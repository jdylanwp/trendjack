/*
  # Materialized Views for Dashboard Analytics

  1. New Materialized Views
    - `mv_dashboard_stats` - Pre-aggregated dashboard statistics per user
      - `user_id`, `total_keywords`, `trending_count`, `avg_heat_score`
      - `total_leads`, `avg_intent_score`, `avg_fury_score`, `red_zone_count`
      - `refreshed_at`

    - `mv_keyword_trend_summary` - Pre-aggregated keyword trend data
      - `keyword_id`, `user_id`, `keyword`, `related_subreddit`
      - `latest_heat_score`, `latest_z_score`, `is_trending`, `calculated_at`

  2. Indexes
    - Unique index on user_id for mv_dashboard_stats
    - Unique index on keyword_id for mv_keyword_trend_summary

  3. Functions
    - `refresh_dashboard_views` - Refreshes both materialized views concurrently
    - `get_dashboard_stats` - Secure accessor for per-user dashboard stats

  4. Cron
    - Scheduled refresh every 5 minutes
*/

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_stats AS
SELECT
  mk.user_id,
  COUNT(DISTINCT mk.id) AS total_keywords,
  COUNT(DISTINCT CASE WHEN ts.is_trending = true THEN ts.keyword_id END) AS trending_count,
  COALESCE(ROUND(AVG(ts.heat_score)::numeric, 1), 0) AS avg_heat_score,
  COUNT(DISTINCT l.id) AS total_leads,
  COALESCE(ROUND(AVG(l.intent_score)::numeric, 0), 0) AS avg_intent_score,
  COALESCE(ROUND(AVG(l.fury_score)::numeric, 0), 0) AS avg_fury_score,
  COUNT(DISTINCT CASE
    WHEN l.intent_score >= 85 AND COALESCE(l.fury_score, 0) >= 75 THEN l.id
  END) AS red_zone_count,
  now() AS refreshed_at
FROM monitored_keywords mk
LEFT JOIN LATERAL (
  SELECT ts2.keyword_id, ts2.heat_score, ts2.is_trending
  FROM trend_scores ts2
  WHERE ts2.keyword_id = mk.id
  ORDER BY ts2.calculated_at DESC
  LIMIT 1
) ts ON true
LEFT JOIN leads l ON l.user_id = mk.user_id
WHERE mk.enabled = true
GROUP BY mk.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dashboard_stats_user_id
  ON mv_dashboard_stats(user_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_keyword_trend_summary AS
SELECT DISTINCT ON (ts.keyword_id)
  ts.keyword_id,
  mk.user_id,
  mk.keyword,
  mk.related_subreddit,
  ts.heat_score AS latest_heat_score,
  ts.z_score AS latest_z_score,
  ts.is_trending,
  ts.calculated_at
FROM trend_scores ts
JOIN monitored_keywords mk ON mk.id = ts.keyword_id
WHERE mk.enabled = true
ORDER BY ts.keyword_id, ts.calculated_at DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_keyword_trend_keyword_id
  ON mv_keyword_trend_summary(keyword_id);

CREATE INDEX IF NOT EXISTS idx_mv_keyword_trend_user_id
  ON mv_keyword_trend_summary(user_id);

CREATE OR REPLACE FUNCTION refresh_dashboard_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_keyword_trend_summary;
END;
$$;

CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id uuid)
RETURNS TABLE (
  total_keywords bigint,
  trending_count bigint,
  avg_heat_score numeric,
  total_leads bigint,
  avg_intent_score numeric,
  avg_fury_score numeric,
  red_zone_count bigint,
  refreshed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ds.total_keywords,
    ds.trending_count,
    ds.avg_heat_score,
    ds.total_leads,
    ds.avg_intent_score,
    ds.avg_fury_score,
    ds.red_zone_count,
    ds.refreshed_at
  FROM mv_dashboard_stats ds
  WHERE ds.user_id = p_user_id;
END;
$$;

SELECT cron.schedule(
  'refresh-dashboard-views',
  '*/5 * * * *',
  $$SELECT refresh_dashboard_views()$$
);
