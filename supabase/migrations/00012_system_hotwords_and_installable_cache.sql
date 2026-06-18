
-- ============================================================
-- 1. repo_installable_cache：全局共享安装包状态缓存
--    首次查询后缓存结果，后续用户无需重复调用 GitHub API
-- ============================================================
CREATE TABLE IF NOT EXISTS repo_installable_cache (
  owner            text        NOT NULL,
  repo             text        NOT NULL,
  has_release      boolean     NOT NULL,
  latest_version   text,
  latest_release_date timestamptz,
  total_downloads  bigint      DEFAULT 0,
  platforms        text[]      DEFAULT '{}',
  checked_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner, repo)
);

CREATE INDEX IF NOT EXISTS idx_repo_installable_has_release
  ON repo_installable_cache (has_release, checked_at DESC);

-- 允许匿名用户读取（共享缓存），只有服务端（service_role）可写
ALTER TABLE repo_installable_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_anon_read_installable_cache"
  ON repo_installable_cache FOR SELECT
  USING (true);

-- 注：INSERT/UPDATE 由 github-proxy Edge Function 使用 service_role key 完成

-- ============================================================
-- 2. 热搜词触发器：每次 app_events INSERT 搜索事件时自动聚合
--    过滤 blocked_keywords，标准化（小写+trim）后写入 search_hot_words
-- ============================================================

-- 触发器函数
CREATE OR REPLACE FUNCTION trg_fn_search_event_to_hot_words()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kw text;
BEGIN
  -- 只处理搜索事件且关键词有效
  IF NEW.event_type <> 'search' OR NEW.keyword IS NULL THEN
    RETURN NEW;
  END IF;

  v_kw := lower(trim(NEW.keyword));

  -- 过滤空、超短（<2字符）、超长（>50字符）词
  IF length(v_kw) < 2 OR length(v_kw) > 50 THEN
    RETURN NEW;
  END IF;

  -- 过滤屏蔽词（精确或包含匹配）
  IF EXISTS (
    SELECT 1 FROM blocked_keywords
    WHERE v_kw = lower(trim(keyword))
       OR v_kw LIKE '%' || lower(trim(keyword)) || '%'
  ) THEN
    RETURN NEW;
  END IF;

  -- 原子性 upsert：计数+1
  INSERT INTO search_hot_words (keyword, search_count, updated_at)
  VALUES (v_kw, 1, now())
  ON CONFLICT (keyword)
  DO UPDATE SET
    search_count = search_hot_words.search_count + 1,
    updated_at   = now();

  RETURN NEW;
END;
$$;

-- 绑定触发器到 app_events
DROP TRIGGER IF EXISTS on_search_event_aggregate ON app_events;
CREATE TRIGGER on_search_event_aggregate
  AFTER INSERT ON app_events
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_search_event_to_hot_words();

-- ============================================================
-- 3. 重建 get_hot_keywords RPC：
--    读 search_hot_words（已聚合索引表），速度从全表扫描 O(n)
--    降为索引读 O(1)，前20条排行结果
-- ============================================================
CREATE OR REPLACE FUNCTION get_hot_keywords(limit_n int DEFAULT 20)
RETURNS TABLE(keyword text, cnt bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT keyword, search_count::bigint AS cnt
  FROM search_hot_words
  ORDER BY search_count DESC, updated_at DESC
  LIMIT limit_n;
$$;

-- search_hot_words 加索引确保排序快
CREATE INDEX IF NOT EXISTS idx_search_hot_words_count
  ON search_hot_words (search_count DESC, updated_at DESC);

-- ============================================================
-- 4. search_hot_words RLS（匿名可读，只有触发器可写）
-- ============================================================
ALTER TABLE search_hot_words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_anon_read_hot_words"
  ON search_hot_words FOR SELECT
  USING (true);
