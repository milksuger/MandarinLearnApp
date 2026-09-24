PRAGMA foreign_keys = ON;

-- Original Indonesian-first starter lessons, licensed separately from the app.
INSERT INTO asset_sources(
  id,name,version,source_url,license_id,license_url,attribution,checksum,notes,
  license_verification,verification_method,verified_at
) VALUES (
  'source-everyday-content-v1','MandarinLearnApp original Indonesian beginner lessons','1.0.0',NULL,
  'CC BY 4.0','https://creativecommons.org/licenses/by/4.0/',
  'Original Chinese examples, Indonesian glosses, and lesson sequencing by MandarinLearnApp contributors.',
  NULL,
  'Original app-authored material. HSK routes are learning navigation only; this content is not copied from official HSK lists or syllabi.',
  'verified','Project-authored content with an explicit open license; no CTI syllabus text or list reproduced.','2026-09-24T00:00:00Z'
);

INSERT INTO asset_sources(
  id,name,version,source_url,license_id,license_url,attribution,checksum,notes,
  license_verification,verification_method,verified_at
) VALUES (
  'source-commons-wo','Wikimedia Commons file Zh-wǒ.ogg','2006-10-29',
  'https://commons.wikimedia.org/wiki/File:Zh-w%C7%92.ogg',
  'CC BY 2.0 fr','https://creativecommons.org/licenses/by/2.0/fr/deed.en',
  '“Zh-wǒ.ogg” by Wei Gao and Vion Nicolas, via Wikimedia Commons, CC BY 2.0 fr. Recording from The Shtooka Project; Commons identifies the speaker as from Beijing.',
  'sha256:c912a0796315cf2d4c7c8cab74b13c8979b9eac372d3d8047638550db949cd15',
  'Exact isolated Mandarin reading wǒ / 我. The served MP3 is Wikimedia Commons’ compatibility transcode of the original Ogg; the speech is not edited. Community recording, not a government-certified voice.',
  'verified','Commons file description identifies the exact reading and speaker location; file page states CC BY 2.0 fr; source bytes and served MP3 checksum recorded.','2026-09-24T00:00:00Z'
);

