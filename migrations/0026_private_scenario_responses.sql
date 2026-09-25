-- A private, no-AI productive-language task attached to stable course activity IDs.
CREATE TABLE scenario_responses (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  activity_id TEXT NOT NULL REFERENCES curriculum_activities(id) ON DELETE CASCADE,
  response_text TEXT NOT NULL CHECK(length(response_text) BETWEEN 1 AND 1200),
  self_assessment TEXT NOT NULL CHECK(self_assessment IN ('confident','repeat','unsure')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(user_id, activity_id)
);
CREATE INDEX scenario_responses_activity_idx ON scenario_responses(activity_id, updated_at DESC);

INSERT OR IGNORE INTO curriculum_activities
  (id,unit_id,activity_kind,title,objective,instructions,ordinal,status,source_id)
VALUES
  ('activity-unit-daily-greetings-output','unit-daily-greetings','scenario_output','Perkenalan singkatmu','Gunakan salam dan pola 我叫 untuk memperkenalkan diri.','Tulis satu atau dua kalimat tentang nama panggilan dan asalmu. Kamu boleh memakai huruf Latin untuk nama. Hindari menulis alamat atau nomor kontak.',4,'published','source-everyday-content-v1'),
  ('activity-unit-daily-food-output','unit-daily-food','scenario_output','Pesan minuman','Gunakan 想 + kata kerja untuk menyebut pilihan minumanmu.','Bayangkan sedang memilih minuman. Tulis satu kalimat tentang yang ingin kamu minum. Gunakan kata yang sudah dipelajari; kamu boleh membuka contoh lagi.',4,'published','source-everyday-content-v1'),
  ('activity-unit-daily-home-output','unit-daily-home','scenario_output','Ceritakan keluargamu','Gunakan pola 有 + jumlah + 人 untuk menyampaikan jumlah anggota keluarga.','Tulis satu kalimat tentang jumlah anggota keluarga. Kamu boleh mengganti jumlahnya dengan contoh rekaan; jangan sertakan nama lengkap atau detail pribadi.',4,'published','source-everyday-content-v1'),
  ('activity-unit-daily-intro-output','unit-daily-intro','scenario_output','Perkenalkan dirimu','Gabungkan sapaan, nama, dan asal dalam perkenalan sederhana.','Tulis satu atau dua kalimat Mandarin untuk memperkenalkan diri. Nama dapat tetap ditulis dengan huruf Latin. Jangan tulis alamat atau nomor kontak.',4,'published','source-everyday-content-v1');
