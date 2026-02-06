/*
  # Atomic Entity Mention Increment

  1. New Functions
    - `increment_entity_mention` - Atomically inserts or increments mention_count
      for a given entity, date, and source using ON CONFLICT DO UPDATE.
      Eliminates the overwrite bug where mention_count was always reset to 1.

    - `increment_entity_counters` - Atomically increments volume_24h and
      total_mentions on the global_entities table using SQL arithmetic,
      eliminating the read-modify-write race condition.

  2. Bug Fixes
    - Fixes "flat line at 1" bug: mention_count now correctly accumulates
    - Fixes race condition: concurrent extractions no longer lose counts
*/

CREATE OR REPLACE FUNCTION increment_entity_mention(
  p_entity_id uuid,
  p_date date,
  p_source text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO entity_mentions (global_entity_id, mention_date, source, mention_count)
  VALUES (p_entity_id, p_date, p_source, 1)
  ON CONFLICT (global_entity_id, mention_date, source)
  DO UPDATE SET mention_count = entity_mentions.mention_count + 1;
END;
$$;

CREATE OR REPLACE FUNCTION increment_entity_counters(
  p_entity_id uuid,
  p_category text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE global_entities
  SET
    volume_24h = volume_24h + 1,
    total_mentions = total_mentions + 1,
    last_analyzed_at = now(),
    category = p_category
  WHERE id = p_entity_id;
END;
$$;