-- The copied Hanzi Writer data files are unchanged; the per-file SHA-256 and
-- Arphic Public License are retained from content/stroke-assets-manifest.json.
WITH stroke_seed(hanzi,stroke_count,checksum) AS (VALUES
  ('中',4,'6982c8c16e7e7f769011edef0608289443711dbb34046dd9ca763e79ec29192f'),
  ('人',2,'18ffb9fb727576b0c3e7dc44914be7ffd43164de9ba121710824b83f27bd3bb1'),
  ('再',6,'63c13624816b79b2edb3f6d04c494a1bc8fe89175e06c4f1e7452e2016e5224c'),
  ('去',5,'96e01168e8c76add5a05de734f18ef282451ca9107757977e5d83d8eea2bc281'),
  ('吃',6,'7030e0da002dbc77d79821e9b78ab848777a8b9c0dabd1340b41b5fc1dd63a36'),
  ('名',6,'3dc8c37774349653b6e4732d505bcdd84585f092ab461221ef77984cffb7e98d'),
  ('吗',6,'fd15dc345d5413ebf4bb3517b7b616890b0a948f62a70a21a2a8eed4eed78583'),
  ('喝',12,'bf7840cc0811e59e4db4a35f476af88054625cac10e87b0338c2c267b37dca9a'),
  ('国',8,'40b46b7cbe5c292abcf79507dc544c5424c9cfa4df0376aa3b8fa42e535c2f7f'),
  ('在',6,'ec45f668f3181cd2c612797ff557f5b53f8823f120eca5d9a68e0fd8b1b0f21c'),
  ('奶',5,'151460436d8c0f29b05af02b03e456d0232f4dc9f1bfae3b2b551aa8a99d3aa9'),
  ('妈',6,'0b288b695765e1294ca2cbc2b463227b637047932ebdab2ff9cddba6c1d576b2'),
  ('字',6,'d4e20f90c64acc1427d41e693c7151f3ea389eb10d8ce7f2c98613b01c6d1baf'),
  ('学',8,'9f2bdcab70ecf93632b6cf1ce9b5339cc8018d742eed7839037d146f8c294193'),
  ('家',10,'390ad42ee60491df2ae9ddfd59358d4d6ff69208ccdac902aae0431b7e5f9aef'),
  ('很',9,'b34ddabdd9034dfa73a413d9f83aec96451f97d75e8a553505a7fbe442c57356'),
  ('想',13,'9e3bf868a8170c4deb5c1fc39ffd42ef1a119bb55d742028777fb7ebfb23e885'),
  ('我',7,'08616462fc64b4c18c76a3f68a992305e98946f468bf42ec76ca9be1cd6c5ac8'),
  ('是',9,'73249157dc9e08c1eb3fb029ca12288b15c597f85eb4a6c72f5bdc6893ded27b'),
  ('来',7,'ebf3a9165522693077a8f14d25e003565409d8751ff0a4724423315d57d9a57d'),
  ('校',10,'bd810a1cf7fa8216207502a388f4593cce34b71018e8419ecff0b5364147e0bb'),
  ('水',4,'46e262a80f2b7da72ea04788d1c19c40339e18beaba16987cc84d55fc257c9e3'),
  ('牛',4,'cb0c578ebb919ca2ad759cc8a79159f1eff623ae7f57dacca26a1bbbc523ab98'),
  ('生',5,'dbe556919f5c0a95448c40997dfce35ad56ebf26d874218e7076d8c12374cfd8'),
  ('的',8,'d9a067e65c8c3770d5559d42bd2bc564b8e133d8fa3dc237d9c4a317adfbb32f'),
  ('米',6,'105847e8be1741677145b1e7b7168ba883e9ca3ae1abb7b60a476d430117e88e'),
  ('茶',9,'a9bf01e1c90c9a153d7200beb3530730fe1af14266f709d32460f1a171be004e'),
  ('要',9,'29596cde9e081fafc88b28b84c25d5b0751a272a3db9e8d665c4f6b1015c4e7f'),
  ('见',4,'38f248a32907c2061fe800b7217847f07181ec6ecfa421e194e020426b79ec3d'),
  ('请',10,'6d48bdaeed17674221109997ed3187d71a6c8d7d3549dd277845a18828e2c82c'),
  ('谢',12,'9f68c6a28d3632f77ac32ea4d31945ed760b8d98a133e7516a11854991de1f39'),
  ('饭',7,'cc1fa66270ac4250e36825e9c45d7af0b43a5ae271483fc15dfc14fd95a60026')
)
INSERT INTO characters(
  id,hanzi,unicode_code_point,stroke_count,stroke_data_source_id,stroke_data_storage_key,
  stroke_data_checksum,stroke_data_version,stroke_data_license_id,stroke_data_status,status,source_id,
  stroke_data_source_page_url,stroke_data_attested_at,stroke_data_attestation_method
)
SELECT
  'char-' || printf('%x',unicode(hanzi)),hanzi,'U+' || upper(printf('%04x',unicode(hanzi))),stroke_count,
  'source-hanzi-writer-data','media/strokes/' || upper(printf('%x',unicode(hanzi))) || '.json',checksum,
  '2.0.1','Arphic Public License','approved','approved','source-hanzi-writer-data',
  'https://github.com/chanind/hanzi-writer-data/blob/master/' || hanzi || '.json',
  '2026-09-24T00:00:00Z','upstream_package_license_and_character_file'
FROM stroke_seed;

INSERT INTO vocabulary_entries(id,simplified_form,part_of_speech,status,source_id) VALUES
  ('word-you','你','pronoun','approved','source-everyday-content-v1'),
  ('word-good','好','adjective','approved','source-everyday-content-v1'),
  ('word-wo','我','pronoun','approved','source-everyday-content-v1'),
  ('word-shi','是','verb','approved','source-everyday-content-v1'),
  ('word-zhongguo','中国','noun','approved','source-everyday-content-v1'),
  ('word-ren','人','noun','approved','source-everyday-content-v1'),
  ('word-mingzi','名字','noun','approved','source-everyday-content-v1'),
  ('word-xiexie','谢谢','phrase','approved','source-everyday-content-v1'),
  ('word-home','家','noun','approved','source-everyday-content-v1'),
  ('word-mama','妈妈','noun','approved','source-everyday-content-v1'),
  ('word-water','水','noun','approved','source-everyday-content-v1'),
  ('word-tea','茶','noun','approved','source-everyday-content-v1'),
  ('word-milk','牛奶','noun','approved','source-everyday-content-v1'),
  ('word-eat','吃','verb','approved','source-everyday-content-v1'),
  ('word-want','要','verb','approved','source-everyday-content-v1'),
  ('word-please','请','verb','approved','source-everyday-content-v1'),
  ('word-go','去','verb','approved','source-everyday-content-v1'),
  ('word-come','来','verb','approved','source-everyday-content-v1'),
  ('word-ma','吗','particle','approved','source-everyday-content-v1'),
  ('word-very','很','adverb','approved','source-everyday-content-v1'),
  ('word-de','的','particle','approved','source-everyday-content-v1'),
  ('word-drink','喝','verb','approved','source-everyday-content-v1'),
  ('word-rice','米饭','noun','approved','source-everyday-content-v1'),
  ('word-at','在','verb','approved','source-everyday-content-v1'),
  ('word-want-think','想','verb','approved','source-everyday-content-v1'),
  ('word-student','学生','noun','approved','source-everyday-content-v1'),
  ('word-school','学校','noun','approved','source-everyday-content-v1'),
  ('word-goodbye','再见','phrase','approved','source-everyday-content-v1');

