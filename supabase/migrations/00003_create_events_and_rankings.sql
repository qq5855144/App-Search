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
-- 3. increment_hot_word(keyword_in TEXT, increment_by INTEGER DEFAULT 1)
--    原子 increment 单个搜索热词（与前端 JS 调用签名对齐）
-- ============================================================
CREATE OR REPLACE FUNCTION increment_hot_word(keyword_in TEXT, increment_by INTEGER DEFAULT 1)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    clean_kw TEXT;
BEGIN
    IF keyword_in IS NULL THEN RETURN; END IF;
    clean_kw := btrim(lower(keyword_in));
    IF clean_kw = '' OR length(clean_kw) < 2 THEN RETURN; END IF;
    IF increment_by IS NULL OR increment_by < 1 THEN increment_by := 1; END IF;

    INSERT INTO search_hot_words (keyword, search_count, last_searched, updated_at)
    VALUES (clean_kw, increment_by, NOW(), NOW())
    ON CONFLICT (keyword) DO UPDATE
    SET search_count  = search_hot_words.search_count + increment_by,
        last_searched = NOW(),
        updated_at    = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION increment_hot_word(TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION increment_hot_word(TEXT, INTEGER) TO authenticated;


-- ============================================================
-- 4. increment_hot_words_batch(TEXT[]) — 批量 increment 热词
--    在数据库端做单次事务内 upsert，避免 N 次网络往返
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
        IF kw IS NOT NULL AND btrim(lower(kw)) <> ''
           AND length(btrim(lower(kw))) >= 2 THEN
            INSERT INTO search_hot_words (keyword, search_count, last_searched, updated_at)
            VALUES (btrim(lower(kw)), 1, NOW(), NOW())
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
-- 5. get_hot_keywords(limit_n INTEGER DEFAULT 20) — 前端搜索页主入口
--    返回 [{keyword, cnt}] 列表，与 search.tsx 期望的格式一致
--    在数据库端做：小写规范化、最小出现次数、TTL 过滤、LIMIT
-- ============================================================
CREATE OR REPLACE FUNCTION get_hot_keywords(limit_n INTEGER DEFAULT 20)
RETURNS TABLE(keyword TEXT, cnt INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF limit_n IS NULL OR limit_n < 1 THEN limit_n := 20; END IF;
    IF limit_n > 100 THEN limit_n := 100; END IF;

    RETURN QUERY
    SELECT
        h.keyword,
        h.search_count AS cnt
    FROM search_hot_words h
    WHERE h.search_count >= 1
      AND h.last_searched >= NOW() - INTERVAL '90 days'   -- TTL: 90 天未出现则剔除
      -- 基本安全规则：最短 2 字，最长 50 字，不含控制字符
      AND length(h.keyword) BETWEEN 2 AND 50
      AND h.keyword !~ '[\\x00-\\x1F\\x7F]'
    ORDER BY h.search_count DESC, h.last_searched DESC
    LIMIT limit_n;
END;
$$;

GRANT EXECUTE ON FUNCTION get_hot_keywords(INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_hot_keywords(INTEGER) TO authenticated;


-- ============================================================
-- 6. clean_old_hot_words() — 定期清理过期热词
--    可用 pg_cron 定期执行：SELECT clean_old_hot_words();
-- ============================================================
CREATE OR REPLACE FUNCTION clean_old_hot_words()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_cnt INTEGER;
BEGIN
    DELETE FROM search_hot_words
    WHERE last_searched < NOW() - INTERVAL '90 days'
       OR search_count < 1;
    GET DIAGNOSTICS deleted_cnt = ROW_COUNT;
    RETURN deleted_cnt;
END;
$$;

GRANT EXECUTE ON FUNCTION clean_old_hot_words() TO authenticated;


-- ============================================================
-- 7. safe_hot_words 视图（兼容旧查询，保留只读权限）
-- ============================================================
CREATE OR REPLACE VIEW safe_hot_words AS
SELECT keyword, search_count, last_searched
FROM search_hot_words
WHERE search_count > 0
  AND last_searched >= NOW() - INTERVAL '90 days'
  AND length(keyword) BETWEEN 2 AND 50
ORDER BY search_count DESC, last_searched DESC
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
