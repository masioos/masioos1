-- Search text: fold more Persian/Arabic letter forms, same as normalizeSearch in catalog/rules.ts.
-- Short vowels and tatweel removed; آأإٱ → ا, ةۀ → ه, ؤ → و, ئ → ی.
UPDATE "catalog_products"
SET "search_text" = translate(
  regexp_replace("search_text", '[ً-ٰٟـ]', '', 'g'),
  'آأإٱةۀؤئ',
  'ااااههوی'
);
