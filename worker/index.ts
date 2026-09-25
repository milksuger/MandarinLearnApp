import { Hono, type Context } from "hono";
import { z } from "zod";
import OpenCC from "opencc-js/t2cn";
import { createAuth, type AppBindings } from "./auth";

type Principal = { id: string; email: string; name: string } | null;
type AppEnv = { Bindings: AppBindings; Variables: { principal: Principal; requestId: string } };
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
  activityMode: z.enum(["listen", "meaning", "guided_writing", "freehand_writing"]),
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
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
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

app.get("/api/v1/discover", async (c) => {
  const query = (c.req.query("q") ?? "").trim().slice(0, 60);
  const requestedKind = c.req.query("kind") ?? "";
  if (requestedKind && requestedKind !== "daily_life" && requestedKind !== "hsk") return jsonError("invalid_filter", "Filter materi tidak valid.");
  const pattern = `%${query}%`;
  const rows = await c.env.DB.prepare(`WITH eligible AS (
    SELECT v.id, v.simplified_form,
      (SELECT r.id FROM readings r WHERE r.vocabulary_id = v.id AND r.status = 'approved'
        ORDER BY CASE WHEN EXISTS (SELECT 1 FROM audio_assets a WHERE a.reading_id = r.id AND a.status = 'approved'
          AND (a.pronunciation_review = 'passed' OR a.source_attested_at IS NOT NULL)) THEN 0 ELSE 1 END, r.id LIMIT 1) AS reading_id
    FROM vocabulary_entries v
    WHERE v.status = 'approved' AND EXISTS (
      SELECT 1 FROM curriculum_placements cp JOIN curriculum_units u ON u.id = cp.unit_id
      JOIN curricula c ON c.id = u.curriculum_id
      WHERE cp.vocabulary_id = v.id AND u.status = 'published' AND c.status = 'published'))
    SELECT v.id, v.simplified_form AS simplifiedForm,
      (SELECT g.text FROM vocabulary_glosses vg JOIN glosses g ON g.id = vg.gloss_id
        WHERE vg.vocabulary_id = v.id AND g.status = 'approved' AND g.locale = 'id' ORDER BY g.id LIMIT 1) AS meaning,
      r.numbered_pinyin AS pinyin,
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
  const recent = await c.env.DB.prepare(`SELECT u.id AS unitId, u.title AS unitTitle, c.name AS curriculumName
    FROM learning_attempts a JOIN curriculum_placements cp ON cp.id = a.placement_id
    JOIN curriculum_units u ON u.id = cp.unit_id JOIN curricula c ON c.id = u.curriculum_id
    WHERE a.user_id = ? AND u.status = 'published' AND c.status = 'published'
    ORDER BY a.accepted_at DESC LIMIT 1`).bind(principal.id).first();
  const first = recent ? null : await c.env.DB.prepare(`SELECT u.id AS unitId, u.title AS unitTitle, c.name AS curriculumName
    FROM curriculum_units u JOIN curricula c ON c.id = u.curriculum_id
    WHERE c.status = 'published' AND u.status = 'published' AND c.curriculum_kind = 'daily_life'
      AND EXISTS (SELECT 1 FROM curriculum_placements cp WHERE cp.unit_id = u.id)
    ORDER BY u.ordinal LIMIT 1`).first();
  return c.json({ destination: recent ?? first ?? null, resumeMode: recent ? "last_practised_unit" : first ? "first_available_unit" : "no_published_units" });
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
  const unit = await c.env.DB.prepare(`SELECT u.id, u.title, u.description, u.ordinal, c.name AS curriculum_name
    FROM curriculum_units u JOIN curricula c ON c.id = u.curriculum_id
    WHERE u.id = ? AND u.status = 'published' AND c.status = 'published'`).bind(unitId).first();
  if (!unit) return jsonError("not_found", "Pelajaran belum tersedia.", 404);
  const rows = await c.env.DB.prepare(`SELECT p.id AS placement_id, p.ordinal,
    v.id AS vocabulary_id, v.simplified_form, ch.id AS character_id, ch.hanzi, ch.stroke_count,
    r.id AS reading_id, r.pinyin_json, r.numbered_pinyin,
    (SELECT e.simplified_text FROM examples e WHERE e.vocabulary_id = v.id AND e.status = 'approved' AND e.locale = 'id' ORDER BY e.id LIMIT 1) AS example_text,
    (SELECT e.numbered_pinyin FROM examples e WHERE e.vocabulary_id = v.id AND e.status = 'approved' AND e.locale = 'id' ORDER BY e.id LIMIT 1) AS example_pinyin,
    (SELECT e.translation FROM examples e WHERE e.vocabulary_id = v.id AND e.status = 'approved' AND e.locale = 'id' ORDER BY e.id LIMIT 1) AS example_translation,
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
    .bind(unitId).all();
  return c.json({ unit, items: rows.results });
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
    const at = new Date().toISOString();
    const attemptId = crypto.randomUUID();
    const dimensionValues = Object.values(attempt.dimensions);
    const passed = dimensionValues.length > 0 && dimensionValues.every((value) => value === "correct" || value === "recognized" || value === "close_enough");
    const assessmentOutcome = dimensionValues.length === 0 ? "not_assessed" : passed ? "passed"
      : dimensionValues.some((value) => value === "needs_practice" || value === "not_recognized") ? "needs_practice" : "uncertain";
    const passedCount = passed ? 1 : 0;
    const [inserted] = await c.env.DB.batch([
      c.env.DB.prepare(`INSERT OR IGNORE INTO learning_attempts
      (id, user_id, idempotency_key, content_type, content_id, reading_id, placement_id, activity_mode, dimensions_json, engine_version, created_at_client, accepted_at, assessment_outcome)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(attemptId, principal.id, attempt.idempotencyKey, attempt.contentType, attempt.contentId,
          attempt.readingId ?? null, attempt.curriculumPlacementId ?? null, attempt.activityMode,
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
    c.env.DB.prepare("SELECT COUNT(*) AS due_count FROM review_schedules WHERE user_id = ? AND due_at <= ?").bind(principal.id, new Date().toISOString()).first(),
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
  const rows = await c.env.DB.prepare(`SELECT rs.content_type AS contentType, rs.content_id AS contentId, rs.due_at AS dueAt,
    v.simplified_form AS word, ch.hanzi AS character FROM review_schedules rs
    LEFT JOIN vocabulary_entries v ON rs.content_type = 'vocabulary' AND v.id = rs.content_id AND v.status = 'approved'
    LEFT JOIN characters ch ON rs.content_type = 'character' AND ch.id = rs.content_id AND ch.status = 'approved'
    WHERE rs.user_id = ? AND rs.due_at <= ? ORDER BY rs.due_at LIMIT 50`).bind(principal.id, new Date().toISOString()).all();
  return c.json({ items: rows.results });
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
  const [progress, curriculumProgress, daily, freehand] = await Promise.all([
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
    c.env.DB.prepare(`SELECT date(activity_at) AS day, SUM(attempt_count) AS attempts FROM (
      SELECT accepted_at AS activity_at, COUNT(*) AS attempt_count FROM learning_attempts WHERE user_id = ? AND accepted_at >= datetime('now','-30 days') GROUP BY date(accepted_at)
      UNION ALL SELECT occurred_at AS activity_at, COUNT(*) AS attempt_count FROM freehand_recognition_events WHERE user_id = ? AND occurred_at >= datetime('now','-30 days') GROUP BY date(occurred_at)
    ) GROUP BY date(activity_at) ORDER BY day`).bind(learnerId, learnerId).all(),
    c.env.DB.prepare("SELECT hanzi, unicode_code_point AS codePoint, engine_id AS engineId, candidate_rank AS candidateRank, occurred_at AS occurredAt FROM freehand_recognition_events WHERE user_id = ? ORDER BY occurred_at DESC LIMIT 100").bind(learnerId).all(),
  ]);
  return c.json({ learner, progress: progress.results, curriculumProgress: curriculumProgress.results, activity: daily.results, freehand: freehand.results });
});

app.get("/api/v1/admin/content/review-queue", async (c) => {
  const { principal, role } = await requireRole(c, ["owner_admin", "content_reviewer"]);
  if (!principal) return jsonError("unauthenticated", "Masuk sebagai reviewer.", 401);
  if (!role) return jsonError("forbidden", "Akses reviewer diperlukan.", 403);
  const [words, characters, readings, audio] = await Promise.all([
    c.env.DB.prepare("SELECT id, simplified_form AS text, status, source_id AS sourceId FROM vocabulary_entries WHERE status IN ('draft','needs_review') ORDER BY updated_at DESC LIMIT 100").all(),
    c.env.DB.prepare("SELECT id, hanzi AS text, status, source_id AS sourceId, stroke_data_status AS strokeStatus FROM characters WHERE status IN ('draft','needs_review') ORDER BY updated_at DESC LIMIT 100").all(),
    c.env.DB.prepare("SELECT id, context_label AS text, status, source_id AS sourceId, numbered_pinyin AS pinyin FROM readings WHERE status IN ('draft','needs_review') ORDER BY id LIMIT 100").all(),
    c.env.DB.prepare(`SELECT a.id, r.context_label AS text, r.numbered_pinyin AS pinyin, a.dialect, a.recording_context AS recordingContext,
      a.format, a.size_bytes AS sizeBytes, a.duration_ms AS durationMs, a.sha256, a.status, a.pronunciation_review AS pronunciationReview,
      s.name AS sourceName, s.license_id AS license, s.license_url AS licenseUrl, s.attribution,
      a.source_page_url AS sourcePageUrl, a.source_attested_at AS sourceAttestedAt,
      a.source_attestation_method AS sourceAttestationMethod
      FROM audio_assets a JOIN readings r ON r.id = a.reading_id JOIN asset_sources s ON s.id = a.source_id
      WHERE a.status = 'candidate' OR (a.status = 'approved' AND a.source_attested_at IS NOT NULL)
      ORDER BY a.created_at LIMIT 100`).all(),
  ]);
  return c.json({ vocabulary: words.results, characters: characters.results, readings: readings.results, audio: audio.results });
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
  const result = await c.env.DB.prepare(`UPDATE audio_assets SET pronunciation_review = ?, status = ?, reviewer_user_id = ?,
    reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND status IN ('candidate','approved')`)
    .bind(body.decision, status, principal.id, c.req.param("audioId")).run();
  const found = (result.meta.changes ?? 0) > 0;
  await addAudit(c.env.DB, c.get("requestId"), principal.id, `admin.audio.${body.decision}`, "audio_asset", c.req.param("audioId"), found ? "success" : "failure", { note: body.note });
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
