/*
  # Fix Embeddings Schema and Create Content Drafts Table

  1. Schema Changes
    - Make `post_embeddings.user_id` nullable since embeddings are per-post, not per-user.
      Reddit posts are shared resources; embeddings should be generated once and
      queried by any user whose keywords match.
    - Update the `match_posts_semantic` function to work without user_id filtering
      by default, or optionally filter by a join through keywords.

  2. New Tables
    - `content_drafts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `entity_id` (uuid, nullable, references global_entities)
      - `trend_keyword` (text) - the trend or keyword that triggered generation
      - `platform` (text) - 'linkedin', 'twitter', 'reddit'
      - `content_type` (text) - 'thought_leadership', 'hot_take', 'educational'
      - `title` (text)
      - `body` (text) - the generated content
      - `news_context` (text) - the news headlines that informed the content
      - `hook` (text) - the opening hook line
      - `cta` (text) - call to action
      - `status` (text) - 'draft', 'edited', 'published', 'archived'
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  3. Security
    - RLS on content_drafts
    - Users can CRUD their own drafts only
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'post_embeddings' AND column_name = 'user_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE post_embeddings ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION match_posts_semantic(
  query_embedding extensions.vector(384),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 20,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  reddit_post_id uuid,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pe.reddit_post_id,
    1 - (pe.embedding <=> query_embedding) AS similarity
  FROM post_embeddings pe
  WHERE 1 - (pe.embedding <=> query_embedding) > match_threshold
  ORDER BY pe.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE TABLE IF NOT EXISTS content_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES global_entities(id) ON DELETE SET NULL,
  trend_keyword text NOT NULL DEFAULT '',
  platform text NOT NULL DEFAULT 'linkedin' CHECK (platform IN ('linkedin', 'twitter', 'reddit')),
  content_type text NOT NULL DEFAULT 'thought_leadership' CHECK (content_type IN ('thought_leadership', 'hot_take', 'educational')),
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  news_context text NOT NULL DEFAULT '',
  hook text NOT NULL DEFAULT '',
  cta text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'edited', 'published', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_drafts_user_status
  ON content_drafts(user_id, status);

CREATE INDEX IF NOT EXISTS idx_content_drafts_created
  ON content_drafts(created_at DESC);

ALTER TABLE content_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own content drafts"
  ON content_drafts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own content drafts"
  ON content_drafts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own content drafts"
  ON content_drafts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own content drafts"
  ON content_drafts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages content drafts"
  ON content_drafts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE content_drafts;
