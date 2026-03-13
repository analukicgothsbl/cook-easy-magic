-- Enable pgvector extension for semantic similarity search on recipe embeddings.
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Store the embedding vector alongside each recipe.
ALTER TABLE public.recipe ADD COLUMN embedding vector(1536);

-- HNSW index for fast cosine-similarity lookups.
CREATE INDEX idx_recipe_embedding_hnsw
  ON public.recipe USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Find recipes similar to a given embedding vector.
-- Returns matches above the cosine-similarity threshold, annotated with
-- whether the querying user already owns each recipe.
CREATE OR REPLACE FUNCTION public.match_similar_recipes(
  p_embedding     vector(1536),
  p_threshold     FLOAT   DEFAULT 0.92,
  p_limit         INT     DEFAULT 5,
  p_user_id       UUID    DEFAULT NULL
)
RETURNS TABLE(
  recipe_id         UUID,
  recipe_title      TEXT,
  similarity        FLOAT,
  is_owned_by_user  BOOLEAN
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    r.id,
    r.title,
    (1 - (r.embedding <=> p_embedding))::FLOAT AS similarity,
    CASE
      WHEN p_user_id IS NOT NULL
        THEN EXISTS(
          SELECT 1 FROM recipe_user ru
          WHERE ru.recipe_id = r.id AND ru.user_id = p_user_id
        )
      ELSE FALSE
    END AS is_owned_by_user
  FROM recipe r
  WHERE r.embedding IS NOT NULL
    AND (1 - (r.embedding <=> p_embedding)) >= p_threshold
  ORDER BY r.embedding <=> p_embedding
  LIMIT p_limit;
$$;

-- Allow service_role (edge functions) to call this function.
REVOKE ALL ON FUNCTION public.match_similar_recipes(vector, FLOAT, INT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_similar_recipes(vector, FLOAT, INT, UUID) TO service_role;
