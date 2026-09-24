import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router";
import { Activity, ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, CircleHelp, Clock3, Cloud, Flame, Headphones, Home, Layers3, LogOut, Menu, Pause, Play, RotateCcw, Search, Settings, ShieldCheck, Sparkles, UserRound, Volume2, X } from "lucide-react";
import HanziWriter from "hanzi-writer";
import OpenCC from "opencc-js/t2cn";
import { authClient } from "./auth-client";
import { api, audioUrl } from "../shared/api";
import { enqueueAttempt, enqueueRecognition, pendingAttempts, syncOutbox } from "../features/sync/outbox";

type SessionResult = ReturnType<typeof authClient.useSession>;
type SessionUser = NonNullable<SessionResult["data"]>["user"];
type UserProfile = { display_name: string; email: string; locale: string; daily_goal_minutes: number; roles?: string[] };
type Metrics = { learned_items: number; attempts: number; correct: number; streak_days: number };
type Unit = { id: string; title: string; description: string | null; curriculum_name: string };
type UnitItem = { placement_id: string; vocabulary_id: string | null; simplified_form: string | null; character_id: string | null; hanzi: string | null; stroke_count: number | null; reading_id: string | null; pinyin_json: string | null; numbered_pinyin: string | null; gloss: string | null; audio_id: string | null; duration_ms: number | null };

function useLearnerSession() { return authClient.useSession(); }

function App() {
  const session = useLearnerSession();
  return <Routes>
    <Route element={<LearnerFrame user={session.data?.user ?? null} isPending={session.isPending} />}>
      <Route path="/" element={<HomePage user={session.data?.user ?? null} />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/paths" element={<PathsPage />} />
      <Route path="/paths/:pathId" element={<PathPage />} />
      <Route path="/unit/:unitId" element={<LessonPage />} />
      <Route path="/word/:entryId" element={<WordPage />} />
      <Route path="/write/:characterId" element={<GuidedWritingPage />} />
      <Route path="/freehand" element={<FreehandPage />} />
      <Route path="/review" element={<ReviewPage />} />
      <Route path="/session-summary" element={<SummaryPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/credits" element={<CreditsPage />} />
    </Route>
    <Route path="/admin" element={<AdminFrame user={session.data?.user ?? null} isPending={session.isPending} />}>
      <Route index element={<AdminOverview />} />
      <Route path="learners" element={<AdminLearners />} />
      <Route path="learners/:learnerId" element={<AdminLearnerPage />} />
      <Route path="content" element={<AdminContent />} />
      <Route path="audit" element={<AdminAudit />} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>;
}

function LearnerFrame({ user, isPending }: { user: SessionUser | null; isPending: boolean }) {
  const [syncState, setSyncState] = useState("synced");
  const [pending, setPending] = useState(0);
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const count = user ? (await pendingAttempts(user.id)).length : 0;
      if (alive) setPending(count);
      if (user && navigator.onLine) {
        try {
          const result = await syncOutbox(user.id);
          if (alive) { setSyncState(result.state); setPending(result.pending); }
        } catch { if (alive) setSyncState(navigator.onLine ? "sync-error" : "offline"); }
      } else if (alive) setSyncState(navigator.onLine ? "signed-out" : "offline");
    };
    void refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => { alive = false; window.removeEventListener("online", refresh); window.removeEventListener("offline", refresh); };
  }, [user]);
  return <div className="learner-frame">
    <header className="learner-topbar"><Link to="/" className="brand"><span className="brand-mark">文</span><span>Belajar Mandarin</span></Link>
      <div className="topbar-actions"><SyncPill state={syncState} pending={pending} /><Link aria-label={user ? "Buka profil dan pengaturan" : "Masuk ke akun"} title={user ? "Profil dan pengaturan" : "Masuk"} to={user ? "/profile" : "/login"} className="avatar">{user ? user.name.slice(0, 1).toUpperCase() : <UserRound size={18} />}</Link></div>
    </header>
    <main className="learner-main">{isPending ? <div className="centered-page"><div className="loader" /></div> : <Outlet />}</main>
    <nav className="mobile-nav" aria-label="Navigasi utama">
      <NavLink to="/" end><Home /><span>Beranda</span></NavLink><NavLink to="/paths"><Layers3 /><span>Belajar</span></NavLink><NavLink to="/review"><RotateCcw /><span>Ulangi</span></NavLink><NavLink to="/profile"><UserRound /><span>Profil</span></NavLink>
    </nav>
  </div>;
}

function SyncPill({ state, pending }: { state: string; pending: number }) {
  const label = state === "synced" ? "Tersinkron" : state === "offline" ? "Offline" : state === "syncing" ? "Menyinkronkan" : state === "signed-out" ? "Belum masuk" : state === "sign-in-required" ? "Masuk untuk sinkron" : `Menunggu sinkron · ${pending}`;
  return <span className={`sync-pill sync-${state}`} role="status" aria-label={`Sinkronisasi: ${label}`} title={`Sinkronisasi: ${label}`}><Cloud size={14} /><span>{label}</span></span>;
}

function Protected({ children }: { children: React.ReactNode }) {
  const { data, isPending } = useLearnerSession();
  if (isPending) return <div className="centered-page"><div className="loader" /></div>;
  if (!data?.user) return <section className="auth-required" aria-labelledby="auth-gate-title"><div className="auth-gate-art" aria-hidden="true"><span className="gate-spark gate-spark-one">✦</span><span className="gate-character">文</span><span className="gate-bubble">你好!</span><span className="gate-spark gate-spark-two">✧</span></div><div className="auth-gate-copy"><span className="tag">RUANG BELAJAR MANDARIN</span><h2 id="auth-gate-title">Satu karakter hari ini, selangkah lebih dekat.</h2><p>Kemajuanmu tersimpan di akun dan bisa dilanjutkan di ponsel atau iPad.</p><div className="auth-gate-actions"><Link className="button button-primary" to="/signup">Mulai belajar <ArrowRight /></Link><Link className="button button-soft" to="/login">Saya sudah punya akun</Link></div><small>Belajar gratis · dirancang untuk sentuhan dan Apple Pencil</small></div></section>;
  return <>{children}</>;
}

function HomePage({ user }: { user: SessionUser | null }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [dueReviews, setDueReviews] = useState<number | null>(null);
  const [paths, setPaths] = useState<Array<{ id: string; slug: string; name: string; kind: string; description: string | null }>>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ paths: typeof paths }>("/paths").then((data) => setPaths(data.paths)).catch(() => setError("Tidak dapat memuat jalur belajar."));
    if (user) api<{ summary: Metrics; due: number }>("/progress").then((data) => { setMetrics(data.summary); setDueReviews(data.due); }).catch(() => { setMetrics(null); setDueReviews(null); });
  }, [user]);
  const name = user?.name?.trim().split(" ")[0] || "teman";
  return <Protected><div className="home-wrap">
    <section className="greeting-row"><div><p className="eyebrow">SELAMAT DATANG KEMBALI</p><h1>你好, {name} <span className="wave">✦</span></h1><p className="muted">Setiap guratan membawamu selangkah lebih dekat.</p></div><div className="streak-chip" title="Jumlah hari belajar berurutan" aria-label={(metrics?.streak_days ?? 0) + " hari belajar berurutan"}><Flame size={18} /><span><strong>{metrics?.streak_days ?? 0}</strong><small>hari belajar beruntun</small></span></div></section>
    <section className="daily-card"><div className="daily-copy"><span className="tag tag-white">TUJUAN HARI INI</span><h2>Belajar sedikit, setiap hari.</h2><p>Mulai dengan beberapa kata yang berguna dalam kehidupan sehari-hari.</p><Link to="/paths" className="button button-dark">Mulai belajar <ArrowRight size={16} /></Link></div><div className="daily-art" aria-hidden="true"><span>山</span><small>shān · gunung</small></div></section>
    <section className="metric-grid"><MetricCard icon={<BookOpen />} label="Materi dipelajari" value={metrics?.learned_items ?? 0} unit="kata & karakter" /><MetricCard icon={<Activity />} label="Latihan selesai" value={metrics?.attempts ?? 0} unit="semua sesi" /><MetricCard icon={<Clock3 />} label="Siap diulang" value={dueReviews ?? 0} unit="kata dan karakter" /></section>
    <div className="section-heading"><div><h2>Jalur belajarmu</h2><p>Belajar dari keseharian atau pilih susunan HSK 2.0 maupun HSK 3.0.</p></div><Link to="/paths" className="text-link">Lihat semua <ChevronRight size={16} /></Link></div>
    {error && <InlineNotice>{error}</InlineNotice>}
    {paths.length ? <div className="path-cards">{paths.map((path) => <PathCard key={path.id} path={path} />)}</div> : <div className="empty-card"><div className="empty-icon"><Layers3 /></div><h3>Jalur materi sedang disiapkan</h3><p>Materi baru akan muncul setelah ditinjau untuk memastikan arti, pelafalan dan sumbernya benar.</p><Link className="button button-soft" to="/paths">Jelajahi jalur belajar <ArrowRight size={16} /></Link></div>}
    <footer className="trust-note"><ShieldCheck size={16} /> Audio dan data guratan yang digunakan mencantumkan sumber, lisensi, dan checksum. <Link to="/credits">Lihat kredit</Link></footer>
  </div></Protected>;
}

