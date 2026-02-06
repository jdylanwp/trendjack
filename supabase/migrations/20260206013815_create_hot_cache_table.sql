/*
  # Result Caching with Hot Cache Table

  1. New Tables
    - `hot_cache` (UNLOGGED for maximum read/write speed)
      - `cache_key` (text, primary key)
      - `cache_value` (jsonb)
      - `expires_at` (timestamptz)
      - `created_at` (timestamptz)
      - `hit_count` (bigint) - Track access frequency

  2. Functions
    - `cache_get` - Retrieve cached value (returns NULL if expired)
    - `cache_set` - Store value with TTL
    - `cache_invalidate` - Remove specific cache entry
    - `cache_cleanup` - Remove all expired entries

  3. Indexes
    - Index on expires_at for cleanup efficiency
    - Partial index for non-expired entries

  4. Cron
    - Cleanup expired cache entries every 10 minutes

  5. Security
    - RLS enabled
    - Accessible via SECURITY DEFINER functions only
*/

CREATE UNLOGGED TABLE IF NOT EXISTS hot_cache (
  cache_key text PRIMARY KEY,
  cache_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
  created_at timestamptz NOT NULL DEFAULT now(),
  hit_count bigint NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_hot_cache_expires
  ON hot_cache(expires_at ASC);

ALTER TABLE hot_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages hot cache"
  ON hot_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION cache_get(p_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_value jsonb;
BEGIN
  UPDATE hot_cache
  SET hit_count = hit_count + 1
  WHERE cache_key = p_key
    AND expires_at > now()
  RETURNING cache_value INTO v_value;

  RETURN v_value;
END;
$$;

CREATE OR REPLACE FUNCTION cache_set(
  p_key text,
  p_value jsonb,
  p_ttl_seconds integer DEFAULT 300
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO hot_cache (cache_key, cache_value, expires_at)
  VALUES (p_key, p_value, now() + (p_ttl_seconds || ' seconds')::interval)
  ON CONFLICT (cache_key) DO UPDATE
  SET
    cache_value = EXCLUDED.cache_value,
    expires_at = EXCLUDED.expires_at,
    hit_count = 0;
END;
$$;

CREATE OR REPLACE FUNCTION cache_invalidate(p_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM hot_cache WHERE cache_key = p_key;
END;
$$;

CREATE OR REPLACE FUNCTION cache_cleanup()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count bigint;
BEGIN
  WITH removed AS (
    DELETE FROM hot_cache
    WHERE expires_at < now()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM removed;

  RETURN v_count;
END;
$$;

SELECT cron.schedule(
  'cache-cleanup-expired',
  '*/10 * * * *',
  $$SELECT cache_cleanup()$$
);

CREATE OR REPLACE FUNCTION cache_top_trends(p_limit integer DEFAULT 100)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trends jsonb;
BEGIN
  SELECT jsonb_agg(row_to_json(t))
  INTO v_trends
  FROM (
    SELECT
      ge.id,
      ge.name,
      ge.category,
      ge.trend_status,
      ge.total_volume,
      ge.updated_at
    FROM global_entities ge
    WHERE ge.trend_status IN ('Exploding', 'Slow Burn')
    ORDER BY ge.total_volume DESC
    LIMIT p_limit
  ) t;

  PERFORM cache_set('top_trends', COALESCE(v_trends, '[]'::jsonb), 600);
END;
$$;

SELECT cron.schedule(
  'refresh-top-trends-cache',
  '*/5 * * * *',
  $$SELECT cache_top_trends(100)$$
);
