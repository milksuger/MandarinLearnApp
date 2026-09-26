import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router";
import { Activity, ArrowLeft, ArrowRight, Ban, BookOpen, Check, ChevronLeft, ChevronRight, CircleHelp, Clock3, Cloud, Compass, Flag, Flame, Headphones, Home, Layers3, LogOut, Menu, MessageCircle, Mic, Pause, PenLine, Play, RotateCcw, Search, Settings, ShieldCheck, SkipForward, Sparkles, Square, UserRound, Volume2, X } from "lucide-react";
import type HanziWriter from "hanzi-writer";
import { authClient } from "./auth-client";
import { api, audioUrl } from "../shared/api";
import { enqueueAttempt, enqueueRecognition, pendingAttempts, syncOutbox } from "../features/sync/outbox";
import { recordedBlobToWav } from "../features/admin/sentence-recorder";

type SessionResult = ReturnType<typeof authClient.useSession>;
type SessionUser = NonNullable<SessionResult["data"]>["user"];
type UserProfile = { display_name: string; email: string; locale: string; daily_goal_minutes: number; roles?: string[] };
type Metrics = { learned_items: number; attempts: number; correct: number; streak_days: number };
type Unit = { id: string; title: string; description: string | null; curriculum_name: string };
type UnitItem = { placement_id: string; vocabulary_id: string | null; simplified_form: string | null; character_id: string | null; hanzi: string | null; stroke_count: number | null; stroke_data_status: string | null; reading_id: string | null; pinyin_json: string | null; numbered_pinyin: string | null; gloss: string | null; audio_id: string | null; duration_ms: number | null; example_text: string | null; example_pinyin: string | null; example_translation: string | null; example_audio_id: string | null };
type LessonActivity = { id: string; activityKind: string; title: string; objective: string; instructions: string; ordinal: number; state: "not_started" | "in_progress" | "completed"; currentItemOrdinal: number; correctCount: number; completedCharacterIds: string[] };
type LessonExtras = {
  grammar: Array<{ id: string; title: string; pattern: string; explanation: string; usageNotes: string }>;
  dialogueTurns: Array<{ id: string; speakerRole: string; speakerLabel: string; simplifiedText: string; pinyinJson: string; translation: string; dialogueTitle: string; audioId: string | null }>;
  storyParagraphs: Array<{ id: string; simplifiedText: string; pinyinJson: string; translation: string; storyTitle: string; audioId: string | null }>;
};

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
      <Route path="/placement" element={<PlacementPage />} />
      <Route path="/practice" element={<PracticeHubPage />} />
      <Route path="/practice/speaking" element={<SpeakingPracticePage />} />
      <Route path="/pinyin" element={<PinyinPage />} />
      <Route path="/discover" element={<DiscoverPage />} />
      <Route path="/talk" element={<TalkPage />} />
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
      <Route path="community" element={<AdminCommunity />} />
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
    <header className="learner-topbar"><Link to="/" className="brand"><img className="brand-mark" src="/images/mandarin-learn-mascot.png" alt="" aria-hidden="true" /><span>Belajar Mandarin</span></Link>
      <div className="topbar-actions"><Link className="topbar-community" to="/talk"><MessageCircle /><span>Talk</span></Link><SyncPill state={syncState} pending={pending} /><Link aria-label={user ? "Buka profil dan pengaturan" : "Masuk ke akun"} title={user ? "Profil dan pengaturan" : "Masuk"} to={user ? "/profile" : "/login"} className="avatar">{user ? user.name.slice(0, 1).toUpperCase() : <UserRound size={18} />}</Link></div>
    </header>
    <main className="learner-main">{isPending ? <div className="centered-page"><div className="loader" /></div> : <Outlet />}</main>
    <nav className="mobile-nav" aria-label="Navigasi utama">
      <NavLink to="/" end><Home /><span>Beranda</span></NavLink><NavLink to="/paths"><Layers3 /><span>Kursus</span></NavLink><NavLink to="/practice"><PenLine /><span>Latihan</span></NavLink><NavLink to="/discover"><Compass /><span>Jelajahi</span></NavLink><NavLink to="/review"><RotateCcw /><span>Ulangi</span></NavLink>
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
  if (!data?.user) return <section className="auth-required" aria-labelledby="auth-gate-title"><div className="auth-gate-art" aria-hidden="true"><img src="/images/auth-learning-companion.png" alt="" /><span className="gate-bubble">你好!</span><span className="gate-spark gate-spark-two">✧</span></div><div className="auth-gate-copy"><span className="tag">RUANG BELAJAR MANDARIN</span><h2 id="auth-gate-title">Satu karakter hari ini, selangkah lebih dekat.</h2><p>Kemajuanmu tersimpan di akun dan bisa dilanjutkan di ponsel atau iPad.</p><div className="auth-gate-actions"><Link className="button button-primary" to="/signup">Mulai belajar <ArrowRight /></Link><Link className="button button-soft" to="/login">Saya sudah punya akun</Link></div><small>Belajar gratis · dirancang untuk sentuhan dan Apple Pencil</small></div></section>;
  return <>{children}</>;
}

function HomePage({ user }: { user: SessionUser | null }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [dueReviews, setDueReviews] = useState<number | null>(null);
  const [continueTarget, setContinueTarget] = useState<{ unitId: string; unitTitle: string; curriculumName: string; activityId?: string; activityOrdinal?: number; currentItemOrdinal?: number } | null>(null);
  const [paths, setPaths] = useState<Array<{ id: string; slug: string; name: string; kind: string; description: string | null }>>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ paths: typeof paths }>("/paths").then((data) => setPaths(data.paths)).catch(() => setError("Tidak dapat memuat jalur belajar."));
    if (user) {
      api<{ summary: Metrics; due: number }>("/progress").then((data) => { setMetrics(data.summary); setDueReviews(data.due); }).catch(() => { setMetrics(null); setDueReviews(null); });
      api<{ destination: typeof continueTarget }>("/continue").then((data) => setContinueTarget(data.destination)).catch(() => setContinueTarget(null));
    } else setContinueTarget(null);
  }, [user]);
  const name = user?.name?.trim().split(" ")[0] || "teman";
  return <Protected><div className="home-wrap">
    <section className="greeting-row"><div><p className="eyebrow">SELAMAT DATANG KEMBALI</p><h1>你好, {name} <span className="wave">✦</span></h1><p className="muted">Setiap guratan membawamu selangkah lebih dekat.</p></div><div className="streak-chip" title="Jumlah hari belajar berurutan" aria-label={(metrics?.streak_days ?? 0) + " hari belajar berurutan"}><Flame size={18} /><span><strong>{metrics?.streak_days ?? 0}</strong><small>hari belajar beruntun</small></span></div></section>
    <section className="daily-card"><div className="daily-copy"><span className="tag tag-white">TUJUAN HARI INI</span><h2>{continueTarget ? `Lanjutkan: ${continueTarget.unitTitle}` : "Belajar sedikit, setiap hari."}</h2><p>{continueTarget ? `${continueTarget.curriculumName} · ${continueTarget.activityId ? "Kursus menyimpan langkah dan soal terakhirmu." : "Buka lagi topik yang terakhir kamu pelajari."}` : "Mulai dengan beberapa kata yang berguna dalam kehidupan sehari-hari."}</p><Link to={continueTarget ? `/unit/${continueTarget.unitId}${continueTarget.activityId ? `?activity=${encodeURIComponent(continueTarget.activityId)}` : ""}` : "/paths"} className="button button-dark">{continueTarget ? "Lanjutkan belajar" : "Mulai belajar"} <ArrowRight size={16} /></Link></div><div className="daily-art" aria-hidden="true"><img src="/media/mascot/study-companion.webp" alt="" width="250" height="250" fetchPriority="high" /></div></section>
    <section className="quick-start" aria-label="Cara belajar"><span className="quick-start-title">Mudah dimulai</span><span><b>1</b>Pilih pelajaran</span><span><b>2</b>Dengarkan &amp; baca</span><span><b>3</b>Tulis &amp; ulangi</span></section>
    <section className="metric-grid"><MetricCard icon={<BookOpen />} label="Materi dipelajari" value={metrics?.learned_items ?? 0} unit="kata & karakter" /><MetricCard icon={<Activity />} label="Latihan selesai" value={metrics?.attempts ?? 0} unit="semua sesi" /><MetricCard icon={<Clock3 />} label="Siap diulang" value={dueReviews ?? 0} unit="kata dan karakter" /></section>
    <div className="section-heading"><div><h2>Jalur belajarmu</h2><p>Belajar dari keseharian atau pilih susunan HSK 2.0 maupun HSK 3.0.</p></div><Link to="/paths" className="text-link">Lihat semua <ChevronRight size={16} /></Link></div>
    {error && <InlineNotice>{error}</InlineNotice>}
    {paths.length ? <div className="path-cards">{paths.map((path) => <PathCard key={path.id} path={path} />)}</div> : <div className="empty-card"><div className="empty-icon"><Layers3 /></div><h3>Jalur materi sedang disiapkan</h3><p>Materi baru akan muncul setelah ditinjau untuk memastikan arti, pelafalan dan sumbernya benar.</p><Link className="button button-soft" to="/paths">Jelajahi jalur belajar <ArrowRight size={16} /></Link></div>}
    <footer className="trust-note"><ShieldCheck size={16} /> Rekaman asli dan data guratan memiliki sumber serta lisensi; kata lain memakai suara Mandarin lokal perangkat. <Link to="/credits">Lihat kredit</Link></footer>
  </div></Protected>;
}

function MetricCard({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: React.ReactNode; unit: string }) {
  return <div className="metric-card"><div className="metric-icon">{icon}</div><p>{label}</p><strong>{value}</strong><small>{unit}</small></div>;
}

function PathCard({ path }: { path: { id: string; slug: string; name: string; kind: string; description: string | null } }) {
  const hsk = path.kind === "hsk";
  return <Link to={`/paths/${path.id}`} className={`path-card ${hsk ? "path-hsk" : "path-daily"}`}>
    <span className="path-glyph" aria-hidden="true">{hsk ? <Layers3 /> : <BookOpen />}</span><div><span className="tag">{hsk ? (path.slug === "hsk-2" ? "HSK 2.0 · 6 TINGKAT" : "HSK 3.0 · 9 TINGKAT") : "KEHIDUPAN SEHARI-HARI"}</span><h3>{path.name}</h3><p>{path.description ?? "Materi disusun bertahap."}</p></div><ChevronRight className="path-arrow" />
  </Link>;
}

function PathsPage() {
  const [paths, setPaths] = useState<Array<{ id: string; slug: string; name: string; kind: string; description: string | null }>>([]);
  useEffect(() => { void api<{ paths: typeof paths }>("/paths").then((data) => setPaths(data.paths)).catch(() => setPaths([])); }, []);
  return <Protected><div className="page-wrap"><PageBack to="/" label="Beranda" /><PageTitle eyebrow="PILIH JALUR" title="Pilih jalur belajar" subtitle="Mulai dari keseharian atau pilih tingkat HSK. Setelah itu buka satu pelajaran dan ikuti langkahnya: kenali kata, pahami contoh, berlatih menulis, ulangi, lalu gunakan dalam kalimatmu." /><Link to="/placement" className="placement-entry"><span className="skill-icon skill-icon-course"><CircleHelp /></span><span><strong>Belum yakin mulai dari mana?</strong><small>Jawab penilaian singkat untuk mendapat saran titik awal. Bukan nilai resmi HSK.</small></span><ChevronRight /></Link>
    {paths.length ? <div className="path-cards path-cards-page">{paths.map((path) => <PathCard key={path.id} path={path} />)}</div> : <div className="empty-card"><div className="empty-icon"><BookOpen /></div><h3>Materi sedang ditinjau</h3><p>Susunan jalur sudah dibuat. Kosakata dan penempatan pelajaran akan diterbitkan setelah sumber serta lisensinya diperiksa.</p><div className="hsk-level-strip">{Array.from({ length: 9 }, (_, i) => <span key={i}>HSK {i + 1}</span>)}</div></div>}
  </div></Protected>;
}

type PlacementQuestion = { id: string; ordinal: number; prompt: string; pinyin: string; options: string[]; audioId: string | null };
type PlacementResult = { sessionId: string; answered: number; correct: number; recommendation: "foundation" | "elementary" | "developing"; explanation: string; isOfficialHskResult: false };

function PlacementPage() {
  const [questions, setQuestions] = useState<PlacementQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<{ questions: PlacementQuestion[] }>("/placement/questions")
      .then((data) => { setQuestions(data.questions); setError(""); })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Belum dapat memuat penilaian."))
      .finally(() => setBusy(false));
  }, []);

  const current = questions[index];
  const submit = async () => {
    if (!current || answers[current.id] === undefined) return;
    if (index < questions.length - 1) { setIndex((value) => value + 1); return; }
    setBusy(true); setError("");
    try {
      const response = await api<PlacementResult>("/placement/submit", {
        method: "POST",
        body: JSON.stringify({ assessmentVersion: "starting-point-v1", answers: questions.map((question) => ({ questionId: question.id, selectedOption: answers[question.id] })) }),
      });
      setResult(response);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Hasil belum tersimpan. Periksa koneksi lalu coba lagi."); }
    finally { setBusy(false); }
  };
  const recommendationLabels = { foundation: "Mulai dari dasar", elementary: "Dasar dengan tantangan", developing: "Siap mencoba materi lanjutan" };

  return <Protected><div className="page-wrap placement-page">
    <PageBack to="/paths" label="Kembali ke kursus" />
    <PageTitle eyebrow="SARAN TITIK AWAL" title="Cari materi yang pas untukmu" subtitle="Jawab beberapa soal buatan MandarinLearnApp. Hasilnya hanya saran belajar, bukan ujian atau sertifikat HSK." />
    {error && <InlineNotice tone="danger">{error}</InlineNotice>}
    {busy && !current && !result ? <div className="empty-card"><div className="loader" /><p>Menyiapkan soal…</p></div> : result ? <section className="placement-result">
      <span className="placement-result-icon"><Sparkles /></span><span className="tag">SARAN PRIBADI</span>
      <h2>{recommendationLabels[result.recommendation]}</h2><p>{result.explanation}</p>
      <div className="placement-score"><strong>{result.correct}/{result.answered}</strong><span>jawaban tepat</span></div>
      <InlineNotice>Ini bukan hasil resmi HSK. Saran ini berasal dari penilaian singkat dan dapat berubah seiring kamu belajar.</InlineNotice>
      <div className="placement-actions"><Link className="button button-primary" to="/paths">Jelajahi jalur belajar <ArrowRight /></Link><button className="button button-soft" onClick={() => { setIndex(0); setAnswers({}); setResult(null); }}>Coba lagi</button></div>
    </section> : current ? <section className="placement-question">
      <div className="placement-progress"><span>Pertanyaan {index + 1} dari {questions.length}</span><span>{Math.round(((index + 1) / questions.length) * 100)}%</span></div>
      <div className="lesson-progress-track"><span style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div>
      <div className="placement-prompt" lang="zh-Hans">{current.prompt}</div>
      {current.pinyin && <p className="placement-pinyin">{current.pinyin}</p>}
      <AudioButton assetId={current.audioId} text={current.prompt} prominent humanOnly />
      <h2>Pilih arti atau jawaban yang paling tepat.</h2>
      <div className="lesson-answer-list">{current.options.map((option, optionIndex) => <button key={`${current.id}-${optionIndex}`} className={`lesson-answer ${answers[current.id] === optionIndex ? "answer-correct" : ""}`} aria-pressed={answers[current.id] === optionIndex} onClick={() => setAnswers((previous) => ({ ...previous, [current.id]: optionIndex }))}>{option}{answers[current.id] === optionIndex && <Check size={17} />}</button>)}</div>
      <div className="placement-actions">{index > 0 && <button className="button button-soft" onClick={() => setIndex((value) => value - 1)}>Kembali</button>}<button className="button button-primary" disabled={answers[current.id] === undefined || busy} onClick={() => void submit()}>{busy ? "Menyimpan…" : index === questions.length - 1 ? "Lihat saranku" : "Lanjut"} <ArrowRight /></button></div>
    </section> : <div className="empty-card"><h3>Soal belum tersedia</h3><p>Silakan pilih jalur belajar secara langsung.</p><Link className="button button-primary" to="/paths">Buka kursus</Link></div>}
  </div></Protected>;
}