WITH reading_seed(id,pinyin,numbered) AS (VALUES
  ('word-you','["nǐ"]','ni3'),
  ('word-good','["hǎo"]','hao3'),
  ('word-wo','["wǒ"]','wo3'),
  ('word-shi','["shì"]','shi4'),
  ('word-zhongguo','["zhōng","guó"]','zhong1 guo2'),
  ('word-ren','["rén"]','ren2'),
  ('word-mingzi','["míng","zi"]','ming2 zi0'),
  ('word-xiexie','["xiè","xie"]','xie4 xie0'),
  ('word-home','["jiā"]','jia1'),
  ('word-mama','["mā","ma"]','ma1 ma0'),
  ('word-water','["shuǐ"]','shui3'),
  ('word-tea','["chá"]','cha2'),
  ('word-milk','["niú","nǎi"]','niu2 nai3'),
  ('word-eat','["chī"]','chi1'),
  ('word-want','["yào"]','yao4'),
  ('word-please','["qǐng"]','qing3'),
  ('word-go','["qù"]','qu4'),
  ('word-come','["lái"]','lai2'),
  ('word-ma','["ma"]','ma0'),
  ('word-very','["hěn"]','hen3'),
  ('word-de','["de"]','de0'),
  ('word-drink','["hē"]','he1'),
  ('word-rice','["mǐ","fàn"]','mi3 fan4'),
  ('word-at','["zài"]','zai4'),
  ('word-want-think','["xiǎng"]','xiang3'),
  ('word-student','["xué","shēng"]','xue2 sheng1'),
  ('word-school','["xué","xiào"]','xue2 xiao4'),
  ('word-goodbye','["zài","jiàn"]','zai4 jian4')
)
INSERT INTO readings(id,character_id,vocabulary_id,context_label,pinyin_json,numbered_pinyin,sandhi_json,source_id,status)
SELECT 'reading-vocabulary-' || v.id,NULL,v.id,'Everyday Mandarin: ' || v.simplified_form,d.pinyin,d.numbered,'[]',v.source_id,'approved'
FROM vocabulary_entries v JOIN reading_seed d ON d.id=v.id;

INSERT INTO readings(id,character_id,vocabulary_id,context_label,pinyin_json,numbered_pinyin,sandhi_json,source_id,status)
VALUES
  ('reading-word-ni',NULL,'word-you','Isolated character 你 / nǐ','["nǐ"]','ni3','[]','source-commons-ni','approved'),
  ('reading-word-wo',NULL,'word-wo','Isolated character 我 / wǒ','["wǒ"]','wo3','[]','source-commons-wo','approved');

