import { Hono, type Context } from "hono";
import { z } from "zod";
import OpenCC from "opencc-js/t2cn";
import { createAuth, type AppBindings } from "./auth";

type Principal = { id: string; email: string; name: string } | null;
type AppEnv = { Bindings: AppBindings; Variables: { principal: Principal; requestId: string } };
type LessonActivityRow = { id: string; activityKind: string; title: string; objective: string; instructions: string; ordinal: number; state: "not_started" | "in_progress" | "completed"; currentItemOrdinal: number; correctCount: number };
const app = new Hono<AppEnv>();
const simplifyTraditionalCharacter = OpenCC.Converter({ from: "t", to: "cn" });

const jsonError = (code: string, message: string, status: 400 | 401 | 403 | 404 | 409 | 429 | 500 = 400) =>
  Response.json({ error: { code, message } }, { status });

async function readVerifiedMedia(c: Context<AppEnv>, key: string, expectedSha256: string): Promise<ArrayBuffer | null> {
  if (!/^[a-z0-9/_-]+\.(?:json|ogg|mp3)$/i.test(key) || key.includes("..")) return null;
  let bytes: ArrayBuffer | null = null;
  if (c.env.MEDIA) {
    const object = await c.env.MEDIA.get(key);
    if (object) {
      if (object.customMetadata?.sha256 && object.customMetadata.sha256 !== expectedSha256) return null;
      bytes = await object.arrayBuffer();
    }
  }
  if (!bytes) {
    const assetUrl = new URL(`/${key}`, c.req.url);
    const response = await c.env.ASSETS.fetch(new Request(assetUrl));
    if (!response.ok) return null;
    bytes = await response.arrayBuffer();
  }
  const actual = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (actual !== expectedSha256.toLowerCase()) {
    console.error(JSON.stringify({ category: "media_checksum_mismatch", key, expected: expectedSha256.toLowerCase(), actual, byteLength: bytes.byteLength }));
    return null;
  }
  return bytes;
}

const idSchema = z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/);
const isoDateSchema = z.string().datetime({ offset: true });
const dimensionsSchema = z.object({
  meaningRecall: z.enum(["correct", "needs_practice", "uncertain"]).optional(),
  selfAssessment: z.enum(["confident", "repeat", "unsure"]).optional(),
  characterIdentity: z.enum(["recognized", "uncertain", "not_recognized"]).optional(),
  strokeOrder: z.enum(["correct", "needs_practice", "uncertain"]).optional(),
  strokeDirection: z.enum(["correct", "needs_practice", "uncertain"]).optional(),
  shape: z.enum(["close_enough", "needs_practice", "uncertain"]).optional(),
}).strict();
const attemptSchema = z.object({
  idempotencyKey: z.string().uuid(),
  contentType: z.enum(["vocabulary", "character"]),
  contentId: idSchema,
  readingId: idSchema.optional(),
  curriculumPlacementId: idSchema.optional(),
  activityId: idSchema.optional(),
  skill: z.enum(["listening","speaking","reading","writing","grammar","vocabulary","comprehension"]).optional(),
  activityMode: z.enum(["listen", "record_compare", "meaning", "guided_writing", "freehand_writing"]),
  dimensions: dimensionsSchema,
  engineVersion: z.string().max(120).optional(),
  createdAtClient: isoDateSchema,
}).strict();

function parseBody<T extends z.ZodType>(schema: T, raw: unknown): z.infer<T> | null {
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

async function addAudit(
  db: D1Database,
  requestId: string,
  actorId: string | null,
  action: string,
  subjectType: string | null,
  subjectId: string | null,
  outcome: "success" | "denied" | "failure" = "success",
  metadata: Record<string, unknown> = {},
) {
  await db.prepare(
    "INSERT INTO audit_events (id, actor_user_id, action, subject_type, subject_id, outcome, request_id, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(crypto.randomUUID(), actorId, action, subjectType, subjectId, outcome, requestId, JSON.stringify(metadata)).run();
}

async function requirePrincipal(c: Context<AppEnv>): Promise<Principal> {
  return c.get("principal");
}

async function requireRole(c: Context<AppEnv>, roles: string[]) {
  const principal = await requirePrincipal(c);
  if (!principal) return { principal: null, role: null };
  const row = await c.env.DB.prepare(
    `SELECT role FROM account_roles WHERE user_id = ? AND role IN (${roles.map(() => "?").join(",")}) LIMIT 1`,
  ).bind(principal.id, ...roles).first<{ role: string }>();
  return { principal, role: row?.role ?? null };
}

async function rateLimitRecovery(db: D1Database, request: Request, action: string) {
  const forwarded = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${action}:${forwarded}`));
  const bucketHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const now = Math.floor(Date.now() / 1000);
  const row = await db.prepare("SELECT window_started_at, failure_count FROM auth_attempt_limits WHERE bucket_hash = ? AND action = ?")
    .bind(bucketHash, action).first<{ window_started_at: number; failure_count: number }>();
  if (row && now - row.window_started_at < 3600 && row.failure_count >= 5) return false;
  await db.prepare(`INSERT INTO auth_attempt_limits(bucket_hash, action, window_started_at, failure_count)
    VALUES (?, ?, ?, 1) ON CONFLICT(bucket_hash, action) DO UPDATE SET
    window_started_at = CASE WHEN ? - window_started_at >= 3600 THEN ? ELSE window_started_at END,
    failure_count = CASE WHEN ? - window_started_at >= 3600 THEN 1 ELSE failure_count + 1 END`)
    .bind(bucketHash, action, now, now, now, now).run();
  return true;
}

app.use("/api/*", async (c, next) => {
  c.set("requestId", c.req.header("cf-ray") ?? crypto.randomUUID());
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(self), geolocation=()");
  await next();
});

app.use("/api/auth/*", async (c, next) => {
  const origin = c.req.header("origin");
  const expected = c.env.APP_URL ? new URL(c.env.APP_URL).origin : new URL(c.req.url).origin;
  if (origin && origin !== expected) return jsonError("origin_not_allowed", "Permintaan tidak diizinkan.", 403);
  return next();
});

app.on(["GET", "POST"], "/api/auth/*", (c) => createAuth(c.env).handler(c.req.raw));

app.use("/api/v1/*", async (c, next) => {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  c.set("principal", session?.user ? {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  } : null);
  await next();
});

app.get("/api/v1/health", (c) => c.json({ ok: true, apiVersion: "v1", serverTime: new Date().toISOString() }));

app.post("/api/v1/admin/bootstrap", async (c) => {
  const secret = c.env.BOOTSTRAP_ADMIN_SECRET;
  if (!secret || c.req.header("x-bootstrap-secret") !== secret) return jsonError("not_authorized", "Bootstrap tidak diizinkan.", 403);
  const existing = await c.env.DB.prepare("SELECT 1 AS found FROM account_roles WHERE role = 'owner_admin' LIMIT 1").first();
  if (existing) return jsonError("already_bootstrapped", "Administrator utama sudah diinisialisasi.", 409);
  const body = parseBody(z.object({ email: z.string().email().max(254) }), await c.req.json().catch(() => null));
  if (!body) return jsonError("invalid_request", "Alamat email tidak valid.");
  const user = await c.env.DB.prepare("SELECT id FROM user WHERE email = ? COLLATE NOCASE").bind(body.email.trim()).first<{ id: string }>();
  if (!user) return jsonError("user_not_found", "Buat akun terlebih dahulu lalu ulangi bootstrap.", 404);
  await c.env.DB.prepare("INSERT INTO account_roles(user_id, role) VALUES (?, 'owner_admin')").bind(user.id).run();
  await addAudit(c.env.DB, c.get("requestId"), user.id, "admin.bootstrap", "user", user.id, "success");
  return c.json({ ok: true, message: "Administrator utama siap. Segera hapus BOOTSTRAP_ADMIN_SECRET." });
});

app.get("/api/v1/me", async (c) => {
  const principal = await requirePrincipal(c);
  if (!principal) return jsonError("unauthenticated", "Silakan masuk terlebih dahulu.", 401);
  await c.env.DB.prepare("INSERT OR IGNORE INTO learner_profiles(user_id, display_name) VALUES (?, ?)").bind(principal.id, principal.name).run();
  const profile = await c.env.DB.prepare(`SELECT p.display_name, p.locale, p.timezone, p.daily_goal_minutes,
    p.active_curriculum_id, u.email FROM learner_profiles p JOIN user u ON u.id = p.user_id WHERE p.user_id = ?`)
    .bind(principal.id).first();
  const roles = await c.env.DB.prepare("SELECT role FROM account_roles WHERE user_id = ? ORDER BY role").bind(principal.id).all<{ role: string }>();
  return c.json({ profile, roles: roles.results.map((row) => row.role) });
});

app.patch("/api/v1/profile", async (c) => {
  const principal = await requirePrincipal(c);
  if (!principal) return jsonError("unauthenticated", "Silakan masuk terlebih dahulu.", 401);
  const body = parseBody(z.object({ displayName: z.string().trim().min(1).max(80).optional(), locale: z.enum(["id", "en"]).optional(), timezone: z.string().max(80).optional(), dailyGoalMinutes: z.number().int().min(1).max(180).optional(), activeCurriculumId: idSchema.nullable().optional() }).strict(), await c.req.json().catch(() => null));
  if (!body || Object.keys(body).length === 0) return jsonError("invalid_request", "Pengaturan tidak valid.");
  await c.env.DB.prepare(`UPDATE learner_profiles SET
    display_name = COALESCE(?, display_name), locale = COALESCE(?, locale), timezone = COALESCE(?, timezone),
    daily_goal_minutes = COALESCE(?, daily_goal_minutes), active_curriculum_id = CASE WHEN ? THEN ? ELSE active_curriculum_id END,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id = ?`)
    .bind(body.displayName ?? null, body.locale ?? null, body.timezone ?? null, body.dailyGoalMinutes ?? null,
      body.activeCurriculumId !== undefined ? 1 : 0, body.activeCurriculumId ?? null, principal.id).run();
  return c.json({ ok: true });
});

app.get("/api/v1/paths", async (c) => {
  const paths = await c.env.DB.prepare("SELECT id, slug, name, locale, curriculum_kind AS kind, version, description FROM curricula WHERE status = 'published' ORDER BY curriculum_kind, name").all();
  return c.json({ paths: paths.results });
});

app.get("/api/v1/placement/questions", async (c) => {
  const principal = await requirePrincipal(c);
  if (!principal) return jsonError("unauthenticated", "Silakan masuk terlebih dahulu.", 401);
  const questions = await c.env.DB.prepare(`SELECT q.id, q.ordinal, q.prompt, q.pinyin, q.options_json AS optionsJson,
    COALESCE(
      (SELECT a.id FROM vocabulary_entries v JOIN readings r ON r.vocabulary_id = v.id AND r.status = 'approved'
        JOIN audio_assets a ON a.reading_id = r.id AND a.status = 'approved'
          AND (a.pronunciation_review = 'passed' OR a.source_attested_at IS NOT NULL)
        WHERE v.simplified_form = q.prompt AND v.status = 'approved' ORDER BY a.pronunciation_review = 'passed' DESC, a.id LIMIT 1),
      (SELECT a.id FROM characters ch JOIN readings r ON r.character_id = ch.id AND r.status = 'approved'
        JOIN audio_assets a ON a.reading_id = r.id AND a.status = 'approved'
          AND (a.pronunciation_review = 'passed' OR a.source_attested_at IS NOT NULL)
        WHERE ch.hanzi = q.prompt AND ch.status = 'approved' ORDER BY a.pronunciation_review = 'passed' DESC, a.id LIMIT 1)
    ) AS audioId
    FROM placement_questions q WHERE q.status = 'published' ORDER BY q.ordinal`).all();
  return c.json({ version: "starting-point-v1", questions: questions.results.map((row) => ({
    ...row, options: JSON.parse(String(row.optionsJson)),
  })) });
});

app.post("/api/v1/placement/submit", async (c) => {
  const principal = await requirePrincipal(c);
  if (!principal) return jsonError("unauthenticated", "Silakan masuk terlebih dahulu.", 401);
  const body = parseBody(z.object({
    assessmentVersion: z.string().min(1).max(40),
    answers: z.array(z.object({ questionId: idSchema, selectedOption: z.number().int().min(0).max(20) }).strict()).min(1).max(6)
      .refine((answers) => new Set(answers.map((answer) => answer.questionId)).size === answers.length),
  }).strict(), await c.req.json().catch(() => null));
  if (!body || body.assessmentVersion !== "starting-point-v1") return jsonError("invalid_placement", "Hasil penilaian tidak valid.");
  const questionRows = await c.env.DB.prepare(`SELECT id, options_json AS optionsJson, correct_option AS correctOption
    FROM placement_questions WHERE status = 'published'`).all<{ id: string; optionsJson: string; correctOption: number }>();
  const questionMap = new Map(questionRows.results.map((question) => [question.id, question]));
  if (body.answers.some((answer) => !questionMap.has(answer.questionId)
    || answer.selectedOption >= JSON.parse(questionMap.get(answer.questionId)!.optionsJson).length)) {
    return jsonError("invalid_placement_answer", "Ada jawaban yang tidak sesuai dengan soal.");
  }
  const correct = body.answers.filter((answer) => answer.selectedOption === questionMap.get(answer.questionId)!.correctOption).length;
  const recommendation = correct <= 2 ? "foundation" : correct <= 4 ? "elementary" : "developing";
  const explanations = {
    foundation: "Mulai dari sapaan, pinyin, nada, dan kalimat sederhana. Kamu bisa mengulang penilaian nanti.",
    elementary: "Kamu mengenali sebagian pola dasar. Mulailah dari kursus keseharian lalu lanjutkan ke materi dasar berikutnya.",
    developing: "Kamu menjawab sebagian besar soal dengan benar. Cobalah topik keseharian yang lebih panjang dan materi tingkat lanjut secara bertahap.",
  } as const;
  const sessionId = crypto.randomUUID();
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO placement_sessions(id,user_id,assessment_version,answered_count,correct_count,recommendation,explanation)
      VALUES (?,?,?,?,?,?,?)`).bind(sessionId, principal.id, body.assessmentVersion, body.answers.length, correct, recommendation, explanations[recommendation]),
    ...body.answers.map((answer) => c.env.DB.prepare(`INSERT INTO placement_responses(session_id,question_id,selected_option,is_correct)
      VALUES (?,?,?,?)`).bind(sessionId, answer.questionId, answer.selectedOption,
        answer.selectedOption === questionMap.get(answer.questionId)!.correctOption ? 1 : 0)),
  ]);
  return c.json({ sessionId, answered: body.answers.length, correct, recommendation, explanation: explanations[recommendation], isOfficialHskResult: false });
});

