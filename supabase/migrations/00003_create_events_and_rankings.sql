-- ============================================================
-- Open App Store — 事件/榜单/热词 相关表
-- 依赖：00002_create_app_catalog.sql
-- ============================================================

-- ============================================================
-- 1. app_events — 用户行为事件（view / search / download / favorite）
--    由前端 track-event Edge Function 写入
-- ============================================================
CREATE TABLE IF NOT EXISTS app_events (
    id              BIGSERIAL PRIMARY KEY,
    app_id          BIGINT,                     -- 可空：search 事件无 app_id
    app_name        TEXT,
    owner           TEXT,
    repo            TEXT,
    avatar_url      TEXT,
    event_type      TEXT NOT NULL,              -- 'search' | 'view' | 'download' | 'favorite'
    keyword         TEXT,                       -- 仅 search 事件
    platform        TEXT,                       -- 客户端平台：Android / iOS / Web / Windows / macOS / Linux
    device_id       TEXT,                       -- 设备指纹（用于去重）
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_events_app_id        ON app_events(app_id);
CREATE INDEX IF NOT EXISTS idx_app_events_type          ON app_events(event_type);
CREATE INDEX IF NOT EXISTS idx_app_events_created_at    ON app_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_events_keyword       ON app_events(keyword) WHERE keyword IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_app_events_device        ON app_events(device_id) WHERE device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_app_events_owner_repo    ON app_events(owner, repo) WHERE owner IS NOT NULL;

ALTER TABLE app_events ENABLE ROW LEVEL SECURITY;

-- 匿名只能写不能读（防止数据泄露）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'app_events' AND policyname = 'app_events_insert'
    ) THEN
        CREATE POLICY app_events_insert ON app_events
        FOR INSERT TO anon WITH CHECK (true);
    END IF;
END $$;

GRANT INSERT ON app_events TO anon;
GRANT SELECT ON app_events TO authenticated;


-- ============================================================
-- 2. search_hot_words — 搜索热词计数
--    由 track-event Edge Function 通过 increment_hot_word() 维护
-- ============================================================
CREATE TABLE IF NOT EXISTS search_hot_words (
    keyword         TEXT PRIMARY KEY,
    search_count    INTEGER DEFAULT 0,
    last_searched   TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE search_hot_words ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'search_hot_words' AND policyname = 'search_hot_words_select'
    ) THEN
        CREATE POLICY search_hot_words_select ON search_hot_words
        FOR SELECT TO anon USING (true);
    END IF;
END $$;

GRANT SELECT ON search_hot_words TO anon;


-- ============================================================
-- 3. increment_hot_word() — RPC：原子 increment 搜索热词
--    使用 ON CONFLICT 避免重复 key 报错
-- ============================================================
CREATE OR REPLACE FUNCTION increment_hot_word(kw TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF kw IS NULL OR trim(kw) = '' THEN RETURN; END IF;

    INSERT INTO search_hot_words (keyword, search_count, last_searched, updated_at)
    VALUES (trim(kw), 1, NOW(), NOW())
    ON CONFLICT (keyword) DO UPDATE
    SET search_count  = search_hot_words.search_count + 1,
        last_searched = NOW(),
        updated_at    = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION increment_hot_word(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION increment_hot_word(TEXT) TO authenticated;


-- ============================================================
-- 4. increment_hot_words_batch(TEXT[]) — RPC：批量 increment 热词
--    替代 N 次单独 RPC 调用，减少网络往返
-- ============================================================
CREATE OR REPLACE FUNCTION increment_hot_words_batch(keywords TEXT[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    kw TEXT;
BEGIN
    IF keywords IS NULL OR array_length(keywords, 1) IS NULL THEN RETURN; END IF;

    FOREACH kw IN ARRAY keywords
    LOOP
        IF kw IS NOT NULL AND trim(kw) <> '' THEN
            INSERT INTO search_hot_words (keyword, search_count, last_searched, updated_at)
            VALUES (trim(kw), 1, NOW(), NOW())
            ON CONFLICT (keyword) DO UPDATE
            SET search_count  = search_hot_words.search_count + 1,
                last_searched = NOW(),
                updated_at    = NOW();
        END IF;
    END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_hot_words_batch(TEXT[]) TO anon;
GRANT EXECUTE ON FUNCTION increment_hot_words_batch(TEXT[]) TO authenticated;


-- ============================================================
-- 5. safe_hot_words — 过滤后的热词视图
--    过滤掉包含不安全关键词（如色情/赌博/毒品 等）的搜索词
--    实际过滤规则由应用层维护，这里简单暴露 search_count > 0 的词
-- ============================================================
CREATE OR REPLACE VIEW safe_hot_words AS
SELECT keyword, search_count, last_searched
FROM search_hot_words
WHERE search_count > 0
ORDER BY search_count DESC
LIMIT 100;

GRANT SELECT ON safe_hot_words TO anon;
GRANT SELECT ON safe_hot_words TO authenticated;


-- ============================================================
-- 6. app_rankings — 应用榜单
--    由 aggregate-rankings Edge Function 定期生成
--    包含热门 / 下载 / 收藏 三种榜单，周期为 week / month / all
-- ============================================================
CREATE TABLE IF NOT EXISTS app_rankings (
    id              BIGSERIAL PRIMARY KEY,
    rank_type       TEXT NOT NULL,              -- 'hot' | 'download' | 'favorite'
    period          TEXT NOT NULL,              -- 'week' | 'month' | 'all'
    app_id          BIGINT,                     -- 对应 app_catalog.id
    app_name        TEXT,
    owner           TEXT,
    repo            TEXT,
    avatar_url      TEXT,
    score           INTEGER DEFAULT 0,          -- 综合热度分（对 download/favorite 也复用）
    download_count  INTEGER DEFAULT 0,
    favorite_count  INTEGER DEFAULT 0,
    view_count      INTEGER DEFAULT 0,
    rank_position   INTEGER,                    -- 榜单位置（1~N）
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    -- 确保同一 (rank_type, period, app_id) 唯一，用于 upsert
    CONSTRAINT app_rankings_unique UNIQUE (rank_type, period, app_id)
);

CREATE INDEX IF NOT EXISTS idx_app_rankings_type_period   ON app_rankings(rank_type, period, rank_position);
CREATE INDEX IF NOT EXISTS idx_app_rankings_app_id        ON app_rankings(app_id);

ALTER TABLE app_rankings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'app_rankings' AND policyname = 'app_rankings_select'
    ) THEN
        CREATE POLICY app_rankings_select ON app_rankings
        FOR SELECT TO anon USING (true);
    END IF;
END $$;

GRANT SELECT ON app_rankings TO anon;
GRANT SELECT ON app_rankings TO authenticated;


-- ============================================================
-- 7. ranking_denylist — 榜单黑名单
--    聚合排行榜时排除某些项目（例如无安装包的旧数据/测试项目）
-- ============================================================
CREATE TABLE IF NOT EXISTS ranking_denylist (
    owner           TEXT NOT NULL,
    repo            TEXT NOT NULL,
    reason          TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (owner, repo)
);

ALTER TABLE ranking_denylist ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'ranking_denylist' AND policyname = 'ranking_denylist_select'
    ) THEN
        CREATE POLICY ranking_denylist_select ON ranking_denylist
        FOR SELECT TO anon USING (true);
    END IF;
END $$;

GRANT SELECT ON ranking_denylist TO anon;
GRANT SELECT ON ranking_denylist TO authenticated;