WITH gloss_seed(vocabulary_id,text,usage_label) AS (VALUES
  ('word-you','Kamu; Anda','Kata ganti orang kedua'),
  ('word-good','Baik; bagus','Kata sifat; juga bagian dari sapaan 你好'),
  ('word-wo','Saya; aku','Kata ganti orang pertama'),
  ('word-shi','Adalah','Menghubungkan orang/benda dengan identitas atau kategori'),
  ('word-zhongguo','Tiongkok; China','Nama negara'),
  ('word-ren','Orang; manusia','Kata benda'),
  ('word-mingzi','Nama','Kata benda; untuk nama seseorang'),
  ('word-xiexie','Terima kasih','Ungkapan sopan'),
  ('word-home','Rumah; keluarga','Kata benda; arti mengikuti konteks'),
  ('word-mama','Ibu; mama','Sapaan untuk ibu'),
  ('word-water','Air','Kata benda'),
  ('word-tea','Teh','Kata benda'),
  ('word-milk','Susu','牛奶 berarti susu sapi'),
  ('word-eat','Makan','Kata kerja'),
  ('word-want','Mau; ingin; perlu','Makna bergantung pada kalimat'),
  ('word-please','Silakan; tolong','Ungkapan permintaan yang sopan'),
  ('word-go','Pergi','Kata kerja arah'),
  ('word-come','Datang','Kata kerja arah'),
  ('word-ma','Partikel pertanyaan ya/tidak','Diletakkan di akhir pertanyaan'),
  ('word-very','Sangat','Biasanya mendahului kata sifat'),
  ('word-de','Partikel penghubung keterangan dan kata benda','Fungsi gramatikal; terjemahan bergantung konteks'),
  ('word-drink','Minum','Kata kerja'),
  ('word-rice','Nasi','米饭 berarti nasi yang sudah dimasak'),
  ('word-at','Berada; di','Menandai lokasi atau keberadaan'),
  ('word-want-think','Ingin; mau','Dalam contoh pemula digunakan sebagai keinginan'),
  ('word-student','Pelajar; siswa','Kata benda'),
  ('word-school','Sekolah','Kata benda'),
  ('word-goodbye','Sampai jumpa','Ungkapan perpisahan')
)
INSERT INTO glosses(id,locale,text,usage_label,source_id,status)
SELECT 'gloss-' || vocabulary_id,'id',text,usage_label,'source-everyday-content-v1','approved' FROM gloss_seed;

INSERT INTO vocabulary_glosses(vocabulary_id,gloss_id)
SELECT id,'gloss-' || id FROM vocabulary_entries WHERE source_id='source-everyday-content-v1';

WITH links(vocabulary_id,characters_json) AS (VALUES
  ('word-you','["你"]'),('word-good','["好"]'),('word-wo','["我"]'),('word-shi','["是"]'),
  ('word-zhongguo','["中","国"]'),('word-ren','["人"]'),('word-mingzi','["名","字"]'),
  ('word-xiexie','["谢"]'),('word-home','["家"]'),('word-mama','["妈"]'),('word-water','["水"]'),
  ('word-tea','["茶"]'),('word-milk','["牛","奶"]'),('word-eat','["吃"]'),('word-want','["要"]'),
  ('word-please','["请"]'),('word-go','["去"]'),('word-come','["来"]'),('word-ma','["吗"]'),
  ('word-very','["很"]'),('word-de','["的"]'),('word-drink','["喝"]'),('word-rice','["米","饭"]'),
  ('word-at','["在"]'),('word-want-think','["想"]'),('word-student','["学","生"]'),
  ('word-school','["学","校"]'),('word-goodbye','["再","见"]')
), parts AS (
  SELECT vocabulary_id,CAST(j.key AS INTEGER) AS position,j.value AS hanzi
  FROM links,json_each(links.characters_json) j
)
INSERT INTO vocabulary_characters(vocabulary_id,character_id,position)
SELECT p.vocabulary_id,c.id,p.position FROM parts p JOIN characters c ON c.hanzi=p.hanzi;

INSERT INTO examples(id,vocabulary_id,simplified_text,pinyin_json,numbered_pinyin,locale,translation,source_id,status) VALUES
  ('example-wo-student','word-wo','我是学生。','["wǒ","shì","xué","shēng"]','wo3 shi4 xue2 sheng1','id','Saya seorang pelajar.','source-everyday-content-v1','approved'),
  ('example-china-person','word-zhongguo','我是中国人。','["wǒ","shì","zhōng","guó","rén"]','wo3 shi4 zhong1 guo2 ren2','id','Saya orang Tiongkok.','source-everyday-content-v1','approved'),
  ('example-thanks-you','word-xiexie','谢谢你。','["xiè","xie","nǐ"]','xie4 xie0 ni3','id','Terima kasih.','source-everyday-content-v1','approved'),
  ('example-mama-home','word-mama','妈妈在家。','["mā","ma","zài","jiā"]','ma1 ma0 zai4 jia1','id','Ibu ada di rumah.','source-everyday-content-v1','approved'),
  ('example-tea-please','word-please','请喝茶。','["qǐng","hē","chá"]','qing3 he1 cha2','id','Silakan minum teh.','source-everyday-content-v1','approved'),
  ('example-drink-water','word-water','我喝水。','["wǒ","hē","shuǐ"]','wo3 he1 shui3','id','Saya minum air.','source-everyday-content-v1','approved'),
  ('example-want-milk','word-milk','我要牛奶。','["wǒ","yào","niú","nǎi"]','wo3 yao4 niu2 nai3','id','Saya mau susu.','source-everyday-content-v1','approved'),
  ('example-eat-rice','word-eat','我吃米饭。','["wǒ","chī","mǐ","fàn"]','wo3 chi1 mi3 fan4','id','Saya makan nasi.','source-everyday-content-v1','approved'),
  ('example-go-school','word-go','我去学校。','["wǒ","qù","xué","xiào"]','wo3 qu4 xue2 xiao4','id','Saya pergi ke sekolah.','source-everyday-content-v1','approved'),
  ('example-want-tea','word-want-think','我想喝茶。','["wǒ","xiǎng","hē","chá"]','wo3 xiang3 he1 cha2','id','Saya ingin minum teh.','source-everyday-content-v1','approved');