app.get("/api/v1/discover", async (c) => {
  const query = (c.req.query("q") ?? "").trim().slice(0, 60);
  const requestedKind = c.req.query("kind") ?? "";
  const collection = c.req.query("collection") ?? "words";
  if (requestedKind && requestedKind !== "daily_life" && requestedKind !== "hsk") return jsonError("invalid_filter", "Filter materi tidak valid.");
  if (!["words", "grammar", "dialogue", "story"].includes(collection)) return jsonError("invalid_collection", "Jenis materi tidak valid.");
  if (collection !== "words") {
    const pattern = `%${query}%`;
    const search = collection === "grammar"
      ? c.env.DB.prepare(`SELECT gp.id, 'grammar' AS type, gp.title, gp.pattern AS subtitle,
          gp.explanation AS preview, u.id AS unitId, u.title AS unitTitle
          FROM grammar_points gp JOIN curriculum_activity_items cai ON cai.grammar_point_id = gp.id
          JOIN curriculum_activities ca ON ca.id = cai.activity_id JOIN curriculum_units u ON u.id = ca.unit_id
          JOIN curricula cr ON cr.id = u.curriculum_id
          WHERE gp.status = 'approved' AND ca.status = 'published' AND u.status = 'published' AND cr.status = 'published'
            AND (? = '' OR gp.title LIKE ? OR gp.pattern LIKE ? OR gp.explanation LIKE ?)
            AND (? = '' OR cr.curriculum_kind = ?)
          ORDER BY gp.title LIMIT 60`).bind(query, pattern, pattern, pattern, requestedKind, requestedKind)
      : collection === "dialogue"
        ? c.env.DB.prepare(`SELECT d.id, 'dialogue' AS type, d.title, d.objective AS subtitle,
            (SELECT dt.simplified_text FROM dialogue_turns dt WHERE dt.dialogue_id = d.id AND dt.status = 'approved' ORDER BY dt.ordinal LIMIT 1) AS preview,
            u.id AS unitId, u.title AS unitTitle
            FROM dialogues d JOIN curriculum_units u ON u.id = d.unit_id JOIN curricula cr ON cr.id = u.curriculum_id
            WHERE d.status = 'approved' AND u.status = 'published' AND cr.status = 'published'
              AND (? = '' OR d.title LIKE ? OR d.objective LIKE ? OR EXISTS (SELECT 1 FROM dialogue_turns dt WHERE dt.dialogue_id = d.id AND dt.status = 'approved' AND dt.simplified_text LIKE ?))
              AND (? = '' OR cr.curriculum_kind = ?)
            ORDER BY d.title LIMIT 60`).bind(query, pattern, pattern, pattern, requestedKind, requestedKind)
        : c.env.DB.prepare(`SELECT s.id, 'story' AS type, s.title, s.objective AS subtitle,
            (SELECT sp.simplified_text FROM story_paragraphs sp WHERE sp.story_id = s.id AND sp.status = 'approved' ORDER BY sp.ordinal LIMIT 1) AS preview,
            u.id AS unitId, u.title AS unitTitle
            FROM stories s JOIN curriculum_units u ON u.id = s.unit_id JOIN curricula cr ON cr.id = u.curriculum_id
            WHERE s.status = 'approved' AND u.status = 'published' AND cr.status = 'published'
              AND (? = '' OR s.title LIKE ? OR s.objective LIKE ? OR EXISTS (SELECT 1 FROM story_paragraphs sp WHERE sp.story_id = s.id AND sp.status = 'approved' AND sp.simplified_text LIKE ?))
              AND (? = '' OR cr.curriculum_kind = ?)
            ORDER BY s.title LIMIT 60`).bind(query, pattern, pattern, pattern, requestedKind, requestedKind);
    const result = await search.all();
    return c.json({ collection, collections: result.results });
  }
  const pattern = `%${query}%`;
  const rows = await c.env.DB.prepare(`WITH eligible AS (
    SELECT v.id, v.simplified_form,
      (SELECT cp.id FROM curriculum_placements cp JOIN curriculum_units u ON u.id = cp.unit_id
        JOIN curricula c ON c.id = u.curriculum_id WHERE cp.vocabulary_id = v.id
          AND u.status = 'published' AND c.status = 'published'
        ORDER BY CASE WHEN c.curriculum_kind = 'daily_life' THEN 0 ELSE 1 END, c.id, u.ordinal LIMIT 1) AS placement_id,
      (SELECT r.id FROM readings r WHERE r.vocabulary_id = v.id AND r.status = 'approved'
        ORDER BY CASE WHEN EXISTS (SELECT 1 FROM audio_assets a WHERE a.reading_id = r.id AND a.status = 'approved'
          AND (a.pronunciation_review = 'passed' OR a.source_attested_at IS NOT NULL)) THEN 0 ELSE 1 END, r.id LIMIT 1) AS reading_id
    FROM vocabulary_entries v
    WHERE v.status = 'approved' AND EXISTS (
      SELECT 1 FROM curriculum_placements cp JOIN curriculum_units u ON u.id = cp.unit_id
      JOIN curricula c ON c.id = u.curriculum_id
      WHERE cp.vocabulary_id = v.id AND u.status = 'published' AND c.status = 'published'))
    SELECT v.id, v.simplified_form AS simplifiedForm, v.placement_id AS placementId, r.id AS readingId,
      (SELECT g.text FROM vocabulary_glosses vg JOIN glosses g ON g.id = vg.gloss_id
        WHERE vg.vocabulary_id = v.id AND g.status = 'approved' AND g.locale = 'id' ORDER BY g.id LIMIT 1) AS meaning,
      r.pinyin_json AS pinyinJson,
      (SELECT a.id FROM audio_assets a WHERE a.reading_id = r.id AND a.status = 'approved'
        AND (a.pronunciation_review = 'passed' OR a.source_attested_at IS NOT NULL)
        ORDER BY CASE WHEN a.pronunciation_review = 'passed' THEN 0 ELSE 1 END, a.id LIMIT 1) AS audioId
    FROM eligible v LEFT JOIN readings r ON r.id = v.reading_id
    WHERE (? = '' OR v.simplified_form LIKE ? OR EXISTS (
        SELECT 1 FROM readings rp WHERE rp.vocabulary_id = v.id AND rp.status = 'approved'
          AND (rp.numbered_pinyin LIKE ? OR rp.pinyin_json LIKE ?)) OR EXISTS (
        SELECT 1 FROM vocabulary_glosses vg JOIN glosses g ON g.id = vg.gloss_id
        WHERE vg.vocabulary_id = v.id AND g.status = 'approved' AND g.locale = 'id' AND g.text LIKE ?))
      AND (? = '' OR EXISTS (SELECT 1 FROM curriculum_placements cp JOIN curriculum_units u ON u.id = cp.unit_id
        JOIN curricula c ON c.id = u.curriculum_id WHERE cp.vocabulary_id = v.id
          AND u.status = 'published' AND c.status = 'published' AND c.curriculum_kind = ?))
    ORDER BY CASE WHEN v.simplified_form = ? THEN 0 ELSE 1 END, v.simplified_form LIMIT 60`)
    .bind(query, pattern, pattern, pattern, pattern, requestedKind, requestedKind, query).all();
  return c.json({ query, kind: requestedKind || "all", items: rows.results });
});

app.get("/api/v1/continue", async (c) => {
  const principal = await requirePrincipal(c);
  if (!principal) return jsonError("unauthenticated", "Silakan masuk terlebih dahulu.", 401);
  const inProgress = await c.env.DB.prepare(`SELECT u.id AS unitId, u.title AS unitTitle, c.name AS curriculumName,
      a.id AS activityId, a.ordinal AS activityOrdinal, p.current_item_ordinal AS currentItemOrdinal
    FROM learner_activity_progress p JOIN curriculum_activities a ON a.id = p.activity_id
    JOIN curriculum_units u ON u.id = a.unit_id JOIN curricula c ON c.id = u.curriculum_id
    WHERE p.user_id = ? AND p.state = 'in_progress' AND a.status = 'published' AND u.status = 'published' AND c.status = 'published'
    ORDER BY p.updated_at DESC LIMIT 1`).bind(principal.id).first();
  const recent = inProgress ? null : await c.env.DB.prepare(`SELECT u.id AS unitId, u.title AS unitTitle, c.name AS curriculumName
    FROM learning_attempts a JOIN curriculum_placements cp ON cp.id = a.placement_id
    JOIN curriculum_units u ON u.id = cp.unit_id JOIN curricula c ON c.id = u.curriculum_id
    WHERE a.user_id = ? AND u.status = 'published' AND c.status = 'published'
    ORDER BY a.accepted_at DESC LIMIT 1`).bind(principal.id).first();
  const first = inProgress || recent ? null : await c.env.DB.prepare(`SELECT u.id AS unitId, u.title AS unitTitle, c.name AS curriculumName
    FROM curriculum_units u JOIN curricula c ON c.id = u.curriculum_id
    WHERE c.status = 'published' AND u.status = 'published' AND c.curriculum_kind = 'daily_life'
      AND EXISTS (SELECT 1 FROM curriculum_placements cp WHERE cp.unit_id = u.id)
    ORDER BY u.ordinal LIMIT 1`).first();
  return c.json({ destination: inProgress ?? recent ?? first ?? null, resumeMode: inProgress ? "saved_activity" : recent ? "last_practised_unit" : first ? "first_available_unit" : "no_published_units" });
});

app.get("/api/v1/paths/:pathId/units", async (c) => {
  const pathId = c.req.param("pathId");
  const rows = await c.env.DB.prepare(`SELECT u.id, u.slug, u.title, u.description, u.ordinal, u.level_number,
    (SELECT COUNT(*) FROM curriculum_placements p WHERE p.unit_id = u.id) AS placement_count
    FROM curriculum_units u JOIN curricula c ON c.id = u.curriculum_id
    WHERE c.id = ? AND c.status = 'published' AND u.status = 'published' ORDER BY u.ordinal`)
    .bind(pathId).all();
  return c.json({ units: rows.results });
});

app.get("/api/v1/units/:unitId", async (c) => {
  const unitId = c.req.param("unitId");
  const principal = await requirePrincipal(c);
  const unit = await c.env.DB.prepare(`SELECT u.id, u.title, u.description, u.ordinal, c.name AS curriculum_name
    FROM curriculum_units u JOIN curricula c ON c.id = u.curriculum_id
    WHERE u.id = ? AND u.status = 'published' AND c.status = 'published'`).bind(unitId).first();
  if (!unit) return jsonError("not_found", "Pelajaran belum tersedia.", 404);
  const [rows, activities, writingProgress, grammar, dialogueTurns, storyParagraphs] = await Promise.all([c.env.DB.prepare(`SELECT p.id AS placement_id, p.ordinal,
    v.id AS vocabulary_id, v.simplified_form, ch.id AS character_id, ch.hanzi, ch.stroke_count, ch.stroke_data_status AS stroke_data_status,
    r.id AS reading_id, r.pinyin_json, r.numbered_pinyin,
    (SELECT e.simplified_text FROM examples e WHERE e.vocabulary_id = v.id AND e.status = 'approved' AND e.locale = 'id' ORDER BY e.id LIMIT 1) AS example_text,
    (SELECT e.numbered_pinyin FROM examples e WHERE e.vocabulary_id = v.id AND e.status = 'approved' AND e.locale = 'id' ORDER BY e.id LIMIT 1) AS example_pinyin,
    (SELECT e.translation FROM examples e WHERE e.vocabulary_id = v.id AND e.status = 'approved' AND e.locale = 'id' ORDER BY e.id LIMIT 1) AS example_translation,
    (SELECT a.id FROM examples e JOIN example_audio_links l ON l.example_id = e.id AND l.role = 'primary'
      JOIN content_audio_assets a ON a.id = l.asset_id JOIN asset_sources s ON s.id = a.source_id
      WHERE e.vocabulary_id = v.id AND e.status = 'approved' AND e.locale = 'id' AND a.status = 'approved'
        AND (a.pronunciation_review = 'passed' OR a.source_attested_at IS NOT NULL) AND s.license_verification = 'verified'
      ORDER BY l.ordinal, a.id LIMIT 1) AS example_audio_id,
    g.text AS gloss, g.usage_label, a.id AS audio_id, a.duration_ms
    FROM curriculum_placements p
    LEFT JOIN vocabulary_entries v ON v.id = p.vocabulary_id AND v.status = 'approved'
    LEFT JOIN characters ch ON ch.id = p.character_id AND ch.status = 'approved'
    LEFT JOIN readings r ON r.id = (SELECT r2.id FROM readings r2
      WHERE (r2.vocabulary_id = v.id OR r2.character_id = ch.id) AND r2.status = 'approved'
      ORDER BY CASE WHEN EXISTS (SELECT 1 FROM audio_assets a2 WHERE a2.reading_id = r2.id AND a2.status = 'approved'
        AND (a2.pronunciation_review = 'passed' OR a2.source_attested_at IS NOT NULL)) THEN 0 ELSE 1 END, r2.id LIMIT 1)
    LEFT JOIN vocabulary_glosses vg ON vg.vocabulary_id = v.id
    LEFT JOIN character_glosses cg ON cg.character_id = ch.id
    LEFT JOIN glosses g ON g.id = COALESCE(vg.gloss_id, cg.gloss_id) AND g.status = 'approved' AND g.locale = 'id'
    LEFT JOIN audio_assets a ON a.reading_id = r.id AND a.status = 'approved' AND (a.pronunciation_review = 'passed' OR a.source_attested_at IS NOT NULL)
    WHERE p.unit_id = ? ORDER BY p.ordinal`)
    .bind(unitId).all(),
    c.env.DB.prepare(`SELECT a.id, a.activity_kind AS activityKind, a.title, a.objective, a.instructions,
      a.ordinal, COALESCE(lp.state, 'not_started') AS state, COALESCE(lp.current_item_ordinal, 0) AS currentItemOrdinal,
      COALESCE(lp.correct_count, 0) AS correctCount
      FROM curriculum_activities a LEFT JOIN learner_activity_progress lp ON lp.activity_id = a.id AND lp.user_id = ?
      WHERE a.unit_id = ? AND a.status = 'published' ORDER BY a.ordinal`).bind(principal?.id ?? '', unitId).all<LessonActivityRow>(),
    c.env.DB.prepare(`SELECT p.activity_id AS activityId, p.character_id AS characterId
      FROM learner_activity_character_progress p JOIN curriculum_activities a ON a.id = p.activity_id
      WHERE p.user_id = ? AND a.unit_id = ? AND a.status = 'published'`).bind(principal?.id ?? '', unitId).all(),
    c.env.DB.prepare(`SELECT gp.id, gp.title, gp.pattern, gp.explanation, gp.usage_notes AS usageNotes
      FROM curriculum_activities ca JOIN curriculum_activity_items cai ON cai.activity_id = ca.id
      JOIN grammar_points gp ON gp.id = cai.grammar_point_id
      WHERE ca.unit_id = ? AND ca.status = 'published' AND gp.status = 'approved'
      ORDER BY ca.ordinal, cai.ordinal`).bind(unitId).all(),
    c.env.DB.prepare(`SELECT dt.id, dt.speaker_role AS speakerRole, dt.speaker_label AS speakerLabel,
      dt.simplified_text AS simplifiedText, dt.pinyin_json AS pinyinJson, dt.translation, d.title AS dialogueTitle,
      (SELECT a.id FROM dialogue_turn_audio_links l JOIN content_audio_assets a ON a.id = l.asset_id
        JOIN asset_sources s ON s.id = a.source_id WHERE l.dialogue_turn_id = dt.id AND l.role = 'primary'
          AND a.status = 'approved' AND (a.pronunciation_review = 'passed' OR a.source_attested_at IS NOT NULL)
          AND s.license_verification = 'verified' ORDER BY l.ordinal, a.id LIMIT 1) AS audioId
      FROM dialogues d JOIN dialogue_turns dt ON dt.dialogue_id = d.id
      WHERE d.unit_id = ? AND d.status = 'approved' AND dt.status = 'approved'
      ORDER BY d.id, dt.ordinal`).bind(unitId).all(),
    c.env.DB.prepare(`SELECT sp.id, sp.simplified_text AS simplifiedText, sp.pinyin_json AS pinyinJson,
      sp.translation, s.title AS storyTitle,
      (SELECT a.id FROM story_paragraph_audio_links l JOIN content_audio_assets a ON a.id = l.asset_id
        JOIN asset_sources src ON src.id = a.source_id WHERE l.story_paragraph_id = sp.id AND l.role = 'primary'
          AND a.status = 'approved' AND (a.pronunciation_review = 'passed' OR a.source_attested_at IS NOT NULL)
          AND src.license_verification = 'verified' ORDER BY l.ordinal, a.id LIMIT 1) AS audioId
      FROM stories s JOIN story_paragraphs sp ON sp.story_id = s.id
      WHERE s.unit_id = ? AND s.status = 'approved' AND sp.status = 'approved'
      ORDER BY s.id, sp.ordinal`).bind(unitId).all(),
  ]);
  const completedCharactersByActivity = new Map<string, string[]>();
  for (const progress of writingProgress.results as Array<{ activityId: string; characterId: string }>) {
    completedCharactersByActivity.set(progress.activityId, [...(completedCharactersByActivity.get(progress.activityId) ?? []), progress.characterId]);
  }
  return c.json({ unit, items: rows.results, activities: activities.results.map((activity) => ({
    ...activity, completedCharacterIds: completedCharactersByActivity.get(activity.id) ?? [],
  })),
    grammar: grammar.results, dialogueTurns: dialogueTurns.results, storyParagraphs: storyParagraphs.results });
});

