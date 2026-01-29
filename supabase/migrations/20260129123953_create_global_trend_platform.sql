/*
  # Global Trend Platform Architecture

  1. New Tables
    - `global_entities`: Central table for all discovered trends across users
      - Aggregates mentions from all users anonymously
      - Tracks both "exploding" (sudden spikes) and "slow burn" (steady growth) trends
      - Calculates growth slopes over 30-day windows
    - `entity_trackers`: Links users to entities they're personally watching
      - Enables personalized leaderboard with "watching" badges
      - Allows users to add custom entities to track
    - `entity_mentions`: Time-series data for trend analysis
      - Tracks daily mention volumes for slope calculations
      - Powers both spike detection and slow burn analysis

  2. Security
    - global_entities: Public read, system writes only
    - entity_trackers: Users can manage their own tracking list
    - entity_mentions: Public read, system writes only

  3. Features Enabled
    - Global trend leaderboard visible to all users
    - Personalized view with badges for tracked entities
    - Crowdsourced trend discovery (all users contribute)
    - Multi-timeframe analysis (24h spikes + 30d slopes)
*/

-- 1. Central table for global trends (The "Global Brain")
CREATE TABLE IF NOT EXISTS global_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_name text UNIQUE NOT NULL,
  category text DEFAULT 'General',
  
  -- Exploding Topics Metrics
  volume_24h int DEFAULT 0,
  volume_7d int DEFAULT 0,
  volume_30d int DEFAULT 0,
  
  -- Trend Classification
  z_score float DEFAULT 0, -- For spike detection
  growth_slope float DEFAULT 0, -- For slow burn detection
  trend_status text DEFAULT 'New', -- 'Exploding', 'Peaked', 'Slow Burn', 'Declining'
  
  -- Metadata
  first_seen_at timestamptz DEFAULT now(),
  last_analyzed_at timestamptz DEFAULT now(),
  total_mentions int DEFAULT 0,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. User tracking table (Personal "watching" list)
CREATE TABLE IF NOT EXISTS entity_trackers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  global_entity_id uuid REFERENCES global_entities(id) ON DELETE CASCADE,
  is_custom boolean DEFAULT false, -- True if user added it manually
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, global_entity_id)
);

-- 3. Time-series data for trend analysis
CREATE TABLE IF NOT EXISTS entity_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  global_entity_id uuid REFERENCES global_entities(id) ON DELETE CASCADE,
  mention_date date NOT NULL,
  mention_count int DEFAULT 1,
  source text, -- 'reddit', 'news', 'google_trends'
  created_at timestamptz DEFAULT now(),
  UNIQUE(global_entity_id, mention_date, source)
);

-- Enable RLS
ALTER TABLE global_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_mentions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for global_entities (Public read, system write)
CREATE POLICY "Anyone can view global trends"
  ON global_entities FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for entity_trackers (Users manage their own)
CREATE POLICY "Users can view own tracked entities"
  ON entity_trackers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can track entities"
  ON entity_trackers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can untrack entities"
  ON entity_trackers FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for entity_mentions (Public read, system write)
CREATE POLICY "Anyone can view entity mentions"
  ON entity_mentions FOR SELECT
  TO authenticated
  USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_global_entities_status ON global_entities(trend_status);
CREATE INDEX IF NOT EXISTS idx_global_entities_growth ON global_entities(growth_slope DESC);
CREATE INDEX IF NOT EXISTS idx_global_entities_zscore ON global_entities(z_score DESC);
CREATE INDEX IF NOT EXISTS idx_entity_trackers_user ON entity_trackers(user_id);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_entity_date ON entity_mentions(global_entity_id, mention_date DESC);

-- Function to update entity timestamps
CREATE OR REPLACE FUNCTION update_global_entity_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_global_entities_timestamp
  BEFORE UPDATE ON global_entities
  FOR EACH ROW
  EXECUTE FUNCTION update_global_entity_timestamp();