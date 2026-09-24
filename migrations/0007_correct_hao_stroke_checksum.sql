-- Correct a single transposed character in the starter manifest checksum.
-- The upstream file itself is unchanged; this value is SHA-256 of the shipped bytes.
UPDATE characters
SET stroke_data_checksum = 'c9f085fe6519e2b2c9653c7edf51bdbc78339fcc0b10f94c1f33c7f4f4d4a3a5'
WHERE id = 'char-hao' AND stroke_data_storage_key = 'media/strokes/597D.json';