function PracticeHubPage() {
  const [paths, setPaths] = useState<Array<{ id: string; slug: string; name: string; kind: string; description: string | null }>>([]);
  const [units, setUnits] = useState<Array<{ id: string; title: string; description: string | null; ordinal: number; placement_count: number }>>([]);
  useEffect(() => {
    void api<{ paths: typeof paths }>("/paths").then(async ({ paths: available }) => {
      setPaths(available);
      const daily = available.find((path) => path.kind === "daily_life");
      if (daily) {
        const result = await api<{ units: typeof units }>(`/paths/${encodeURIComponent(daily.id)}/units`);
        setUnits(result.units.filter((unit) => unit.placement_count > 0));
      }
    }).catch(() => { setPaths([]); setUnits([]); });
  }, []);
  return <Protected><div className="page-wrap"><PageTitle eyebrow="LATIHAN MANDIRI" title="Pilih yang ingin kamu latih" subtitle="Latihan memakai kata dan karakter yang sama dengan kursusmu, agar hasilnya tetap terhubung ke materi yang dipelajari." />
    <div className="practice-hub-grid">
      <Link className="skill-card" to="/pinyin"><span className="skill-icon skill-icon-course"><CircleHelp /></span><span><strong>Dasar pinyin & nada</strong><small>Pelajari cara membaca pinyin dan membedakan empat nada.</small></span><ChevronRight /></Link>
      <Link className="skill-card" to="/review"><span className="skill-icon skill-icon-review"><RotateCcw /></span><span><strong>Ulangi materi</strong><small>Kerjakan kata dan karakter yang sudah waktunya ditinjau.</small></span><ChevronRight /></Link>
      <Link className="skill-card" to="/freehand"><span className="skill-icon skill-icon-write"><PenLine /></span><span><strong>Kenali tulisanmu</strong><small>Tulis karakter bebas dan pilih kandidat yang kamu maksud.</small></span><ChevronRight /></Link>
      <Link className="skill-card" to="/practice/speaking"><span className="skill-icon skill-icon-listen"><Headphones /></span><span><strong>Dengar, rekam, bandingkan</strong><small>Dengarkan penutur Mandarin, rekam suaramu, lalu bandingkan sendiri.</small></span><ChevronRight /></Link>
      <Link className="skill-card" to="/paths"><span className="skill-icon skill-icon-course"><BookOpen /></span><span><strong>Belajar lewat skenario</strong><small>Ikuti contoh, panduan menulis, dan cek pemahaman.</small></span><ChevronRight /></Link>
    </div>
    <div className="section-heading practice-hub-heading"><div><h2>Latihan dari topik sehari-hari</h2><p>Pilih topik yang sudah memiliki materi.</p></div><Link to="/paths" className="text-link">Semua kursus <ChevronRight /></Link></div>
    {units.length ? <div className="unit-list">{units.map((unit) => <Link className="unit-row" to={`/unit/${unit.id}`} key={unit.id}><span className="unit-number">{String(unit.ordinal + 1).padStart(2, "0")}</span><span className="unit-copy"><strong>{unit.title}</strong><small>{unit.description ?? "Skenario keseharian"}</small></span><span className="unit-progress">{unit.placement_count} materi</span><ChevronRight /></Link>)}</div> : <div className="empty-card"><h3>Topik latihan sedang dimuat</h3><p>Materi topik akan muncul setelah server dapat dijangkau.</p><Link className="button button-soft" to="/paths">Buka kursus <ArrowRight /></Link></div>}
  </div></Protected>;
}

function ToneContour({ kind }: { kind: "first" | "second" | "third" | "fourth" | "neutral" }) {
  const paths = { first: "M8 25 L92 25", second: "M8 40 Q50 40 92 10", third: "M8 13 Q24 38 50 38 Q72 38 92 13", fourth: "M8 10 Q50 10 92 40", neutral: "M8 25 L92 25" };
  const startY = { first: 25, second: 40, third: 13, fourth: 10, neutral: 25 }[kind];
  const endY = { first: 25, second: 10, third: 13, fourth: 40, neutral: 25 }[kind];
  return <svg className={`tone-contour tone-contour-${kind}`} viewBox="0 0 100 50" aria-label={`${kind} tone contour`} role="img"><path d={paths[kind]} /><circle cx="8" cy={startY} r="3" /><circle cx="92" cy={endY} r="3" /></svg>;
}

function PinyinPage() {
  const tones = [
    { kind: "first" as const, name: "Nada pertama", mark: "mā", shape: "tinggi dan datar", text: "Jaga suara tetap tinggi dan rata.", word: "妈妈", audioId: "audio-word-mama", note: "mā adalah suku kata bernada pertama; ma berikutnya adalah nada netral." },
    { kind: "second" as const, name: "Nada kedua", mark: "shí", shape: "naik", text: "Mulai dari tengah, lalu naik seperti bertanya singkat.", word: "时候", audioId: "audio-word-shihou", note: "Dengarkan nada pada suku kata shí; suku kata hou memakai nada netral." },
    { kind: "third" as const, name: "Nada ketiga", mark: "shuǐ", shape: "turun lalu naik", text: "Saat diucapkan sendiri, suara turun lalu kembali naik.", word: "水", audioId: "audio-word-water", note: "Nada ketiga dalam rangkaian kalimat sering terdengar lebih pendek dan rendah." },
    { kind: "fourth" as const, name: "Nada keempat", mark: "shì", shape: "turun tegas", text: "Mulai tinggi dan turun dengan jelas.", word: "是", audioId: "audio-word-shi", note: "Gunakan suara tegas tetapi tetap alami, tanpa berteriak." },
  ];
  return <Protected><div className="page-wrap pinyin-page"><PageBack to="/practice" label="Kembali ke latihan" /><PageTitle eyebrow="PONDASI PELAFALAN" title="Kenali pinyin dan nada" subtitle="Pinyin menuliskan bunyi Mandarin dengan huruf Latin. Tanda nada mengubah arti; dengarkan rekaman dan tirukan perlahan." />
    <section className="pinyin-intro"><div className="pinyin-syllable" lang="zh-Hans">音</div><div><h2>Satu suku kata, tiga bagian</h2><p>Biasanya sebuah suku kata memiliki bunyi awal, bagian vokal, dan nada. Misalnya <strong>sh + ui + 3 → shuǐ</strong>. Beberapa suku kata tidak memiliki bunyi awal.</p><small>Huruf ü tetap memakai dua titik dalam pinyin, misalnya nǚ. Pada keyboard, kamu dapat mengetik v bila ü tidak tersedia.</small></div></section>
    <div className="tone-lesson-grid">{tones.map((tone) => <article className="tone-lesson-card" key={tone.kind}><div className="tone-card-heading"><div><span className="tag">{tone.name.toUpperCase()}</span><h2>{tone.mark}</h2></div><ToneContour kind={tone.kind} /></div><strong>{tone.shape}</strong><p>{tone.text}</p><div className="tone-example"><span lang="zh-Hans">{tone.word}</span><span>{tone.note}</span><AudioButton assetId={tone.audioId} text={tone.word} /></div></article>)}</div>
    <section className="detail-card"><h2>Nada netral</h2><p>Nada netral biasanya lebih ringan dan lebih singkat daripada nada penuh. Tinggi suaranya bergantung pada suku kata sebelumnya. Contoh: 妈妈 <strong>mā ma</strong>.</p><AudioButton assetId="audio-word-mama" text="妈妈" /></section>
    <section className="detail-card"><h2>Perubahan nada dalam ucapan</h2><p>Dua suku kata bernada ketiga yang berurutan biasanya membuat suku kata pertama terdengar bernada kedua. Contoh sapaan 你好 ditulis <strong>nǐ hǎo</strong>, tetapi dalam ucapan alaminya suku kata pertama terdengar mendekati <strong>ní hǎo</strong>.</p><AudioButton assetId="audio-nihao" text="你好" /></section>
    <Link className="button button-primary" to="/paths">Mulai belajar lewat kursus <ArrowRight /></Link>
  </div></Protected>;
}

type DiscoverItem = { id: string; simplifiedForm: string; meaning: string | null; pinyinJson: string | null; audioId: string | null; readingId: string | null; placementId: string | null };
type DiscoverCollectionItem = { id: string; type: "grammar" | "dialogue" | "story"; title: string; subtitle: string; preview: string | null; unitId: string; unitTitle: string };
function DiscoverPage() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "daily_life" | "hsk">("all");
  const [collection, setCollection] = useState<"words" | "grammar" | "dialogue" | "story">("words");
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [collections, setCollections] = useState<DiscoverCollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void api<{ items?: DiscoverItem[]; collection?: string; collections?: DiscoverCollectionItem[] }>(`/discover?q=${encodeURIComponent(query)}&kind=${kind === "all" ? "" : kind}&collection=${collection}`)
        .then((result) => { if (active) { setItems(result.items ?? []); setCollections(result.collections ?? []); setError(""); } })
        .catch(() => { if (active) setError("Belum dapat memuat materi. Periksa koneksi lalu coba lagi."); })
        .finally(() => { if (active) setLoading(false); });
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, kind, collection]);
  const collectionNames = { words: "Kata", grammar: "Tata bahasa", dialogue: "Dialog", story: "Cerita" };
  return <Protected><div className="page-wrap discover-page"><PageTitle eyebrow="JELAJAHI MANDARIN" title="Temukan kata baru" subtitle="Cari dengan hanzi, pinyin, atau arti bahasa Indonesia. Buka kata untuk melihat contoh dan karakter penyusunnya." />
    <label className="discover-search"><Search aria-hidden="true" /><span className="sr-only">Cari hanzi, pinyin, atau arti</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Contoh: 你好, nǐ hǎo, halo" autoComplete="off" /><button type="button" onClick={() => setQuery("")} disabled={!query} aria-label="Hapus pencarian"><X /></button></label>
    <div className="discover-filters" aria-label="Jenis materi">{(Object.keys(collectionNames) as Array<keyof typeof collectionNames>).map((value) => <button key={value} className={collection === value ? "filter-active" : ""} onClick={() => setCollection(value)}>{collectionNames[value]}</button>)}</div>
    <div className="discover-filters" aria-label="Filter materi"><button className={kind === "all" ? "filter-active" : ""} onClick={() => setKind("all")}>Semua</button><button className={kind === "daily_life" ? "filter-active" : ""} onClick={() => setKind("daily_life")}>Keseharian</button><button className={kind === "hsk" ? "filter-active" : ""} onClick={() => setKind("hsk")}>Jalur HSK</button></div>
    <div className="discover-results-head"><strong>{query ? `Hasil “${query}” · ${collectionNames[collection]}` : `${collectionNames[collection]} yang tersedia`}</strong><span>{loading ? "Mencari…" : `${collection === "words" ? items.length : collections.length} materi`}</span></div>
    {error && <InlineNotice tone="danger">{error}</InlineNotice>}
    {collection === "words" && items.length > 0 && <div className="discover-grid">{items.map((item) => <article className="discover-card" key={item.id}><Link to={`/word/${item.id}`} className="discover-card-main"><span className="discover-hanzi">{item.simplifiedForm}</span><span className="discover-word-copy"><strong>{item.meaning ?? "Arti sedang disiapkan"}</strong><small>{formatPinyinJson(item.pinyinJson) || "Pinyin sedang disiapkan"}</small></span><ChevronRight aria-hidden="true" /></Link><AudioButton assetId={item.audioId} text={item.simplifiedForm} /></article>)}</div>}
    {collection !== "words" && collections.length > 0 && <div className="discover-collection-grid">{collections.map((item) => <Link className="discover-collection-card" to={`/unit/${item.unitId}`} key={item.id}><span className={`collection-mark collection-mark-${item.type}`}>{item.type === "grammar" ? <BookOpen /> : item.type === "dialogue" ? <MessageCircle /> : <Sparkles />}</span><span><small>{item.unitTitle} · {collectionNames[item.type]}</small><strong>{item.title}</strong><p>{item.subtitle}</p>{item.preview && <em lang="zh-Hans">{item.preview}</em>}</span><ChevronRight /></Link>)}</div>}
    {((collection === "words" && !items.length) || (collection !== "words" && !collections.length)) && !loading && !error ? <div className="empty-card discover-empty"><div className="empty-icon"><Compass /></div><h3>{query ? `Belum ada ${collectionNames[collection].toLowerCase()} yang cocok` : `${collectionNames[collection]} belum tersedia`}</h3><p>{query ? "Coba istilah lain, atau hapus pencarian untuk melihat semua materi." : "Materi yang sudah diterbitkan akan muncul di sini."}</p>{query && <button className="button button-soft" onClick={() => setQuery("")}>Lihat semua materi</button>}</div> : null}
    <p className="discover-note"><ShieldCheck /> Hanya materi yang sudah diterbitkan dan memiliki sumber yang terdaftar akan ditampilkan.</p>
  </div></Protected>;
}

function formatPinyinJson(value: string | null) {
  if (!value) return "";
  try {
    const syllables = JSON.parse(value) as string[];
    return syllables.join(" ");
  } catch { return ""; }
}

