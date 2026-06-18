-- 从 app_events 聚合搜索热词，写入 search_hot_words 表
INSERT INTO search_hot_words (keyword, search_count, updated_at)
SELECT
  keyword,
  COUNT(*) AS search_count,
  NOW() AS updated_at
FROM app_events
WHERE event_type = 'search'
  AND keyword IS NOT NULL
  AND keyword != ''
GROUP BY keyword
ON CONFLICT (keyword)
DO UPDATE SET
  search_count = EXCLUDED.search_count,
  updated_at   = EXCLUDED.updated_at;