function MetricCard({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: React.ReactNode; unit: string }) {
  return <div className="metric-card"><div className="metric-icon">{icon}</div><p>{label}</p><strong>{value}</strong><small>{unit}</small></div>;
}

function PathCard({ path }: { path: { id: string; slug: string; name: string; kind: string; description: string | null } }) {
  const hsk = path.kind === "hsk";
  return <Link to={`/paths/${path.id}`} className={`path-card ${hsk ? "path-hsk" : "path-daily"}`}>
    <span className="path-glyph">{hsk ? "级" : "日"}</span><div><span className="tag">{hsk ? (path.slug === "hsk-2" ? "HSK 2.0 · 6 TINGKAT" : "HSK 3.0 · 9 TINGKAT") : "KEHIDUPAN SEHARI-HARI"}</span><h3>{path.name}</h3><p>{path.description ?? "Materi disusun bertahap."}</p></div><ChevronRight className="path-arrow" />
  </Link>;
}

function PathsPage() {
  const [paths, setPaths] = useState<Array<{ id: string; slug: string; name: string; kind: string; description: string | null }>>([]);
  useEffect(() => { void api<{ paths: typeof paths }>("/paths").then((data) => setPaths(data.paths)).catch(() => setPaths([])); }, []);
  return <Protected><div className="page-wrap"><PageBack /><PageTitle eyebrow="PILIH JALUR" title="Belajar sesuai tujuanmu" subtitle="Kata sehari-hari untuk praktik, dan susunan HSK untuk mengikuti tingkat kemampuan." />
    {paths.length ? <div className="path-cards path-cards-page">{paths.map((path) => <PathCard key={path.id} path={path} />)}</div> : <div className="empty-card"><div className="empty-icon"><BookOpen /></div><h3>Materi sedang ditinjau</h3><p>Susunan jalur sudah dibuat. Kosakata dan penempatan pelajaran akan diterbitkan setelah sumber serta lisensinya diperiksa.</p><div className="hsk-level-strip">{Array.from({ length: 9 }, (_, i) => <span key={i}>HSK {i + 1}</span>)}</div></div>}
  </div></Protected>;
}

function PathPage() {
  const { pathId = "" } = useParams();
  const [units, setUnits] = useState<Array<{ id: string; title: string; description: string | null; ordinal: number; placement_count: number }>>([]);
  const pathName = pathId === "curriculum-hsk-3" ? "HSK 3.0 · 9 tingkat" : pathId === "curriculum-hsk-2" ? "HSK 2.0 · 6 tingkat" : "Keseharian";
  const hskPath = pathId === "curriculum-hsk-3" || pathId === "curriculum-hsk-2";
  useEffect(() => { void api<{ units: typeof units }>(`/paths/${encodeURIComponent(pathId)}/units`).then((data) => setUnits(data.units)).catch(() => setUnits([])); }, [pathId]);
  return <Protected><div className="page-wrap"><PageBack to="/paths" /><PageTitle eyebrow="JALUR BELAJAR" title={pathName || "Susunan materi"} subtitle={hskPath ? "Kerangka resmi HSK tersedia dan dipakai untuk menyusun jalur. Materi pemula di sini ditulis khusus untuk aplikasi, bukan salinan daftar resmi." : "Kata, contoh, dan latihan berbahasa Indonesia untuk situasi sehari-hari."} />
    {units.length ? <div className="unit-list">{units.map((unit) => <Link className="unit-row" to={`/unit/${unit.id}`} key={unit.id}><span className="unit-number">{String(unit.ordinal + 1).padStart(2, "0")}</span><span className="unit-copy"><strong>{unit.title}</strong><small>{unit.description ?? `${unit.placement_count} materi`}</small></span><span className="unit-progress">{unit.placement_count} materi</span><ChevronRight /></Link>)}</div> : <div className="empty-card"><div className="hsk-level-strip">{Array.from({ length: pathId === "curriculum-hsk-2" ? 6 : 9 }, (_, i) => <span key={i}>Tingkat {i + 1}</span>)}</div><h3>Daftar pelajaran akan segera tersedia</h3><p>Kami tidak menampilkan jumlah kata HSK yang belum diverifikasi dari sumber resmi.</p></div>}
  </div></Protected>;
}

function LessonPage() {
  const { unitId = "" } = useParams();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [items, setItems] = useState<UnitItem[]>([]);
  useEffect(() => { void api<{ unit: Unit; items: UnitItem[] }>(`/units/${encodeURIComponent(unitId)}`).then((data) => { setUnit(data.unit); setItems(data.items); }).catch(() => { setUnit(null); setItems([]); }); }, [unitId]);
  return <Protected><div className="page-wrap"><PageBack to="/paths" /><PageTitle eyebrow={unit?.curriculum_name ?? "PELAJARAN"} title={unit?.title ?? "Pelajaran"} subtitle={unit?.description ?? "Kenali kata, konteks penggunaan, dan cara menulisnya."} />
    {items.length ? <div className="lesson-items">{items.map((item) => {
      const context = new URLSearchParams({ placementId: item.placement_id, unitId });
      const to = item.vocabulary_id ? `/word/${item.vocabulary_id}?${context}` : `/write/${item.character_id}?${context}`;
      return <article className="vocab-row" key={item.placement_id}><span className="hanzi-thumb">{item.simplified_form ?? item.hanzi}</span><div><strong>{item.simplified_form ?? item.hanzi}</strong><small>{item.numbered_pinyin ?? "Pengucapan ditinjau"} · {item.gloss ?? "Arti sedang ditinjau"}</small></div><AudioButton assetId={item.audio_id} /><Link className="icon-button" to={to} aria-label="Buka materi"><ChevronRight /></Link></article>;
    })}</div> : <div className="empty-card"><div className="empty-icon"><BookOpen /></div><h3>Belum ada materi terbit</h3><p>Bagian ini menampilkan materi yang sudah lolos pemeriksaan editorial. Draf tidak ikut disajikan ke pembelajar.</p></div>}
  </div></Protected>;
}