function SpeakingPracticePage() {
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(true);
  const [recording, setRecording] = useState(false);
  const [complete, setComplete] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [notice, setNotice] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const { data: currentSession } = useLearnerSession();
  useEffect(() => {
    let active = true;
    void api<{ items: DiscoverItem[] }>("/discover?kind=daily_life").then(({ items: rows }) => {
      if (active) { setItems(rows.filter((item) => item.audioId && item.readingId && item.placementId)); setBusy(false); }
    }).catch(() => { if (active) { setNotice("Belum dapat memuat rekaman. Periksa koneksi lalu coba lagi."); setBusy(false); } });
    return () => {
      active = false;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  useEffect(() => () => { if (recordingUrl) URL.revokeObjectURL(recordingUrl); }, [recordingUrl]);
  const item = items[index];
  const startRecording = async () => {
    setNotice("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setNotice("Perangkat ini belum mendukung perekaman suara di browser. Kamu masih bisa mendengarkan dan berlatih tanpa merekam."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (chunksRef.current.length) {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/mp4" });
          setRecordingUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return URL.createObjectURL(blob); });
        }
        setRecording(false);
      };
      recorder.start(); setRecording(true);
    } catch { setNotice("Tidak dapat membuka mikrofon. Izinkan akses mikrofon untuk situs ini melalui pengaturan browser, lalu coba lagi."); }
  };
  const stopRecording = () => { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); };
  const rateAndContinue = async (selfAssessment: "confident" | "repeat" | "unsure") => {
    if (!item || !currentSession?.user.id || !item.readingId || !item.placementId) return;
    const labels = { confident: "Bagus, saya cukup yakin", repeat: "Saya ingin mengulang", unsure: "Saya belum yakin" };
    try {
      await saveAttempt({ contentType: "vocabulary", contentId: item.id, readingId: item.readingId, curriculumPlacementId: item.placementId,
        skill: "speaking", activityMode: "record_compare", dimensions: { selfAssessment }, engineVersion: "browser-record-and-compare-v1" }, currentSession.user.id);
      setNotice(labels[selfAssessment]);
      setRecordingUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return ""; });
      if (index + 1 < items.length) setIndex((value) => value + 1);
      else { setComplete(true); setNotice("Selesai! Catatan latihan tersimpan. Rekaman suaramu tidak diunggah dan tidak disimpan."); }
    } catch { setNotice("Latihan belum masuk antrean sinkronisasi. Coba lagi saat koneksi tersedia."); }
  };
  if (busy) return <Protected><div className="centered-page"><div className="loader" /></div></Protected>;
  return <Protected><div className="page-wrap speaking-practice"><PageBack to="/practice" label="Latihan" /><PageTitle eyebrow="LATIHAN BERBICARA" title="Dengar, rekam, bandingkan" subtitle="Dengarkan rekaman Mandarin yang berlisensi, ucapkan kata, lalu bandingkan dengan rekamanmu sendiri. Tidak ada skor otomatis." />
    {complete ? <div className="empty-card"><div className="empty-icon"><Check /></div><h3>Latihan berbicara selesai</h3><p>Penilaianmu tersimpan sebagai refleksi diri; aplikasi tidak mengklaim mengukur ketepatan pelafalan.</p><button className="button button-primary" onClick={() => { setIndex(0); setComplete(false); setNotice(""); }}>Mulai lagi</button></div> : !item ? <div className="empty-card"><div className="empty-icon"><Headphones /></div><h3>Belum ada contoh suara untuk latihan</h3><p>Latihan berbicara hanya memakai kata yang memiliki rekaman tepat dan terverifikasi. Materi tanpa model suara tidak akan diisi dengan tebakan.</p><Link className="button button-primary" to="/discover">Jelajahi kata <ArrowRight /></Link></div> : <section className="speaking-card"><div className="speaking-count">KATA {index + 1} DARI {items.length}</div><div className="speaking-hanzi" lang="zh-Hans">{item.simplifiedForm}</div><p className="speaking-pinyin">{formatPinyinJson(item.pinyinJson)}</p><p className="speaking-meaning">{item.meaning}</p><div className="speaking-model"><span>1</span><div><strong>Dengarkan contoh</strong><small>Rekaman Mandarin dari sumber berlisensi</small></div><AudioButton assetId={item.audioId} text={item.simplifiedForm} prominent /></div><div className="speaking-record"><span>2</span><div><strong>Ucapkan dan rekam</strong><small>Audio hanya diproses sementara di perangkat ini.</small></div>{recording ? <button className="button button-danger" onClick={stopRecording}>Hentikan rekaman</button> : <button className="button button-primary" onClick={() => void startRecording()}><Headphones /> Mulai merekam</button>}</div>{recordingUrl && <div className="speaking-playback"><span>3</span><div><strong>Dengarkan suaramu</strong><small>Bandingkan pelafalan dan nadanya sendiri.</small></div><audio controls src={recordingUrl} /></div>}{recordingUrl && <div className="speaking-self-check"><p>Bagaimana menurutmu?</p><div><button className="button button-soft" onClick={() => void rateAndContinue("repeat")}>Ulangi lagi</button><button className="button button-soft" onClick={() => void rateAndContinue("unsure")}>Belum yakin</button><button className="button button-primary" onClick={() => void rateAndContinue("confident")}>Cukup yakin</button></div></div>}</section>}
    {notice && <InlineNotice>{notice}</InlineNotice>}<p className="privacy-note">Tidak ada rekaman yang dikirim ke server. Hasilnya hanya mencatat bahwa kamu berlatih dan penilaian dirimu sendiri.</p>
  </div></Protected>;
}

