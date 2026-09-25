PRAGMA foreign_keys = ON;

-- A small text-only community with pre-moderation, reporting, blocking and
-- account-level rate limits. No DMs, media uploads, or public unreviewed posts.
CREATE TABLE community_topics (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'id' CHECK(locale IN ('id','en')),
  status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published','retired')),
  source_id TEXT NOT NULL REFERENCES asset_sources(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE community_posts (
  id TEXT PRIMARY KEY NOT NULL,
  topic_id TEXT REFERENCES community_topics(id) ON DELETE SET NULL,
  author_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 1200),
  locale TEXT NOT NULL DEFAULT 'id' CHECK(locale IN ('id','en')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','hidden','removed')),
  moderated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  moderated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX community_posts_feed_idx ON community_posts(status, created_at DESC);
CREATE INDEX community_posts_author_idx ON community_posts(author_user_id, created_at DESC);

CREATE TABLE community_comments (
  id TEXT PRIMARY KEY NOT NULL,
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 800),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','hidden','removed')),
  moderated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  moderated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX community_comments_post_idx ON community_comments(post_id, status, created_at);
CREATE INDEX community_comments_author_idx ON community_comments(author_user_id, created_at DESC);

CREATE TABLE community_reports (
  id TEXT PRIMARY KEY NOT NULL,
  reporter_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL CHECK(subject_type IN ('post','comment')),
  subject_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK(reason IN ('spam','harassment','personal_data','copyright','other')),
  details TEXT NOT NULL DEFAULT '' CHECK(length(details) <= 600),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewing','resolved','dismissed')),
  reviewed_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(reporter_user_id, subject_type, subject_id)
);
CREATE INDEX community_reports_queue_idx ON community_reports(status, created_at);

CREATE TABLE community_blocks (
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  blocked_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(user_id, blocked_user_id),
  CHECK(user_id != blocked_user_id)
);

INSERT INTO community_topics(id,slug,title,prompt,source_id) VALUES
  ('community-topic-introduction','introductions','Mari berkenalan','Ceritakan satu hal sederhana tentang dirimu dalam bahasa Mandarin. Kamu boleh memakai pinyin bila masih belajar hanzi.','source-everyday-content-v1'),
  ('community-topic-daily-life','daily-life','Bahasa untuk keseharian','Kalimat Mandarin apa yang ingin kamu gunakan saat makan, berbelanja, atau bepergian?','source-everyday-content-v1'),
  ('community-topic-learning-tip','learning-tip','Cara belajarmu','Apa cara yang membantumu mengingat nada atau urutan guratan? Bagikan pengalaman belajar, bukan data pribadi.','source-everyday-content-v1'),
  ('community-topic-question','ask-a-question','Tanya teman belajar','Tuliskan pertanyaan tentang kata atau kalimat Mandarin. Jangan sertakan nomor telepon, alamat, atau informasi rahasia.','source-everyday-content-v1');

PRAGMA foreign_keys = ON;
