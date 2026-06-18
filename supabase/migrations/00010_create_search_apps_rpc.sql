
-- 服务端搜索函数：绕开客户端 URL 编码问题，纯 SQL 执行
-- latest_version IS NOT NULL 确保只返回有安装包的项目
CREATE OR REPLACE FUNCTION search_apps(q text, lim int DEFAULT 30)
RETURNS SETOF app_catalog
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT * FROM app_catalog
  WHERE
    archived = false
    AND latest_version IS NOT NULL
    AND (
      name        ILIKE '%' || q || '%'
      OR repo     ILIKE '%' || q || '%'
      OR full_name ILIKE '%' || q || '%'
      OR description ILIKE '%' || q || '%'
      OR owner    ILIKE '%' || q || '%'
    )
  ORDER BY stars DESC
  LIMIT lim;
$$;

-- 允许匿名用户调用
GRANT EXECUTE ON FUNCTION search_apps(text, int) TO anon, authenticated;