type CommunityTopic = { id: string; slug: string; title: string; prompt: string };
type CommunityPost = { id: string; topicId: string | null; topicTitle: string | null; body: string; createdAt: string; authorName: string; commentCount: number };
type CommunityComment = { id: string; body: string; createdAt: string; authorName: string };
function TalkPage() {
  const { data: session } = useLearnerSession();
  const [topics, setTopics] = useState<CommunityTopic[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [myPosts, setMyPosts] = useState<Array<{ id: string; body: string; status: string; createdAt: string; topicTitle: string | null }>>([]);
  const [topicId, setTopicId] = useState("");
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [openPost, setOpenPost] = useState("");
  const [comments, setComments] = useState<Record<string, CommunityComment[]>>({});
  const [reply, setReply] = useState("");
  const [reportReason, setReportReason] = useState("other");
  const [reportDetails, setReportDetails] = useState("");
  const load = () => void api<{ topics: CommunityTopic[]; posts: CommunityPost[]; myPosts: typeof myPosts }>("/community/feed")
    .then((data) => { setTopics(data.topics); setPosts(data.posts); setMyPosts(data.myPosts); setError(""); if (!topicId && data.topics[0]) setTopicId(data.topics[0].id); })
    .catch((cause) => setError(cause instanceof Error ? cause.message : "Belum dapat memuat komunitas."));
  useEffect(() => { if (session?.user) load(); }, [session?.user?.id]);
  const selectedTopic = topics.find((topic) => topic.id === topicId);
  const submitPost = async (event: React.FormEvent) => {
    event.preventDefault(); setNotice(""); setError("");
    try { const response = await api<{ message: string }>("/community/posts", { method: "POST", body: JSON.stringify({ topicId: topicId || undefined, body: draft, locale: "id" }) }); setDraft(""); setNotice(response.message); load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Pesan belum dapat dikirim."); }
  };
  const toggleComments = async (postId: string) => {
    if (openPost === postId) { setOpenPost(""); return; }
    setOpenPost(postId);
    if (!comments[postId]) { try { const data = await api<{ comments: CommunityComment[] }>(`/community/posts/${postId}/comments`); setComments((current) => ({ ...current, [postId]: data.comments })); } catch { setError("Balasan belum dapat dimuat."); } }
  };
  const submitReply = async (event: React.FormEvent, postId: string) => {
    event.preventDefault();
    try { await api(`/community/posts/${postId}/comments`, { method: "POST", body: JSON.stringify({ body: reply }) }); setReply(""); setNotice("Balasan terkirim untuk pemeriksaan moderator sebelum ditampilkan."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Balasan belum dapat dikirim."); }
  };
  const report = async (subjectType: "post" | "comment", subjectId: string) => {
    try { await api("/community/reports", { method: "POST", body: JSON.stringify({ subjectType, subjectId, reason: reportReason, details: reportDetails }) }); setReportDetails(""); setNotice("Laporan telah dikirim untuk ditinjau."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Laporan belum dapat dikirim."); }
  };
  const blockAuthor = async (postId: string) => {
    if (!window.confirm("Sembunyikan semua postingan dari akun ini di feed-mu? Kamu bisa membuka blokir lewat pengaturan komunitas nanti.")) return;
    try { await api("/community/blocks", { method: "POST", body: JSON.stringify({ postId }) }); setNotice("Postingan dari akun ini disembunyikan."); load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Akun belum dapat disembunyikan."); }
  };
  return <Protected><div className="page-wrap talk-page"><PageTitle eyebrow="KOMUNITAS BELAJAR" title="Belajar bareng" subtitle="Bagikan pertanyaan dan cara belajarmu dengan sesama pembelajar. Pesan diperiksa moderator sebelum tampil." />
    <div className="community-safety"><ShieldCheck /><div><strong>Komunitas aman untuk belajar</strong><span>Jangan bagikan alamat, nomor pribadi, kata sandi, atau informasi rahasia. Tidak ada pesan pribadi atau unggahan media.</span></div></div>
    {error && <InlineNotice tone="danger">{error}</InlineNotice>}{notice && <InlineNotice>{notice}</InlineNotice>}
    <form className="community-compose detail-card" onSubmit={(event) => void submitPost(event)}><h2><MessageCircle /> Mulai percakapan</h2>{topics.length > 0 && <label>Topik<select value={topicId} onChange={(event) => setTopicId(event.target.value)}>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select></label>}{selectedTopic && <p className="community-prompt">{selectedTopic.prompt}</p>}<label>Pesan<textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1200} rows={4} placeholder="Tulis dalam bahasa Indonesia atau Mandarin…" required /></label><div className="community-compose-foot"><small>{draft.length}/1200 · Maksimal 5 topik per hari</small><button className="button button-primary" disabled={!draft.trim()}>Kirim untuk ditinjau <ArrowRight /></button></div></form>
    {myPosts.length > 0 && <section className="community-own-posts"><h2>Pesanmu yang sedang ditinjau</h2>{myPosts.map((post) => <article className="community-own-row" key={post.id}><span className={`community-status status-${post.status}`}>{post.status === "pending" ? "Menunggu pemeriksaan" : "Perlu disunting"}</span><p>{post.body}</p><small>{post.topicTitle ?? "Komunitas"} · {new Date(post.createdAt).toLocaleDateString("id-ID")}</small></article>)}</section>}
    <section className="community-feed"><div className="section-heading"><div><h2>Percakapan terbaru</h2><p>Hanya pesan yang sudah disetujui moderator yang tampil.</p></div></div>{posts.length ? posts.map((post) => <article className="community-post" key={post.id}><div className="community-post-head"><span className="avatar avatar-small">{post.authorName.slice(0,1).toUpperCase()}</span><div><strong>{post.authorName}</strong><small>{post.topicTitle ?? "Belajar Mandarin"} · {new Date(post.createdAt).toLocaleDateString("id-ID")}</small></div><details className="community-actions"><summary aria-label="Tindakan postingan"><CircleHelp /></summary><button onClick={() => void blockAuthor(post.id)}><Ban /> Sembunyikan akun ini</button></details></div><p className="community-post-body">{post.body}</p><div className="community-post-actions"><button className="text-link" onClick={() => void toggleComments(post.id)}><MessageCircle /> {post.commentCount} balasan</button><details className="community-report"><summary><Flag /> Laporkan</summary><div><label>Alasan<select value={reportReason} onChange={(event) => setReportReason(event.target.value)}><option value="spam">Spam</option><option value="harassment">Perundungan</option><option value="personal_data">Data pribadi</option><option value="copyright">Hak cipta</option><option value="other">Lainnya</option></select></label><textarea maxLength={600} value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} placeholder="Keterangan tambahan (opsional)" /><button className="button button-soft" onClick={() => void report("post", post.id)}>Kirim laporan</button></div></details></div>{openPost === post.id && <div className="community-comments">{comments[post.id]?.map((comment) => <div className="community-comment" key={comment.id}><div><strong>{comment.authorName}</strong><small>{new Date(comment.createdAt).toLocaleDateString("id-ID")}</small></div><p>{comment.body}</p><button className="text-link" onClick={() => void report("comment", comment.id)}><Flag /> Laporkan balasan</button></div>)}{comments[post.id]?.length === 0 && <p className="muted">Belum ada balasan yang disetujui.</p>}<form onSubmit={(event) => void submitReply(event, post.id)}><label className="sr-only" htmlFor={`reply-${post.id}`}>Tulis balasan</label><input id={`reply-${post.id}`} value={reply} maxLength={800} onChange={(event) => setReply(event.target.value)} placeholder="Tulis balasan…" required /><button className="button button-soft" disabled={!reply.trim()}>Balas</button></form><small>Balasan juga ditinjau moderator sebelum tampil. Maksimal 15 balasan per hari.</small></div>}</article>) : !error ? <div className="empty-card community-empty"><div className="empty-icon"><MessageCircle /></div><h3>Jadilah yang pertama berbagi</h3><p>Topik pembuka sudah tersedia di atas. Pesan akan muncul di percakapan setelah moderator menyetujuinya.</p></div> : null}</section>
  </div></Protected>;
}

function AdminCommunity() {
  const [queue, setQueue] = useState<{ posts: Array<{ id: string; body: string; createdAt: string; authorName: string; topicTitle: string | null }>; comments: Array<{ id: string; postId: string; body: string; createdAt: string; authorName: string; parentBody: string }>; reports: Array<{ id: string; subjectType: string; subjectId: string; reason: string; details: string; createdAt: string; body: string | null }> } | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const load = () => void api<typeof queue>("/admin/community/queue").then((data) => setQueue(data)).catch((cause) => setError(cause instanceof Error ? cause.message : "Akses moderator diperlukan."));
  useEffect(() => { load(); }, []);
  const moderate = async (kind: "posts" | "comments", id: string, decision: "approved" | "rejected") => { try { await api(`/admin/community/${kind}/${id}`, { method: "PATCH", body: JSON.stringify({ decision }) }); setNotice("Keputusan tersimpan dan tercatat di audit."); load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Keputusan belum tersimpan."); } };
  const reviewReport = async (reportId: string, hideContent: boolean) => { try { await api(`/admin/community-reports/${reportId}`, { method: "PATCH", body: JSON.stringify({ decision: hideContent ? "resolved" : "dismissed", hideContent }) }); setNotice("Laporan sudah ditangani."); load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Laporan belum dapat ditangani."); } };
  return <><AdminPageHead eyebrow="MODERASI" title="Komunitas" subtitle="Kiriman dan balasan baru hanya terlihat oleh penulis sampai disetujui. Akses moderator tercatat di audit." />{error && <InlineNotice tone="danger">{error}</InlineNotice>}{notice && <InlineNotice>{notice}</InlineNotice>}{queue && <>
    <section className="admin-panel review-section"><div className="panel-head"><div><h2>Topik menunggu moderasi</h2><p>{queue.posts.length} kiriman</p></div></div>{queue.posts.length ? queue.posts.map((post) => <div className="community-admin-item" key={post.id}><div><strong>{post.topicTitle ?? "Tanpa topik"} · {post.authorName}</strong><p>{post.body}</p><small>{new Date(post.createdAt).toLocaleString("id-ID")}</small></div><div><button className="button button-soft" onClick={() => void moderate("posts", post.id, "rejected")}>Tolak</button><button className="button button-primary" onClick={() => void moderate("posts", post.id, "approved")}>Setujui</button></div></div>) : <div className="table-empty">Tidak ada kiriman menunggu.</div>}</section>
    <section className="admin-panel review-section"><div className="panel-head"><div><h2>Balasan menunggu moderasi</h2><p>{queue.comments.length} balasan</p></div></div>{queue.comments.length ? queue.comments.map((comment) => <div className="community-admin-item" key={comment.id}><div><strong>{comment.authorName} membalas:</strong><blockquote>{comment.parentBody}</blockquote><p>{comment.body}</p></div><div><button className="button button-soft" onClick={() => void moderate("comments", comment.id, "rejected")}>Tolak</button><button className="button button-primary" onClick={() => void moderate("comments", comment.id, "approved")}>Setujui</button></div></div>) : <div className="table-empty">Tidak ada balasan menunggu.</div>}</section>
    <section className="admin-panel review-section"><div className="panel-head"><div><h2>Laporan komunitas</h2><p>{queue.reports.length} laporan terbuka</p></div></div>{queue.reports.length ? queue.reports.map((report) => <div className="community-admin-item" key={report.id}><div><strong>{report.reason} · {report.subjectType}</strong><p>{report.body ?? "Konten sudah dihapus"}</p><small>{report.details || "Tanpa keterangan tambahan"} · {new Date(report.createdAt).toLocaleString("id-ID")}</small></div><div><button className="button button-soft" onClick={() => void reviewReport(report.id, false)}>Tutup laporan</button><button className="button button-danger" onClick={() => void reviewReport(report.id, true)}>Sembunyikan konten</button></div></div>) : <div className="table-empty">Tidak ada laporan terbuka.</div>}</section>
  </>}</>;
}

function PathPage() {
  const { pathId = "" } = useParams();
  const [units, setUnits] = useState<Array<{ id: string; title: string; description: string | null; ordinal: number; placement_count: number }>>([]);
  const pathName = pathId === "curriculum-hsk-3" ? "HSK 3.0 · 9 tingkat" : pathId === "curriculum-hsk-2" ? "HSK 2.0 · 6 tingkat" : "Keseharian";
  const hskPath = pathId === "curriculum-hsk-3" || pathId === "curriculum-hsk-2";
  useEffect(() => { setUnits([]); void api<{ units: typeof units }>(`/paths/${encodeURIComponent(pathId)}/units`).then((data) => setUnits(data.units)).catch(() => setUnits([])); }, [pathId]);
  return <Protected><div className="page-wrap"><PageBack to="/paths" label="Semua jalur" /><PageTitle eyebrow="JALUR BELAJAR" title={pathName || "Susunan materi"} subtitle={hskPath ? "Pilih satu pelajaran untuk mulai. Materi ditulis khusus untuk aplikasi dan disusun mengikuti tingkat, bukan salinan daftar resmi HSK." : "Pilih satu topik keseharian. Di setiap pelajaran kamu akan mendengar kata, melihat contoh, berlatih menulis, lalu mengulang artinya."} />
    {units.length ? <div className="unit-list">{units.map((unit) => unit.placement_count > 0 ? <Link className="unit-row" to={`/unit/${unit.id}`} key={unit.id}><span className="unit-number">{String(unit.ordinal + 1).padStart(2, "0")}</span><span className="unit-copy"><strong>{unit.title}</strong><small>{unit.description ?? `${unit.placement_count} materi`}</small></span><span className="unit-progress">{unit.placement_count} materi</span><ChevronRight /></Link> : <div className="unit-row unit-row-locked" key={unit.id} aria-disabled="true"><span className="unit-number">{String(unit.ordinal + 1).padStart(2, "0")}</span><span className="unit-copy"><strong>{unit.title}</strong><small>{unit.description ?? "Materi belum tersedia."}</small></span><span className="unit-progress">Dalam penyusunan</span></div>)}</div> : <div className="empty-card"><div className="hsk-level-strip">{Array.from({ length: pathId === "curriculum-hsk-2" ? 6 : 9 }, (_, i) => <span key={i}>Tingkat {i + 1}</span>)}</div><h3>Daftar pelajaran sedang dimuat</h3><p>Jalur akan menampilkan tiap pelajaran setelah datanya tersedia.</p></div>}
  </div></Protected>;
}

function LessonPage() {
  const { unitId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const requestedActivityId = searchParams.get("activity");
  const [unit, setUnit] = useState<Unit | null>(null);
  const [items, setItems] = useState<UnitItem[]>([]);
  const [activities, setActivities] = useState<LessonActivity[]>([]);
  const [lessonExtras, setLessonExtras] = useState<LessonExtras>({ grammar: [], dialogueTurns: [], storyParagraphs: [] });
  const [phase, setPhase] = useState(0);
  const [writingCharacters, setWritingCharacters] = useState<Record<string, Array<{ id: string; hanzi: string; strokeCount: number; strokeDataStatus: string }>>>({});
  const [loadingCharacters, setLoadingCharacters] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [highestPhase, setHighestPhase] = useState(0);
  const [scenarioDraft, setScenarioDraft] = useState("");
  const [scenarioSelfAssessment, setScenarioSelfAssessment] = useState<"confident" | "repeat" | "unsure">("unsure");
  const [scenarioSaved, setScenarioSaved] = useState(false);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioSaving, setScenarioSaving] = useState(false);
  const [scenarioNotice, setScenarioNotice] = useState("");
  const [progressNotice, setProgressNotice] = useState("");
  const { data: currentSession } = useLearnerSession();
  useEffect(() => {
    setUnit(null); setItems([]); setActivities([]); setLessonExtras({ grammar: [], dialogueTurns: [], storyParagraphs: [] });
    void api<{ unit: Unit; items: UnitItem[]; activities: LessonActivity[] } & LessonExtras>(`/units/${encodeURIComponent(unitId)}`).then((data) => {
      setUnit(data.unit); setItems(data.items); setActivities(data.activities);
      setLessonExtras({ grammar: data.grammar ?? [], dialogueTurns: data.dialogueTurns ?? [], storyParagraphs: data.storyParagraphs ?? [] });
      const orderedActivities = [...data.activities].sort((a, b) => a.ordinal - b.ordinal);
      const requested = orderedActivities.find((activity) => activity.id === requestedActivityId);
      const inProgress = orderedActivities.find((activity) => activity.state === "in_progress");
      const firstIncomplete = orderedActivities.find((activity) => activity.state !== "completed");
      const lastActivity = orderedActivities.at(-1);
      let unlockedThrough = 0;
      for (const activity of orderedActivities) {
        if (activity.state !== "completed") break;
        unlockedThrough = activity.ordinal + 1;
      }
      const requestedIsAvailable = requested && requested.state !== "completed" && requested.ordinal <= unlockedThrough;
      const resume = (requestedIsAvailable ? requested : undefined) ?? inProgress ?? firstIncomplete ?? lastActivity;
      const maximumPhase = Math.max(0, (lastActivity?.ordinal ?? 0));
      const startPhase = Math.min(resume?.ordinal ?? 0, maximumPhase);
      setPhase(startPhase); setHighestPhase(Math.max(Math.min(unlockedThrough, maximumPhase), startPhase));
      setQuestionIndex(resume?.activityKind === "comprehension" && resume.state === "completed"
        ? data.items.filter((item) => item.vocabulary_id && item.gloss).length
        : resume?.currentItemOrdinal ?? 0);
      setScore(resume?.correctCount ?? 0);
      setSelectedAnswer(null); setProgressNotice("");
    }).catch(() => { setUnit(null); setItems([]); setActivities([]); });
  }, [unitId, requestedActivityId]);
  useEffect(() => { setPhase(0); setHighestPhase(0); setQuestionIndex(0); setSelectedAnswer(null); setScore(0); setWritingCharacters({}); setScenarioDraft(""); setScenarioSaved(false); setScenarioSelfAssessment("unsure"); setProgressNotice(""); }, [unitId]);
  useEffect(() => {
    if (phase !== 2 || items.length === 0 || items.every((item) => item.placement_id in writingCharacters)) return;
    let active = true;
    setLoadingCharacters(true);
    void Promise.all(items.map(async (item) => {
      if (item.character_id && item.hanzi) return [item.placement_id, item.stroke_data_status === "approved" ? [{ id: item.character_id, hanzi: item.hanzi, strokeCount: item.stroke_count ?? 0, strokeDataStatus: item.stroke_data_status }] : []] as const;
      if (!item.vocabulary_id) return [item.placement_id, []] as const;
      try {
        const data = await api<{ characters: Array<{ id: string; hanzi: string; strokeCount: number; strokeDataStatus: string }> }>(`/vocabulary/${encodeURIComponent(item.vocabulary_id)}`);
        return [item.placement_id, data.characters.filter((character) => character.strokeDataStatus === "approved")] as const;
      } catch { return [item.placement_id, []] as const; }
    })).then((entries) => { if (active) setWritingCharacters(Object.fromEntries(entries)); })
      .finally(() => { if (active) setLoadingCharacters(false); });
    return () => { active = false; };
  }, [phase, items, writingCharacters]);
  const quizItems = items.filter((item) => item.vocabulary_id && item.gloss);
  const activeQuestion = quizItems[questionIndex];
  const distractors = activeQuestion ? [...new Set(quizItems.filter((item) => item.placement_id !== activeQuestion.placement_id).map((item) => item.gloss).filter((gloss): gloss is string => Boolean(gloss) && gloss !== activeQuestion.gloss))].slice(0, 3) : [];
  const answerSlot = activeQuestion ? questionIndex % Math.min(4, distractors.length + 1) : 0;
  const answerOptions = activeQuestion ? [...distractors.slice(0, answerSlot), activeQuestion.gloss!, ...distractors.slice(answerSlot, answerSlot + 3 - answerSlot)] : [];
  const persistActivityProgress = async (activity: LessonActivity, state: "in_progress" | "completed", currentItemOrdinal = 0, correctCount = score) => {
    try {
      const saved = await api<{ state: LessonActivity["state"]; currentItemOrdinal: number; correctCount: number }>(`/activities/${encodeURIComponent(activity.id)}/progress`, { method: "POST", body: JSON.stringify({ state, currentItemOrdinal, correctCount }) });
      setActivities((current) => current.map((item) => item.id === activity.id
        ? { ...item, state: saved.state, currentItemOrdinal: saved.currentItemOrdinal, correctCount: saved.correctCount }
        : item));
      return true;
    } catch { return false; }
  };
  const currentActivity = activities.find((activity) => activity.ordinal === phase);
  const scenarioActivity = activities.find((activity) => activity.activityKind === "scenario_output");
  useEffect(() => {
    if (currentActivity && phase !== 3 && currentActivity.activityKind !== "scenario_output" && currentActivity.state !== "completed") persistActivityProgress(currentActivity, "in_progress", 0);
  }, [currentActivity?.id, currentActivity?.state, phase]);
  useEffect(() => {
    if (phase !== 4 || !scenarioActivity) return;
    let active = true;
    setScenarioLoading(true); setScenarioNotice("");
    void api<{ response: { responseText: string; selfAssessment: "confident" | "repeat" | "unsure" } | null }>(`/scenario-responses/${encodeURIComponent(scenarioActivity.id)}`)
      .then(({ response }) => { if (active && response) { setScenarioDraft(response.responseText); setScenarioSelfAssessment(response.selfAssessment); setScenarioSaved(true); } })
      .catch(() => { if (active) setScenarioNotice("Belum dapat memuat jawaban tersimpan."); })
      .finally(() => { if (active) setScenarioLoading(false); });
    return () => { active = false; };
  }, [phase, scenarioActivity?.id]);
  const [savingProgress, setSavingProgress] = useState(false);
  const advanceTo = async (nextPhase: number) => {
    if (savingProgress) return;
    setSavingProgress(true); setProgressNotice("");
    if (currentActivity && !await persistActivityProgress(currentActivity, "completed", phase === 3 ? Math.max(0, questionIndex - 1) : 0, score)) {
      setProgressNotice("Kemajuan belum tersimpan. Periksa koneksi lalu tekan tombol lanjut lagi."); setSavingProgress(false); return;
    }
    const nextActivity = activities.find((activity) => activity.ordinal === nextPhase);
    if (nextActivity && nextActivity.state !== "completed" && !await persistActivityProgress(nextActivity, "in_progress", nextActivity.currentItemOrdinal, nextActivity.correctCount)) {
      setProgressNotice("Langkah berikutnya belum siap dibuka karena kemajuan belum tersimpan. Coba lagi."); setSavingProgress(false); return;
    }
    setHighestPhase((value) => Math.max(value, nextPhase)); setPhase(nextPhase); setSavingProgress(false);
  };
  const moveToPhase = async (nextPhase: number) => {
    if (savingProgress || nextPhase === phase) return;
    setSavingProgress(true); setProgressNotice("");
    if (currentActivity && currentActivity.state !== "completed" && !await persistActivityProgress(currentActivity, "in_progress", phase === 3 ? questionIndex : 0)) {
      setProgressNotice("Kemajuan belum tersimpan. Periksa koneksi lalu coba lagi."); setSavingProgress(false); return;
    }
    const destination = activities.find((activity) => activity.ordinal === nextPhase);
    if (destination && destination.state !== "completed" && !await persistActivityProgress(destination, "in_progress", destination.currentItemOrdinal, destination.correctCount)) {
      setProgressNotice("Langkah belum dapat dibuka karena kemajuan belum tersimpan. Coba lagi."); setSavingProgress(false); return;
    }
    setPhase(nextPhase); setSavingProgress(false);
  };
  const recordMeaningAttempt = (answer: string) => {
    if (!activeQuestion?.vocabulary_id || !currentSession?.user.id || selectedAnswer !== null) return;
    const correct = answer === activeQuestion.gloss;
    if (correct) setScore((value) => value + 1);
    setSelectedAnswer(answer);
    void saveAttempt({ contentType: "vocabulary", contentId: activeQuestion.vocabulary_id, readingId: activeQuestion.reading_id ?? undefined,
      curriculumPlacementId: activeQuestion.placement_id, activityId: activities.find((activity) => activity.activityKind === "comprehension")?.id,
      skill: "comprehension", activityMode: "meaning", dimensions: { meaningRecall: correct ? "correct" : "needs_practice" }, engineVersion: "lesson-recall-v1" }, currentSession.user.id).catch(() => undefined);
  };
  const continueQuiz = async () => {
    if (!currentActivity || !activeQuestion || selectedAnswer === null || savingProgress) return;
    const nextIndex = questionIndex + 1;
    const nextScore = score;
    setSavingProgress(true); setProgressNotice("");
    const saved = await persistActivityProgress(currentActivity, nextIndex >= quizItems.length ? "completed" : "in_progress", Math.min(nextIndex, Math.max(0, quizItems.length - 1)), nextScore);
    if (!saved) { setProgressNotice("Kemajuan belum tersimpan. Periksa koneksi lalu coba lagi."); setSavingProgress(false); return; }
    setScore(nextScore); setQuestionIndex(nextIndex); setSelectedAnswer(null); setSavingProgress(false);
  };
  const saveScenarioResponse = async () => {
    if (!scenarioActivity || !scenarioDraft.trim()) { setScenarioNotice("Tulis setidaknya satu kalimat pendek sebelum menyimpan."); return; }
    setScenarioSaving(true); setScenarioNotice("");
    try {
      await api(`/scenario-responses/${encodeURIComponent(scenarioActivity.id)}`, { method: "POST", body: JSON.stringify({ responseText: scenarioDraft, selfAssessment: scenarioSelfAssessment }) });
      setActivities((current) => current.map((activity) => activity.id === scenarioActivity.id ? { ...activity, state: "completed" } : activity));
      setScenarioSaved(true); setHighestPhase((value) => Math.max(value, 4));
      setScenarioNotice("Jawaban tersimpan di akunmu. Aplikasi tidak mengirimkannya ke AI atau memberi nilai otomatis.");
    } catch (cause) { setScenarioNotice(cause instanceof Error ? cause.message : "Jawaban belum tersimpan. Coba lagi setelah koneksi pulih."); }
    finally { setScenarioSaving(false); }
  };
  const phases = activities.length ? activities.map((activity) => activity.title) : ["Kenali kata", "Pahami contoh", "Belajar menulis", "Uji ingatan", "Gunakan kalimat"];
  const writingActivity = activities.find((activity) => activity.activityKind === "writing");
  const writingCharactersReady = items.length > 0 && items.every((item) => item.placement_id in writingCharacters);
  const writingCharacterIds = [...new Set(Object.values(writingCharacters).flat().map((character) => character.id))];
  const completedWritingCharacterIds = new Set(writingActivity?.completedCharacterIds ?? []);
  const writingPracticeComplete = writingCharacterIds.length > 0 && writingCharacterIds.every((id) => completedWritingCharacterIds.has(id));
  return <Protected><div className="page-wrap"><PageBack to="/paths" label="Semua jalur" /><PageTitle eyebrow={unit?.curriculum_name ?? "PELAJARAN"} title={unit?.title ?? "Pelajaran"} subtitle={unit?.description ?? "Ikuti langkahnya berurutan: kenali kata, pahami contoh, berlatih menulis, ulangi, lalu gunakan dalam kalimatmu."} />
    {items.length ? <>
      <div className={`lesson-stepper lesson-stepper-${phases.length}`} role="group" aria-label="Langkah pelajaran">{phases.map((label, index) => <button key={activities[index]?.id ?? label} type="button" className={`lesson-step ${phase === index ? "lesson-step-active" : ""} ${activities[index]?.state === "completed" || phase > index ? "lesson-step-done" : ""} ${index > highestPhase ? "lesson-step-locked" : ""}`} aria-current={phase === index ? "step" : undefined} title={index > highestPhase ? "Selesaikan langkah saat ini untuk membuka bagian ini." : label} disabled={savingProgress || index > highestPhase} onClick={() => void moveToPhase(index)}><span>{activities[index]?.state === "completed" || phase > index ? <Check size={14} /> : index + 1}</span>{label}</button>)}</div>
      <div className="lesson-step-caption"><strong>Langkah {phase + 1} dari {phases.length}</strong><span>{phase < phases.length - 1 ? "Selesaikan bagian ini lalu tekan tombol lanjut untuk membuka langkah berikutnya." : "Selesaikan latihan terakhir untuk menutup pelajaran."}</span></div>
      <div className="lesson-progress-track" aria-label={`Langkah ${phase + 1} dari ${phases.length}`}><span style={{ width: `${((phase + 1) / phases.length) * 100}%` }} /></div>
      {progressNotice && <InlineNotice tone="danger">{progressNotice}</InlineNotice>}
      {phase === 0 && <section className="lesson-stage"><div className="lesson-stage-heading"><span className="tag">LANGKAH 1 · KENALI</span><h2>Kata yang akan kamu pelajari</h2><p>Dengarkan rekaman jika tersedia, baca pinyin, lalu buka detail untuk melihat penggunaan dan contoh.</p></div><div className="lesson-items">{items.map((item) => {
        const context = new URLSearchParams({ placementId: item.placement_id, unitId });
        const to = item.vocabulary_id ? `/word/${item.vocabulary_id}?${context}` : `/write/${item.character_id}?${context}`;
        return <article className="vocab-row lesson-vocab-row" key={item.placement_id}><span className="hanzi-thumb">{item.simplified_form ?? item.hanzi}</span><div><strong>{item.simplified_form ?? item.hanzi}</strong><small>{item.numbered_pinyin ?? "Pengucapan sedang ditinjau"} · {item.gloss ?? "Arti sedang ditinjau"}</small></div><AudioButton assetId={item.audio_id} text={item.simplified_form ?? item.hanzi ?? ""} /><Link className="icon-button" to={to} aria-label="Lihat detail kata dan contoh"><ChevronRight /></Link></article>;
      })}</div><button className="button button-primary lesson-next" disabled={savingProgress} onClick={() => void advanceTo(1)}>{savingProgress ? "Menyimpan kemajuan…" : "Lanjut ke contoh"} <ArrowRight /></button></section>}
      {phase === 1 && <section className="lesson-stage"><div className="lesson-stage-heading"><span className="tag">LANGKAH 2 · GUNAKAN</span><h2>Lihat kata dalam kalimat</h2><p>Perhatikan polanya, ikuti percakapan, lalu baca contoh singkat. Pinyin dan arti ditampilkan bersama agar mudah dipahami.</p></div>{lessonExtras.grammar.length > 0 && <div className="scenario-section"><h3>Pola kalimat</h3>{lessonExtras.grammar.map((grammar) => <article className="grammar-card" key={grammar.id}><span className="tag">TATA BAHASA</span><h4>{grammar.title}</h4><strong lang="zh-Hans">{grammar.pattern}</strong><p>{grammar.explanation}</p>{grammar.usageNotes && <small>{grammar.usageNotes}</small>}</article>)}</div>}{items.some((item) => item.example_text) && <div className="lesson-examples">{items.filter((item) => item.example_text).map((item) => <article className="lesson-example-card" key={item.placement_id}><div className="lesson-example-context"><span className="hanzi-thumb">{item.simplified_form ?? item.hanzi}</span><span>{item.gloss}</span></div><strong lang="zh-Hans">{item.example_text}</strong>{item.example_pinyin && <small>{item.example_pinyin}</small>}{item.example_translation && <p>{item.example_translation}</p>}<AudioButton assetId={item.example_audio_id} text={item.example_text ?? ""} humanOnly /></article>)}</div>}{lessonExtras.dialogueTurns.length > 0 && <div className="scenario-section"><h3>{lessonExtras.dialogueTurns[0].dialogueTitle}</h3><div className="dialogue-list">{lessonExtras.dialogueTurns.map((turn) => <article className={`dialogue-turn dialogue-turn-${turn.speakerRole.toLowerCase()}`} key={turn.id}><div><span className="dialogue-speaker">{turn.speakerLabel}</span><strong lang="zh-Hans">{turn.simplifiedText}</strong><small>{formatPinyinJson(turn.pinyinJson)}</small><p>{turn.translation}</p></div><AudioButton assetId={turn.audioId} text={turn.simplifiedText} humanOnly /></article>)}</div></div>}{lessonExtras.storyParagraphs.length > 0 && <div className="scenario-section"><h3>{lessonExtras.storyParagraphs[0].storyTitle}</h3>{lessonExtras.storyParagraphs.map((paragraph) => <article className="story-paragraph" key={paragraph.id}><strong lang="zh-Hans">{paragraph.simplifiedText}</strong><small>{formatPinyinJson(paragraph.pinyinJson)}</small><p>{paragraph.translation}</p><AudioButton assetId={paragraph.audioId} text={paragraph.simplifiedText} humanOnly /></article>)}</div>}{!items.some((item) => item.example_text) && lessonExtras.grammar.length === 0 && lessonExtras.dialogueTurns.length === 0 && lessonExtras.storyParagraphs.length === 0 && <div className="empty-card lesson-empty"><div className="empty-icon"><BookOpen /></div><h3>Contoh kalimat belum tersedia</h3><p>Pelajari dulu makna kata, lalu lanjutkan ke latihan menulis dan pengulangan.</p></div>}<button className="button button-primary lesson-next" disabled={savingProgress} onClick={() => void advanceTo(2)}>{savingProgress ? "Menyimpan kemajuan…" : "Lanjut ke tulisan"} <ArrowRight /></button></section>}
      {phase === 2 && <section className="lesson-stage"><div className="lesson-stage-heading"><span className="tag">LANGKAH 3 · TULIS</span><h2>Ikuti urutan guratan</h2><p>Buka setiap karakter yang tersedia, putar tutorial lengkap, lalu tulis dengan sentuhan atau stylus. Setiap karakter latihan akan dicentang dan disimpan di akunmu. Data guratan yang belum disetujui tidak akan ditampilkan.</p></div>{currentActivity?.state === "completed" && <InlineNotice>Semua karakter yang tersedia sudah tercatat. Kamu dapat mengulang karakter atau lanjut ke latihan ingatan.</InlineNotice>}{loadingCharacters || !writingCharactersReady ? <div className="empty-card lesson-empty"><div className="loader" /><p>Memuat karakter dalam pelajaran…</p></div> : <div className="lesson-character-grid">{items.flatMap((item) => (writingCharacters[item.placement_id] ?? []).map((character) => {
        const context = new URLSearchParams({ placementId: item.placement_id, unitId });
        if (currentActivity) context.set("activityId", currentActivity.id);
        const done = completedWritingCharacterIds.has(character.id);
        return <Link className={`lesson-character-card ${done ? "lesson-character-done" : ""}`} key={`${item.placement_id}-${character.id}`} to={`/write/${character.id}?${context}`}><span>{character.hanzi}</span><small>{item.simplified_form ?? item.hanzi} · {done ? "latihan selesai" : "mulai menulis"}</small><strong>{done ? <><Check size={15} /> Latihan selesai</> : <>Ikuti urutan <ChevronRight size={15} /></>}</strong></Link>;
      }))}{writingCharactersReady && !items.some((item) => (writingCharacters[item.placement_id] ?? []).length) && <div className="empty-card lesson-empty"><div className="empty-icon"><BookOpen /></div><h3>Karakter belum tersedia</h3><p>Karakter tanpa data guratan yang disetujui tidak ditampilkan dalam latihan; kamu dapat melewati langkah ini.</p></div>}</div>}<button className="button button-primary lesson-next" disabled={savingProgress || loadingCharacters || !writingCharactersReady || (writingCharacterIds.length > 0 && !writingPracticeComplete)} onClick={() => void advanceTo(3)}>{savingProgress ? "Menyimpan kemajuan…" : writingCharacterIds.length > 0 ? writingPracticeComplete ? "Lanjut ke latihan ingatan" : `Selesaikan semua karakter (${completedWritingCharacterIds.size}/${writingCharacterIds.length})` : "Lewati latihan menulis"} <ArrowRight /></button></section>}
      {phase === 3 && <section className="lesson-stage"><div className="lesson-stage-heading"><span className="tag">LANGKAH 4 · ULANGI</span><h2>Ingat arti katanya</h2><p>Pilih arti bahasa Indonesia. Setelah tiap jawaban, kemajuan dan nilai tersimpan di akun agar bisa dilanjutkan di perangkat lain.</p></div>{quizItems.length < 2 || new Set(quizItems.map((item) => item.gloss)).size < 2 ? <div className="empty-card lesson-empty"><div className="empty-icon"><BookOpen /></div><h3>Latihan pilihan belum tersedia</h3><p>Pelajaran perlu sedikitnya dua arti kata yang berbeda dan sudah diperiksa.</p>{scenarioActivity && <button className="button button-primary" onClick={() => void advanceTo(4)}>Coba tulis kalimatmu <ArrowRight /></button>}</div> : questionIndex >= quizItems.length ? <div className="lesson-result"><div className="lesson-result-mark"><Check /></div><span className="tag">LATIHAN SELESAI</span><h2>Bagus, kamu sudah menyelesaikan latihan ini.</h2><p>Jawaban tepat: <strong>{score} dari {quizItems.length}</strong>. Materi yang perlu diulang akan muncul pada bagian Ulangi.</p><div className="lesson-result-actions"><button className="button button-soft" onClick={() => { setQuestionIndex(0); setSelectedAnswer(null); setScore(0); }}>Ulangi latihan</button>{scenarioActivity ? <button className="button button-primary" onClick={() => void advanceTo(4)}>Sekarang tulis kalimatmu <ArrowRight /></button> : <Link className="button button-primary" to="/paths">Pilih pelajaran lain <ArrowRight /></Link>}</div></div> : activeQuestion ? <div className="lesson-quiz-card"><div className="lesson-quiz-count">KATA {questionIndex + 1} DARI {quizItems.length}</div><div className="lesson-quiz-hanzi" lang="zh-Hans">{activeQuestion.simplified_form ?? activeQuestion.hanzi}</div><p>{activeQuestion.numbered_pinyin ?? "Baca pinyinnya"}</p><AudioButton assetId={activeQuestion.audio_id} text={activeQuestion.simplified_form ?? activeQuestion.hanzi ?? ""} prominent /><h3>Apa artinya dalam bahasa Indonesia?</h3><div className="lesson-answer-list">{answerOptions.map((option, index) => <button key={`${questionIndex}-${index}`} className={`lesson-answer ${selectedAnswer === option ? (option === activeQuestion.gloss ? "answer-correct" : "answer-wrong") : ""}`} disabled={selectedAnswer !== null} onClick={() => recordMeaningAttempt(option)}>{option}{selectedAnswer === option && (option === activeQuestion.gloss ? <Check size={17} /> : <X size={17} />)}</button>)}</div>{selectedAnswer !== null && <><p className={`lesson-answer-feedback ${selectedAnswer === activeQuestion.gloss ? "" : "answer-feedback-wrong"}`} aria-live="polite">{selectedAnswer === activeQuestion.gloss ? "Benar!" : `Belum tepat. Artinya: ${activeQuestion.gloss}.`}</p><button className="button button-primary lesson-next" disabled={savingProgress} onClick={() => void continueQuiz()}>{savingProgress ? "Menyimpan kemajuan…" : questionIndex + 1 === quizItems.length ? "Lihat hasil" : "Berikutnya"} <ArrowRight /></button></>}</div> : null}</section>}
      {phase === 4 && scenarioActivity && <section className="lesson-stage"><div className="lesson-stage-heading"><span className="tag">LANGKAH 5 · GUNAKAN</span><h2>{scenarioActivity.title}</h2><p>{scenarioActivity.objective}</p></div><div className="scenario-writing-card"><p>{scenarioActivity.instructions}</p>{scenarioLoading ? <div className="loader" /> : <><label htmlFor="scenario-response">Kalimat Mandarinmu<textarea id="scenario-response" rows={4} maxLength={1200} value={scenarioDraft} onChange={(event) => { setScenarioDraft(event.target.value); setScenarioSaved(false); }} placeholder="Tulis kalimat di sini…" /></label><div className="scenario-response-meta"><span>{scenarioDraft.length}/1200</span><span>Jawaban tersimpan dengan akunmu; tidak dikirim ke AI.</span></div><fieldset><legend>Bagaimana perasaanmu tentang jawabanmu?</legend><label><input type="radio" name="scenario-confidence" checked={scenarioSelfAssessment === "confident"} onChange={() => { setScenarioSelfAssessment("confident"); setScenarioSaved(false); }} /> Cukup yakin</label><label><input type="radio" name="scenario-confidence" checked={scenarioSelfAssessment === "repeat"} onChange={() => { setScenarioSelfAssessment("repeat"); setScenarioSaved(false); }} /> Ingin berlatih lagi</label><label><input type="radio" name="scenario-confidence" checked={scenarioSelfAssessment === "unsure"} onChange={() => { setScenarioSelfAssessment("unsure"); setScenarioSaved(false); }} /> Belum yakin</label></fieldset><button className="button button-primary" disabled={scenarioSaving || !scenarioDraft.trim()} onClick={() => void saveScenarioResponse()}>{scenarioSaving ? "Menyimpan…" : scenarioSaved ? "Perbarui jawaban" : "Simpan jawaban"} <Check /></button></>}{scenarioNotice && <InlineNotice>{scenarioNotice}</InlineNotice>}</div>{scenarioSaved && <div className="lesson-result lesson-complete-card"><div className="lesson-result-mark"><Check /></div><span className="tag">PELAJARAN SELESAI</span><h2>Bagus, jawabanmu sudah tersimpan.</h2><p>Seluruh langkah pelajaran ini selesai. Kemajuanmu tersimpan di akun dan akan muncul di halaman profil pengelola sebagai status, tanpa isi jawabanmu.</p><div className="lesson-result-actions"><Link className="button button-primary" to="/paths">Pilih pelajaran berikutnya <ArrowRight /></Link><Link className="button button-soft" to="/">Kembali ke beranda</Link></div></div>}</section>}
    </> : <div className="empty-card"><div className="empty-icon"><BookOpen /></div><h3>Belum ada materi terbit</h3><p>Bagian ini menampilkan materi yang sudah lolos pemeriksaan editorial. Draf tidak ikut disajikan ke pembelajar.</p></div>}
  </div></Protected>;
}

function WordPage() {
  const { entryId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const placementId = searchParams.get("placementId");
  const unitId = searchParams.get("unitId");
  const readingId = searchParams.get("readingId");
  const fromReview = searchParams.get("from") === "review";
  const writeParams = new URLSearchParams();
  if (placementId) writeParams.set("placementId", placementId);
  if (unitId) writeParams.set("unitId", unitId);
  if (readingId) writeParams.set("readingId", readingId);
  if (fromReview) writeParams.set("from", "review");
  writeParams.set("returnWordId", entryId);
  const writeQuery = `?${writeParams}`;
  const [entry, setEntry] = useState<{ entry: { id: string; simplifiedForm: string; partOfSpeech?: string }; readings: Array<{ id: string; contextText: string; pinyin: string; numberedPinyin: string; audioId?: string }>; senses: Array<{ id: string; text: string; usageLabel?: string }>; examples: Array<{ id: string; simplifiedText: string; numberedPinyin: string; translation: string }>; characters: Array<{ id: string; hanzi: string; strokeCount: number; strokeDataStatus: string }> } | null>(null);
  useEffect(() => { void api<typeof entry>(`/vocabulary/${encodeURIComponent(entryId)}`).then(setEntry).catch(() => setEntry(null)); }, [entryId]);
  if (!entry) return <Protected><div className="page-wrap"><PageBack /><EmptyContent message="Kata ini belum tersedia untuk dipelajari." /></div></Protected>;
  const activeReading = entry.readings.find((reading) => reading.id === readingId) ?? entry.readings[0];
  return <Protected><div className="page-wrap word-page"><PageBack to={fromReview ? "/review" : unitId ? `/unit/${unitId}` : "/paths"} /><div className="word-hero"><span className="tag">KATA DALAM KONTEKS</span><h1>{entry.entry.simplifiedForm}</h1><p>{activeReading?.numberedPinyin ?? "Pelafalan sedang ditinjau"}</p><AudioButton assetId={activeReading?.audioId} text={entry.entry.simplifiedForm} prominent /></div>
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
  const writingActivityId = searchParams.get("activityId");
  const returnWordId = searchParams.get("returnWordId");
  const returnParams = new URLSearchParams();
  if (placementId) returnParams.set("placementId", placementId);
  if (unitId) returnParams.set("unitId", unitId);
  if (writingActivityId) returnParams.set("activity", writingActivityId);
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
    if (!writingActivityId) return;
    void api(`/activities/${encodeURIComponent(writingActivityId)}/progress`, { method: "POST", body: JSON.stringify({ state: "in_progress", currentItemOrdinal: 0 }) }).catch(() => undefined);
  }, [writingActivityId]);
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
      const { default: HanziWriterLibrary } = await import("hanzi-writer");
      if (cancelled) return;
      writer = HanziWriterLibrary.create(host, character.hanzi, {
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
        if (currentSession?.user.id) void saveAttempt({ contentType: "character", contentId: characterId, curriculumPlacementId: placementId ?? undefined, activityId: writingActivityId ?? undefined, activityMode: "guided_writing", dimensions: { strokeOrder: summary.totalMistakes ? "needs_practice" : "correct" }, engineVersion: "hanzi-writer-local" }, currentSession.user.id);
        if (writingActivityId) void api<{ state: LessonActivity["state"]; completedCount: number; totalCount: number }>(`/activities/${encodeURIComponent(writingActivityId)}/characters/${encodeURIComponent(characterId)}/complete`, { method: "POST" })
          .then((progress) => setResult(progress.state === "completed"
            ? "Semua karakter pelajaran selesai dilatih. Kembali ke pelajaran untuk melanjutkan."
            : `Karakter tersimpan · ${progress.completedCount} / ${progress.totalCount} sudah dilatih. Kembali ke pelajaran untuk karakter berikutnya.`))
          .catch(() => setResult("写字练习完成了，但进度暂时未同步。请保持联网后返回课程重试。"));
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
  const simplify = useRef<(value: string) => string>((value) => value);
  const [normalizerReady, setNormalizerReady] = useState(false);
  const [recognizerState, setRecognizerState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [candidates, setCandidates] = useState<Array<{ hanzi: string; score: number }>>([]);
  const [strokeCount, setStrokeCount] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [notice, setNotice] = useState("");
  const points = useRef(false);
  useEffect(() => {
    let active = true;
    void import("opencc-js/t2cn").then(({ default: OpenCC }) => {
      simplify.current = OpenCC.Converter({ from: "t", to: "cn" });
      if (active) setNormalizerReady(true);
    }).catch(() => { if (active) { setRecognizerState("unavailable"); setNotice("Pengenal karakter sederhana belum dapat dimuat."); } });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!normalizerReady) return;
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
  }, [normalizerReady]);
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
  const [skill, setSkill] = useState("all");
  const [items, setItems] = useState<Array<{ contentType: string; contentId: string; dueAt: string; word: string | null; character: string | null; readingId: string | null; skill: string }>>([]);
  const skillNames: Record<string, string> = { listening: "Menyimak", speaking: "Berbicara", reading: "Membaca", writing: "Menulis", grammar: "Tata bahasa", vocabulary: "Kosakata", comprehension: "Pemahaman" };
  useEffect(() => { void api<{ items: typeof items }>(`/reviews?skill=${skill === "all" ? "" : skill}`).then((data) => setItems(data.items)).catch(() => setItems([])); }, [skill]);
  return <Protected><div className="page-wrap"><PageTitle eyebrow="PUSAT ULASAN" title="Ulangi yang sudah kamu pelajari" subtitle="Jadwal tiap keterampilan terpisah. Materi akan kembali sesuai kebutuhan, bukan sebagai tumpukan kartu kata." />
    <div className="review-filters" aria-label="Filter keterampilan"><button className={skill === "all" ? "filter-active" : ""} onClick={() => setSkill("all")}>Semua</button>{Object.entries(skillNames).map(([key, name]) => <button key={key} className={skill === key ? "filter-active" : ""} onClick={() => setSkill(key)}>{name}</button>)}</div>
    {items.length ? <div className="unit-list">{items.map((item) => <div key={`${item.contentType}-${item.contentId}-${item.readingId ?? ""}-${item.skill}`} className="unit-row"><span className="hanzi-thumb">{item.word ?? item.character}</span><span className="unit-copy"><strong>{item.word ?? item.character}</strong><small>{item.contentType === "character" ? "Karakter" : "Kosakata"} · {skillNames[item.skill] ?? item.skill}</small></span><Link to={item.contentType === "character" ? `/write/${item.contentId}` : `/word/${item.contentId}?${new URLSearchParams({ ...(item.readingId ? { readingId: item.readingId } : {}), from: "review" })}`} className="button button-primary">Latih lagi</Link></div>)}</div> : <div className="empty-card"><div className="empty-icon"><RotateCcw /></div><h3>{skill === "all" ? "Belum ada materi untuk diulang" : `Belum ada ${skillNames[skill]?.toLowerCase() ?? "materi"} yang waktunya diulang`}</h3><p>Setelah berlatih, jadwal ulasan per keterampilan akan muncul di sini.</p><Link to="/paths" className="button button-primary">Pilih pelajaran</Link></div>}</div></Protected>;
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
  const [audioAssets, setAudioAssets] = useState<Array<{ id: string; text: string; pinyin?: string; creator: string; recordedBy?: string; sourcePage: string; licenseUrl: string; license: string; speakerProfile?: string }> | null>(null);
  useEffect(() => { void Promise.all([import("../../content/audio-assets-manifest.json"), api<{ assets: Array<{ id: string; text: string; creator: string; attribution: string; recordedBy: string; sourcePage: string; licenseUrl: string; license: string }> }>("/audio-credits/sentences")]).then(([manifest, sentences]) => setAudioAssets([...manifest.default.assets, ...sentences.assets.map((asset) => ({ ...asset, pinyin: "", creator: asset.attribution || asset.creator }))])); }, []);
  return <div className="page-wrap"><PageBack to="/profile" /><PageTitle eyebrow="KREDIT & LISENSI" title="Sumber materi dan teknologi" subtitle="Materi terbuka mempertahankan atribusi dan lisensinya sendiri; lisensi aplikasi tidak menggantikannya." />
    <section className="detail-card"><h2>Data urutan guratan</h2><p>Karakter awal memakai Hanzi Writer Data 2.0.1 dari Make Me a Hanzi, yang menyatakan data guratan berasal dari glyph Arphic. Data ini berlisensi Arphic Public License dan bukan klaim bahwa setiap urutan telah disahkan Kementerian Pendidikan Tiongkok.</p><p><a href="https://github.com/chanind/hanzi-writer-data" target="_blank" rel="noreferrer">Repositori Hanzi Writer Data</a> · <a href="https://github.com/chanind/hanzi-writer-data/blob/master/ARPHICPL.TXT" target="_blank" rel="noreferrer">Teks Arphic Public License</a></p></section>
    <section className="detail-card" id="human-recordings"><h2>Rekaman Mandarin</h2><p>{audioAssets ? `Sebanyak ${audioAssets.length} berkas rekaman manusia memiliki sumber dan lisensinya tercatat.` : "Memuat daftar rekaman dan atribusinya…"} Jika suatu kata belum punya rekaman tepat, tombol audio memakai suara Mandarin sederhana (zh-CN) yang tersedia secara lokal di perangkat. Suara perangkat tidak dikirim ke server, bukan rekaman manusia, dan dapat berbeda antarperangkat; bila belum tersedia, pasang suara Mandarin di pengaturan perangkat. Kami tidak memakai suara jarak jauh berbayar atau menggabungkan potongan suku kata. Kalimat hanya memakai rekaman manusia; tombolnya tetap nonaktif jika rekaman yang cocok belum tersedia.</p>{audioAssets?.map((asset) => <p key={asset.id}><strong>“{asset.text}{asset.pinyin ? ` / ${asset.pinyin}` : ""}”</strong> — {asset.creator}{asset.recordedBy ? `, direkam oleh ${asset.recordedBy}` : ""} · <a href={asset.sourcePage} target="_blank" rel="noreferrer">file sumber</a> · <a href={asset.licenseUrl} target="_blank" rel="noreferrer">{asset.license}</a>{asset.speakerProfile ? <> · <a href={asset.speakerProfile} target="_blank" rel="noreferrer">profil penutur</a></> : null}</p>)}</section>
    <section className="detail-card"><h2>Materi & struktur HSK</h2><p>Materi resmi memang tersedia: situs ujian HSK memuat kerangka, silabus, contoh soal, dan bahan ujian. Yang belum dipastikan adalah izin untuk menyalin serta menerbitkan ulang daftar dan teks lengkap itu di aplikasi terbuka ini. Karena itu, latihan HSK yang tersedia sekarang ditulis khusus untuk aplikasi dan tidak diklaim sebagai daftar resmi HSK.</p><p><a href="https://www.chinesetest.cn/hsk" target="_blank" rel="noreferrer">Kerangka HSK resmi</a> · <a href="https://admin.chinesetest.cn/godownload.do" target="_blank" rel="noreferrer">Pusat unduhan resmi HSK</a> · <a href="https://www.chinesetest.cn/legal-notice" target="_blank" rel="noreferrer">Ketentuan situs CTI</a></p><p>Struktur enam tingkat HSK 2.0 dan tiga tahap/sembilan tingkat HSK Baru dipakai sebagai navigasi. Kosakata, contoh kalimat, serta terjemahan baru tetap dicatat sebagai konten asli berbahasa Indonesia. Tingkat pemula sekarang berisi 20 materi buatan aplikasi pada kedua jalur.</p></section>
    <section className="detail-card"><h2>Teknologi</h2><ul><li>React, React Router, TypeScript, Vite, Hono, Better Auth, Zod, IndexedDB, dan Cloudflare Workers/D1.</li><li>Hanzi Writer untuk animasi dan latihan guratan; library-nya MIT, data karakternya memakai lisensi terpisah.</li><li>Hanzi Lookup WASM untuk saran pengenalan tulisan tangan lokal; kodenya LGPL-3.0 dan data bentuk tertanam berlisensi Arphic Public License.</li><li>OpenCC JS untuk normalisasi kandidat tradisional menjadi sederhana; source, data, dan lisensinya dicatat di <code>THIRD_PARTY_NOTICES.md</code> pada repositori.</li></ul></section>
    <section className="detail-card"><h2>Ilustrasi</h2><p>Maskot pendamping belajar di halaman utama dibuat untuk proyek ini menggunakan alat pembuat gambar OpenAI pada 25 September 2026. Ilustrasi tidak memuat aset atau karakter berlisensi pihak lain.</p></section>
    <section className="detail-card"><h2>Catatan penggunaan</h2><p>Rekaman asli dipakai jika tersedia. Untuk kata lain, aplikasi hanya memilih suara sistem lokal berbahasa zh-CN; suara buatan ini tidak ditinjau sebagai rekaman manusia dan tidak dikirim ke server.</p><p>Setiap aset rekaman menyimpan checksum dan bukti lisensi. Pengelola tetap dapat membuka sumbernya untuk melakukan pemeriksaan ulang atau menolak aset.</p></section>
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
  if (generatedCodes.length) return <div className="auth-page"><div className="auth-card"><Link to="/" className="brand"><img className="brand-mark" src="/images/mandarin-learn-mascot.png" alt="" aria-hidden="true" /><span>Belajar Mandarin</span></Link><span className="tag">LANGKAH KEAMANAN PENTING</span><h1>Simpan kode pemulihanmu</h1><p className="muted">Kode ini hanya ditampilkan sekali. Simpan di tempat aman agar akun tetap dapat dipulihkan tanpa email berbayar.</p><div className="recovery-codes">{generatedCodes.map((code) => <code key={code}>{code}</code>)}<button className="button button-soft" onClick={() => void navigator.clipboard.writeText(generatedCodes.join("\n"))}>Salin kedua kode</button></div><button className="button button-primary button-wide" onClick={() => navigate("/")}>Saya sudah menyimpannya <ArrowRight /></button></div></div>;
  return <div className="auth-page"><div className="auth-card"><Link to="/" className="brand"><img className="brand-mark" src="/images/mandarin-learn-mascot.png" alt="" aria-hidden="true" /><span>Belajar Mandarin</span></Link><span className="tag">BELAJAR BAHASA MANDARIN</span><h1>{recoveryOpen ? "Pulihkan akun" : mode === "signup" ? "Mulai dari satu karakter." : "Senang melihatmu kembali."}</h1><p className="muted">{recoveryOpen ? "Masukkan email dan salah satu kode pemulihan yang kamu simpan." : "Akun memungkinkan kemajuanmu tersinkron di ponsel dan iPad."}</p>
    {noticeRecovery && <InlineNotice>{noticeRecovery}</InlineNotice>}
    {recoveryOpen ? <form onSubmit={(event) => void (resetToken ? finishRecovery(event) : beginRecovery(event))}><label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} /></label>{!resetToken ? <label>Kode pemulihan<input autoComplete="one-time-code" value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} minLength={64} maxLength={64} required /></label> : <label>Kata sandi baru<input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={3} maxLength={128} required /><small>Gunakan sedikitnya 3 karakter.</small></label>}{error && <InlineNotice tone="danger">{error}</InlineNotice>}<button className="button button-primary button-wide" disabled={busy}>{busy ? "Memproses…" : resetToken ? "Simpan kata sandi baru" : "Periksa kode"}</button><button type="button" className="button button-soft button-wide" onClick={() => { setRecoveryOpen(false); setError(""); setResetToken(""); }}>Kembali ke masuk</button></form> : <form onSubmit={(event) => void submit(event)}>{mode === "signup" && <label>Nama tampilan<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} /></label>}<label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} /></label><label>Kata sandi<input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={3} maxLength={128} required />{mode === "signup" && <small>Gunakan sedikitnya 3 karakter.</small>}</label>{error && <InlineNotice tone="danger">{error}</InlineNotice>}<button className="button button-primary button-wide" disabled={busy}>{busy ? "Memproses…" : mode === "signup" ? "Buat akun" : "Masuk"} <ArrowRight /></button></form>}
    {!recoveryOpen && <p className="auth-switch">{mode === "signup" ? "Sudah punya akun?" : <>Lupa kata sandi? <button className="text-button" onClick={() => { setRecoveryOpen(true); setError(""); }}>Gunakan kode pemulihan</button></>} {mode === "signup" && <Link to="/login">Masuk</Link>}{mode === "login" && <> · <Link to="/signup">Daftar</Link></>}</p>}
    <small className="auth-privacy">Tanpa layanan email berbayar. Kode pemulihan diperlukan untuk mengatur ulang kata sandi.</small></div></div>;
}

function AdminFrame({ user, isPending }: { user: SessionUser | null; isPending: boolean }) {
  const [open, setOpen] = useState(false);
  const { data } = useLearnerSession();
  if (isPending) return <div className="centered-page"><div className="loader" /></div>;
  if (!user) return <AuthPage mode="login" redirectTo="/admin" />;
  return <div className="admin-frame"><aside className={`admin-sidebar ${open ? "sidebar-open" : ""}`}><Link className="brand" to="/admin"><img className="brand-mark" src="/images/mandarin-learn-mascot.png" alt="" aria-hidden="true" /><span>Belajar <small>ADMIN</small></span></Link><span className="sidebar-label">RUANG KERJA</span><NavLink to="/admin" end><Activity /> Ringkasan</NavLink><NavLink to="/admin/learners"><UserRound /> Pembelajar</NavLink><NavLink to="/admin/content"><BookOpen /> Konten & Audio</NavLink><NavLink to="/admin/community"><MessageCircle /> Komunitas</NavLink><NavLink to="/admin/audit"><ShieldCheck /> Audit & Privasi</NavLink><div className="sidebar-spacer" /><Link to="/" className="sidebar-exit"><ArrowLeft /> Aplikasi belajar</Link><button className="sidebar-user" onClick={() => void authClient.signOut()}><span className="avatar">{data?.user.name.slice(0, 1).toUpperCase()}</span><span>{data?.user.name}<small>Keluar dari admin</small></span><LogOut /></button></aside><main className="admin-content"><header className="admin-topbar"><button className="icon-button mobile-admin-menu" aria-label="Buka menu" onClick={() => setOpen((value) => !value)}><Menu /></button><span>Ruang pengelola</span><span className="admin-account"><span className="status-dot" />Terkoneksi</span></header><div className="admin-page"><Outlet /></div></main>{open && <button className="sidebar-scrim" aria-label="Tutup menu" onClick={() => setOpen(false)} />}</div>;
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
    skillProgress: Array<{ skill: string; attempts: number; passed: number; uncertain: number; needsPractice: number; itemsPractised: number; lastSeenAt: string | null }>;
    activityProgress: Array<{ id: string; title: string; activityKind: string; unitTitle: string; levelNumber: number | null; curriculumName: string; state: string; currentItemOrdinal: number; correctCount: number; updatedAt: string | null; completedAt: string | null; itemCount: number; writingItemCount: number; writingCompletedCount: number }>;
    placements: Array<{ id: string; assessmentVersion: string; answered: number; correct: number; recommendation: string; explanation: string; completedAt: string }>;
    activity: Array<{ day: string; attempts: number }>;
    freehand: Array<{ hanzi: string; codePoint: string; engineId: string; candidateRank: number; occurredAt: string }>;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void api<typeof data>(`/admin/learners/${encodeURIComponent(learnerId)}`).then(setData).catch((cause) => setError(cause instanceof Error ? cause.message : "Profil tidak tersedia.")); }, [learnerId]);
  return <><PageBack to="/admin/learners" /><AdminPageHead eyebrow="PROFIL PEMBELAJAR" title={data?.learner.name ?? "Detail pembelajar"} subtitle="Akses sensitif ini dicatat otomatis di audit." />{error && <InlineNotice tone="danger">{error}</InlineNotice>}{data && <>
    <div className="learner-admin-hero"><div className="profile-avatar">{data.learner.name.slice(0, 1)}</div><div><strong>{data.learner.email}</strong><small>Bergabung {new Date(data.learner.createdAt).toLocaleDateString("id-ID")} · target {data.learner.daily_goal_minutes} menit / hari</small></div></div>
    <div className="admin-kpi-grid"><AdminKpi icon={<BookOpen />} label="Materi dipelajari" value={data.progress.length} /><AdminKpi icon={<Activity />} label="Latihan tersimpan" value={data.progress.reduce((sum, item) => sum + item.attempts, 0)} /><AdminKpi icon={<Clock3 />} label="Hari aktif tercatat" value={data.activity.length} /></div>
    <div className="admin-panel individual-progress"><div className="panel-head"><div><h2>Kemajuan menurut jalur belajar</h2><p>Latihan ditautkan ke jalur dan unit asal. “Lolos” berarti semua dimensi yang dinilai pada sesi itu lulus.</p></div></div>{data.curriculumProgress.length ? data.curriculumProgress.map((item) => <div className="progress-row" key={`${item.curriculumName}-${item.unitTitle}`}><span className="unit-number">{item.levelNumber ?? "日"}</span><div><strong>{item.curriculumName} · {item.stageName ? `${item.stageName} · ` : ""}{item.unitTitle}</strong><small>{item.curriculumVersion} · {item.itemsPractised} materi · {item.attempts} sesi · terakhir {item.lastSeenAt ? new Date(item.lastSeenAt).toLocaleDateString("id-ID") : "Belum tercatat"}</small><small>{item.passed} lolos · {item.needsPractice} perlu latihan · {item.uncertain} belum pasti · {item.notAssessed} belum dinilai</small></div><span className="progress-score">{item.passed}/{item.attempts}</span></div>) : <div className="table-empty">Belum ada latihan yang terhubung dengan unit belajar.</div>}</div>
    <div className="admin-panel individual-progress"><div className="panel-head"><div><h2>Kemajuan per keterampilan</h2><p>Mendengar, berbicara, membaca, menulis, tata bahasa, dan pemahaman disimpan terpisah; rekaman suara mentah tidak disimpan.</p></div></div>{data.skillProgress.length ? <div className="skill-progress-grid">{data.skillProgress.map((item) => <article className="skill-progress-card" key={item.skill}><div><strong>{({ listening: "Menyimak", speaking: "Berbicara", reading: "Membaca", writing: "Menulis", grammar: "Tata bahasa", vocabulary: "Kosakata", comprehension: "Pemahaman" } as Record<string, string>)[item.skill] ?? item.skill}</strong><span>{item.itemsPractised} materi · {item.attempts} latihan</span></div><b>{item.passed}/{item.attempts}</b><small>{item.needsPractice} perlu diulang · {item.uncertain} belum yakin{item.lastSeenAt ? ` · ${new Date(item.lastSeenAt).toLocaleDateString("id-ID")}` : ""}</small></article>)}</div> : <div className="table-empty">Belum ada hasil yang tercatat menurut keterampilan.</div>}</div>
    <div className="admin-panel individual-progress"><div className="panel-head"><div><h2>Aktivitas kursus</h2><p>Kelanjutan tiap tahap tersimpan di server; kemajuan menulis memperlihatkan jumlah karakter yang selesai.</p></div></div>{data.activityProgress.length ? data.activityProgress.map((item) => <div className="progress-row" key={item.id}><span className={`activity-state activity-state-${item.state}`}>{item.state === "completed" ? <Check size={15} /> : item.state === "in_progress" ? <Clock3 size={15} /> : <BookOpen size={15} />}</span><div><strong>{item.curriculumName} · {item.unitTitle} · {item.title}</strong><small>{item.activityKind} · {item.state === "completed" ? item.activityKind === "comprehension" ? `Selesai · benar ${item.correctCount}/${item.itemCount}` : "Selesai" : item.state === "in_progress" ? item.activityKind === "writing" ? `Sedang menulis · ${item.writingCompletedCount}/${item.writingItemCount} karakter` : item.activityKind === "comprehension" ? `Sedang berlangsung · butir ${item.currentItemOrdinal + 1}/${item.itemCount} · benar ${item.correctCount}` : `Sedang berlangsung · butir ${item.currentItemOrdinal + 1}${item.itemCount ? ` dari ${item.itemCount}` : ""}` : "Belum dimulai"}{item.updatedAt ? ` · ${new Date(item.updatedAt).toLocaleString("id-ID")}` : ""}</small></div><span className="progress-score">{item.state === "completed" ? "✓" : item.activityKind === "writing" ? item.writingItemCount ? `${item.writingCompletedCount}/${item.writingItemCount}` : "—" : item.itemCount ? `${Math.min(item.currentItemOrdinal, item.itemCount)}/${item.itemCount}` : "—"}</span></div>) : <div className="table-empty">Belum ada aktivitas kursus yang dimulai.</div>}</div>
    <div className="admin-panel individual-progress"><div className="panel-head"><div><h2>Diagnosis titik awal</h2><p>Saran terakhir dari penilaian buatan aplikasi; ini bukan hasil resmi HSK.</p></div></div>{data.placements.length ? data.placements.map((item) => <div className="progress-row" key={item.id}><span className="activity-state"><Sparkles size={15} /></span><div><strong>{item.correct}/{item.answered} · {({ foundation: "Mulai dari dasar", elementary: "Dasar dengan tantangan", developing: "Siap mencoba materi lanjutan" } as Record<string, string>)[item.recommendation] ?? item.recommendation}</strong><small>{item.explanation} · {new Date(item.completedAt).toLocaleString("id-ID")}</small></div></div>) : <div className="table-empty">Belum ada penilaian titik awal.</div>}</div>
    <div className="admin-panel individual-progress"><div className="panel-head"><div><h2>Kemajuan per materi</h2><p>Ringkasan hasil tersimpan; jejak pena mentah tidak disimpan.</p></div></div>{data.progress.length ? data.progress.map((item) => <div className="progress-row" key={`${item.contentType}-${item.contentId}`}><span className="hanzi-thumb">{item.contentLabel?.slice(0, 1) ?? (item.contentId.startsWith("unicode:") ? item.contentId.slice(8, 9) : item.contentType === "character" ? "字" : "词")}</span><div><strong>{item.contentType === "character" ? "Karakter" : "Kosakata"} · {item.contentLabel ?? item.contentId}</strong><small>{item.attempts} latihan · terakhir {item.lastSeenAt ? new Date(item.lastSeenAt).toLocaleDateString("id-ID") : "Belum tercatat"}</small></div><span className="progress-score">{item.correct}/{item.attempts}</span></div>) : <div className="table-empty">Belum ada aktivitas tersinkron.</div>}</div>
    <div className="admin-panel individual-progress"><div className="panel-head"><div><h2>Karakter bebas dikonfirmasi</h2><p>Hanya karakter yang dipilih pembelajar setelah melihat kandidat; tidak ada goresan mentah.</p></div></div>{data.freehand.length ? data.freehand.map((item, index) => <div className="progress-row" key={`${item.codePoint}-${item.occurredAt}-${index}`}><span className="hanzi-thumb">{item.hanzi}</span><div><strong>{item.hanzi} · {item.codePoint}</strong><small>{item.engineId} · kandidat nomor {item.candidateRank} · {new Date(item.occurredAt).toLocaleString("id-ID")}</small></div></div>) : <div className="table-empty">Belum ada konfirmasi pengenalan bebas.</div>}</div>
  </>}</>;
}

type SentenceAudioPrompt = { targetType: "example" | "dialogue" | "story"; targetId: string; text: string; pinyin: string; translation: string; unitTitle: string };

function SentenceAudioRecordingStudio({ onUploaded }: { onUploaded: () => void }) {
  const [prompts, setPrompts] = useState<SentenceAudioPrompt[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [speakerName, setSpeakerName] = useState("");
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [wav, setWav] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [exactConfirmed, setExactConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const prompt = prompts[currentIndex];
  const loadPrompts = async () => {
    try {
      const result = await api<{ prompts: SentenceAudioPrompt[] }>("/admin/sentence-audio-prompts");
      setPrompts(result.prompts);
      setCurrentIndex(0);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Tidak dapat memuat antrean kalimat."); }
  };
  useEffect(() => { void loadPrompts(); return () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }; }, []);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const clearPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setWav(null);
  };
  const startRecording = async () => {
    setError(""); setNotice(""); clearPreview();
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("Browser ini tidak mendukung perekaman mikrofon.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const source = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        void recordedBlobToWav(source).then((result) => { setWav(result); setPreviewUrl(URL.createObjectURL(result)); })
          .catch((cause) => setError(cause instanceof Error ? cause.message : "Tidak dapat menyiapkan audio WAV."));
      };
      recorder.start(250);
      setRecording(true);
      timerRef.current = window.setTimeout(() => {
        if (recorder.state === "recording") { recorder.stop(); setRecording(false); setNotice("Rekaman mencapai batas 29 detik. Dengarkan dahulu sebelum mengirim."); }
      }, 29_000);
    } catch (cause) { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setError(cause instanceof Error ? cause.message : "Izin mikrofon tidak diberikan."); }
  };
  const stopRecording = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
  };
  const uploadRecording = async () => {
    if (!prompt || !wav || !speakerName.trim() || !consent || !exactConfirmed) return;
    setSaving(true); setError(""); setNotice("");
    const form = new FormData();
    form.set("targetType", prompt.targetType);
    form.set("targetId", prompt.targetId);
    form.set("speakerDisplayName", speakerName.trim());
    form.set("consent", "accepted");
    form.set("exactLineConfirmed", "yes");
    form.set("recording", wav, "human-sentence.wav");
    try {
      const saved = await api<{ assetId: string; text: string }>("/admin/sentence-audio-recordings", { method: "POST", body: form });
      setNotice(`Rekaman untuk “${saved.text}” masuk antrean pemeriksaan.`);
      clearPreview(); setConsent(false); setExactConfirmed(false);
      await loadPrompts(); onUploaded();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Rekaman belum tersimpan."); }
    finally { setSaving(false); }
  };
  return <section className="admin-panel sentence-recording-studio">
    <div className="panel-head"><div><h2>Rekam audio kalimat</h2><p>Ucapkan tepat sesuai teks. Audio baru dipublikasikan setelah admin memeriksa kecocokan dan kualitasnya.</p></div><span className="recording-queue-count">{prompts.length} kalimat</span></div>
    {notice && <InlineNotice>{notice}</InlineNotice>}{error && <InlineNotice tone="danger">{error}</InlineNotice>}
    {!prompt ? <div className="recording-empty"><Headphones aria-hidden="true" /><strong>Tidak ada kalimat yang menunggu rekaman baru. Periksa audio kandidat yang masih menunggu persetujuan.</strong></div> : <div className="recording-workspace">
      <div className="recording-prompt"><small>{prompt.unitTitle} · {prompt.targetType === "dialogue" ? "Dialog" : prompt.targetType === "story" ? "Cerita" : "Contoh"}</small><strong lang="zh-CN">{prompt.text}</strong>{prompt.pinyin && <span>{prompt.pinyin}</span>}<p>{prompt.translation}</p></div>
      <div className="recording-controls">
        {!recording ? <button className="button button-primary" onClick={() => void startRecording()}><Mic size={16} />Mulai merekam</button> : <button className="button button-danger" onClick={stopRecording}><Square size={14} />Hentikan</button>}
        {previewUrl && <audio controls preload="metadata" src={previewUrl} />}
        <button className="button button-soft" disabled={recording || saving} onClick={() => { clearPreview(); setConsent(false); setExactConfirmed(false); setCurrentIndex((index) => prompts.length ? (index + 1) % prompts.length : 0); }}><SkipForward size={15} />Lewati kalimat</button>
      </div>
      <label className="recording-speaker">Nama yang ditampilkan sebagai pembaca<input value={speakerName} maxLength={80} onChange={(event) => setSpeakerName(event.target.value)} placeholder="Nama atau nama panggilan" /></label>
      <label className="recording-consent"><input type="checkbox" checked={exactConfirmed} onChange={(event) => setExactConfirmed(event.target.checked)} />Saya sendiri yang mengucapkan seluruh kalimat Mandarin yang tampil; rekaman ini bukan suara sintetis.</label>
      <label className="recording-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />Saya memiliki hak atas rekaman ini dan mengizinkan audio serta nama tampilan saya dipublikasikan dengan lisensi CC BY 4.0. Pengguna boleh menyalin dan mengadaptasinya dengan atribusi.</label>
      <button className="button button-primary" disabled={!wav || !speakerName.trim() || !consent || !exactConfirmed || saving || recording} onClick={() => void uploadRecording()}>{saving ? "Menyimpan…" : "Kirim ke pemeriksaan"}</button>
    </div>}
  </section>;
}

function AdminContent() {
  const [queue, setQueue] = useState<{ vocabulary: Array<{ id: string; text: string; status: string; sourceId: string }>; characters: Array<{ id: string; text: string; status: string; sourceId: string; strokeStatus: string }>; readings: Array<{ id: string; text: string; pinyin: string; status: string; sourceId: string }>; audio: Array<{ id: string; text: string; pinyin: string; dialect: string; recordingContext: string; assetType: string; format: string; sizeBytes: number; durationMs: number; sha256: string; status: string; pronunciationReview: string; sourceName: string; license: string; licenseUrl: string; attribution: string; sourcePageUrl: string; sourceAttestedAt: string | null; sourceAttestationMethod: string | null }> } | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const load = () => { void api<typeof queue>("/admin/content/review-queue").then((data) => { setQueue(data); setError(""); }).catch((cause) => setError(cause instanceof Error ? cause.message : "Tidak dapat memuat materi.")); };
  useEffect(load, []);
  const review = async (kind: string, id: string, status: string) => { try { await api(`/admin/content/${kind}/${id}`, { method: "PATCH", body: JSON.stringify({ status, note: "Reviewed in admin" }) }); setNotice("Keputusan review tersimpan dan tercatat."); load(); } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Keputusan belum dapat disimpan."); } };
  const audioReview = async (id: string, decision: "passed" | "failed") => { try { await api(`/admin/audio/${id}`, { method: "PATCH", body: JSON.stringify({ decision, note: "Checked against the exact displayed Mandarin reading and context." }) }); setNotice("Hasil pemeriksaan audio tersimpan."); load(); } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Hasil pemeriksaan belum dapat disimpan."); } };
  return <><AdminPageHead eyebrow="KUALITAS MATERI" title="Konten & audio" subtitle="Materi dari sumber lisensi terbuka dapat aktif otomatis setelah sumber dan metadata cocok; antrian ini tetap menyediakan pemutaran, penolakan, dan pemeriksaan ulang." />{error && <InlineNotice tone="danger">{error}</InlineNotice>}{notice && <InlineNotice>{notice}</InlineNotice>}{queue && <><ReviewGroup title="Kosakata" items={queue.vocabulary} kind="vocabulary" onReview={review} /><ReviewGroup title="Karakter & data guratan" items={queue.characters.map((item) => ({ ...item, text: `${item.text} · guratan: ${item.strokeStatus}` }))} kind="character" onReview={review} /><ReviewGroup title="Pelafalan / Pinyin" items={queue.readings.map((item) => ({ ...item, text: `${item.text} · ${item.pinyin}` }))} kind="reading" onReview={review} />
    <SentenceAudioRecordingStudio onUploaded={load} />
    <section className="admin-panel review-section"><div className="panel-head"><div><h2>Audio tersumber & kandidat</h2><p>Rekaman sumber dapat aktif tanpa keputusan per file; putar kembali atau tolak bila ada masalah.</p></div></div>{queue.audio.length ? queue.audio.map((audio) => <div className="audio-review-card" key={audio.id}><div className="audio-meta"><strong>{audio.text} <small>{audio.pinyin}</small></strong><p>{audio.assetType === "sentence" ? "Audio kalimat" : "Audio kosakata"} · {audio.sourceName} · {audio.license} {audio.sourceAttestedAt ? "· sumber cocok" : "· menunggu sumber/review"}</p><p>{audio.recordingContext} · {audio.dialect} · {(audio.sizeBytes / 1024).toFixed(1)} KB · {audio.durationMs} ms</p><small>Checksum {audio.sha256.slice(0, 16)}… · atribusi: {audio.attribution}</small><p><a href={audio.sourcePageUrl} target="_blank" rel="noreferrer">Buka file sumber</a> · <a href={audio.licenseUrl} target="_blank" rel="noreferrer">Lisensi</a></p><audio controls preload="none" src={audioUrl(audio.id) ?? undefined} /></div><div className="audio-review-actions"><button className="button button-soft" onClick={() => void audioReview(audio.id, "failed")}>Tolak</button><button className="button button-primary" onClick={() => void audioReview(audio.id, "passed")}>Tandai cocok</button></div></div>) : <div className="table-empty">Belum ada file audio kandidat atau tersumber.</div>}</section></>}</>;
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

function AudioButton({ assetId, text, prominent = false, humanOnly = false }: { assetId?: string | null; text: string; prominent?: boolean; humanOnly?: boolean }) {
  const [error, setError] = useState("");
  const [voiceAvailable, setVoiceAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    if (humanOnly) return;
    if (!("speechSynthesis" in window)) return;
    const updateVoices = () => setVoiceAvailable(window.speechSynthesis.getVoices().some((voice) => voice.lang.toLowerCase() === "zh-cn" && voice.localService));
    updateVoices();
    window.speechSynthesis.addEventListener("voiceschanged", updateVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", updateVoices);
  }, [humanOnly]);
  const play = async () => {
    const src = audioUrl(assetId);
    if (src) {
      try { const audio = new Audio(src); await audio.play(); setError(""); } catch { setError("Rekaman belum dapat diputar."); }
      return;
    }
    if (humanOnly) return;
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return;
    const voice = window.speechSynthesis.getVoices().find((item) => item.lang.toLowerCase() === "zh-cn" && item.localService);
    if (!voice) { setError("Suara Mandarin lokal belum tersedia. Unduh suara Mandarin di perangkat."); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.voice = voice;
    utterance.rate = 0.88;
    utterance.onstart = () => setError("");
    utterance.onerror = () => setError("Suara Mandarin perangkat gagal diputar.");
    window.speechSynthesis.speak(utterance);
  };
  const speechSupported = "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
  const canSpeak = !humanOnly && speechSupported && Boolean(text) && voiceAvailable !== false;
  return <span className="audio-control"><button className={`audio-button ${prominent ? "audio-button-prominent" : ""} ${!assetId && !canSpeak ? "audio-unavailable" : ""}`} disabled={!assetId && !canSpeak} onClick={() => void play()} aria-label={assetId ? "Putar rekaman Mandarin" : humanOnly ? "Rekaman penutur belum tersedia" : "Putar suara Mandarin lokal dari perangkat"} title={assetId ? "Putar rekaman Mandarin berlisensi" : humanOnly ? "Rekaman manusia untuk kalimat ini belum tersedia" : canSpeak ? "Gunakan suara Mandarin lokal bawaan perangkat" : "Suara Mandarin lokal tidak tersedia di perangkat ini"}><Volume2 /></button><small>{error || (assetId ? (prominent ? "Dengarkan" : "Putar") : humanOnly ? "Rekaman manusia belum tersedia" : voiceAvailable === null && speechSupported ? "Cek suara Mandarin" : canSpeak ? "Suara perangkat" : "Audio tidak tersedia")}</small></span>;
}

function AdminPageHead({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) { return <div className="admin-page-head"><span className="tag">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>; }
function PageTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) { return <div className="page-title"><span className="tag">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>; }
function PageBack({ to = "/", label = "Kembali" }: { to?: string; label?: string }) { return <Link className="page-back" to={to}><ArrowLeft size={17} /> {label}</Link>; }
function InlineNotice({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "danger" }) { return <div className={`inline-notice notice-${tone}`} role="status"><CircleHelp size={16} />{children}</div>; }
function EmptyContent({ message }: { message: string }) { return <div className="empty-card"><div className="empty-icon"><BookOpen /></div><p>{message}</p><Link className="button button-primary" to="/paths">Kembali ke pelajaran</Link></div>; }
function NotFound() { return <div className="auth-required"><h1>Halaman tidak ditemukan</h1><Link className="button button-primary" to="/">Kembali</Link></div>; }

async function saveAttempt(attempt: Omit<Parameters<typeof enqueueAttempt>[0], "createdAtClient">, ownerUserId: string) {
  const skill = attempt.skill ?? (attempt.activityMode === "listen" ? "listening" : attempt.activityMode === "record_compare" ? "speaking" : attempt.activityMode === "guided_writing" || attempt.activityMode === "freehand_writing" ? "writing" : "comprehension");
  await enqueueAttempt({ ...attempt, skill, createdAtClient: new Date().toISOString() }, ownerUserId);
  void syncOutbox(ownerUserId).catch(() => undefined);
}

export { App };