function WordPage() {
  const { entryId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const placementId = searchParams.get("placementId");
  const unitId = searchParams.get("unitId");
  const writeParams = new URLSearchParams();
  if (placementId) writeParams.set("placementId", placementId);
  if (unitId) writeParams.set("unitId", unitId);
  writeParams.set("returnWordId", entryId);
  const writeQuery = `?${writeParams}`;
  const [entry, setEntry] = useState<{ entry: { id: string; simplifiedForm: string; partOfSpeech?: string }; readings: Array<{ id: string; contextText: string; pinyin: string; numberedPinyin: string; audioId?: string }>; senses: Array<{ id: string; text: string; usageLabel?: string }>; examples: Array<{ id: string; simplifiedText: string; numberedPinyin: string; translation: string }>; characters: Array<{ id: string; hanzi: string; strokeCount: number; strokeDataStatus: string }> } | null>(null);
  useEffect(() => { void api<typeof entry>(`/vocabulary/${encodeURIComponent(entryId)}`).then(setEntry).catch(() => setEntry(null)); }, [entryId]);
  if (!entry) return <Protected><div className="page-wrap"><PageBack /><EmptyContent message="Kata ini belum tersedia untuk dipelajari." /></div></Protected>;
  return <Protected><div className="page-wrap word-page"><PageBack to={unitId ? `/unit/${unitId}` : "/paths"} /><div className="word-hero"><span className="tag">KATA DALAM KONTEKS</span><h1>{entry.entry.simplifiedForm}</h1><p>{entry.readings[0]?.numberedPinyin ?? "Pelafalan sedang ditinjau"}</p><AudioButton assetId={entry.readings[0]?.audioId} prominent /></div>
    <section className="detail-card"><h2>Makna</h2>{entry.senses.length ? entry.senses.map((sense) => <p key={sense.id}>{sense.text}<span className="muted"> {sense.usageLabel}</span></p>) : <InlineNotice>Terjemahan bahasa Indonesia belum disetujui.</InlineNotice>}</section>
    <section className="detail-card"><h2>Karakter penyusun</h2><div className="character-strip">{entry.characters.map((char) => <Link key={char.id} to={`/write/${char.id}${writeQuery}`}><strong>{char.hanzi}</strong><small>{char.strokeCount} guratan</small></Link>)}</div></section>
    {entry.examples.length > 0 && <section className="detail-card"><h2>Contoh kalimat</h2>{entry.examples.map((example) => <div className="example" key={example.id}><strong>{example.simplifiedText}</strong><small>{example.numberedPinyin}</small><p>{example.translation}</p></div>)}</section>}
  </div></Protected>;
}

function GuidedWritingPage() {
  const { characterId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const placementId = searchParams.get("placementId");
  const unitId = searchParams.get("unitId");
  const returnWordId = searchParams.get("returnWordId");
  const returnParams = new URLSearchParams();
  if (placementId) returnParams.set("placementId", placementId);
  if (unitId) returnParams.set("unitId", unitId);
  const returnQuery = returnParams.toString();
  const returnTo = returnWordId
    ? `/word/${returnWordId}${returnQuery ? `?${returnQuery}` : ""}`
    : unitId ? `/unit/${unitId}` : "/paths";
  const { data: currentSession } = useLearnerSession();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const writerRef = useRef<HanziWriter | null>(null);
  const [target, setTarget] = useState<{ hanzi: string; strokeCount: number; strokeDataStatus: string } | null>(null);
  const [writerState, setWriterState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [result, setResult] = useState<string>("");
  const [mode, setMode] = useState<"tutorial" | "practice">("tutorial");
  const [strokeIndex, setStrokeIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let writer: HanziWriter | undefined;
    let cancelled = false;
    const host = document.getElementById("stroke-writer");
    if (!host) return;
    host.replaceChildren();
    void api<{ character: { hanzi: string; strokeCount: number; strokeDataStatus: string } }>(`/characters/${encodeURIComponent(characterId)}`).then(async ({ character }) => {
      if (cancelled) return;
      setTarget(character);
      const response = await fetch(`/api/v1/strokes/${encodeURIComponent(characterId)}`, { credentials: "include" });
      if (!response.ok) throw new Error("stroke data unavailable");
      const data = await response.json() as { strokes: string[]; medians: number[][][]; radStrokes?: number[] };
      writer = HanziWriter.create(host, character.hanzi, {
        width: Math.min(500, Math.max(260, Math.min(window.innerWidth - 56, window.innerHeight - 220))),
        height: Math.min(500, Math.max(260, Math.min(window.innerWidth - 56, window.innerHeight - 220))),
        padding: 20,
        showOutline: true,
        showCharacter: false,
        strokeColor: "#171717",
        outlineColor: "#d8dbe3",
        drawingColor: "#171717",
        highlightColor: "#171717",
        highlightCompleteColor: "#171717",
        drawingWidth: 12,
        strokeAnimationSpeed: 0.85,
        delayBetweenStrokes: 480,
        charDataLoader: (_char, onLoad) => { onLoad(data); return data; },
      });
      if (cancelled) { writer?.cancelQuiz(); host.replaceChildren(); return; }
      writerRef.current = writer;
      setStrokeIndex(-1); setMode("tutorial"); setPlaying(false); setPaused(false);
      setWriterState("ready");
      setResult("Mulai dengan melihat seluruh urutan, lalu coba tulis sendiri.");
    }).catch(() => { if (!cancelled) setWriterState("unavailable"); });
    return () => { cancelled = true; writer?.cancelQuiz(); if (writerRef.current === writer) writerRef.current = null; };
  }, [characterId, currentSession?.user.id, placementId]);

  const playTutorial = () => {
    const writer = writerRef.current;
    if (!writer) return;
    writer.cancelQuiz();
    setMode("tutorial"); setPlaying(true); setPaused(false); setResult("Perhatikan arah dan urutan setiap guratan.");
    void writer.animateCharacter({ onComplete: ({ canceled }) => {
      setPlaying(false); setPaused(false);
      if (!canceled) { setStrokeIndex((target?.strokeCount ?? 1) - 1); setResult("Urutan lengkap selesai. Putar lagi atau coba menulis sendiri."); }
    } });
  };

  const showStrokeThrough = async (requestedIndex: number) => {
    const writer = writerRef.current;
    if (!writer || !target || playing) return;
    const nextIndex = Math.max(0, Math.min(target.strokeCount - 1, requestedIndex));
    writer.cancelQuiz(); setMode("tutorial"); setPlaying(true); setPaused(false);
    setResult("Lihat guratan satu per satu dari awal.");
    await writer.hideCharacter({ duration: 0 });
    for (let index = 0; index <= nextIndex; index += 1) await writer.animateStroke(index);
    setStrokeIndex(nextIndex); setPlaying(false);
    setResult("Guratan " + (nextIndex + 1) + " dari " + target.strokeCount + ". Ikuti arah hitam yang terisi perlahan.");
  };

  const startPractice = () => {
    const writer = writerRef.current;
    if (!writer) return;
    writer.cancelQuiz(); setMode("practice"); setPlaying(false); setPaused(false);
    setResult("Mulai menulis dari guratan pertama. Guratanmu terisi hitam saat digambar.");
    void writer.hideCharacter({ duration: 0 }).then(() => writer.quiz({ showHintAfterMisses: 1, markStrokeCorrectAfterMisses: false, acceptBackwardsStrokes: false,
      onCorrectStroke: (stroke) => setResult("Guratan " + (stroke.strokeNum + 1) + " benar"),
      onMistake: (stroke) => setResult("Perhatikan arah dan urutan guratan " + (stroke.strokeNum + 1)),
      onComplete: (summary) => {
        setResult(summary.totalMistakes ? "Sesi selesai · " + summary.totalMistakes + " koreksi arah atau bentuk" : "Semua guratan selesai dengan benar");
        if (currentSession?.user.id) void saveAttempt({ contentType: "character", contentId: characterId, curriculumPlacementId: placementId ?? undefined, activityMode: "guided_writing", dimensions: { strokeOrder: summary.totalMistakes ? "needs_practice" : "correct" }, engineVersion: "hanzi-writer-local" }, currentSession.user.id);
      },
    }));
  };

  const togglePlayback = () => {
    const writer = writerRef.current;
    if (!writer) return;
    if (paused) { void writer.resumeAnimation(); setPaused(false); }
    else { void writer.pauseAnimation(); setPaused(true); }
  };
  return <Protected><div className="practice-page"><PageBack to={returnTo} /><div className="practice-heading"><div><span className="tag">逐笔引导 · LATIHAN MENULIS</span><h1>{target?.hanzi ?? "写"}</h1><p>{target ? `${target.strokeCount} guratan · ikuti petunjuk 一笔一笔` : "Pilih karakter dari pelajaran yang tersedia."}</p></div><button className="button button-soft" disabled={writerState !== "ready" || playing} onClick={playTutorial}><RotateCcw size={16} /> Putar ulang</button></div>
    <div className="writing-layout"><div className="writing-main"><div id="stroke-writer" className="writer-board" ref={containerRef}><div className="practice-grid" aria-hidden="true" /></div><div className="writer-mode-tabs" role="group" aria-label="Pilih cara belajar menulis"><button className={`button ${mode === "tutorial" ? "button-primary" : "button-soft"}`} disabled={writerState !== "ready" || playing} aria-pressed={mode === "tutorial"} onClick={playTutorial}><Play /> Putar seluruh urutan</button><button className={`button ${mode === "practice" ? "button-primary" : "button-soft"}`} disabled={writerState !== "ready" || playing} aria-pressed={mode === "practice"} onClick={startPractice}>Mulai menulis</button></div>
      {mode === "tutorial" && <div className="stroke-stepper"><button className="icon-button" aria-label="Tampilkan guratan sebelumnya" disabled={writerState !== "ready" || playing || strokeIndex <= 0} onClick={() => void showStrokeThrough(strokeIndex - 1)}><ChevronLeft /></button><span>Langkah {target ? strokeIndex + 1 : 0} dari {target?.strokeCount ?? "—"}</span><button className="icon-button" aria-label="Tampilkan guratan berikutnya" disabled={writerState !== "ready" || playing || strokeIndex >= (target?.strokeCount ?? 0) - 1} onClick={() => void showStrokeThrough(strokeIndex + 1)}><ChevronRight /></button><button className="icon-button" aria-label={paused ? "Lanjutkan tutorial" : "Jeda tutorial"} disabled={!playing} onClick={togglePlayback}>{paused ? <Play /> : <Pause />}</button></div>}
      <div className={`practice-feedback ${result.includes("benar") ? "feedback-good" : ""}`} aria-live="polite">{writerState === "loading" ? "Memuat data guratan yang telah ditinjau…" : writerState === "unavailable" ? "Data guratan berlisensi dan terverifikasi belum tersedia untuk karakter ini." : result || "Mulai dengan mengikuti petunjuk guratan."}</div></div>
      <aside className="writing-aside"><div className="aside-card"><span className="aside-step">TUTORIAL LENGKAP</span><strong>Lihat, ulangi, lalu tulis</strong><p>Putar seluruh urutan dari awal. Gunakan panah untuk melihat hingga guratan tertentu, lalu mulai latihan arah dan bentuk.</p><button className="button button-soft" disabled={writerState !== "ready" || playing} onClick={playTutorial}><RotateCcw /> Putar ulang tutorial</button></div><div className="aside-card aside-light"><span className="aside-step">YANG DINILAI</span><span className="check-line"><Check /> Urutan guratan</span><span className="check-line"><Check /> Arah guratan</span><span className="check-line"><Check /> Bentuk mendekati contoh</span></div><div className="aside-note"><ShieldCheck size={15} /> Jejak pena tidak disimpan di server.</div></aside>
    </div></div></Protected>;
}

function FreehandPage() {
  const { data: currentSession } = useLearnerSession();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef(0);
  const strokesRef = useRef<Array<Array<[number, number]>>>([]);
  const currentStrokeRef = useRef<Array<[number, number]> | null>(null);
  const simplify = useRef(OpenCC.Converter({ from: "t", to: "cn" }));
  const [recognizerState, setRecognizerState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [candidates, setCandidates] = useState<Array<{ hanzi: string; score: number }>>([]);
  const [strokeCount, setStrokeCount] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [notice, setNotice] = useState("");
  const points = useRef(false);
  useEffect(() => {
    if (!("Worker" in window) || !("WebAssembly" in window)) { setRecognizerState("unavailable"); return; }
    const worker = new Worker("/workers/hanzi-recognition-worker.js");
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<{ type: string; requestId?: number; matches?: Array<{ hanzi: string; score: number }>; message?: string }>) => {
      const message = event.data;
      if (message.type === "ready") { setRecognizerState("ready"); return; }
      if (message.type === "matches" && message.requestId === requestRef.current) {
        const bySimplified = new Map<string, number>();
        for (const candidate of message.matches ?? []) {
          const simplified = simplify.current(candidate.hanzi);
          if ([...simplified].length !== 1 || !/\p{Script=Han}/u.test(simplified)) continue;
          bySimplified.set(simplified, Math.max(bySimplified.get(simplified) ?? -Infinity, candidate.score));
        }
        setCandidates([...bySimplified].map(([hanzi, score]) => ({ hanzi, score })).sort((left, right) => right.score - left.score).slice(0, 8));
        setRecognizing(false);
        setNotice(message.matches?.length ? "Pilih yang paling sesuai. Urutan ini adalah saran mesin, bukan kepastian." : "Belum ada aksara yang cocok. Coba tulis lebih besar dan satu karakter saja.");
      }
      if (message.type === "error") { setRecognizing(false); setRecognizerState("unavailable"); setNotice("Pengenal lokal tidak dapat dimuat pada perangkat ini."); }
    };
    worker.onerror = () => { setRecognizerState("unavailable"); setRecognizing(false); setNotice("Pengenal lokal tidak dapat dimuat pada perangkat ini."); };
    worker.postMessage({ type: "initialize" });
    return () => { worker.terminate(); workerRef.current = null; };
  }, []);
  const setCanvas = (canvas: HTMLCanvasElement | null) => {
    if (!canvas || canvasRef.current) return;
    canvasRef.current = canvas;
    const ctx = canvas.getContext("2d");
    if (ctx) { ctx.lineWidth = 8; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#20243a"; }
  };
  const getCanvas = () => canvasRef.current;
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = getCanvas(); const ctx = canvas?.getContext("2d"); if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect(); const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height;
    if (strokesRef.current.length >= 64) { setNotice("Sesi dibatasi hingga 64 guratan. Bersihkan kanvas untuk mulai lagi."); return; }
    const point: [number, number] = [(event.clientX - rect.left) * scaleX, (event.clientY - rect.top) * scaleY];
    const stroke: Array<[number, number]> = [point];
    strokesRef.current.push(stroke); currentStrokeRef.current = stroke;
    setCandidates([]); setNotice("");
    ctx.beginPath(); ctx.moveTo(point[0], point[1]);
    canvas.setPointerCapture(event.pointerId); points.current = true; setDrawing(true); setStrokeCount(strokesRef.current.length);
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!points.current) return; const canvas = getCanvas(); const ctx = canvas?.getContext("2d"); if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect(); const x = (event.clientX - rect.left) * canvas.width / rect.width; const y = (event.clientY - rect.top) * canvas.height / rect.height;
    const stroke = currentStrokeRef.current; const previous = stroke?.at(-1);
    if (stroke && previous && Math.hypot(x - previous[0], y - previous[1]) >= 2) stroke.push([x, y]);
    ctx.lineTo(x, y); ctx.stroke();
  };
  const end = () => { points.current = false; currentStrokeRef.current = null; setDrawing(false); };
  const redraw = (strokes: Array<Array<[number, number]>>) => {
    const canvas = getCanvas(); const ctx = canvas?.getContext("2d"); if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.beginPath();
    for (const stroke of strokes) { if (!stroke.length) continue; ctx.moveTo(stroke[0][0], stroke[0][1]); for (const [x, y] of stroke.slice(1)) ctx.lineTo(x, y); ctx.stroke(); }
  };
  const clear = () => { strokesRef.current = []; redraw([]); setStrokeCount(0); setCandidates([]); setNotice(""); };
  const undo = () => { strokesRef.current.pop(); redraw(strokesRef.current); setStrokeCount(strokesRef.current.length); setCandidates([]); setNotice(""); };
  const recognize = () => {
    if (recognizerState !== "ready" || !strokesRef.current.length) { setNotice("Tulis satu karakter terlebih dahulu."); return; }
    const requestId = ++requestRef.current; setRecognizing(true); setNotice("Mencari aksara yang bentuknya mirip…");
    workerRef.current?.postMessage({ type: "recognize", requestId, strokes: strokesRef.current, limit: 8 });
  };
  const confirmCandidate = async (candidate: { hanzi: string; score: number }, index: number) => {
    try {
      const userId = currentSession?.user.id;
      if (!userId) throw new Error("Masuk agar hasil konfirmasi dapat tersinkron.");
      const selected = simplify.current(candidate.hanzi);
      await enqueueRecognition({ hanzi: selected, candidateRank: index + 1 }, userId);
      const sync = await syncOutbox(userId);
      setNotice(sync.state === "synced"
        ? `已确认是「${selected}」。只保存了你确认的字与练习结果；笔迹没有上传。`
        : sync.state === "offline"
          ? `「${selected}」已保存在此账号的待同步队列中；笔迹没有上传。`
          : `「${selected}」已保留在待同步队列中。联网后会自动重试；笔迹没有上传。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "目前无法保存确认结果。笔迹没有上传。");
    }
  };
  return <Protected><div className="practice-page"><PageBack to="/" /><PageTitle eyebrow="自由书写" title="写写看，不限笔顺" subtitle="自由手写用来观察字形；笔顺练习请使用逐笔引导。" />
    <div className="freehand-layout"><div className="freehand-canvas-wrap"><canvas id="freehand-canvas" ref={setCanvas} width={960} height={960} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} className="freehand-canvas" aria-label="自由手写画布" /><div className="freehand-hint">{drawing ? "正在书写…" : "用触控笔或手指在方格中写字"}</div></div>
      <aside className="freehand-side"><div className="aside-card"><span className="aside-step">本机辨识 · {recognizerState === "ready" ? "已就绪" : recognizerState === "loading" ? "载入中" : "无法使用"}</span><strong>在你的设备上找相似字</strong><p>引擎在浏览器本机运行，提供候选字并由你确认；不会把笔迹传送或保存到服务器。相似排序不代表准确率。</p></div><div className="freehand-count"><small>本次落笔</small><strong>{strokeCount}</strong><span>笔</span></div><div className="freehand-actions"><button className="button button-soft" onClick={undo} disabled={!strokeCount}><RotateCcw size={16} /> 撤销一笔</button><button className="button button-soft" onClick={clear} disabled={!strokeCount}><X size={16} /> 清除</button><button className="button button-primary" onClick={recognize} disabled={recognizing || recognizerState !== "ready" || !strokeCount}><Search size={16} /> {recognizing ? "辨认中…" : "辨认手写"}</button></div>
        {candidates.length > 0 && <div className="candidate-panel"><strong>你想写的是哪个字？</strong><p>选一个确认；结果只代表本次辨认。</p><div className="candidate-grid">{candidates.map((candidate, index) => <button className="candidate-chip" key={`${candidate.hanzi}-${index}`} onClick={() => void confirmCandidate(candidate, index)} aria-label={`确认为${candidate.hanzi}`}><span>{candidate.hanzi}</span><small>{index + 1}</small></button>)}</div></div>}
        {notice && <InlineNotice>{notice}</InlineNotice>}</aside>
    </div>
  </div></Protected>;
}

function ReviewPage() {
  const [items, setItems] = useState<Array<{ contentType: string; contentId: string; dueAt: string; word: string | null; character: string | null }>>([]);
  useEffect(() => { void api<{ items: typeof items }>("/reviews").then((data) => setItems(data.items)).catch(() => setItems([])); }, []);
  return <Protected><div className="page-wrap"><PageTitle eyebrow="ULANGI" title="Pengulangan hari ini" subtitle="Materi akan dijadwalkan ulang berdasarkan hasil latihanmu." />{items.length ? <div className="unit-list">{items.map((item) => <div key={`${item.contentType}-${item.contentId}`} className="unit-row"><span className="hanzi-thumb">{item.word ?? item.character}</span><span className="unit-copy"><strong>{item.word ?? item.character}</strong><small>{item.contentType === "character" ? "Karakter" : "Kosakata"}</small></span><Link to={item.contentType === "character" ? `/write/${item.contentId}` : `/word/${item.contentId}`} className="button button-primary">Mulai</Link></div>)}</div> : <div className="empty-card"><div className="empty-icon"><RotateCcw /></div><h3>Belum ada materi untuk diulang</h3><p>Setelah belajar materi yang sudah terbit, pengulangan akan muncul sesuai jadwalmu.</p><Link to="/paths" className="button button-primary">Pilih pelajaran</Link></div>}</div></Protected>;
}

function SummaryPage() { return <Protected><div className="summary-page"><div className="summary-star"><Sparkles /></div><span className="tag">SESI SELESAI</span><h1>Bagus sekali!</h1><p>Latihanmu tersimpan di akun. Jika sedang offline, aplikasi akan menyinkronkannya saat koneksi kembali.</p><Link className="button button-primary" to="/">Kembali ke beranda <ArrowRight /></Link></div></Protected>; }

function ProfilePage() {
  const { data } = useLearnerSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [privacyRequests, setPrivacyRequests] = useState<Array<{ id: string; type: string; status: string; requestedAt: string }>>([]);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    void api<{ profile: UserProfile; roles: string[] }>("/me").then((data) => setProfile({ ...data.profile, roles: data.roles })).catch(() => setProfile(null));
    void api<{ requests: typeof privacyRequests }>("/privacy-requests").then((data) => setPrivacyRequests(data.requests)).catch(() => setPrivacyRequests([]));
  }, []);
  const makeCodes = async () => { try { const response = await api<{ codes: string[] }>("/recovery-codes/rotate", { method: "POST", body: "{}" }); setRecoveryCodes(response.codes); } catch { setNotice("Masuk kembali untuk membuat kode pemulihan baru."); } };
  const requestPrivacy = async (type: "export" | "delete_account") => {
    try {
      const response = await api<{ export?: unknown; status?: string }>("/privacy-requests", { method: "POST", body: JSON.stringify({ type }) });
      if (response.export) {
        const blob = new Blob([JSON.stringify(response.export, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "belajar-mandarin-data-export.json"; anchor.click(); URL.revokeObjectURL(url);
        setNotice("Salinan data telah diunduh.");
      } else { setNotice("Permintaan penghapusan tersimpan untuk ditangani administrator."); void api<{ requests: typeof privacyRequests }>("/privacy-requests").then((data) => setPrivacyRequests(data.requests)); }
    } catch { setNotice("Permintaan belum dapat diproses."); }
  };
  const signOut = async () => { await authClient.signOut(); window.location.assign("/login"); };
  return <Protected><div className="page-wrap profile-page"><PageTitle eyebrow="PROFIL" title="Akun belajar" subtitle="Kemajuan akun tersinkron ke server saat perangkat online." />
    <div className="profile-card"><div className="profile-avatar">{data?.user.name.slice(0, 1).toUpperCase()}</div><div><strong>{profile?.display_name || data?.user.name}</strong><small>{profile?.email || data?.user.email}</small></div><span className="tag">PEMBELAJAR</span></div>
    <div className="detail-card profile-settings"><h2><Settings /> Pengaturan</h2><label>Target belajar harian<select value={profile?.daily_goal_minutes ?? 10} onChange={(event) => { const value = Number(event.target.value); setProfile((current) => current ? { ...current, daily_goal_minutes: value } : current); void api("/profile", { method: "PATCH", body: JSON.stringify({ dailyGoalMinutes: value }) }); }}><option value={5}>5 menit</option><option value={10}>10 menit</option><option value={15}>15 menit</option><option value={20}>20 menit</option></select></label><div className="profile-quick-actions"><Link className="button button-soft" to="/credits"><BookOpen /><span>Sumber materi & teknologi</span><ChevronRight /></Link><button className="button button-soft" onClick={() => void signOut()}><LogOut /><span>Keluar</span></button></div>{profile?.roles?.some((role) => role === "owner_admin" || role === "content_reviewer") && <Link className="button button-soft admin-entry-button" to="/admin"><ShieldCheck /> Ruang pengelola <ArrowRight /></Link>}</div>
    <div className="detail-card"><h2><ShieldCheck /> Pemulihan akun tanpa email berbayar</h2><p className="muted">Simpan kode pemulihan di tempat aman. Setiap kode hanya dapat digunakan sekali.</p><button className="button button-soft" onClick={() => void makeCodes()}>Buat kode pemulihan</button>{recoveryCodes.length > 0 && <div className="recovery-codes">{recoveryCodes.map((code) => <code key={code}>{code}</code>)}<button className="button button-primary" onClick={() => void navigator.clipboard.writeText(recoveryCodes.join("\n"))}>Salin kode</button><p>Pastikan tersimpan. Kode tidak dapat ditampilkan lagi.</p></div>}</div>
    <div className="detail-card"><h2>Privasi & data</h2><div className="privacy-actions"><button className="button button-soft" onClick={() => void requestPrivacy("export")}>Unduh salinan data</button><button className="button button-danger" onClick={() => { if (window.confirm("Ajukan permintaan penghapusan akun? Admin perlu menyelesaikan penghapusan ini.")) void requestPrivacy("delete_account"); }}>Ajukan penghapusan akun</button></div>{privacyRequests.filter((request) => request.type === "delete_account").map((request) => <p className="privacy-request-status" key={request.id}>Permintaan {new Date(request.requestedAt).toLocaleDateString("id-ID")} · {request.status === "requested" ? "menunggu ditangani" : request.status === "rejected" ? "ditolak" : request.status}</p>)}{notice && <InlineNotice>{notice}</InlineNotice>}</div>
  </div></Protected>;
}

function CreditsPage() {
  return <div className="page-wrap"><PageBack to="/profile" /><PageTitle eyebrow="KREDIT & LISENSI" title="Sumber materi dan teknologi" subtitle="Materi terbuka mempertahankan atribusi dan lisensinya sendiri; lisensi aplikasi tidak menggantikannya." />
    <section className="detail-card"><h2>Data urutan guratan</h2><p>Karakter awal memakai Hanzi Writer Data 2.0.1 dari Make Me a Hanzi, yang menyatakan data guratan berasal dari glyph Arphic. Data ini berlisensi Arphic Public License dan bukan klaim bahwa setiap urutan telah disahkan Kementerian Pendidikan Tiongkok.</p><p><a href="https://github.com/chanind/hanzi-writer-data" target="_blank" rel="noreferrer">Repositori Hanzi Writer Data</a> · <a href="https://github.com/chanind/hanzi-writer-data/blob/master/ARPHICPL.TXT" target="_blank" rel="noreferrer">Teks Arphic Public License</a></p></section>
    <section className="detail-card"><h2>Rekaman Mandarin</h2><p>“你好” — Sjors Provoost, sumber Wikimedia Commons, CC BY-SA 3.0. <a href="https://commons.wikimedia.org/wiki/File:Zh_n%C7%90_h%C7%8Eo.ogg" target="_blank" rel="noreferrer">File sumber</a>.</p><p>“你 / nǐ” dan “我 / wǒ” — Wei Gao dan Vion Nicolas, sumber Wikimedia Commons, CC BY 2.0 fr. <a href="https://commons.wikimedia.org/wiki/File:Zh-n%C7%90.ogg" target="_blank" rel="noreferrer">你 / file sumber</a> · <a href="https://commons.wikimedia.org/wiki/File:Zh-w%C7%92.ogg" target="_blank" rel="noreferrer">我 / file sumber</a>.</p><p>Wiktionary mencantumkan file “你好” untuk pembacaan Mandarin <i>nǐ hǎo</i>: <a href="https://en.wiktionary.org/wiki/n%C7%90_h%C7%8Eo" target="_blank" rel="noreferrer">entri pelafalan</a>. Ini adalah rekaman komunitas dengan lisensi terbuka, bukan rekaman pemerintah atau sertifikasi fonetik resmi. Ogg sumber ditranskode ke MP3 demi kompatibilitas browser; audio ucapannya tidak diedit.</p></section>
    <section className="detail-card"><h2>Materi & struktur HSK</h2><p>Materi resmi memang tersedia: situs ujian HSK memuat kerangka, silabus, contoh soal, dan bahan ujian. Yang belum dipastikan adalah izin untuk menyalin serta menerbitkan ulang daftar dan teks lengkap itu di aplikasi terbuka ini. Karena itu, latihan HSK yang tersedia sekarang ditulis khusus untuk aplikasi dan tidak diklaim sebagai daftar resmi HSK.</p><p><a href="https://www.chinesetest.cn/hsk" target="_blank" rel="noreferrer">Kerangka HSK resmi</a> · <a href="https://admin.chinesetest.cn/godownload.do" target="_blank" rel="noreferrer">Pusat unduhan resmi HSK</a> · <a href="https://www.chinesetest.cn/legal-notice" target="_blank" rel="noreferrer">Ketentuan situs CTI</a></p><p>Struktur enam tingkat HSK 2.0 dan tiga tahap/sembilan tingkat HSK Baru dipakai sebagai navigasi. Kosakata, contoh kalimat, serta terjemahan baru tetap dicatat sebagai konten asli berbahasa Indonesia. Tingkat pemula sekarang berisi 20 materi buatan aplikasi pada kedua jalur.</p></section>
    <section className="detail-card"><h2>Teknologi</h2><ul><li>React, React Router, TypeScript, Vite, Hono, Better Auth, Zod, IndexedDB, dan Cloudflare Workers/D1.</li><li>Hanzi Writer untuk animasi dan latihan guratan; library-nya MIT, data karakternya memakai lisensi terpisah.</li><li>Hanzi Lookup WASM untuk saran pengenalan tulisan tangan lokal; kodenya LGPL-3.0 dan data bentuk tertanam berlisensi Arphic Public License.</li><li>OpenCC JS untuk normalisasi kandidat tradisional menjadi sederhana; source, data, dan lisensinya dicatat di <code>THIRD_PARTY_NOTICES.md</code> pada repositori.</li></ul></section>
    <section className="detail-card"><h2>Catatan penggunaan</h2><p>Audio yang belum memiliki rekaman tepat untuk kata dan konteksnya akan tetap ditampilkan sebagai belum tersedia. Kami tidak menggabungkan bunyi per suku kata atau menggantinya dengan suara sintesis yang belum diverifikasi.</p><p>Setiap aset menyimpan checksum dan bukti lisensi. Pengelola tetap dapat membuka sumbernya untuk melakukan pemeriksaan ulang atau menolak aset.</p></section>
  </div>;
}

function AuthPage({ mode, redirectTo = "/" }: { mode: "login" | "signup"; redirectTo?: string }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false); const [recoveryCode, setRecoveryCode] = useState(""); const [resetToken, setResetToken] = useState(""); const [newPassword, setNewPassword] = useState(""); const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = mode === "signup"
        ? await authClient.signUp.email({ name, email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) throw new Error(result.error.message ?? "Akun belum dapat diproses.");
      if (mode === "signup") {
        const recovery = await api<{ codes: string[] }>("/recovery-codes/rotate", { method: "POST", body: "{}" });
        setGeneratedCodes(recovery.codes);
      } else navigate(redirectTo);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Periksa koneksi lalu coba lagi."); }
    finally { setBusy(false); }
  };
  const beginRecovery = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await api<{ resetToken: string }>("/recovery/start", { method: "POST", body: JSON.stringify({ email: email.trim(), code: recoveryCode.trim() }) });
      setResetToken(response.resetToken);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Email atau kode pemulihan tidak cocok."); }
    finally { setBusy(false); }
  };
  const finishRecovery = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/reset-password", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: resetToken, newPassword }) });
      const result = await response.json() as { message?: string; status?: boolean };
      if (!response.ok) throw new Error(result.message ?? "Kata sandi belum dapat diperbarui.");
      setNoticeRecovery("Kata sandi diperbarui. Silakan masuk kembali."); setRecoveryOpen(false); setResetToken("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Kata sandi belum dapat diperbarui."); }
    finally { setBusy(false); }
  };
  const [noticeRecovery, setNoticeRecovery] = useState("");
  if (generatedCodes.length) return <div className="auth-page"><div className="auth-card"><Link to="/" className="brand"><span className="brand-mark">文</span><span>Belajar Mandarin</span></Link><span className="tag">LANGKAH KEAMANAN PENTING</span><h1>Simpan kode pemulihanmu</h1><p className="muted">Kode ini hanya ditampilkan sekali. Simpan di tempat aman agar akun tetap dapat dipulihkan tanpa email berbayar.</p><div className="recovery-codes">{generatedCodes.map((code) => <code key={code}>{code}</code>)}<button className="button button-soft" onClick={() => void navigator.clipboard.writeText(generatedCodes.join("\n"))}>Salin kedua kode</button></div><button className="button button-primary button-wide" onClick={() => navigate("/")}>Saya sudah menyimpannya <ArrowRight /></button></div></div>;
  return <div className="auth-page"><div className="auth-card"><Link to="/" className="brand"><span className="brand-mark">文</span><span>Belajar Mandarin</span></Link><span className="tag">BELAJAR BAHASA MANDARIN</span><h1>{recoveryOpen ? "Pulihkan akun" : mode === "signup" ? "Mulai dari satu karakter." : "Senang melihatmu kembali."}</h1><p className="muted">{recoveryOpen ? "Masukkan email dan salah satu kode pemulihan yang kamu simpan." : "Akun memungkinkan kemajuanmu tersinkron di ponsel dan iPad."}</p>
    {noticeRecovery && <InlineNotice>{noticeRecovery}</InlineNotice>}
    {recoveryOpen ? <form onSubmit={(event) => void (resetToken ? finishRecovery(event) : beginRecovery(event))}><label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} /></label>{!resetToken ? <label>Kode pemulihan<input autoComplete="one-time-code" value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} minLength={64} maxLength={64} required /></label> : <label>Kata sandi baru<input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={12} maxLength={128} required /></label>}{error && <InlineNotice tone="danger">{error}</InlineNotice>}<button className="button button-primary button-wide" disabled={busy}>{busy ? "Memproses…" : resetToken ? "Simpan kata sandi baru" : "Periksa kode"}</button><button type="button" className="button button-soft button-wide" onClick={() => { setRecoveryOpen(false); setError(""); setResetToken(""); }}>Kembali ke masuk</button></form> : <form onSubmit={(event) => void submit(event)}>{mode === "signup" && <label>Nama tampilan<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} /></label>}<label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} /></label><label>Kata sandi<input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={mode === "signup" ? 12 : 1} maxLength={128} required />{mode === "signup" && <small>Gunakan sedikitnya 12 karakter.</small>}</label>{error && <InlineNotice tone="danger">{error}</InlineNotice>}<button className="button button-primary button-wide" disabled={busy}>{busy ? "Memproses…" : mode === "signup" ? "Buat akun" : "Masuk"} <ArrowRight /></button></form>}
    {!recoveryOpen && <p className="auth-switch">{mode === "signup" ? "Sudah punya akun?" : <>Lupa kata sandi? <button className="text-button" onClick={() => { setRecoveryOpen(true); setError(""); }}>Gunakan kode pemulihan</button></>} {mode === "signup" && <Link to="/login">Masuk</Link>}{mode === "login" && <> · <Link to="/signup">Daftar</Link></>}</p>}
    <small className="auth-privacy">Tanpa layanan email berbayar. Kode pemulihan diperlukan untuk mengatur ulang kata sandi.</small></div></div>;
}

function AdminFrame({ user, isPending }: { user: SessionUser | null; isPending: boolean }) {
  const [open, setOpen] = useState(false);
  const { data } = useLearnerSession();
  if (isPending) return <div className="centered-page"><div className="loader" /></div>;
  if (!user) return <AuthPage mode="login" redirectTo="/admin" />;
  return <div className="admin-frame"><aside className={`admin-sidebar ${open ? "sidebar-open" : ""}`}><Link className="brand" to="/admin"><span className="brand-mark">文</span><span>Belajar <small>ADMIN</small></span></Link><span className="sidebar-label">RUANG KERJA</span><NavLink to="/admin" end><Activity /> Ringkasan</NavLink><NavLink to="/admin/learners"><UserRound /> Pembelajar</NavLink><NavLink to="/admin/content"><BookOpen /> Konten & Audio</NavLink><NavLink to="/admin/audit"><ShieldCheck /> Audit & Privasi</NavLink><div className="sidebar-spacer" /><Link to="/" className="sidebar-exit"><ArrowLeft /> Aplikasi belajar</Link><button className="sidebar-user" onClick={() => void authClient.signOut()}><span className="avatar">{data?.user.name.slice(0, 1).toUpperCase()}</span><span>{data?.user.name}<small>Keluar dari admin</small></span><LogOut /></button></aside><main className="admin-content"><header className="admin-topbar"><button className="icon-button mobile-admin-menu" aria-label="Buka menu" onClick={() => setOpen((value) => !value)}><Menu /></button><span>Ruang pengelola</span><span className="admin-account"><span className="status-dot" />Terkoneksi</span></header><div className="admin-page"><Outlet /></div></main>{open && <button className="sidebar-scrim" aria-label="Tutup menu" onClick={() => setOpen(false)} />}</div>;
}

function AdminOverview() {
  const [metrics, setMetrics] = useState<{ learners: number; attempts: number; vocabularyPendingReview: number; audioCandidates: number; activeLearnersLast7Days: number } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void api<{ metrics: typeof metrics }>("/admin/overview").then((data) => setMetrics(data.metrics)).catch((cause) => setError(cause instanceof Error ? cause.message : "Akses administrator diperlukan.")); }, []);
  return <><AdminPageHead eyebrow="OVERVIEW" title="Ringkasan" subtitle="Aktivitas akun dan antrian pemeriksaan. Nilai ditarik dari data server." /><div className="admin-kpi-grid"><AdminKpi icon={<UserRound />} label="Pembelajar terdaftar" value={metrics?.learners ?? "—"} /><AdminKpi icon={<Activity />} label="Aktif · 7 hari" value={metrics?.activeLearnersLast7Days ?? "—"} /><AdminKpi icon={<BookOpen />} label="Latihan tersimpan" value={metrics?.attempts ?? "—"} /><AdminKpi icon={<Headphones />} label="Audio menunggu review" value={metrics?.audioCandidates ?? "—"} /></div>{error && <InlineNotice tone="danger">{error}</InlineNotice>}<div className="admin-lower-grid"><div className="admin-panel"><div className="panel-head"><div><h2>Antrian editorial</h2><p>Materi tidak akan muncul ke pembelajar sebelum disetujui.</p></div><Link className="text-link" to="/admin/content">Buka antrian <ChevronRight /></Link></div><div className="queue-row"><span className="queue-dot queue-amber" /><span><strong>Materi kosakata</strong><small>Menunggu sumber dan tinjauan editorial</small></span><b>{metrics?.vocabularyPendingReview ?? 0}</b></div><div className="queue-row"><span className="queue-dot queue-mint" /><span><strong>Pelafalan</strong><small>Harus cocok dengan kata dan konteks yang tepat</small></span><b>{metrics?.audioCandidates ?? 0}</b></div></div><div className="admin-panel"><div className="panel-head"><div><h2>Akses data pembelajar</h2><p>Halaman profil individu mencatat siapa yang membukanya.</p></div></div><Link className="button button-primary" to="/admin/learners">Cari pembelajar <ArrowRight /></Link></div></div></>;
}

function AdminKpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) { return <div className="admin-kpi"><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong></div>; }

function AdminLearners() {
  const [q, setQ] = useState(""); const [learners, setLearners] = useState<Array<{ id: string; name: string; masked_email: string; attempts: number; last_active: string | null }>>([]); const [error, setError] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => { void api<{ learners: typeof learners }>(`/admin/learners?q=${encodeURIComponent(q)}`).then((data) => { setLearners(data.learners); setError(""); }).catch((cause) => setError(cause instanceof Error ? cause.message : "Tidak dapat memuat pembelajar.")); }, 180); return () => window.clearTimeout(timer); }, [q]);
  return <><AdminPageHead eyebrow="PEMBELAJAR" title="Daftar pembelajar" subtitle="Buka profil hanya saat diperlukan; setiap akses tercatat di audit." /><label className="search-field"><Search /><input placeholder="Cari nama atau email" value={q} onChange={(event) => setQ(event.target.value)} /></label>{error && <InlineNotice tone="danger">{error}</InlineNotice>}<div className="table-wrap"><table className="admin-table"><thead><tr><th>NAMA</th><th>EMAIL</th><th>LATIHAN</th><th>AKTIF TERAKHIR</th><th></th></tr></thead><tbody>{learners.map((learner) => <tr key={learner.id}><td><Link to={`/admin/learners/${learner.id}`} className="learner-name"><span className="avatar avatar-small">{learner.name.slice(0, 1)}</span>{learner.name}</Link></td><td>{learner.masked_email}</td><td>{learner.attempts}</td><td>{learner.last_active ? new Date(learner.last_active).toLocaleDateString("id-ID") : "Belum mulai"}</td><td><Link className="text-link" to={`/admin/learners/${learner.id}`}>Lihat <ChevronRight /></Link></td></tr>)}</tbody></table>{learners.length === 0 && <div className="table-empty">{error ? "Data belum dapat dimuat." : "Belum ada pembelajar untuk ditampilkan."}</div>}</div></>;
}

function AdminLearnerPage() {
  const { learnerId = "" } = useParams();
  const [data, setData] = useState<{
    learner: { name: string; email: string; createdAt: string; daily_goal_minutes: number };
    progress: Array<{ contentType: string; contentId: string; contentLabel: string | null; attempts: number; correct: number; lastSeenAt: string; dimensions: string }>;
    curriculumProgress: Array<{ curriculumName: string; curriculumVersion: string; unitTitle: string; levelNumber: number | null; stageName: string | null; attempts: number; passed: number; needsPractice: number; uncertain: number; notAssessed: number; itemsPractised: number; lastSeenAt: string }>;
    activity: Array<{ day: string; attempts: number }>;
    freehand: Array<{ hanzi: string; codePoint: string; engineId: string; candidateRank: number; occurredAt: string }>;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void api<typeof data>(`/admin/learners/${encodeURIComponent(learnerId)}`).then(setData).catch((cause) => setError(cause instanceof Error ? cause.message : "Profil tidak tersedia.")); }, [learnerId]);
  return <><PageBack to="/admin/learners" /><AdminPageHead eyebrow="PROFIL PEMBELAJAR" title={data?.learner.name ?? "Detail pembelajar"} subtitle="Akses sensitif ini dicatat otomatis di audit." />{error && <InlineNotice tone="danger">{error}</InlineNotice>}{data && <>
    <div className="learner-admin-hero"><div className="profile-avatar">{data.learner.name.slice(0, 1)}</div><div><strong>{data.learner.email}</strong><small>Bergabung {new Date(data.learner.createdAt).toLocaleDateString("id-ID")} · target {data.learner.daily_goal_minutes} menit / hari</small></div></div>
    <div className="admin-kpi-grid"><AdminKpi icon={<BookOpen />} label="Materi dipelajari" value={data.progress.length} /><AdminKpi icon={<Activity />} label="Latihan tersimpan" value={data.progress.reduce((sum, item) => sum + item.attempts, 0)} /><AdminKpi icon={<Clock3 />} label="Hari aktif tercatat" value={data.activity.length} /></div>
    <div className="admin-panel individual-progress"><div className="panel-head"><div><h2>Kemajuan menurut jalur belajar</h2><p>Latihan ditautkan ke jalur dan unit asal. “Lolos” berarti semua dimensi yang dinilai pada sesi itu lulus.</p></div></div>{data.curriculumProgress.length ? data.curriculumProgress.map((item) => <div className="progress-row" key={`${item.curriculumName}-${item.unitTitle}`}><span className="unit-number">{item.levelNumber ?? "日"}</span><div><strong>{item.curriculumName} · {item.stageName ? `${item.stageName} · ` : ""}{item.unitTitle}</strong><small>{item.curriculumVersion} · {item.itemsPractised} materi · {item.attempts} sesi · terakhir {item.lastSeenAt ? new Date(item.lastSeenAt).toLocaleDateString("id-ID") : "Belum tercatat"}</small><small>{item.passed} lolos · {item.needsPractice} perlu latihan · {item.uncertain} belum pasti · {item.notAssessed} belum dinilai</small></div><span className="progress-score">{item.passed}/{item.attempts}</span></div>) : <div className="table-empty">Belum ada latihan yang terhubung dengan unit belajar.</div>}</div>
    <div className="admin-panel individual-progress"><div className="panel-head"><div><h2>Kemajuan per materi</h2><p>Ringkasan hasil tersimpan; jejak pena mentah tidak disimpan.</p></div></div>{data.progress.length ? data.progress.map((item) => <div className="progress-row" key={`${item.contentType}-${item.contentId}`}><span className="hanzi-thumb">{item.contentLabel?.slice(0, 1) ?? (item.contentId.startsWith("unicode:") ? item.contentId.slice(8, 9) : item.contentType === "character" ? "字" : "词")}</span><div><strong>{item.contentType === "character" ? "Karakter" : "Kosakata"} · {item.contentLabel ?? item.contentId}</strong><small>{item.attempts} latihan · terakhir {item.lastSeenAt ? new Date(item.lastSeenAt).toLocaleDateString("id-ID") : "Belum tercatat"}</small></div><span className="progress-score">{item.correct}/{item.attempts}</span></div>) : <div className="table-empty">Belum ada aktivitas tersinkron.</div>}</div>
    <div className="admin-panel individual-progress"><div className="panel-head"><div><h2>Karakter bebas dikonfirmasi</h2><p>Hanya karakter yang dipilih pembelajar setelah melihat kandidat; tidak ada goresan mentah.</p></div></div>{data.freehand.length ? data.freehand.map((item, index) => <div className="progress-row" key={`${item.codePoint}-${item.occurredAt}-${index}`}><span className="hanzi-thumb">{item.hanzi}</span><div><strong>{item.hanzi} · {item.codePoint}</strong><small>{item.engineId} · kandidat nomor {item.candidateRank} · {new Date(item.occurredAt).toLocaleString("id-ID")}</small></div></div>) : <div className="table-empty">Belum ada konfirmasi pengenalan bebas.</div>}</div>
  </>}</>;
}

function AdminContent() {
  const [queue, setQueue] = useState<{ vocabulary: Array<{ id: string; text: string; status: string; sourceId: string }>; characters: Array<{ id: string; text: string; status: string; sourceId: string; strokeStatus: string }>; readings: Array<{ id: string; text: string; pinyin: string; status: string; sourceId: string }>; audio: Array<{ id: string; text: string; pinyin: string; dialect: string; recordingContext: string; format: string; sizeBytes: number; durationMs: number; sha256: string; status: string; pronunciationReview: string; sourceName: string; license: string; licenseUrl: string; attribution: string; sourcePageUrl: string; sourceAttestedAt: string | null; sourceAttestationMethod: string | null }> } | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const load = () => { void api<typeof queue>("/admin/content/review-queue").then((data) => { setQueue(data); setError(""); }).catch((cause) => setError(cause instanceof Error ? cause.message : "Tidak dapat memuat materi.")); };
  useEffect(load, []);
  const review = async (kind: string, id: string, status: string) => { try { await api(`/admin/content/${kind}/${id}`, { method: "PATCH", body: JSON.stringify({ status, note: "Reviewed in admin" }) }); setNotice("Keputusan review tersimpan dan tercatat."); load(); } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Keputusan belum dapat disimpan."); } };
  const audioReview = async (id: string, decision: "passed" | "failed") => { try { await api(`/admin/audio/${id}`, { method: "PATCH", body: JSON.stringify({ decision, note: "Checked against the exact displayed Mandarin reading and context." }) }); setNotice("Hasil pemeriksaan audio tersimpan."); load(); } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Hasil pemeriksaan belum dapat disimpan."); } };
  return <><AdminPageHead eyebrow="KUALITAS MATERI" title="Konten & audio" subtitle="Materi dari sumber lisensi terbuka dapat aktif otomatis setelah sumber dan metadata cocok; antrian ini tetap menyediakan pemutaran, penolakan, dan pemeriksaan ulang." />{error && <InlineNotice tone="danger">{error}</InlineNotice>}{notice && <InlineNotice>{notice}</InlineNotice>}{queue && <><ReviewGroup title="Kosakata" items={queue.vocabulary} kind="vocabulary" onReview={review} /><ReviewGroup title="Karakter & data guratan" items={queue.characters.map((item) => ({ ...item, text: `${item.text} · guratan: ${item.strokeStatus}` }))} kind="character" onReview={review} /><ReviewGroup title="Pelafalan / Pinyin" items={queue.readings.map((item) => ({ ...item, text: `${item.text} · ${item.pinyin}` }))} kind="reading" onReview={review} />
    <section className="admin-panel review-section"><div className="panel-head"><div><h2>Audio tersumber & kandidat</h2><p>Rekaman sumber dapat aktif tanpa keputusan per file; putar kembali atau tolak bila ada masalah.</p></div></div>{queue.audio.length ? queue.audio.map((audio) => <div className="audio-review-card" key={audio.id}><div className="audio-meta"><strong>{audio.text} <small>{audio.pinyin}</small></strong><p>{audio.sourceName} · {audio.license} {audio.sourceAttestedAt ? "· sumber cocok" : "· menunggu sumber/review"}</p><p>{audio.recordingContext} · {audio.dialect} · {(audio.sizeBytes / 1024).toFixed(1)} KB · {audio.durationMs} ms</p><small>Checksum {audio.sha256.slice(0, 16)}… · atribusi: {audio.attribution}</small><p><a href={audio.sourcePageUrl} target="_blank" rel="noreferrer">Buka file sumber</a> · <a href={audio.licenseUrl} target="_blank" rel="noreferrer">Lisensi</a></p><audio controls preload="none" src={audioUrl(audio.id) ?? undefined} /></div><div className="audio-review-actions"><button className="button button-soft" onClick={() => void audioReview(audio.id, "failed")}>Tolak</button><button className="button button-primary" onClick={() => void audioReview(audio.id, "passed")}>Tandai cocok</button></div></div>) : <div className="table-empty">Belum ada file audio kandidat atau tersumber.</div>}</section></>}</>;
}

function ReviewGroup({ title, items, kind, onReview }: { title: string; items: Array<{ id: string; text: string; status: string; sourceId: string }>; kind: string; onReview: (kind: string, id: string, status: string) => void }) { return <section className="admin-panel review-section"><div className="panel-head"><div><h2>{title}</h2><p>{items.length} item menunggu keputusan</p></div></div>{items.length ? items.map((item) => <div className="content-review-row" key={item.id}><span className="hanzi-thumb">{item.text.slice(0, 1)}</span><div><strong>{item.text}</strong><small>Sumber: {item.sourceId} · {item.status}</small></div><div className="review-actions"><button className="button button-soft" onClick={() => onReview(kind, item.id, "rejected")}>Tolak</button><button className="button button-primary" onClick={() => onReview(kind, item.id, "approved")}>Setujui</button></div></div>) : <div className="table-empty">Tidak ada draf pada antrian ini.</div>}</section>; }

function AdminAudit() {
  const [events, setEvents] = useState<Array<{ id: string; actorId: string | null; action: string; subjectType: string | null; subjectId: string | null; outcome: string; occurredAt: string }>>([]); const [error, setError] = useState("");
  const [requests, setRequests] = useState<Array<{ id: string; userId: string; name: string; maskedEmail: string; requestType: string; requestedAt: string }>>([]); const [notice, setNotice] = useState("");
  const load = () => { void Promise.all([api<{ events: typeof events }>("/admin/audit"), api<{ requests: typeof requests }>("/admin/privacy-requests")]).then(([audit, privacy]) => { setEvents(audit.events); setRequests(privacy.requests); setError(""); }).catch((cause) => setError(cause instanceof Error ? cause.message : "Tidak dapat memuat audit.")); };
  useEffect(load, []);
  const handleRequest = async (request: typeof requests[number], decision: "approve_delete" | "reject") => {
    if (decision === "approve_delete" && !window.confirm(`Hapus akun ${request.name} beserta kemajuan dan sesi tersinkron?`)) return;
    try { await api(`/admin/privacy-requests/${request.id}`, { method: "PATCH", body: JSON.stringify({ decision }) }); setNotice(decision === "approve_delete" ? "Akun beserta data tersinkronnya telah dihapus." : "Permintaan ditandai untuk ditinjau ulang."); load(); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "Permintaan belum dapat diproses."); }
  };
  return <><AdminPageHead eyebrow="AKUNTABILITAS" title="Audit & privasi" subtitle="Akses admin dan permintaan data dicatat; log hanya-baca." />{error && <InlineNotice tone="danger">{error}</InlineNotice>}{notice && <InlineNotice>{notice}</InlineNotice>}<section className="admin-panel review-section"><div className="panel-head"><div><h2>Permintaan penghapusan akun</h2><p>Penghapusan permanen ikut menghapus progres dan sesi yang tersimpan di server.</p></div></div>{requests.length ? requests.filter((item) => item.requestType === "delete_account").map((request) => <div className="content-review-row" key={request.id}><span className="avatar avatar-small">{request.name.slice(0, 1)}</span><div><strong>{request.name} · {request.maskedEmail}</strong><small>Diminta {new Date(request.requestedAt).toLocaleString("id-ID")}</small></div><div className="review-actions"><button className="button button-soft" onClick={() => void handleRequest(request, "reject")}>Tolak</button><button className="button button-danger" onClick={() => void handleRequest(request, "approve_delete")}>Hapus data</button></div></div>) : <div className="table-empty">Tidak ada permintaan penghapusan yang menunggu.</div>}</section><div className="table-wrap"><table className="admin-table"><thead><tr><th>WAKTU</th><th>AKSI</th><th>JENIS DATA</th><th>HASIL</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{new Date(event.occurredAt).toLocaleString("id-ID")}</td><td>{event.action}</td><td>{event.subjectType ?? "—"}</td><td><span className={`audit-outcome outcome-${event.outcome}`}>{event.outcome}</span></td></tr>)}</tbody></table>{events.length === 0 && <div className="table-empty">{error || "Belum ada kegiatan audit."}</div>}</div></>;
}

function AudioButton({ assetId, prominent = false }: { assetId?: string | null; prominent?: boolean }) {
  const [error, setError] = useState("");
  const play = async () => {
    const src = audioUrl(assetId); if (!src) return;
    try { const audio = new Audio(src); await audio.play(); setError(""); } catch { setError("Rekaman berlisensi belum dapat diputar."); }
  };
  return <span className="audio-control"><button className={`audio-button ${prominent ? "audio-button-prominent" : ""} ${!assetId ? "audio-unavailable" : ""}`} disabled={!assetId} onClick={() => void play()} aria-label={assetId ? "Putar rekaman Mandarin asli" : "Rekaman belum tersedia"} title={assetId ? "Putar rekaman Mandarin" : "Rekaman Mandarin belum tersedia; pinyin tetap ditampilkan"}><Volume2 /></button><small>{error || (assetId ? (prominent ? "Dengarkan" : "Putar") : "Belum ada audio")}</small></span>;
}

function AdminPageHead({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) { return <div className="admin-page-head"><span className="tag">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>; }
function PageTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) { return <div className="page-title"><span className="tag">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>; }
function PageBack({ to }: { to?: string }) { const navigate = useNavigate(); return to ? <Link className="page-back" to={to}><ArrowLeft size={17} /> Kembali</Link> : <button className="page-back" onClick={() => navigate(-1)}><ArrowLeft size={17} /> Kembali</button>; }
function InlineNotice({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "danger" }) { return <div className={`inline-notice notice-${tone}`} role="status"><CircleHelp size={16} />{children}</div>; }
function EmptyContent({ message }: { message: string }) { return <div className="empty-card"><div className="empty-icon"><BookOpen /></div><p>{message}</p><Link className="button button-primary" to="/paths">Kembali ke pelajaran</Link></div>; }
function NotFound() { return <div className="auth-required"><h1>Halaman tidak ditemukan</h1><Link className="button button-primary" to="/">Kembali</Link></div>; }

async function saveAttempt(attempt: Omit<Parameters<typeof enqueueAttempt>[0], "createdAtClient">, ownerUserId: string) {
  await enqueueAttempt({ ...attempt, createdAtClient: new Date().toISOString() }, ownerUserId);
  void syncOutbox(ownerUserId).catch(() => undefined);
}

export { App };
