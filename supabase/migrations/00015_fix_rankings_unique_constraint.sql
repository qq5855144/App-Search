-- ============================================================
-- 修复 app_rankings 唯一约束：从 (rank_type, period, app_id) 改为 (rank_type, period, owner, repo)
-- 原因：aggregate-rankings Edge Function 的 upsert onConflict 使用的是 (rank_type, period, owner, repo)
-- 但表实际约束是 (rank_type, period, app_id)，导致 upsert 失败
-- 改用 owner/repo 也更合理，因为 owner/repo 是稳定标识，app_id 可能为 null/0
-- ============================================================

-- 1. 删除旧的唯一约束
ALTER TABLE app_rankings DROP CONSTRAINT IF EXISTS app_rankings_unique;

-- 2. 删除可能存在的旧数据中 app_id=0 或 null 的重复行（保留最新的）
DELETE FROM app_rankings a
USING app_rankings b
WHERE a.id < b.id
  AND a.rank_type = b.rank_type
  AND a.period = b.period
  AND a.owner = b.owner
  AND a.repo = b.repo;

-- 3. 添加新的唯一约束：基于 (rank_type, period, owner, repo)
ALTER TABLE app_rankings ADD CONSTRAINT app_rankings_unique UNIQUE (rank_type, period, owner, repo);

-- 4. 确保索引存在
CREATE INDEX IF NOT EXISTS idx_app_rankings_type_period ON app_rankings(rank_type, period, rank_position);
CREATE INDEX IF NOT EXISTS idx_app_rankings_owner_repo ON app_rankings(owner, repo);