-- Original MandarinLearnApp scenario materials for Indonesian learners.
-- Copyright MandarinLearnApp contributors, CC BY 4.0.
-- This is authored content, not copied from SuperChinese or an official HSK list.
-- Human-readable authoring source: content/scenario-content-2026-09.json.

INSERT OR IGNORE INTO grammar_points
  (id, slug, title, pattern, explanation, usage_notes, locale, status, source_id)
VALUES
  ('grammar-introduce-name','introduce-name','Menyebutkan nama','我叫 + nama','Gunakan 叫 untuk menyebut nama yang biasa dipakai.','Untuk perkenalan awal, pola 我叫… terdengar alami. Nama asing dapat ditulis dengan huruf Latin bila belum memiliki nama Mandarin.','id','approved','source-everyday-content-v1'),
  ('grammar-ma-question','yes-no-question-ma','Pertanyaan ya atau tidak','kalimat + 吗？','Tambahkan 吗 di akhir kalimat berita untuk mengubahnya menjadi pertanyaan ya atau tidak.','Kata-kata lain biasanya tetap berurutan. Jawaban dapat berupa 是/不是 atau jawaban singkat yang sesuai konteks.','id','approved','source-everyday-content-v1'),
  ('grammar-xiang-verb','want-to-do','Mengungkapkan keinginan','subjek + 想 + kata kerja','想 sebelum kata kerja menyatakan ingin melakukan sesuatu.','想 juga dapat berarti berpikir atau merindukan pada konteks lain. Di sini artinya ditentukan oleh kata kerja setelahnya.','id','approved','source-everyday-content-v1'),
  ('grammar-family-you','asking-family-size','Menanyakan jumlah anggota keluarga','你家有几个人？','Gunakan 几 untuk menanyakan jumlah kecil yang belum diketahui.','Pola umum: tempat/kelompok + 有 + jumlah + orang/benda. Beberapa jawaban mungkin memakai angka yang berbeda.','id','approved','source-everyday-content-v1');

INSERT OR IGNORE INTO dialogues(id,unit_id,slug,title,objective,locale,status,source_id) VALUES
  ('dialogue-daily-greetings','unit-daily-greetings','first-meeting','Berkenalan untuk pertama kali','Menyapa dan menanyakan nama teman baru.','id','approved','source-everyday-content-v1'),
  ('dialogue-daily-food','unit-daily-food','order-drink','Memesan minuman','Menanyakan pilihan dan menyampaikan minuman yang diinginkan.','id','approved','source-everyday-content-v1'),
  ('dialogue-daily-home','unit-daily-home','family-size','Bercerita tentang keluarga','Menanyakan berapa orang anggota keluarga.','id','approved','source-everyday-content-v1');

INSERT OR IGNORE INTO dialogue_turns
  (id,dialogue_id,ordinal,speaker_role,speaker_label,simplified_text,pinyin_json,translation,source_id,status)
VALUES
  ('dialogue-greetings-1','dialogue-daily-greetings',0,'A','A','你好！','["nǐ","hǎo"]','Halo!','source-everyday-content-v1','approved'),
  ('dialogue-greetings-2','dialogue-daily-greetings',1,'B','B','你好！你叫什么名字？','["nǐ","hǎo","nǐ","jiào","shén","me","míng","zi"]','Halo! Siapa namamu?','source-everyday-content-v1','approved'),
  ('dialogue-greetings-3','dialogue-daily-greetings',2,'A','A','我叫安娜。','["wǒ","jiào","ān","nà"]','Namaku Anna.','source-everyday-content-v1','approved'),
  ('dialogue-greetings-4','dialogue-daily-greetings',3,'B','B','很高兴认识你。','["hěn","gāo","xìng","rèn","shi","nǐ"]','Senang berkenalan denganmu.','source-everyday-content-v1','approved'),
  ('dialogue-food-1','dialogue-daily-food',0,'A','A','你想喝什么？','["nǐ","xiǎng","hē","shén","me"]','Kamu ingin minum apa?','source-everyday-content-v1','approved'),
  ('dialogue-food-2','dialogue-daily-food',1,'B','B','我想喝茶。','["wǒ","xiǎng","hē","chá"]','Saya ingin minum teh.','source-everyday-content-v1','approved'),
  ('dialogue-home-1','dialogue-daily-home',0,'A','A','你家有几个人？','["nǐ","jiā","yǒu","jǐ","ge","rén"]','Ada berapa orang di keluargamu?','source-everyday-content-v1','approved'),
  ('dialogue-home-2','dialogue-daily-home',1,'B','B','我家有四个人。','["wǒ","jiā","yǒu","sì","ge","rén"]','Ada empat orang di keluargaku.','source-everyday-content-v1','approved');

INSERT OR IGNORE INTO stories(id,unit_id,slug,title,objective,locale,status,source_id) VALUES
  ('story-daily-introduce','unit-daily-intro','meet-anna','Kenalan dengan Anna','Membaca perkenalan singkat dan mengenali pola kalimat identitas.','id','approved','source-everyday-content-v1'),
  ('story-daily-food','unit-daily-food','tea-break','Istirahat minum teh','Memahami dialog singkat saat memilih minuman.','id','approved','source-everyday-content-v1');

INSERT OR IGNORE INTO story_paragraphs
  (id,story_id,ordinal,simplified_text,pinyin_json,translation,source_id,status)
VALUES
  ('story-introduce-1','story-daily-introduce',0,'你好！我叫安娜。我是印尼人。','["nǐ","hǎo","wǒ","jiào","ān","nà","wǒ","shì","yìn","ní","rén"]','Halo! Namaku Anna. Saya orang Indonesia.','source-everyday-content-v1','approved'),
  ('story-food-1','story-daily-food',0,'小美想喝茶。她请朋友一起喝。','["xiǎo","měi","xiǎng","hē","chá","tā","qǐng","péng","you","yì","qǐ","hē"]','Xiaomei ingin minum teh. Ia mengajak temannya minum bersama.','source-everyday-content-v1','approved');

-- Connect reusable grammar and authored scenario objects to the existing
-- context activity; stable content IDs keep progress independent of lesson cards.
INSERT OR IGNORE INTO curriculum_activity_items(activity_id,ordinal,grammar_point_id)
VALUES
  ('activity-unit-daily-greetings-context',100,'grammar-introduce-name'),
  ('activity-unit-daily-greetings-context',101,'grammar-ma-question'),
  ('activity-unit-daily-food-context',100,'grammar-xiang-verb'),
  ('activity-unit-daily-home-context',100,'grammar-family-you');

INSERT OR IGNORE INTO curriculum_activity_items(activity_id,ordinal,dialogue_turn_id)
VALUES
  ('activity-unit-daily-greetings-context',110,'dialogue-greetings-1'),
  ('activity-unit-daily-greetings-context',111,'dialogue-greetings-2'),
  ('activity-unit-daily-greetings-context',112,'dialogue-greetings-3'),
  ('activity-unit-daily-greetings-context',113,'dialogue-greetings-4'),
  ('activity-unit-daily-food-context',110,'dialogue-food-1'),
  ('activity-unit-daily-food-context',111,'dialogue-food-2'),
  ('activity-unit-daily-home-context',110,'dialogue-home-1'),
  ('activity-unit-daily-home-context',111,'dialogue-home-2');

INSERT OR IGNORE INTO curriculum_activity_items(activity_id,ordinal,story_paragraph_id)
VALUES
  ('activity-unit-daily-intro-context',120,'story-introduce-1'),
  ('activity-unit-daily-food-context',120,'story-food-1');
