-- Optional app-authored starting-point check. It is not an official HSK test.
-- Human-readable authoring source: placementAssessment in content/scenario-content-2026-09.json.
CREATE TABLE placement_questions (
  id TEXT PRIMARY KEY NOT NULL,
  ordinal INTEGER NOT NULL UNIQUE CHECK(ordinal >= 0),
  prompt TEXT NOT NULL,
  pinyin TEXT NOT NULL DEFAULT '',
  options_json TEXT NOT NULL CHECK(json_valid(options_json)),
  correct_option INTEGER NOT NULL CHECK(correct_option >= 0),
  difficulty_band TEXT NOT NULL CHECK(difficulty_band IN ('foundation','elementary','developing','confident')),
  explanation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','retired')),
  source_id TEXT NOT NULL REFERENCES asset_sources(id),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
  CHECK(correct_option < json_array_length(options_json))
);

CREATE TABLE placement_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  assessment_version TEXT NOT NULL,
  answered_count INTEGER NOT NULL CHECK(answered_count BETWEEN 1 AND 6),
  correct_count INTEGER NOT NULL CHECK(correct_count BETWEEN 0 AND answered_count),
  recommendation TEXT NOT NULL CHECK(recommendation IN ('foundation','elementary','developing')),
  explanation TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX placement_sessions_user_idx ON placement_sessions(user_id, completed_at DESC);

CREATE TABLE placement_responses (
  session_id TEXT NOT NULL REFERENCES placement_sessions(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES placement_questions(id),
  selected_option INTEGER NOT NULL CHECK(selected_option >= 0),
  is_correct INTEGER NOT NULL CHECK(is_correct IN (0,1)),
  PRIMARY KEY(session_id, question_id)
);

INSERT OR IGNORE INTO placement_questions
  (id,ordinal,prompt,pinyin,options_json,correct_option,difficulty_band,explanation,status,source_id)
VALUES
  ('placement-welcome',0,'你好','nǐ hǎo','["Halo","Terima kasih","Selamat malam","Sampai jumpa"]',0,'foundation','你好 adalah sapaan umum yang berarti halo.','published','source-everyday-content-v1'),
  ('placement-basic-sentence',1,'我喝水。','wǒ hē shuǐ','["Saya minum air.","Saya ingin minum teh.","Nama saya Anna.","Saya pergi ke sekolah."]',0,'foundation','我喝水 berarti saya minum air; urutannya adalah subjek, kata kerja, lalu objek.','published','source-everyday-content-v1'),
  ('placement-introduction',2,'你叫什么名字？','nǐ jiào shén me míng zi','["Siapa namamu?","Kamu tinggal di mana?","Berapa harganya?","Kamu ingin minum apa?"]',0,'elementary','你叫什么名字 digunakan untuk menanyakan nama seseorang.','published','source-everyday-content-v1'),
  ('placement-want',3,'我___喝茶。','wǒ ___ hē chá','["想","是","吗","在"]',0,'elementary','想 diletakkan sebelum kata kerja untuk menyatakan keinginan.','published','source-everyday-content-v1'),
  ('placement-cause',4,'因为今天下雨，所以我坐车。','yīnwèi jīntiān xiàyǔ, suǒyǐ wǒ zuò chē','["Hari ini hujan, jadi saya naik kendaraan.","Kemarin cerah, jadi saya berjalan.","Saya suka hujan dan teh.","Saya belum tahu cara naik bus."]',0,'developing','因为…所以… menghubungkan alasan dengan hasil.','published','source-everyday-content-v1'),
  ('placement-contrast',5,'虽然我很忙，但是我每天练习中文。','suīrán wǒ hěn máng, dànshì wǒ měitiān liànxí Zhōngwén','["Walaupun sibuk, saya berlatih bahasa Mandarin setiap hari.","Karena saya sibuk, saya tidak belajar Mandarin.","Saya belajar Mandarin selama satu hari.","Saya ingin mengajar bahasa Mandarin."]',0,'confident','虽然…但是… menyatakan dua gagasan yang berlawanan.','published','source-everyday-content-v1');
