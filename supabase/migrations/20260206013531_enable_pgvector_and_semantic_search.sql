/*
  # Enable pgvector and Semantic Search Infrastructure

  1. Extensions
    - Enable `vector` extension for embedding storage and similarity search

  2. New Tables
    - `post_embeddings`
      - `id` (uuid, primary key)
      - `reddit_post_id` (uuid, references reddit_posts)
      - `user_id` (uuid, references auth.users)
      - `embedding` (vector(384), for gte-small model output)
      - `content_hash` (text, for dedup)
      - `created_at` (timestamptz)

  3. Indexes
    - HNSW index on embedding column for fast cosine similarity search
    - Unique constraint on (reddit_post_id) to prevent duplicate embeddings

  4. Functions
    - `match_posts_semantic` - performs cosine similarity search against stored embeddings

  5. Security
    - Enable RLS on `post_embeddings`
    - Authenticated users can read their own embeddings
    - Service role handles inserts via edge functions
*/

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS post_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reddit_post_id uuid NOT NULL REFERENCES reddit_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  embedding extensions.vector(384) NOT NULL,
  content_hash text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_post_embeddings_post_id
  ON post_embeddings(reddit_post_id);

CREATE INDEX IF NOT EXISTS idx_post_embeddings_hnsw
  ON post_embeddings USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_post_embeddings_user_id
  ON post_embeddings(user_id);

ALTER TABLE post_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own post embeddings"
  ON post_embeddings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert post embeddings"
  ON post_embeddings
  FOR INSERT
  TO service_role
  WITH CHECK (true);

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
  WHERE
    (p_user_id IS NULL OR pe.user_id = p_user_id)
    AND 1 - (pe.embedding <=> query_embedding) > match_threshold
  ORDER BY pe.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