INSERT INTO audio_assets(
  id,reading_id,source_id,storage_key,sha256,format,size_bytes,duration_ms,speaker_id,dialect,
  recording_context,pronunciation_review,status,source_page_url,source_attested_at,
  source_attestation_method,original_sha256,derivative_notes
) VALUES
  ('audio-word-ni','reading-word-ni','source-commons-ni','media/audio/commons-zh-ni.mp3',
   '2ffc2472805ddcf022967b7ceff36c3989afe9a5a1d1e0745cfcc38fa4a2ef25','audio/mpeg',20106,1228,
   'Wei Gao','zh-CN','Exact isolated Mandarin reading 你 / nǐ. Reuses the unchanged licensed asset already included in the app.',
   'pending','approved','https://commons.wikimedia.org/wiki/File:Zh-n%C7%90.ogg','2026-09-24T00:00:00Z',
   'Commons file description and license metadata; byte checksum matches existing distributed file.',
   'e8218d402c238c66f83252592d3e292e2f2bf1054a1dd138faeaa2d6afa4d570',
   'Points to the existing Commons-source recording; pronunciation is not edited.'),
  ('audio-word-wo','reading-word-wo','source-commons-wo','media/audio/commons-zh-wo.mp3',
   'b2326ef9b2fc9228b372c8aef0e6940d4faeaae406d3da8095dd5d3486c69a78','audio/mpeg',16311,993,
   'Wei Gao','zh-CN','Exact isolated Mandarin reading 我 / wǒ; the Commons description identifies a Beijing speaker.',
   'pending','approved','https://commons.wikimedia.org/wiki/File:Zh-w%C7%92.ogg','2026-09-24T00:00:00Z',
   'Commons file description and license checked; Commons-generated MP3 transcode byte checksum recorded.',
   'c912a0796315cf2d4c7c8cab74b13c8979b9eac372d3d8047638550db949cd15',
   'Wikimedia Commons MP3 compatibility transcode from the archived Ogg/Vorbis source; no speech editing.') ;

UPDATE curricula SET version='1.1.0',status='published',
  description='Kata dan ungkapan sehari-hari dengan pinyin, latihan tulis, dan contoh berbahasa Indonesia yang dibuat untuk aplikasi.'
WHERE id='curriculum-daily-life';

UPDATE curriculum_units SET
  description='Sapaan dasar: dengarkan, pahami, dan tulis ungkapan yang dipakai saat bertemu.',status='published'
WHERE id='unit-daily-greetings';
UPDATE curriculum_units SET
  title='Rumah & keluarga',description='Bicarakan rumah, ibu, dan lokasi dengan kalimat sederhana.',status='published'
WHERE id='unit-daily-home';
UPDATE curriculum_units SET
  title='Makanan & minuman',description='Pelajari kata untuk minum, makan, teh, air, susu, dan nasi.',status='published'
WHERE id='unit-daily-food';
UPDATE curriculum_units SET
  title='Bepergian',description='Latih kata arah dan permintaan sopan yang berguna saat bepergian.',status='published'
WHERE id='unit-daily-movement';
INSERT INTO curriculum_units(id,curriculum_id,slug,title,description,ordinal,status)
VALUES('unit-daily-intro','curriculum-daily-life','introduction','Perkenalkan diri','Sebutkan nama, asal, dan bahwa kamu sedang belajar.',4,'published');

