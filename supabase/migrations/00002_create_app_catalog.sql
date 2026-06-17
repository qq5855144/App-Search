-- ============================================================
-- 应用目录表：仅包含有安装包的项目
-- 项目：Open App Store
-- ============================================================

-- 如果已存在先删除
DROP TABLE IF EXISTS app_catalog CASCADE;

CREATE TABLE IF NOT EXISTS app_catalog (
    id BIGINT PRIMARY KEY,                    -- GitHub repo id
    owner TEXT NOT NULL,
    repo TEXT NOT NULL,
    full_name TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    avatar_url TEXT,
    stars INTEGER DEFAULT 0,
    forks INTEGER DEFAULT 0,
    language TEXT,
    topics TEXT[] DEFAULT '{}',                     -- GitHub topics
    platforms TEXT[] DEFAULT '{}',                  -- Android/iOS/macOS/Windows/Linux
    latest_version TEXT,
    latest_release_date TIMESTAMPTZ,
    total_downloads INTEGER DEFAULT 0,
    html_url TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    license TEXT,
    open_issues_count INTEGER DEFAULT 0,
    archived BOOLEAN DEFAULT FALSE,
    has_installable_assets BOOLEAN DEFAULT TRUE,
    last_checked_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes for faster queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_app_catalog_owner_repo
    ON app_catalog (owner, repo);

CREATE INDEX IF NOT EXISTS idx_app_catalog_owner
    ON app_catalog (owner);

CREATE INDEX IF NOT EXISTS idx_app_catalog_stars
    ON app_catalog (stars DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_app_catalog_updated_at
    ON app_catalog (updated_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_app_catalog_total_downloads
    ON app_catalog (total_downloads DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_app_catalog_archived
    ON app_catalog (archived);

-- GIN indexes for array containment queries
CREATE INDEX IF NOT EXISTS idx_app_catalog_platforms
    ON app_catalog USING GIN (platforms);

CREATE INDEX IF NOT EXISTS idx_app_catalog_topics
    ON app_catalog USING GIN (topics);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_app_catalog_search
    ON app_catalog
    USING GIN (
        to_tsvector('simple',
            COALESCE(name, '') || ' ' ||
            COALESCE(description, '') || ' ' ||
            COALESCE(full_name, '') || ' ' ||
            COALESCE(owner, '')
        )
    );

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE app_catalog ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'app_catalog'
          AND policyname = 'app_catalog_select'
    ) THEN
        CREATE POLICY app_catalog_select ON app_catalog
        FOR SELECT USING (true);
    END IF;
END $$;

GRANT SELECT ON app_catalog TO anon;
GRANT SELECT ON app_catalog TO authenticated;

-- ============================================================
-- Search helper function (RPC)
-- ============================================================
CREATE OR REPLACE FUNCTION search_apps(q TEXT DEFAULT '', lim INTEGER DEFAULT 30)
RETURNS SETOF app_catalog
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    IF q IS NULL OR trim(q) = '' THEN
        RETURN QUERY
        SELECT * FROM app_catalog
        WHERE NOT archived
        AND latest_version IS NOT NULL
        ORDER BY stars DESC
        LIMIT lim;
    ELSE
        RETURN QUERY
        SELECT * FROM app_catalog
        WHERE NOT archived
        AND latest_version IS NOT NULL
        AND (
            to_tsvector('simple', COALESCE(name, '')) @@ plainto_tsquery('simple', q)
            OR lower(name) LIKE lower('%' || q || '%')
            OR lower(COALESCE(description, '')) LIKE lower('%' || q || '%')
            OR lower(full_name) LIKE lower('%' || q || '%')
            OR lower(owner) LIKE lower('%' || q || '%')
        )
        ORDER BY stars DESC
        LIMIT lim;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION search_apps(text, integer) TO anon;
GRANT EXECUTE ON FUNCTION search_apps(text, integer) TO authenticated;
