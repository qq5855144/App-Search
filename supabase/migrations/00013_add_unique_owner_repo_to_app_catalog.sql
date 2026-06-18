
-- app_catalog 需要 unique(owner, repo) 约束供 upsert onConflict 使用
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'app_catalog'::regclass
      AND contype = 'u'
      AND conname = 'app_catalog_owner_repo_key'
  ) THEN
    ALTER TABLE app_catalog ADD CONSTRAINT app_catalog_owner_repo_key UNIQUE (owner, repo);
  END IF;
END$$;

-- 为 catalog-sync 的常用查询加索引
CREATE INDEX IF NOT EXISTS idx_app_catalog_stars ON app_catalog (stars DESC);
CREATE INDEX IF NOT EXISTS idx_app_catalog_updated ON app_catalog (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_catalog_platforms ON app_catalog USING GIN (platforms);
CREATE INDEX IF NOT EXISTS idx_app_catalog_topics ON app_catalog USING GIN (topics);