WITH daily(placement_id,unit_id,vocabulary_id,ordinal,objective) AS (VALUES
  ('pl-daily-you','unit-daily-greetings','word-you',1,'Memahami kata ganti orang kedua'),
  ('pl-daily-good','unit-daily-greetings','word-good',2,'Memahami makna 好 dalam sapaan sederhana'),
  ('pl-daily-thanks','unit-daily-greetings','word-xiexie',3,'Mengucapkan terima kasih dengan sopan'),
  ('pl-daily-goodbye','unit-daily-greetings','word-goodbye',4,'Mengucapkan salam perpisahan'),
  ('pl-daily-ma','unit-daily-greetings','word-ma',5,'Mengenali partikel pertanyaan ya/tidak'),
  ('pl-daily-home','unit-daily-home','word-home',0,'Mengenali kata rumah dan keluarga'),
  ('pl-daily-mama','unit-daily-home','word-mama',1,'Menyebut anggota keluarga'),
  ('pl-daily-at','unit-daily-home','word-at',2,'Menyatakan lokasi dengan 在'),
  ('pl-daily-water','unit-daily-food','word-water',0,'Mengenali kata air dan cara membacanya'),
  ('pl-daily-tea','unit-daily-food','word-tea',1,'Menyebut minuman teh'),
  ('pl-daily-milk','unit-daily-food','word-milk',2,'Menyebut minuman susu'),
  ('pl-daily-rice','unit-daily-food','word-rice',3,'Mengenali kata nasi'),
  ('pl-daily-eat','unit-daily-food','word-eat',4,'Menggunakan kata kerja makan'),
  ('pl-daily-drink','unit-daily-food','word-drink',5,'Menggunakan kata kerja minum'),
  ('pl-daily-want','unit-daily-food','word-want',6,'Menyampaikan keinginan sederhana'),
  ('pl-daily-go','unit-daily-movement','word-go',0,'Menggunakan kata pergi'),
  ('pl-daily-come','unit-daily-movement','word-come',1,'Menggunakan kata datang'),
  ('pl-daily-please','unit-daily-movement','word-please',2,'Meminta dengan sopan'),
  ('pl-daily-wo','unit-daily-intro','word-wo',0,'Memperkenalkan diri dengan kata saya'),
  ('pl-daily-shi','unit-daily-intro','word-shi',1,'Menyatakan identitas sederhana'),
  ('pl-daily-name','unit-daily-intro','word-mingzi',2,'Mengenali kata nama'),
  ('pl-daily-china','unit-daily-intro','word-zhongguo',3,'Mengenali nama negara Tiongkok'),
  ('pl-daily-ren','unit-daily-intro','word-ren',4,'Menyebut orang atau asal seseorang'),
  ('pl-daily-student','unit-daily-intro','word-student',5,'Mengenali kata pelajar dan menulis karakter komponennya'),
  ('pl-daily-school','unit-daily-intro','word-school',6,'Menyebut sekolah sebagai tempat belajar')
)
INSERT INTO curriculum_placements(id,unit_id,vocabulary_id,ordinal,learning_objective,source_id)
SELECT placement_id,unit_id,vocabulary_id,ordinal,objective,'source-everyday-content-v1' FROM daily;

-- The official six-level and nine-level HSK structures remain navigation.
-- These are original beginner practice selections, not official HSK word lists.
UPDATE curriculum_units SET
  description='Latihan pemula asli aplikasi yang disusun sebagai jalur belajar. Ini bukan daftar kosakata resmi HSK.',status='published'
WHERE id IN ('unit-hsk-1','unit-hsk-2-1');

WITH beginner(vocabulary_id,ordinal) AS (VALUES
  ('word-you',0),('word-good',1),('word-wo',2),('word-shi',3),('word-zhongguo',4),
  ('word-ren',5),('word-mingzi',6),('word-xiexie',7),('word-home',8),('word-mama',9),
  ('word-water',10),('word-tea',11),('word-milk',12),('word-eat',13),('word-want',14),
  ('word-please',15),('word-go',16),('word-come',17),('word-student',18),('word-school',19)
), placements AS (
  SELECT 'pl-hsk3-l1-' || vocabulary_id AS id,'unit-hsk-1' AS unit_id,vocabulary_id,ordinal FROM beginner
  UNION ALL
  SELECT 'pl-hsk2-l1-' || vocabulary_id,'unit-hsk-2-1',vocabulary_id,ordinal FROM beginner
)
INSERT INTO curriculum_placements(id,unit_id,vocabulary_id,ordinal,learning_objective,source_id)
SELECT id,unit_id,vocabulary_id,ordinal,'Materi pemula asli; tidak menyalin daftar ujian resmi.','source-everyday-content-v1' FROM placements;