app.post("/api/v1/activities/:activityId/progress", async (c) => {
  const principal = await requirePrincipal(c);
  if (!principal) return jsonError("unauthenticated", "Silakan masuk terlebih dahulu.", 401);
  const activityId = c.req.param("activityId");
  const body = parseBody(z.object({ state: z.enum(["in_progress","completed"]), currentItemOrdinal: z.number().int().min(0).max(500), correctCount: z.number().int().min(0).max(500).optional() }).strict(), await c.req.json().catch(() => null));
  if (!body) return jsonError("invalid_request", "Kemajuan aktivitas tidak valid.");
  const activity = await c.env.DB.prepare(`SELECT a.id, a.activity_kind AS activityKind, a.unit_id AS unitId,
      (SELECT COUNT(*) FROM curriculum_activity_items i WHERE i.activity_id = a.id) AS itemCount
    FROM curriculum_activities a JOIN curriculum_units u ON u.id = a.unit_id JOIN curricula c ON c.id = u.curriculum_id
    WHERE a.id = ? AND a.status = 'published' AND u.status = 'published' AND c.status = 'published'`)
    .bind(activityId).first<{ id: string; activityKind: string; unitId: string; itemCount: number }>();
  if (!activity) return jsonError("activity_unavailable", "Aktivitas ini belum tersedia.", 404);
  if (activity.itemCount > 0 && body.currentItemOrdinal >= activity.itemCount) return jsonError("invalid_cursor", "Posisi aktivitas sudah melewati materinya.");
  if (body.correctCount !== undefined && activity.itemCount > 0 && body.correctCount > activity.itemCount) return jsonError("invalid_score", "Nilai latihan tidak valid.");
  if (body.state === "completed" && activity.activityKind === "writing") {
    const counts = await c.env.DB.prepare(`SELECT
        (SELECT COUNT(DISTINCT ch.id) FROM curriculum_placements cp
          LEFT JOIN vocabulary_characters vc ON vc.vocabulary_id = cp.vocabulary_id
          JOIN characters ch ON ch.id = COALESCE(cp.character_id, vc.character_id)
          WHERE cp.unit_id = ? AND ch.status = 'approved' AND ch.stroke_data_status = 'approved') AS total,
        (SELECT COUNT(*) FROM learner_activity_character_progress WHERE user_id = ? AND activity_id = ?) AS completed`)
      .bind(activity.unitId, principal.id, activityId).first<{ total: number; completed: number }>();
    if (counts && counts.total > 0 && counts.completed < counts.total) return jsonError("activity_incomplete", "Selesaikan semua karakter yang memiliki data guratan sebelum menutup langkah menulis.", 409);
  }
  await c.env.DB.prepare(`INSERT INTO learner_activity_progress(user_id, activity_id, state, current_item_ordinal, correct_count, started_at, completed_at)
    VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), CASE WHEN ? = 'completed' THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE NULL END)
    ON CONFLICT(user_id, activity_id) DO UPDATE SET
      state = CASE WHEN learner_activity_progress.state = 'completed' THEN 'completed' ELSE excluded.state END,
      current_item_ordinal = CASE WHEN learner_activity_progress.state = 'completed' THEN learner_activity_progress.current_item_ordinal ELSE excluded.current_item_ordinal END,
      correct_count = CASE WHEN learner_activity_progress.state = 'completed' AND excluded.state != 'completed' THEN learner_activity_progress.correct_count ELSE excluded.correct_count END,
      started_at = COALESCE(learner_activity_progress.started_at, excluded.started_at),
      completed_at = CASE WHEN learner_activity_progress.state = 'completed' THEN learner_activity_progress.completed_at WHEN excluded.state = 'completed' THEN excluded.completed_at ELSE NULL END,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`)
    .bind(principal.id, activityId, body.state, body.currentItemOrdinal, body.correctCount ?? 0, body.state).run();
  const saved = await c.env.DB.prepare(`SELECT state, current_item_ordinal AS currentItemOrdinal, correct_count AS correctCount
    FROM learner_activity_progress WHERE user_id = ? AND activity_id = ?`).bind(principal.id, activityId)
    .first<{ state: "in_progress" | "completed"; currentItemOrdinal: number; correctCount: number }>();
  return c.json({ ok: true, activityId, ...saved });
});

app.post("/api/v1/activities/:activityId/characters/:characterId/complete", async (c) => {
  const principal = await requirePrincipal(c);
  if (!principal) return jsonError("unauthenticated", "Silakan masuk terlebih dahulu.", 401);
  const { activityId, characterId } = c.req.param();
  const activity = await c.env.DB.prepare(`SELECT ca.id, ca.unit_id AS unitId
    FROM curriculum_activities ca JOIN curriculum_units u ON u.id = ca.unit_id JOIN curricula cr ON cr.id = u.curriculum_id
    WHERE ca.id = ? AND ca.activity_kind = 'writing' AND ca.status = 'published' AND u.status = 'published' AND cr.status = 'published'
      AND EXISTS (SELECT 1 FROM curriculum_placements cp LEFT JOIN vocabulary_characters vc ON vc.vocabulary_id = cp.vocabulary_id
        WHERE cp.unit_id = ca.unit_id AND (cp.character_id = ? OR vc.character_id = ?))`)
    .bind(activityId, characterId, characterId).first<{ id: string; unitId: string }>();
  const character = await c.env.DB.prepare(`SELECT id FROM characters WHERE id = ? AND status = 'approved' AND stroke_data_status = 'approved'`)
    .bind(characterId).first<{ id: string }>();
  if (!activity || !character) return jsonError("character_unavailable", "这个课程字符暂时没有可用的已审核笔顺。", 404);
  await c.env.DB.prepare(`INSERT INTO learner_activity_character_progress(user_id, activity_id, character_id)
    VALUES (?, ?, ?) ON CONFLICT(user_id, activity_id, character_id) DO NOTHING`)
    .bind(principal.id, activityId, characterId).run();
  const counts = await c.env.DB.prepare(`SELECT
      (SELECT COUNT(DISTINCT ch.id) FROM curriculum_placements cp
        LEFT JOIN vocabulary_characters vc ON vc.vocabulary_id = cp.vocabulary_id
        JOIN characters ch ON ch.id = COALESCE(cp.character_id, vc.character_id)
        WHERE cp.unit_id = ? AND ch.status = 'approved' AND ch.stroke_data_status = 'approved') AS total,
      (SELECT COUNT(*) FROM learner_activity_character_progress WHERE user_id = ? AND activity_id = ?) AS completed`)
    .bind(activity.unitId, principal.id, activityId).first<{ total: number; completed: number }>();
  const complete = Boolean(counts && counts.total > 0 && counts.completed >= counts.total);
  await c.env.DB.prepare(`INSERT INTO learner_activity_progress(user_id, activity_id, state, current_item_ordinal, correct_count, started_at, completed_at)
    VALUES (?, ?, ?, 0, 0, strftime('%Y-%m-%dT%H:%M:%fZ','now'), CASE WHEN ? = 1 THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE NULL END)
    ON CONFLICT(user_id, activity_id) DO UPDATE SET
      state = CASE WHEN learner_activity_progress.state = 'completed' OR excluded.state = 'completed' THEN 'completed' ELSE 'in_progress' END,
      completed_at = CASE WHEN learner_activity_progress.state = 'completed' THEN learner_activity_progress.completed_at WHEN excluded.state = 'completed' THEN excluded.completed_at ELSE NULL END,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`)
    .bind(principal.id, activityId, complete ? 'completed' : 'in_progress', complete ? 1 : 0).run();
  const saved = await c.env.DB.prepare(`SELECT state FROM learner_activity_progress WHERE user_id = ? AND activity_id = ?`)
    .bind(principal.id, activityId).first<{ state: 'in_progress' | 'completed' }>();
  const completedRows = await c.env.DB.prepare(`SELECT character_id AS characterId FROM learner_activity_character_progress
    WHERE user_id = ? AND activity_id = ?`).bind(principal.id, activityId).all<{ characterId: string }>();
  return c.json({ ok: true, activityId, state: saved?.state ?? 'in_progress', completedCount: counts?.completed ?? 0,
    totalCount: counts?.total ?? 0, completedCharacterIds: completedRows.results.map((row) => row.characterId) });
});

app.get("/api/v1/scenario-responses/:activityId", async (c) => {
  const principal = await requirePrincipal(c);
  if (!principal) return jsonError("unauthenticated", "Silakan masuk terlebih dahulu.", 401);
  const activityId = c.req.param("activityId");
  const activity = await c.env.DB.prepare(`SELECT ca.id FROM curriculum_activities ca JOIN curriculum_units u ON u.id = ca.unit_id
    JOIN curricula c ON c.id = u.curriculum_id WHERE ca.id = ? AND ca.activity_kind = 'scenario_output'
    AND ca.status = 'published' AND u.status = 'published' AND c.status = 'published'`)
    .bind(activityId).first();
  if (!activity) return jsonError("activity_unavailable", "Aktivitas ini belum tersedia.", 404);
  const response = await c.env.DB.prepare(`SELECT response_text AS responseText, self_assessment AS selfAssessment,
    created_at AS createdAt, updated_at AS updatedAt FROM scenario_responses WHERE user_id = ? AND activity_id = ?`)
    .bind(principal.id, activityId).first();
  return c.json({ response: response ?? null });
});

