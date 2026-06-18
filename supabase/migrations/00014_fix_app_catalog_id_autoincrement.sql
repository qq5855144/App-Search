
-- 给 app_catalog.id 加上自增序列，让 upsert 无需手动提供 id
CREATE SEQUENCE IF NOT EXISTS app_catalog_id_seq;
ALTER TABLE app_catalog
  ALTER COLUMN id SET DEFAULT nextval('app_catalog_id_seq');
-- 让序列从当前最大值开始，避免冲突
SELECT setval('app_catalog_id_seq', COALESCE((SELECT MAX(id) FROM app_catalog), 0) + 1, false);