app.post("/api/v1/scenario-responses/:activityId", async (c) => {
  const principal = await requirePrincipal(c);
  if (!principal) return jsonError("unauthenticated", "Silakan masuk terlebih dahulu.", 401);
  const activityId = c.req.param("activityId");
  const body = parseBody(z.object({ responseText: z.string().trim().min(1).max(1200), selfAssessment: z.enum(["confident","repeat","unsure"]) }).strict(), await c.req.json().catch(() => null));
  if (!body) return jsonError("invalid_scenario_response", "Tulis jawaban singkat dan pilih penilaian dirimu.");
  const activity = await c.env.DB.prepare(`SELECT id FROM curriculum_activities ca JOIN curriculum_units u ON u.id = ca.unit_id
    JOIN curricula c ON c.id = u.curriculum_id WHERE ca.id = ? AND ca.activity_kind = 'scenario_output'
      AND ca.status = 'published' AND u.status = 'published' AND c.status = 'published'`).bind(activityId).first();
  if (!activity) return jsonError("activity_unavailable", "Aktivitas ini belum tersedia.", 404);
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO scenario_responses(id,user_id,activity_id,response_text,self_assessment)
      VALUES (?,?,?,?,?) ON CONFLICT(user_id,activity_id) DO UPDATE SET response_text=excluded.response_text,
      self_assessment=excluded.self_assessment, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`)
      .bind(crypto.randomUUID(), principal.id, activityId, body.responseText, body.selfAssessment),
    c.env.DB.prepare(`INSERT INTO learner_activity_progress(user_id,activity_id,state,current_item_ordinal,started_at,completed_at)
      VALUES (?,?,'completed',0,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      ON CONFLICT(user_id,activity_id) DO UPDATE SET state='completed',current_item_ordinal=0,
      completed_at=COALESCE(learner_activity_progress.completed_at,excluded.completed_at),
      updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`).bind(principal.id, activityId),
  ]);
  return c.json({ ok: true, activityId, saved: true });
});

app.get("/api/v1/vocabulary/:entryId", async (c) => {
  const entryId = c.req.param("entryId");
  const entry = await c.env.DB.prepare(`SELECT id, simplified_form AS simplifiedForm, part_of_speech AS partOfSpeech
    FROM vocabulary_entries WHERE id = ? AND status = 'approved'`).bind(entryId).first();
  if (!entry) return jsonError("not_found", "Kata belum tersedia.", 404);
  const [readings, senses, examples, characters] = await Promise.all([
    c.env.DB.prepare(`SELECT r.id, r.context_label AS contextText, r.pinyin_json AS pinyin, r.numbered_pinyin AS numberedPinyin,
      a.id AS audioId, a.duration_ms AS durationMs FROM readings r LEFT JOIN audio_assets a ON a.reading_id = r.id AND a.status = 'approved' AND (a.pronunciation_review = 'passed' OR a.source_attested_at IS NOT NULL)
      WHERE r.vocabulary_id = ? AND r.status = 'approved'
      ORDER BY CASE WHEN a.id IS NOT NULL THEN 0 ELSE 1 END, r.id`).bind(entryId).all(),
    c.env.DB.prepare(`SELECT g.id, g.text, g.usage_label AS usageLabel FROM vocabulary_glosses vg JOIN glosses g ON g.id = vg.gloss_id WHERE vg.vocabulary_id = ? AND g.status = 'approved' AND g.locale = 'id'`).bind(entryId).all(),
    c.env.DB.prepare(`SELECT id, simplified_text AS simplifiedText, pinyin_json AS pinyin, numbered_pinyin AS numberedPinyin, translation
      FROM examples WHERE vocabulary_id = ? AND status = 'approved' AND locale = 'id'`).bind(entryId).all(),
    c.env.DB.prepare(`SELECT ch.id, ch.hanzi, ch.stroke_count AS strokeCount, ch.stroke_data_status AS strokeDataStatus FROM vocabulary_characters vc JOIN characters ch ON ch.id = vc.character_id WHERE vc.vocabulary_id = ? AND ch.status = 'approved' ORDER BY vc.position`).bind(entryId).all(),
  ]);
  return c.json({ entry, readings: readings.results, senses: senses.results, examples: examples.results, characters: characters.results });
});

app.get("/api/v1/characters/:characterId", async (c) => {
  const characterId = c.req.param("characterId");
  const character = await c.env.DB.prepare(`SELECT id, hanzi, unicode_code_point AS unicodeCodePoint, stroke_count AS strokeCount,
    radical, stroke_data_source_id AS strokeDataSourceId, stroke_data_storage_key AS strokeDataStorageKey, stroke_data_version AS strokeDataVersion,
    stroke_data_license_id AS strokeDataLicense, stroke_data_checksum AS strokeDataChecksum, stroke_data_status AS strokeDataStatus
    FROM characters WHERE id = ? AND status = 'approved'`).bind(characterId).first();
  if (!character) return jsonError("not_found", "Karakter belum tersedia.", 404);
  const readings = await c.env.DB.prepare(`SELECT r.id, r.context_label AS contextText, r.pinyin_json AS pinyin,
    r.numbered_pinyin AS numberedPinyin, a.id AS audioId, a.duration_ms AS durationMs
    FROM readings r LEFT JOIN audio_assets a ON a.reading_id = r.id AND a.status = 'approved' AND (a.pronunciation_review = 'passed' OR a.source_attested_at IS NOT NULL)
    WHERE r.character_id = ? AND r.status = 'approved'
    ORDER BY CASE WHEN a.id IS NOT NULL THEN 0 ELSE 1 END, r.id`).bind(characterId).all();
  const glosses = await c.env.DB.prepare(`SELECT g.id, g.text, g.usage_label AS usageLabel FROM character_glosses cg JOIN glosses g ON g.id = cg.gloss_id WHERE cg.character_id = ? AND g.status = 'approved' AND g.locale = 'id'`).bind(characterId).all();
  return c.json({ character, readings: readings.results, glosses: glosses.results });
});

app.get("/api/v1/character-lookup", async (c) => {
  const hanzi = c.req.query("hanzi") ?? "";
  const normalized = simplifyTraditionalCharacter(hanzi.trim());
  if ([...normalized].length !== 1 || !/\p{Script=Han}/u.test(normalized)) return c.json({ characterId: null });
  const row = await c.env.DB.prepare("SELECT id FROM characters WHERE hanzi = ? AND status = 'approved'").bind(normalized).first<{ id: string }>();
  return c.json({ characterId: row?.id ?? null, hanzi: normalized });
});

app.post("/api/v1/recognitions/confirm", async (c) => {
  const principal = await requirePrincipal(c);
  if (!principal) return jsonError("unauthenticated", "Silakan masuk terlebih dahulu.", 401);
  const body = parseBody(z.object({ hanzi: z.string().min(1).max(8), candidateRank: z.number().int().min(1).max(8), idempotencyKey: z.string().uuid() }), await c.req.json().catch(() => null));
  if (!body) return jsonError("invalid_request", "Karakter yang dipilih tidak valid.");
  const hanzi = simplifyTraditionalCharacter(body.hanzi.trim());
  if ([...hanzi].length !== 1 || !/\p{Script=Han}/u.test(hanzi)) return jsonError("invalid_character", "Pilih satu aksara Han sederhana.");
  const codepoint = `U+${hanzi.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;
  const approvedCharacter = await c.env.DB.prepare("SELECT id FROM characters WHERE hanzi = ? AND status = 'approved'").bind(hanzi).first<{ id: string }>();
  const progressContentId = approvedCharacter?.id ?? `unicode:${codepoint}`;
  const eventId = crypto.randomUUID();
  const dueAt = new Date(Date.now() + 86400000).toISOString();
  const statements = [
    c.env.DB.prepare(`INSERT OR IGNORE INTO freehand_recognition_events(id, user_id, idempotency_key, hanzi, unicode_code_point, engine_id, engine_version, candidate_rank)
      VALUES (?, ?, ?, ?, ?, 'hanzi-lookup-wasm', '1.0.0-upstream', ?)`)
      .bind(eventId, principal.id, body.idempotencyKey, hanzi, codepoint, body.candidateRank),
    c.env.DB.prepare(`INSERT INTO learner_progress(user_id, content_type, content_id, attempts_count, correct_count, last_seen_at, dimension_summary_json)
    SELECT ?, 'character', ?, 1, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), '{"characterIdentity":"recognized"}'
    WHERE EXISTS (SELECT 1 FROM freehand_recognition_events WHERE id = ?)
    ON CONFLICT(user_id, content_type, content_id) DO UPDATE SET attempts_count = attempts_count + 1,
    correct_count = correct_count + 1, last_seen_at = excluded.last_seen_at,
    dimension_summary_json = excluded.dimension_summary_json, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`)
      .bind(principal.id, progressContentId, eventId),
  ];
  if (approvedCharacter) {
    statements.push(c.env.DB.prepare(`INSERT INTO review_schedules(user_id, content_type, content_id, interval_days, repetition, due_at)
      SELECT ?, 'character', ?, 1, 1, ? WHERE EXISTS (SELECT 1 FROM freehand_recognition_events WHERE id = ?)
      ON CONFLICT(user_id, content_type, content_id) DO UPDATE SET
      interval_days = MIN(365, MAX(1, interval_days * ease_factor)), repetition = repetition + 1,
      due_at = excluded.due_at, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`)
      .bind(principal.id, approvedCharacter.id, dueAt, eventId));
  }
  statements.push(c.env.DB.prepare(`INSERT INTO audit_events(id, actor_user_id, action, subject_type, subject_id, outcome, request_id, metadata_json)
    SELECT ?, ?, 'learning.freehand.confirm', 'freehand_recognition', ?, 'success', ?, ?
    WHERE EXISTS (SELECT 1 FROM freehand_recognition_events WHERE id = ?)`)
    .bind(crypto.randomUUID(), principal.id, eventId, c.get("requestId"), JSON.stringify({ hanzi, candidateRank: body.candidateRank }), eventId));
  const [inserted] = await c.env.DB.batch(statements);
  const duplicate = (inserted.meta.changes ?? 0) === 0;
  const persisted = await c.env.DB.prepare("SELECT id, hanzi, occurred_at FROM freehand_recognition_events WHERE user_id = ? AND idempotency_key = ?")
    .bind(principal.id, body.idempotencyKey).first<{ id: string; hanzi: string; occurred_at: string }>();
  if (!persisted) return jsonError("sync_failed", "Hasil pengenalan belum tersimpan. Coba sinkronkan lagi.", 500);
  return c.json({ ok: true, hanzi: persisted.hanzi, characterId: approvedCharacter?.id ?? null, eventId: persisted.id, acceptedAt: persisted.occurred_at, duplicate });
});

app.get("/api/v1/strokes/:characterId", async (c) => {
  const row = await c.env.DB.prepare(`SELECT stroke_data_storage_key AS storageKey, stroke_data_checksum AS checksum
    FROM characters WHERE id = ? AND status = 'approved' AND stroke_data_status = 'approved'`)
    .bind(c.req.param("characterId")).first<{ storageKey: string | null; checksum: string | null }>();
  if (!row?.storageKey || !row.checksum) return jsonError("stroke_data_unavailable", "Urutan guratan berlisensi belum tersedia.", 404);
  const bytes = await readVerifiedMedia(c, row.storageKey, row.checksum);
  if (!bytes) return jsonError("stroke_data_unavailable", "Checksum data guratan tidak cocok.", 404);
  return new Response(bytes, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=86400", ETag: `"${row.checksum}"`, "X-Content-Type-Options": "nosniff" } });
});

app.get("/api/v1/audio/:assetId", async (c) => {
  const sentenceAsset = await c.env.DB.prepare(`SELECT a.storage_key, a.format, a.sha256, a.status,
      a.pronunciation_review, a.source_attested_at, s.license_verification
    FROM content_audio_assets a JOIN asset_sources s ON s.id = a.source_id WHERE a.id = ?`)
    .bind(c.req.param("assetId")).first<{ storage_key: string; format: string; sha256: string; status: string; pronunciation_review: string; source_attested_at: string | null; license_verification: string }>();
  if (sentenceAsset) {
    if (sentenceAsset.status === "rejected" || sentenceAsset.status === "retired") return jsonError("audio_unavailable", "Rekaman ini tidak tersedia.", 404);
    const publiclyAvailable = sentenceAsset.status === "approved" && sentenceAsset.license_verification === "verified"
      && (sentenceAsset.pronunciation_review === "passed" || sentenceAsset.source_attested_at !== null);
    if (!publiclyAvailable) {
      const { principal, role } = await requireRole(c, ["owner_admin", "content_reviewer"]);
      if (!principal) return jsonError("unauthenticated", "Masuk sebagai reviewer.", 401);
      if (!role) return jsonError("forbidden", "Kandidat hanya dapat diputar oleh reviewer.", 403);
      await addAudit(c.env.DB, c.get("requestId"), principal.id, "admin.audio.preview", "content_audio_asset", c.req.param("assetId"));
    }
    const bytes = await readVerifiedMedia(c, sentenceAsset.storage_key, sentenceAsset.sha256);
    if (!bytes) return jsonError("audio_unavailable", "Checksum rekaman tidak cocok.", 404);
    return new Response(bytes, { headers: { "Content-Type": sentenceAsset.format, "Cache-Control": "public, max-age=86400", ETag: `"${sentenceAsset.sha256}"`, "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
  }
  const row = await c.env.DB.prepare(`SELECT storage_key, format, sha256, status, pronunciation_review, source_attested_at
    FROM audio_assets WHERE id = ?`).bind(c.req.param("assetId")).first<{ storage_key: string; format: string; sha256: string; status: string; pronunciation_review: string; source_attested_at: string | null }>();
  if (!row || row.status === "rejected" || row.status === "retired") return jsonError("audio_unavailable", "Rekaman ini tidak tersedia.", 404);
  const publiclyAvailable = row.status === "approved" && (row.pronunciation_review === "passed" || row.source_attested_at !== null);
  if (!publiclyAvailable) {
    const { principal, role } = await requireRole(c, ["owner_admin", "content_reviewer"]);
    if (!principal) return jsonError("unauthenticated", "Masuk sebagai reviewer.", 401);
    if (!role) return jsonError("forbidden", "Kandidat hanya dapat diputar oleh reviewer.", 403);
    await addAudit(c.env.DB, c.get("requestId"), principal.id, "admin.audio.preview", "audio_asset", c.req.param("assetId"));
  }
  const bytes = await readVerifiedMedia(c, row.storage_key, row.sha256);
  if (!bytes) return jsonError("audio_unavailable", "Checksum rekaman tidak cocok.", 404);
  return new Response(bytes, { headers: { "Content-Type": row.format, "Cache-Control": "public, max-age=86400", ETag: `"${row.sha256}"`, "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
});

app.post("/api/v1/attempts", async (c) => {
  const principal = await requirePrincipal(c);
  if (!principal) return jsonError("unauthenticated", "Silakan masuk terlebih dahulu.", 401);
  const body = parseBody(z.object({ attempts: z.array(attemptSchema).min(1).max(50) }).strict(), await c.req.json().catch(() => null));
  if (!body) return jsonError("invalid_request", "Data sesi tidak valid atau terlalu banyak.");
  const accepted: Array<{ idempotencyKey: string; acceptedAt: string; duplicate: boolean }> = [];
  const rejected: Array<{ idempotencyKey: string; code: string; message: string }> = [];
  for (const attempt of body.attempts) {
    const table = attempt.contentType === "vocabulary" ? "vocabulary_entries" : "characters";
    const content = await c.env.DB.prepare(`SELECT id FROM ${table} WHERE id = ? AND status = 'approved'`).bind(attempt.contentId).first();
    const reading = attempt.readingId ? await c.env.DB.prepare(`SELECT id FROM readings WHERE id = ? AND status = 'approved' AND (
      (? = 'vocabulary' AND vocabulary_id = ?) OR (? = 'character' AND character_id = ?)
    )`).bind(attempt.readingId, attempt.contentType, attempt.contentId, attempt.contentType, attempt.contentId).first() : true;
    if (!content || !reading) {
      rejected.push({ idempotencyKey: attempt.idempotencyKey, code: "content_unavailable", message: "Materi ini belum dapat disinkronkan." });
      continue;
    }
    if (attempt.curriculumPlacementId) {
      const placement = await c.env.DB.prepare(`SELECT cp.id FROM curriculum_placements cp
        JOIN curriculum_units cu ON cu.id = cp.unit_id
        JOIN curricula c ON c.id = cu.curriculum_id
        WHERE cp.id = ? AND cu.status = 'published' AND c.status = 'published' AND (
          (? = 'vocabulary' AND cp.vocabulary_id = ?) OR
          (? = 'character' AND (cp.character_id = ? OR EXISTS (
            SELECT 1 FROM vocabulary_characters vc
            WHERE vc.vocabulary_id = cp.vocabulary_id AND vc.character_id = ?
          )))
        )`)
        .bind(attempt.curriculumPlacementId, attempt.contentType, attempt.contentId,
          attempt.contentType, attempt.contentId, attempt.contentId).first();
      if (!placement) {
        rejected.push({ idempotencyKey: attempt.idempotencyKey, code: "placement_mismatch", message: "Konteks pelajaran tidak valid." });
        continue;
      }
    }
    if (attempt.activityId) {
      const activity = await c.env.DB.prepare(`SELECT a.id FROM curriculum_activities a
        JOIN curriculum_units u ON u.id = a.unit_id JOIN curricula c ON c.id = u.curriculum_id
        WHERE a.id = ? AND a.status = 'published' AND u.status = 'published' AND c.status = 'published'
          AND (? IS NULL OR EXISTS (SELECT 1 FROM curriculum_placements cp WHERE cp.id = ? AND cp.unit_id = a.unit_id))`)
        .bind(attempt.activityId, attempt.curriculumPlacementId ?? null, attempt.curriculumPlacementId ?? null).first();
      if (!activity) {
        rejected.push({ idempotencyKey: attempt.idempotencyKey, code: "activity_mismatch", message: "Konteks aktivitas tidak sesuai dengan pelajaran." });
        continue;
      }
    }
    const at = new Date().toISOString();
    const attemptId = crypto.randomUUID();
    const dimensionValues = Object.values(attempt.dimensions);
    const measuredValues = Object.entries(attempt.dimensions).filter(([key]) => key !== "selfAssessment").map(([, value]) => value);
    const selfAssessment = attempt.dimensions.selfAssessment;
    const passed = measuredValues.length > 0 && measuredValues.every((value) => value === "correct" || value === "recognized" || value === "close_enough") && selfAssessment !== "repeat" && selfAssessment !== "unsure";
    const assessmentOutcome = dimensionValues.length === 0 ? "not_assessed" : selfAssessment === "repeat" || measuredValues.some((value) => value === "needs_practice" || value === "not_recognized") ? "needs_practice" : passed ? "passed" : "uncertain";
    const passedCount = passed ? 1 : 0;
    const skill = attempt.skill ?? (attempt.activityMode === "listen" ? "listening" : attempt.activityMode === "record_compare" ? "speaking" : attempt.activityMode === "guided_writing" || attempt.activityMode === "freehand_writing" ? "writing" : "comprehension");
    const [inserted] = await c.env.DB.batch([
      c.env.DB.prepare(`INSERT OR IGNORE INTO learning_attempts
      (id, user_id, idempotency_key, content_type, content_id, reading_id, placement_id, activity_id, skill, activity_mode, dimensions_json, engine_version, created_at_client, accepted_at, assessment_outcome)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(attemptId, principal.id, attempt.idempotencyKey, attempt.contentType, attempt.contentId,
          attempt.readingId ?? null, attempt.curriculumPlacementId ?? null, attempt.activityId ?? null, skill, attempt.activityMode,
          JSON.stringify(attempt.dimensions), attempt.engineVersion ?? null, attempt.createdAtClient, at, assessmentOutcome),
      c.env.DB.prepare(`INSERT INTO learner_progress(user_id, content_type, content_id, attempts_count, correct_count, last_seen_at, next_review_at, dimension_summary_json)
        SELECT ?, ?, ?, 1, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM learning_attempts WHERE id = ? AND assessment_outcome = ?)
          AND NOT EXISTS (SELECT 1 FROM sync_receipts WHERE user_id = ? AND idempotency_key = ?)
        ON CONFLICT(user_id, content_type, content_id) DO UPDATE SET attempts_count = attempts_count + 1,
        correct_count = correct_count + excluded.correct_count, last_seen_at = excluded.last_seen_at,
        next_review_at = excluded.next_review_at, dimension_summary_json = excluded.dimension_summary_json,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`)
        .bind(principal.id, attempt.contentType, attempt.contentId, passedCount, at,
          new Date(Date.now() + 86400000).toISOString(), JSON.stringify(attempt.dimensions), attemptId, assessmentOutcome,
          principal.id, attempt.idempotencyKey),
      c.env.DB.prepare(`INSERT INTO review_schedules(user_id, content_type, content_id, interval_days, repetition, due_at)
        SELECT ?, ?, ?, 1, 1, ? WHERE EXISTS (SELECT 1 FROM learning_attempts WHERE id = ?)
          AND NOT EXISTS (SELECT 1 FROM sync_receipts WHERE user_id = ? AND idempotency_key = ?)
        ON CONFLICT(user_id, content_type, content_id) DO UPDATE SET
        interval_days = MIN(365, MAX(1, interval_days * CASE WHEN ? THEN ease_factor ELSE 0.5 END)),
        repetition = repetition + 1,
        due_at = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`)
        .bind(principal.id, attempt.contentType, attempt.contentId, new Date(Date.now() + 86400000).toISOString(), attemptId,
          principal.id, attempt.idempotencyKey,
          passedCount, new Date(Date.now() + 86400000).toISOString()),
      c.env.DB.prepare(`INSERT INTO learner_skill_progress(user_id, content_type, content_id, reading_key, reading_id, skill,
        attempts_count, passed_count, uncertain_count, needs_practice_count, last_seen_at, dimensions_json)
        SELECT ?, ?, ?, COALESCE(?, ''), ?, ?, 1,
          CASE WHEN ? = 'passed' THEN 1 ELSE 0 END, CASE WHEN ? = 'uncertain' THEN 1 ELSE 0 END,
          CASE WHEN ? = 'needs_practice' THEN 1 ELSE 0 END, ?, ?
        WHERE EXISTS (SELECT 1 FROM learning_attempts WHERE id = ?)
          AND NOT EXISTS (SELECT 1 FROM sync_receipts WHERE user_id = ? AND idempotency_key = ?)
        ON CONFLICT(user_id, content_type, content_id, reading_key, skill) DO UPDATE SET
          attempts_count = attempts_count + 1, passed_count = passed_count + excluded.passed_count,
          uncertain_count = uncertain_count + excluded.uncertain_count,
          needs_practice_count = needs_practice_count + excluded.needs_practice_count,
          last_seen_at = excluded.last_seen_at, dimensions_json = excluded.dimensions_json,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`)
        .bind(principal.id, attempt.contentType, attempt.contentId, attempt.readingId ?? null, attempt.readingId ?? null, skill,
          assessmentOutcome, assessmentOutcome, assessmentOutcome, at, JSON.stringify(attempt.dimensions), attemptId,
          principal.id, attempt.idempotencyKey),
      c.env.DB.prepare(`INSERT INTO skill_review_schedules(user_id, content_type, content_id, reading_key, reading_id, skill, interval_days, repetition, due_at)
        SELECT ?, ?, ?, COALESCE(?, ''), ?, ?, 1, 1, ? WHERE EXISTS (SELECT 1 FROM learning_attempts WHERE id = ?)
          AND NOT EXISTS (SELECT 1 FROM sync_receipts WHERE user_id = ? AND idempotency_key = ?)
        ON CONFLICT(user_id, content_type, content_id, reading_key, skill) DO UPDATE SET
          interval_days = MIN(365, MAX(1, interval_days * CASE WHEN ? = 'passed' THEN ease_factor ELSE 0.5 END)),
          repetition = repetition + 1, due_at = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`)
        .bind(principal.id, attempt.contentType, attempt.contentId, attempt.readingId ?? null, attempt.readingId ?? null, skill,
          new Date(Date.now() + 86400000).toISOString(), attemptId, principal.id, attempt.idempotencyKey,
          assessmentOutcome, new Date(Date.now() + 86400000).toISOString()),
      c.env.DB.prepare(`INSERT OR IGNORE INTO sync_receipts(user_id, idempotency_key, accepted_at)
        SELECT ?, ?, accepted_at FROM learning_attempts WHERE id = ?`)
        .bind(principal.id, attempt.idempotencyKey, attemptId),
    ]);
    const duplicate = (inserted.meta.changes ?? 0) === 0;
    const receipt = await c.env.DB.prepare("SELECT accepted_at FROM sync_receipts WHERE user_id = ? AND idempotency_key = ?").bind(principal.id, attempt.idempotencyKey).first<{ accepted_at: string }>();
    accepted.push({ idempotencyKey: attempt.idempotencyKey, acceptedAt: receipt?.accepted_at ?? at, duplicate });
  }
  return c.json({ accepted, rejected, serverTime: new Date().toISOString() });
});

app.get("/api/v1/progress", async (c) => {
  const principal = await requirePrincipal(c);
  if (!principal) return jsonError("unauthenticated", "Silakan masuk terlebih dahulu.", 401);
  const [summary, due, recent, freehand, profile, activity] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS learned_items, COALESCE(SUM(attempts_count),0) AS attempts,
      COALESCE(SUM(correct_count),0) AS correct FROM learner_progress WHERE user_id = ?`).bind(principal.id).first(),
    c.env.DB.prepare("SELECT COUNT(*) AS due_count FROM skill_review_schedules WHERE user_id = ? AND due_at <= ?").bind(principal.id, new Date().toISOString()).first(),
    c.env.DB.prepare("SELECT accepted_at AS occurredAt, content_type AS contentType, activity_mode AS activityMode FROM learning_attempts WHERE user_id = ? ORDER BY accepted_at DESC LIMIT 20").bind(principal.id).all(),
    c.env.DB.prepare("SELECT COUNT(*) AS recognitions, COUNT(DISTINCT hanzi) AS characters FROM freehand_recognition_events WHERE user_id = ?").bind(principal.id).first(),
    c.env.DB.prepare("SELECT timezone FROM learner_profiles WHERE user_id = ?").bind(principal.id).first<{ timezone: string }>(),
    c.env.DB.prepare("SELECT accepted_at FROM learning_attempts WHERE user_id = ? ORDER BY accepted_at DESC LIMIT 2000").bind(principal.id).all<{ accepted_at: string }>(),
  ]);
  const timezone = profile?.timezone || "Asia/Jakarta";
  let dateFormatter: Intl.DateTimeFormat;
  try {
    dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
  }
  const dayKeys = [...new Set((activity.results ?? []).map(({ accepted_at }) => {
    const parts = Object.fromEntries(dateFormatter.formatToParts(new Date(accepted_at)).map(({ type, value }) => [type, value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }))].sort().reverse();
  const utcDay = (key: string) => Date.parse(`${key}T00:00:00.000Z`);
  const today = dateFormatter.formatToParts(new Date()).reduce<Record<string, string>>((parts, item) => (parts[item.type] = item.value, parts), {});
  const todayKey = `${today.year}-${today.month}-${today.day}`;
  let streakDays = 0;
  if (dayKeys.length && (dayKeys[0] === todayKey || utcDay(todayKey) - utcDay(dayKeys[0]) === 86400000)) {
    let expected = utcDay(dayKeys[0]);
    for (const key of dayKeys) {
      const current = utcDay(key);
      if (expected - current !== 86400000 && current !== expected) break;
      streakDays += 1;
      expected = current - 86400000;
    }
  }
  return c.json({ summary: { ...summary, streak_days: streakDays }, due: due?.due_count ?? 0, recent: recent.results, confirmedFreehand: freehand });
});

app.get("/api/v1/reviews", async (c) => {
  const principal = await requirePrincipal(c);
  if (!principal) return jsonError("unauthenticated", "Silakan masuk terlebih dahulu.", 401);
  const skill = c.req.query("skill") ?? "";
  const allowedSkills = ["listening","speaking","reading","writing","grammar","vocabulary","comprehension"];
  if (skill && !allowedSkills.includes(skill)) return jsonError("invalid_filter", "Filter keterampilan tidak valid.");
  const rows = await c.env.DB.prepare(`SELECT rs.content_type AS contentType, rs.content_id AS contentId, rs.due_at AS dueAt,
    rs.reading_id AS readingId, rs.skill, v.simplified_form AS word, ch.hanzi AS character
    FROM skill_review_schedules rs
    LEFT JOIN vocabulary_entries v ON rs.content_type = 'vocabulary' AND v.id = rs.content_id AND v.status = 'approved'
    LEFT JOIN characters ch ON rs.content_type = 'character' AND ch.id = rs.content_id AND ch.status = 'approved'
    WHERE rs.user_id = ? AND rs.due_at <= ? AND (? = '' OR rs.skill = ?)
      AND (v.id IS NOT NULL OR ch.id IS NOT NULL) ORDER BY rs.due_at, rs.skill LIMIT 100`)
    .bind(principal.id, new Date().toISOString(), skill, skill).all();
  return c.json({ items: rows.results });
});

app.get("/api/v1/community/feed", async (c) => {
  const principal = await requirePrincipal(c);
  if (!principal) return jsonError("unauthenticated", "Silakan masuk terlebih dahulu.", 401);
  const [topics, posts, myPosts] = await Promise.all([
    c.env.DB.prepare("SELECT id, slug, title, prompt FROM community_topics WHERE status = 'published' ORDER BY id").all(),
    c.env.DB.prepare(`SELECT p.id, p.topic_id AS topicId, t.title AS topicTitle, p.body, p.created_at AS createdAt,
      COALESCE(lp.display_name, u.name) AS authorName,
      (SELECT COUNT(*) FROM community_comments cc WHERE cc.post_id = p.id AND cc.status = 'approved') AS commentCount
      FROM community_posts p JOIN user u ON u.id = p.author_user_id
      LEFT JOIN learner_profiles lp ON lp.user_id = p.author_user_id
      LEFT JOIN community_topics t ON t.id = p.topic_id
      WHERE p.status = 'approved'
        AND NOT EXISTS (SELECT 1 FROM community_blocks b WHERE b.user_id = ? AND b.blocked_user_id = p.author_user_id)
        AND NOT EXISTS (SELECT 1 FROM community_blocks b WHERE b.user_id = p.author_user_id AND b.blocked_user_id = ?)
      ORDER BY p.created_at DESC LIMIT 50`).bind(principal.id, principal.id).all(),
    c.env.DB.prepare(`SELECT p.id, p.body, p.status, p.created_at AS createdAt, t.title AS topicTitle
      FROM community_posts p LEFT JOIN community_topics t ON t.id = p.topic_id
      WHERE p.author_user_id = ? AND p.status IN ('pending','rejected') ORDER BY p.created_at DESC LIMIT 20`).bind(principal.id).all(),
  ]);
  return c.json({ topics: topics.results, posts: posts.results, myPosts: myPosts.results });
});

app.post("/api/v1/community/posts", async (c) => {
  const principal = await requirePrincipal(c);
  if (!principal) return jsonError("unauthenticated", "Silakan masuk terlebih dahulu.", 401);
  const body = parseBody(z.object({ topicId: idSchema.optional(), body: z.string().trim().min(1).max(1200), locale: z.enum(["id","en"]).default("id") }).strict(), await c.req.json().catch(() => null));
  if (!body) return jsonError("invalid_request", "Tulis pesan maksimal 1200 karakter.");
  const [{ total = 0 } = {}] = (await c.env.DB.prepare("SELECT COUNT(*) AS total FROM community_posts WHERE author_user_id = ? AND created_at >= datetime('now','-1 day')")
    .bind(principal.id).all<{ total: number }>()).results;
  if (total >= 5) return jsonError("rate_limited", "Kamu sudah mengirim lima topik hari ini. Coba lagi besok.", 429);
  if (body.topicId) {
    const topic = await c.env.DB.prepare("SELECT id FROM community_topics WHERE id = ? AND status = 'published'").bind(body.topicId).first();
    if (!topic) return jsonError("topic_unavailable", "Topik ini belum tersedia.", 404);
  }
  const id = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO community_posts(id, topic_id, author_user_id, body, locale) VALUES (?, ?, ?, ?, ?)")
    .bind(id, body.topicId ?? null, principal.id, body.body, body.locale).run();
  await addAudit(c.env.DB, c.get("requestId"), principal.id, "community.post.submit", "community_post", id);
  return c.json({ id, status: "pending", message: "Terkirim untuk pemeriksaan sebelum ditampilkan ke komunitas." }, 201);
});

app.get("/api/v1/community/posts/:postId/comments", async (c) => {
  const principal = await requirePrincipal(c);
  if (!principal) return jsonError("unauthenticated", "Silakan masuk terlebih dahulu.", 401);
  const postId = c.req.param("postId");
  const post = await c.env.DB.prepare("SELECT id FROM community_posts WHERE id = ? AND status = 'approved'").bind(postId).first();
  if (!post) return jsonError("post_unavailable", "Topik ini belum tersedia.", 404);
  const rows = await c.env.DB.prepare(`SELECT c.id, c.body, c.created_at AS createdAt, COALESCE(lp.display_name, u.name) AS authorName
    FROM community_comments c JOIN user u ON u.id = c.author_user_id LEFT JOIN learner_profiles lp ON lp.user_id = c.author_user_id
    WHERE c.post_id = ? AND c.status = 'approved'
      AND NOT EXISTS (SELECT 1 FROM community_blocks b WHERE b.user_id = ? AND b.blocked_user_id = c.author_user_id)
      AND NOT EXISTS (SELECT 1 FROM community_blocks b WHERE b.user_id = c.author_user_id AND b.blocked_user_id = ?)
    ORDER BY c.created_at LIMIT 100`).bind(postId, principal.id, principal.id).all();
  return c.json({ comments: rows.results });
});

app.post("/api/v1/community/posts/:postId/comments", async (c) => {
  const principal = await requirePrincipal(c);
  if (!principal) return jsonError("unauthenticated", "Silakan masuk terlebih dahulu.", 401);
  const postId = c.req.param("postId");
  const body = parseBody(z.object({ body: z.string().trim().min(1).max(800) }).strict(), await c.req.json().catch(() => null));
  if (!body) return jsonError("invalid_request", "Balasan harus berisi maksimal 800 karakter.");
  const post = await c.env.DB.prepare("SELECT author_user_id FROM community_posts WHERE id = ? AND status = 'approved'").bind(postId).first<{ author_user_id: string }>();
  if (!post) return jsonError("post_unavailable", "Topik ini belum tersedia.", 404);
  const blocked = await c.env.DB.prepare(`SELECT 1 AS blocked FROM community_blocks WHERE (user_id = ? AND blocked_user_id = ?)
    OR (user_id = ? AND blocked_user_id = ?) LIMIT 1`).bind(principal.id, post.author_user_id, post.author_user_id, principal.id).first();
  if (blocked) return jsonError("interaction_blocked", "Interaksi dengan akun ini dibatasi.", 403);
  const [{ total = 0 } = {}] = (await c.env.DB.prepare("SELECT COUNT(*) AS total FROM community_comments WHERE author_user_id = ? AND created_at >= datetime('now','-1 day')")
    .bind(principal.id).all<{ total: number }>()).results;
  if (total >= 15) return jsonError("rate_limited", "Kamu sudah mengirim 15 balasan hari ini. Coba lagi besok.", 429);
  const id = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO community_comments(id, post_id, author_user_id, body) VALUES (?, ?, ?, ?)")
    .bind(id, postId, principal.id, body.body).run();
  await addAudit(c.env.DB, c.get("requestId"), principal.id, "community.comment.submit", "community_comment", id);
  return c.json({ id, status: "pending", message: "Balasan menunggu pemeriksaan sebelum ditampilkan." }, 201);
});

app.post("/api/v1/community/reports", async (c) => {
  const principal = await requirePrincipal(c);
  if (!principal) return jsonError("unauthenticated", "Silakan masuk terlebih dahulu.", 401);
  const body = parseBody(z.object({ subjectType: z.enum(["post","comment"]), subjectId: idSchema, reason: z.enum(["spam","harassment","personal_data","copyright","other"]), details: z.string().max(600).default("") }).strict(), await c.req.json().catch(() => null));
  if (!body) return jsonError("invalid_request", "Jenis laporan tidak valid.");
  const source = body.subjectType === "post" ? "community_posts" : "community_comments";
  const subject = await c.env.DB.prepare(`SELECT id FROM ${source} WHERE id = ? AND status IN ('approved','pending')`).bind(body.subjectId).first();
  if (!subject) return jsonError("not_found", "Konten yang dilaporkan tidak ditemukan.", 404);
  const result = await c.env.DB.prepare(`INSERT OR IGNORE INTO community_reports(id, reporter_user_id, subject_type, subject_id, reason, details)
    VALUES (?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), principal.id, body.subjectType, body.subjectId, body.reason, body.details.trim()).run();
  if (!(result.meta.changes ?? 0)) return jsonError("already_reported", "Laporan ini sudah kami terima.", 409);
  await addAudit(c.env.DB, c.get("requestId"), principal.id, "community.report.submit", body.subjectType, body.subjectId);
  return c.json({ ok: true, message: "Laporan telah dikirim untuk ditinjau." }, 201);
});

app.post("/api/v1/community/blocks", async (c) => {
  const principal = await requirePrincipal(c);
  if (!principal) return jsonError("unauthenticated", "Silakan masuk terlebih dahulu.", 401);
  const body = parseBody(z.object({ postId: idSchema }).strict(), await c.req.json().catch(() => null));
  if (!body) return jsonError("invalid_request", "Topik yang ingin disembunyikan tidak valid.");
  const target = await c.env.DB.prepare("SELECT author_user_id AS userId FROM community_posts WHERE id = ? AND status = 'approved'").bind(body.postId).first<{ userId: string }>();
  if (!target) return jsonError("not_found", "Akun tidak ditemukan.", 404);
  if (target.userId === principal.id) return jsonError("invalid_request", "Kendi posting tidak dapat disembunyikan.");
  await c.env.DB.prepare("INSERT OR IGNORE INTO community_blocks(user_id, blocked_user_id) VALUES (?, ?)").bind(principal.id, target.userId).run();
  await addAudit(c.env.DB, c.get("requestId"), principal.id, "community.block", "user", target.userId);
  return c.json({ ok: true });
});

app.delete("/api/v1/community/blocks/:userId", async (c) => {
  const principal = await requirePrincipal(c);
  if (!principal) return jsonError("unauthenticated", "Silakan masuk terlebih dahulu.", 401);
  await c.env.DB.prepare("DELETE FROM community_blocks WHERE user_id = ? AND blocked_user_id = ?").bind(principal.id, c.req.param("userId")).run();
  return c.json({ ok: true });
});

app.get("/api/v1/admin/community/queue", async (c) => {
  const { principal, role } = await requireRole(c, ["owner_admin","content_reviewer"]);
  if (!principal) return jsonError("unauthenticated", "Masuk sebagai moderator.", 401);
  if (!role) return jsonError("forbidden", "Akses moderator diperlukan.", 403);
  const [posts, comments, reports] = await Promise.all([
    c.env.DB.prepare(`SELECT p.id, p.body, p.status, p.created_at AS createdAt, COALESCE(lp.display_name,u.name) AS authorName,
      t.title AS topicTitle FROM community_posts p JOIN user u ON u.id=p.author_user_id LEFT JOIN learner_profiles lp ON lp.user_id=u.id
      LEFT JOIN community_topics t ON t.id=p.topic_id WHERE p.status='pending' ORDER BY p.created_at LIMIT 100`).all(),
    c.env.DB.prepare(`SELECT c.id,c.post_id AS postId,c.body,c.status,c.created_at AS createdAt,COALESCE(lp.display_name,u.name) AS authorName,
      p.body AS parentBody FROM community_comments c JOIN user u ON u.id=c.author_user_id LEFT JOIN learner_profiles lp ON lp.user_id=u.id
      JOIN community_posts p ON p.id=c.post_id WHERE c.status='pending' AND p.status='approved' ORDER BY c.created_at LIMIT 100`).all(),
    c.env.DB.prepare(`SELECT r.id,r.subject_type AS subjectType,r.subject_id AS subjectId,r.reason,r.details,r.created_at AS createdAt,
      CASE WHEN r.subject_type='post' THEN (SELECT body FROM community_posts WHERE id=r.subject_id)
        ELSE (SELECT body FROM community_comments WHERE id=r.subject_id) END AS body
      FROM community_reports r WHERE r.status='open' ORDER BY r.created_at LIMIT 100`).all(),
  ]);
  await addAudit(c.env.DB, c.get("requestId"), principal.id, "admin.community.queue.read", null, null);
  return c.json({ posts: posts.results, comments: comments.results, reports: reports.results });
});

app.patch("/api/v1/admin/community/:kind/:id", async (c) => {
  const { principal, role } = await requireRole(c, ["owner_admin","content_reviewer"]);
  if (!principal) return jsonError("unauthenticated", "Masuk sebagai moderator.", 401);
  if (!role) return jsonError("forbidden", "Akses moderator diperlukan.", 403);
  const kind = c.req.param("kind");
  if (kind !== "posts" && kind !== "comments") return jsonError("invalid_kind", "Jenis moderasi tidak valid.");
  const body = parseBody(z.object({ decision: z.enum(["approved","rejected","hidden"]), note: z.string().max(500).default("") }).strict(), await c.req.json().catch(() => null));
  if (!body) return jsonError("invalid_request", "Keputusan moderasi tidak valid.");
  const table = kind === "posts" ? "community_posts" : "community_comments";
  const updatedAt = kind === "posts" ? ", updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')" : "";
  const statusGuard = kind === "comments" ? " AND EXISTS(SELECT 1 FROM community_posts p WHERE p.id = community_comments.post_id AND p.status='approved')" : "";
  const result = await c.env.DB.prepare(`UPDATE ${table} SET status=?, moderated_by_user_id=?, moderated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')${updatedAt}
    WHERE id=? AND status IN ('pending','approved','rejected','hidden')${statusGuard}`)
    .bind(body.decision, principal.id, c.req.param("id")).run();
  if (!(result.meta.changes ?? 0)) return jsonError("not_found", "Konten yang akan diperiksa tidak ditemukan.", 404);
  await addAudit(c.env.DB, c.get("requestId"), principal.id, `admin.community.${body.decision}`, kind, c.req.param("id"), "success", { noteLength: body.note.length });
  return c.json({ ok: true });
});

app.patch("/api/v1/admin/community-reports/:reportId", async (c) => {
  const { principal, role } = await requireRole(c, ["owner_admin","content_reviewer"]);
  if (!principal) return jsonError("unauthenticated", "Masuk sebagai moderator.", 401);
  if (!role) return jsonError("forbidden", "Akses moderator diperlukan.", 403);
  const body = parseBody(z.object({ decision: z.enum(["resolved","dismissed"]), hideContent: z.boolean().default(false) }).strict(), await c.req.json().catch(() => null));
  if (!body) return jsonError("invalid_request", "Status laporan tidak valid.");
  const report = await c.env.DB.prepare("SELECT subject_type,subject_id FROM community_reports WHERE id=? AND status='open'").bind(c.req.param("reportId")).first<{subject_type:string;subject_id:string}>();
  if (!report) return jsonError("not_found", "Laporan ini sudah ditangani atau tidak ditemukan.", 404);
  await c.env.DB.prepare(`UPDATE community_reports SET status=?,reviewed_by_user_id=?,reviewed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`)
    .bind(body.decision, principal.id, c.req.param("reportId")).run();
  if (body.hideContent && body.decision === "resolved") {
    const table = report.subject_type === "post" ? "community_posts" : "community_comments";
    await c.env.DB.prepare(`UPDATE ${table} SET status='hidden',moderated_by_user_id=?,moderated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`)
      .bind(principal.id, report.subject_id).run();
  }
  await addAudit(c.env.DB, c.get("requestId"), principal.id, `admin.community.report.${body.decision}`, report.subject_type, report.subject_id, "success", { hideContent: body.hideContent });
  return c.json({ ok: true });
});

app.get("/api/v1/privacy-requests", async (c) => {
  const principal = await requirePrincipal(c);
  if (!principal) return jsonError("unauthenticated", "Silakan masuk terlebih dahulu.", 401);
  const rows = await c.env.DB.prepare("SELECT id, request_type AS type, status, requested_at AS requestedAt, completed_at AS completedAt FROM privacy_requests WHERE user_id = ? ORDER BY requested_at DESC LIMIT 20")
    .bind(principal.id).all();
  return c.json({ requests: rows.results });
});

app.post("/api/v1/privacy-requests", async (c) => {
  const principal = await requirePrincipal(c);
  if (!principal) return jsonError("unauthenticated", "Silakan masuk terlebih dahulu.", 401);
  const body = parseBody(z.object({ type: z.enum(["export", "delete_account"]) }), await c.req.json().catch(() => null));
  if (!body) return jsonError("invalid_request", "Permintaan tidak valid.");
  const id = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO privacy_requests(id, user_id, request_type) VALUES (?, ?, ?)").bind(id, principal.id, body.type).run();
  await addAudit(c.env.DB, c.get("requestId"), principal.id, `privacy.${body.type}`, "privacy_request", id);
  if (body.type === "export") {
    const [profile, progress, attempts, reviews] = await Promise.all([
      c.env.DB.prepare("SELECT u.email, u.name, p.display_name, p.locale, p.timezone, p.daily_goal_minutes, p.active_curriculum_id FROM learner_profiles p JOIN user u ON u.id = p.user_id WHERE p.user_id = ?").bind(principal.id).first(),
      c.env.DB.prepare("SELECT * FROM learner_progress WHERE user_id = ?").bind(principal.id).all(),
      c.env.DB.prepare("SELECT idempotency_key, content_type, content_id, activity_mode, dimensions_json, engine_version, created_at_client, accepted_at FROM learning_attempts WHERE user_id = ?").bind(principal.id).all(),
      c.env.DB.prepare("SELECT * FROM review_schedules WHERE user_id = ?").bind(principal.id).all(),
    ]);
    await c.env.DB.prepare("UPDATE privacy_requests SET status = 'completed', completed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").bind(id).run();
    return c.json({ export: { exportedAt: new Date().toISOString(), profile, progress: progress.results, attempts: attempts.results, reviewSchedules: reviews.results } });
  }
  return c.json({ id, status: "requested", message: "Penghapusan dijadwalkan untuk ditangani administrator." }, 202);
});

app.post("/api/v1/recovery-codes/rotate", async (c) => {
  const principal = await requirePrincipal(c);
  if (!principal) return jsonError("unauthenticated", "Silakan masuk terlebih dahulu.", 401);
  const codes = [crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", ""), crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "")];
  const statements = codes.map(async (code) => {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
    const hex = [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return c.env.DB.prepare("INSERT INTO recovery_codes(id, user_id, code_hash) VALUES (?, ?, ?)").bind(crypto.randomUUID(), principal.id, hex);
  });
  const prepared = await Promise.all(statements);
  await c.env.DB.prepare("UPDATE recovery_codes SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id = ? AND revoked_at IS NULL AND used_at IS NULL").bind(principal.id).run();
  await c.env.DB.batch(prepared);
  await addAudit(c.env.DB, c.get("requestId"), principal.id, "recovery.rotate", "user", principal.id);
  return c.json({ codes, shownOnce: true });
});

app.post("/api/v1/recovery/start", async (c) => {
  if (!await rateLimitRecovery(c.env.DB, c.req.raw, "recovery")) return jsonError("rate_limited", "Terlalu banyak percobaan. Coba lagi nanti.", 429);
  const body = parseBody(z.object({ email: z.string().email().max(254), code: z.string().regex(/^[a-f0-9]{64}$/i) }), await c.req.json().catch(() => null));
  if (!body) return jsonError("recovery_failed", "Email atau kode pemulihan tidak cocok.", 401);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body.code.toLowerCase()));
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const match = await c.env.DB.prepare(`SELECT rc.id, rc.user_id FROM recovery_codes rc JOIN user u ON u.id = rc.user_id
    WHERE lower(u.email) = lower(?) AND rc.code_hash = ? AND rc.used_at IS NULL AND rc.revoked_at IS NULL LIMIT 1`).bind(body.email.trim(), hash).first<{ id: string; user_id: string }>();
  if (!match) return jsonError("recovery_failed", "Email atau kode pemulihan tidak cocok.", 401);
  let resetToken: string | undefined;
  const resetAuth = createAuth(c.env, (token) => { resetToken = token; });
  await resetAuth.api.requestPasswordReset({ body: { email: body.email.trim(), redirectTo: "/reset-password" } });
  if (!resetToken) return jsonError("recovery_failed", "Pemulihan belum tersedia. Coba lagi.", 500);
  await c.env.DB.prepare("UPDATE recovery_codes SET used_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND used_at IS NULL").bind(match.id).run();
  await addAudit(c.env.DB, c.get("requestId"), match.user_id, "recovery.started", "user", match.user_id);
  return c.json({ resetToken, expiresInSeconds: 3600 });
});

app.get("/api/v1/admin/overview", async (c) => {
  const { principal, role } = await requireRole(c, ["owner_admin", "content_reviewer"]);
  if (!principal) return jsonError("unauthenticated", "Masuk sebagai administrator.", 401);
  if (!role) return jsonError("forbidden", "Akses administrator diperlukan.", 403);
  const [learners, attempts, content, audio, weekly] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) AS total FROM learner_profiles").first(),
    c.env.DB.prepare("SELECT COUNT(*) AS total FROM learning_attempts").first(),
    c.env.DB.prepare("SELECT COUNT(*) AS total FROM vocabulary_entries WHERE status = 'needs_review'").first(),
    c.env.DB.prepare("SELECT COUNT(*) AS total FROM audio_assets WHERE status = 'candidate'").first(),
    c.env.DB.prepare("SELECT COUNT(DISTINCT user_id) AS active FROM learning_attempts WHERE accepted_at >= datetime('now','-7 days')").first(),
  ]);
  await addAudit(c.env.DB, c.get("requestId"), principal.id, "admin.overview.read", null, null);
  return c.json({ metrics: { learners: learners?.total ?? 0, attempts: attempts?.total ?? 0, vocabularyPendingReview: content?.total ?? 0, audioCandidates: audio?.total ?? 0, activeLearnersLast7Days: weekly?.active ?? 0 } });
});

app.get("/api/v1/admin/learners", async (c) => {
  const { principal, role } = await requireRole(c, ["owner_admin"]);
  if (!principal) return jsonError("unauthenticated", "Masuk sebagai administrator.", 401);
  if (!role) return jsonError("forbidden", "Akses pemilik diperlukan.", 403);
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? 30)));
  const q = (c.req.query("q") ?? "").trim().slice(0, 80);
  const rows = await c.env.DB.prepare(`SELECT u.id, u.name, substr(u.email,1,1) || '•••' || substr(u.email,instr(u.email,'@')) AS masked_email,
    u.createdAt, (SELECT COUNT(*) FROM learning_attempts a WHERE a.user_id = u.id) + (SELECT COUNT(*) FROM freehand_recognition_events f WHERE f.user_id = u.id) AS attempts,
    (SELECT MAX(activity_at) FROM (SELECT a.accepted_at AS activity_at FROM learning_attempts a WHERE a.user_id = u.id
      UNION ALL SELECT f.occurred_at AS activity_at FROM freehand_recognition_events f WHERE f.user_id = u.id)) AS last_active
    FROM user u JOIN learner_profiles p ON p.user_id = u.id
    WHERE (? = '' OR u.name LIKE '%' || ? || '%' OR u.email LIKE '%' || ? || '%')
    ORDER BY last_active DESC LIMIT ?`).bind(q, q, q, limit).all();
  await addAudit(c.env.DB, c.get("requestId"), principal.id, "admin.learners.list", null, null, "success", { queryLength: q.length, limit });
  return c.json({ learners: rows.results });
});

app.get("/api/v1/admin/learners/:learnerId", async (c) => {
  const { principal, role } = await requireRole(c, ["owner_admin"]);
  if (!principal) return jsonError("unauthenticated", "Masuk sebagai administrator.", 401);
  if (!role) return jsonError("forbidden", "Akses pemilik diperlukan.", 403);
  const learnerId = c.req.param("learnerId");
  const learner = await c.env.DB.prepare(`SELECT u.id, u.name, u.email, u.createdAt, p.display_name, p.locale,
    p.daily_goal_minutes, p.active_curriculum_id FROM user u JOIN learner_profiles p ON p.user_id = u.id WHERE u.id = ?`).bind(learnerId).first();
  await addAudit(c.env.DB, c.get("requestId"), principal.id, "admin.learner.read", "user", learnerId, learner ? "success" : "failure");
  if (!learner) return jsonError("not_found", "Pembelajar tidak ditemukan.", 404);
  const [progress, curriculumProgress, skillProgress, activityProgress, placements, daily, freehand] = await Promise.all([
    c.env.DB.prepare(`SELECT p.content_type AS contentType, p.content_id AS contentId,
      COALESCE(v.simplified_form, ch.hanzi) AS contentLabel,
      p.attempts_count AS attempts, p.correct_count AS correct, p.last_seen_at AS lastSeenAt,
      p.next_review_at AS nextReviewAt, p.dimension_summary_json AS dimensions
      FROM learner_progress p
      LEFT JOIN vocabulary_entries v ON p.content_type = 'vocabulary' AND v.id = p.content_id
      LEFT JOIN characters ch ON p.content_type = 'character' AND ch.id = p.content_id
      WHERE p.user_id = ? ORDER BY p.last_seen_at DESC LIMIT 200`).bind(learnerId).all(),
    c.env.DB.prepare(`SELECT c.id AS curriculumId, c.slug AS curriculumSlug, c.name AS curriculumName, c.version AS curriculumVersion,
      u.id AS unitId, u.title AS unitTitle, u.level_number AS levelNumber,
      CASE WHEN c.slug = 'hsk-3' AND u.level_number BETWEEN 1 AND 3 THEN 'Tahap 1'
        WHEN c.slug = 'hsk-3' AND u.level_number BETWEEN 4 AND 6 THEN 'Tahap 2'
        WHEN c.slug = 'hsk-3' AND u.level_number BETWEEN 7 AND 9 THEN 'Tahap 3' ELSE NULL END AS stageName,
      COUNT(*) AS attempts, COUNT(DISTINCT a.content_type || ':' || a.content_id) AS itemsPractised,
      SUM(CASE WHEN a.assessment_outcome = 'passed' THEN 1 ELSE 0 END) AS passed,
      SUM(CASE WHEN a.assessment_outcome = 'needs_practice' THEN 1 ELSE 0 END) AS needsPractice,
      SUM(CASE WHEN a.assessment_outcome = 'uncertain' THEN 1 ELSE 0 END) AS uncertain,
      SUM(CASE WHEN a.assessment_outcome = 'not_assessed' THEN 1 ELSE 0 END) AS notAssessed,
      MAX(a.accepted_at) AS lastSeenAt
      FROM learning_attempts a
      JOIN curriculum_placements cp ON cp.id = a.placement_id
      JOIN curriculum_units u ON u.id = cp.unit_id
      JOIN curricula c ON c.id = u.curriculum_id
      WHERE a.user_id = ?
      GROUP BY c.id, c.slug, c.name, c.version, u.id, u.title, u.level_number
      ORDER BY lastSeenAt DESC LIMIT 100`).bind(learnerId).all(),
    c.env.DB.prepare(`SELECT skill, SUM(attempts_count) AS attempts,
      SUM(passed_count) AS passed, SUM(uncertain_count) AS uncertain,
      SUM(needs_practice_count) AS needsPractice, COUNT(*) AS itemsPractised,
      MAX(last_seen_at) AS lastSeenAt
      FROM learner_skill_progress WHERE user_id = ?
      GROUP BY skill ORDER BY attempts DESC, skill`).bind(learnerId).all(),
    c.env.DB.prepare(`SELECT ca.id, ca.title, ca.activity_kind AS activityKind,
      cu.title AS unitTitle, cu.level_number AS levelNumber, cr.name AS curriculumName,
      COALESCE(lap.state, 'not_started') AS state,
      lap.current_item_ordinal AS currentItemOrdinal, COALESCE(lap.correct_count, 0) AS correctCount, lap.updated_at AS updatedAt,
      lap.completed_at AS completedAt,
      (SELECT COUNT(*) FROM curriculum_activity_items cai WHERE cai.activity_id = ca.id) AS itemCount,
      CASE WHEN ca.activity_kind = 'writing' THEN (
        SELECT COUNT(DISTINCT ch.id) FROM curriculum_placements cp
        LEFT JOIN vocabulary_characters vc ON vc.vocabulary_id = cp.vocabulary_id
        JOIN characters ch ON ch.id = COALESCE(cp.character_id, vc.character_id)
        WHERE cp.unit_id = ca.unit_id AND ch.status = 'approved' AND ch.stroke_data_status = 'approved'
      ) ELSE 0 END AS writingItemCount,
      CASE WHEN ca.activity_kind = 'writing' THEN (
        SELECT COUNT(*) FROM learner_activity_character_progress lcp
        WHERE lcp.user_id = ? AND lcp.activity_id = ca.id
      ) ELSE 0 END AS writingCompletedCount
      FROM curriculum_activities ca
      JOIN curriculum_units cu ON cu.id = ca.unit_id
      JOIN curricula cr ON cr.id = cu.curriculum_id
      LEFT JOIN learner_activity_progress lap ON lap.activity_id = ca.id AND lap.user_id = ?
      WHERE ca.status = 'published' AND ((EXISTS (
        SELECT 1 FROM learning_attempts la WHERE la.user_id = ? AND la.activity_id = ca.id
      )) OR lap.state IS NOT NULL)
      ORDER BY COALESCE(lap.updated_at, lap.completed_at) DESC LIMIT 100`).bind(learnerId, learnerId, learnerId).all(),
    c.env.DB.prepare(`SELECT id, assessment_version AS assessmentVersion, answered_count AS answered,
      correct_count AS correct, recommendation, explanation, completed_at AS completedAt
      FROM placement_sessions WHERE user_id = ? ORDER BY completed_at DESC LIMIT 20`).bind(learnerId).all(),
    c.env.DB.prepare(`SELECT date(activity_at) AS day, SUM(attempt_count) AS attempts FROM (
      SELECT accepted_at AS activity_at, COUNT(*) AS attempt_count FROM learning_attempts WHERE user_id = ? AND accepted_at >= datetime('now','-30 days') GROUP BY date(accepted_at)
      UNION ALL SELECT occurred_at AS activity_at, COUNT(*) AS attempt_count FROM freehand_recognition_events WHERE user_id = ? AND occurred_at >= datetime('now','-30 days') GROUP BY date(occurred_at)
    ) GROUP BY date(activity_at) ORDER BY day`).bind(learnerId, learnerId).all(),
    c.env.DB.prepare("SELECT hanzi, unicode_code_point AS codePoint, engine_id AS engineId, candidate_rank AS candidateRank, occurred_at AS occurredAt FROM freehand_recognition_events WHERE user_id = ? ORDER BY occurred_at DESC LIMIT 100").bind(learnerId).all(),
  ]);
  return c.json({ learner, progress: progress.results, curriculumProgress: curriculumProgress.results,
    skillProgress: skillProgress.results, activityProgress: activityProgress.results, placements: placements.results,
    activity: daily.results, freehand: freehand.results });
});

app.get("/api/v1/admin/content/review-queue", async (c) => {
  const { principal, role } = await requireRole(c, ["owner_admin", "content_reviewer"]);
  if (!principal) return jsonError("unauthenticated", "Masuk sebagai reviewer.", 401);
  if (!role) return jsonError("forbidden", "Akses reviewer diperlukan.", 403);
  const [words, characters, readings, wordAudio, sentenceAudio] = await Promise.all([
    c.env.DB.prepare("SELECT id, simplified_form AS text, status, source_id AS sourceId FROM vocabulary_entries WHERE status IN ('draft','needs_review') ORDER BY updated_at DESC LIMIT 100").all(),
    c.env.DB.prepare("SELECT id, hanzi AS text, status, source_id AS sourceId, stroke_data_status AS strokeStatus FROM characters WHERE status IN ('draft','needs_review') ORDER BY updated_at DESC LIMIT 100").all(),
    c.env.DB.prepare("SELECT id, context_label AS text, status, source_id AS sourceId, numbered_pinyin AS pinyin FROM readings WHERE status IN ('draft','needs_review') ORDER BY id LIMIT 100").all(),
    c.env.DB.prepare(`SELECT a.id, r.context_label AS text, r.numbered_pinyin AS pinyin, a.dialect, a.recording_context AS recordingContext,
      'vocabulary' AS assetType,
      a.format, a.size_bytes AS sizeBytes, a.duration_ms AS durationMs, a.sha256, a.status, a.pronunciation_review AS pronunciationReview,
      s.name AS sourceName, s.license_id AS license, s.license_url AS licenseUrl, s.attribution,
      a.source_page_url AS sourcePageUrl, a.source_attested_at AS sourceAttestedAt,
      a.source_attestation_method AS sourceAttestationMethod
      FROM audio_assets a JOIN readings r ON r.id = a.reading_id JOIN asset_sources s ON s.id = a.source_id
      WHERE a.status = 'candidate' OR (a.status = 'approved' AND a.source_attested_at IS NOT NULL)
      ORDER BY a.created_at LIMIT 100`).all(),
    c.env.DB.prepare(`SELECT a.id, targets.text, '' AS pinyin, a.dialect, a.recording_context AS recordingContext,
      'sentence' AS assetType, a.format, a.size_bytes AS sizeBytes, a.duration_ms AS durationMs, a.sha256, a.status,
      a.pronunciation_review AS pronunciationReview, s.name AS sourceName, s.license_id AS license,
      s.license_url AS licenseUrl, s.attribution, a.source_page_url AS sourcePageUrl,
      a.source_attested_at AS sourceAttestedAt, a.source_attestation_method AS sourceAttestationMethod
      FROM content_audio_assets a JOIN asset_sources s ON s.id = a.source_id
      LEFT JOIN (
        SELECT l.asset_id, e.simplified_text AS text FROM example_audio_links l JOIN examples e ON e.id = l.example_id
        UNION ALL
        SELECT l.asset_id, d.simplified_text AS text FROM dialogue_turn_audio_links l JOIN dialogue_turns d ON d.id = l.dialogue_turn_id
        UNION ALL
        SELECT l.asset_id, p.simplified_text AS text FROM story_paragraph_audio_links l JOIN story_paragraphs p ON p.id = l.story_paragraph_id
      ) targets ON targets.asset_id = a.id
      WHERE a.status = 'candidate' OR (a.status = 'approved' AND a.source_attested_at IS NOT NULL)
      ORDER BY a.created_at LIMIT 100`).all(),
  ]);
  return c.json({ vocabulary: words.results, characters: characters.results, readings: readings.results,
    audio: [...wordAudio.results, ...sentenceAudio.results] });
});

app.patch("/api/v1/admin/content/:kind/:id", async (c) => {
  const { principal, role } = await requireRole(c, ["owner_admin", "content_reviewer"]);
  if (!principal) return jsonError("unauthenticated", "Masuk sebagai reviewer.", 401);
  if (!role) return jsonError("forbidden", "Akses reviewer diperlukan.", 403);
  const kind = c.req.param("kind");
  const body = parseBody(z.object({ status: z.enum(["needs_review", "approved", "rejected", "retired"]), note: z.string().max(500).optional() }), await c.req.json().catch(() => null));
  if (!body) return jsonError("invalid_request", "Keputusan review tidak valid.");
  const table = kind === "vocabulary" ? "vocabulary_entries" : kind === "character" ? "characters" : kind === "reading" ? "readings" : kind === "gloss" ? "glosses" : kind === "example" ? "examples" : null;
  if (!table) return jsonError("invalid_kind", "Jenis materi tidak didukung.");
  if (body.status === "approved") {
    const checks: Array<{ sql: string; ok: boolean }> = [];
    if (kind === "vocabulary") {
      const coverage = await c.env.DB.prepare(`SELECT EXISTS(SELECT 1 FROM readings WHERE vocabulary_id = ? AND status = 'approved') AS has_reading,
        EXISTS(SELECT 1 FROM vocabulary_glosses vg JOIN glosses g ON g.id = vg.gloss_id WHERE vg.vocabulary_id = ? AND g.status = 'approved' AND g.locale = 'id') AS has_gloss`).bind(c.req.param("id"), c.req.param("id")).first<{ has_reading: number; has_gloss: number }>();
      if (!coverage?.has_reading || !coverage.has_gloss) return jsonError("incomplete_content", "Tambahkan pelafalan dan arti bahasa Indonesia yang telah disetujui sebelum menerbitkan kata.", 409);
    }
    if (kind === "character") {
      const row = await c.env.DB.prepare("SELECT stroke_data_status FROM characters WHERE id = ?").bind(c.req.param("id")).first<{ stroke_data_status: string }>();
      if (!row || row.stroke_data_status !== "approved") return jsonError("incomplete_content", "Data guratan belum memiliki sumber dan review yang disetujui.", 409);
    }
    void checks;
  }
  const result = await c.env.DB.prepare(`UPDATE ${table} SET status = ?, revision = revision + 1 WHERE id = ?`).bind(body.status, c.req.param("id")).run();
  const found = (result.meta.changes ?? 0) > 0;
  await addAudit(c.env.DB, c.get("requestId"), principal.id, `admin.content.${body.status}`, kind, c.req.param("id"), found ? "success" : "failure", { note: body.note ?? "" });
  if (!found) return jsonError("not_found", "Materi tidak ditemukan.", 404);
  return c.json({ ok: true, status: body.status });
});

app.patch("/api/v1/admin/audio/:audioId", async (c) => {
  const { principal, role } = await requireRole(c, ["owner_admin", "content_reviewer"]);
  if (!principal) return jsonError("unauthenticated", "Masuk sebagai reviewer.", 401);
  if (!role) return jsonError("forbidden", "Akses reviewer diperlukan.", 403);
  const body = parseBody(z.object({ decision: z.enum(["passed", "failed"]), note: z.string().max(500) }), await c.req.json().catch(() => null));
  if (!body) return jsonError("invalid_request", "Keputusan audio tidak valid.");
  const status = body.decision === "passed" ? "approved" : "rejected";
  const sentenceAsset = c.req.param("audioId").startsWith("snt-");
  const result = await c.env.DB.prepare(`UPDATE ${sentenceAsset ? "content_audio_assets" : "audio_assets"} SET pronunciation_review = ?, status = ?, reviewer_user_id = ?,
    reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND status IN ('candidate','approved')`)
    .bind(body.decision, status, principal.id, c.req.param("audioId")).run();
  const found = (result.meta.changes ?? 0) > 0;
  await addAudit(c.env.DB, c.get("requestId"), principal.id, `admin.audio.${body.decision}`, sentenceAsset ? "content_audio_asset" : "audio_asset", c.req.param("audioId"), found ? "success" : "failure", { note: body.note });
  if (!found) return jsonError("not_found", "Kandidat audio tidak ditemukan.", 404);
  return c.json({ ok: true, status });
});

app.get("/api/v1/admin/audit", async (c) => {
  const { principal, role } = await requireRole(c, ["owner_admin"]);
  if (!principal) return jsonError("unauthenticated", "Masuk sebagai administrator.", 401);
  if (!role) return jsonError("forbidden", "Akses pemilik diperlukan.", 403);
  const limit = Math.min(200, Math.max(1, Number(c.req.query("limit") ?? 50)));
  const rows = await c.env.DB.prepare(`SELECT id, actor_user_id AS actorId, action, subject_type AS subjectType, subject_id AS subjectId,
    outcome, request_id AS requestId, occurred_at AS occurredAt FROM audit_events ORDER BY occurred_at DESC LIMIT ?`).bind(limit).all();
  await addAudit(c.env.DB, c.get("requestId"), principal.id, "admin.audit.read", null, null, "success", { limit });
  return c.json({ events: rows.results });
});

app.get("/api/v1/admin/privacy-requests", async (c) => {
  const { principal, role } = await requireRole(c, ["owner_admin"]);
  if (!principal) return jsonError("unauthenticated", "Masuk sebagai administrator.", 401);
  if (!role) return jsonError("forbidden", "Akses pemilik diperlukan.", 403);
  const rows = await c.env.DB.prepare(`SELECT pr.id, pr.user_id AS userId, u.name, substr(u.email,1,1) || '•••' || substr(u.email,instr(u.email,'@')) AS maskedEmail,
    pr.request_type AS requestType, pr.requested_at AS requestedAt FROM privacy_requests pr JOIN user u ON u.id = pr.user_id
    WHERE pr.status = 'requested' ORDER BY pr.requested_at LIMIT 100`).all();
  await addAudit(c.env.DB, c.get("requestId"), principal.id, "admin.privacy.list", null, null, "success", { count: rows.results.length });
  return c.json({ requests: rows.results });
});

app.patch("/api/v1/admin/privacy-requests/:requestId", async (c) => {
  const { principal, role } = await requireRole(c, ["owner_admin"]);
  if (!principal) return jsonError("unauthenticated", "Masuk sebagai administrator.", 401);
  if (!role) return jsonError("forbidden", "Akses pemilik diperlukan.", 403);
  const body = parseBody(z.object({ decision: z.enum(["approve_delete", "reject"]), note: z.string().max(500).optional() }), await c.req.json().catch(() => null));
  if (!body) return jsonError("invalid_request", "Keputusan permintaan tidak valid.");
  const requestId = c.req.param("requestId");
  const request = await c.env.DB.prepare("SELECT id, user_id, request_type FROM privacy_requests WHERE id = ? AND status = 'requested'").bind(requestId).first<{ id: string; user_id: string; request_type: string }>();
  if (!request) return jsonError("not_found", "Permintaan tidak ditemukan atau sudah ditangani.", 404);
  if (body.decision === "approve_delete") {
    if (request.request_type !== "delete_account") return jsonError("invalid_decision", "Keputusan ini hanya berlaku untuk permintaan penghapusan akun.");
    if (request.user_id === principal.id) return jsonError("self_delete", "Minta administrator lain untuk menyelesaikan penghapusan akunmu.", 409);
    const ownerCount = await c.env.DB.prepare("SELECT COUNT(*) AS count FROM account_roles WHERE role = 'owner_admin'").first<{ count: number }>();
    const isOwner = await c.env.DB.prepare("SELECT 1 AS found FROM account_roles WHERE user_id = ? AND role = 'owner_admin'").bind(request.user_id).first();
    if (isOwner && (ownerCount?.count ?? 0) <= 1) return jsonError("last_owner", "Tetapkan pemilik administrator lain sebelum menghapus akun ini.", 409);
    await c.env.DB.batch([
      c.env.DB.prepare(`INSERT INTO audit_events(id, actor_user_id, action, subject_type, subject_id, outcome, request_id, metadata_json)
        VALUES (?, ?, 'admin.privacy.delete_account', 'user', ?, 'success', ?, ?)`)
        .bind(crypto.randomUUID(), principal.id, request.user_id, c.get("requestId"), JSON.stringify({ requestId, note: body.note ?? "" })),
      c.env.DB.prepare("DELETE FROM user WHERE id = ?").bind(request.user_id),
    ]);
    return c.json({ ok: true, deleted: true });
  }
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE privacy_requests SET status = 'rejected', operator_id = ?, notes = ?, completed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND status = 'requested'")
      .bind(principal.id, body.note ?? "", requestId),
    c.env.DB.prepare(`INSERT INTO audit_events(id, actor_user_id, action, subject_type, subject_id, outcome, request_id, metadata_json)
      VALUES (?, ?, 'admin.privacy.rejected', 'privacy_request', ?, 'success', ?, ?)`)
      .bind(crypto.randomUUID(), principal.id, requestId, c.get("requestId"), JSON.stringify({ note: body.note ?? "" })),
  ]);
  return c.json({ ok: true, deleted: false });
});

app.notFound(() => jsonError("not_found", "Rute tidak ditemukan.", 404));
app.onError((error, c) => {
  console.error(JSON.stringify({ requestId: c.get("requestId"), category: "unhandled_api_error", name: error.name }));
  return jsonError("internal_error", "Terjadi kesalahan. Coba lagi nanti.", 500);
});

export default {
  fetch(request: Request, env: AppBindings, ctx: ExecutionContext) {
    if (request.headers.get("origin") && request.headers.get("origin") === new URL(request.url).origin) {
      return app.fetch(request, env, ctx);
    }
    return app.fetch(request, env, ctx);
  },
};
