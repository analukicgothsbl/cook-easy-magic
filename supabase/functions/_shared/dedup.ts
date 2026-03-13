// Shared recipe deduplication helpers used by generate-recipe and
// generate-meal-planner-day edge functions.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import type OpenAI from "https://esm.sh/openai@4.20.1";

// ─── Thresholds ──────────────────────────────────────────────────────────────
export const GLOBAL_REUSE_THRESHOLD = 0.92;
export const USER_WARNING_THRESHOLD = 0.85;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SimilarRecipeMatch {
  recipe_id: string;
  recipe_title: string;
  similarity: number;
  is_owned_by_user: boolean;
}

export interface DedupResult {
  /** Best global match above GLOBAL_REUSE_THRESHOLD — reuse this recipe row. */
  globalMatch: SimilarRecipeMatch | null;
  /** Matches the user already owns above USER_WARNING_THRESHOLD. */
  userMatches: SimilarRecipeMatch[];
  /** The embedding vector so callers can store it with a new recipe. */
  embedding: number[];
}

interface Ingredient {
  name: string;
  quantity?: string;
  unit?: string;
}

// ─── Embedding generation ────────────────────────────────────────────────────

function buildEmbeddingText(title: string, ingredients: (string | Ingredient)[]): string {
  const names = ingredients.map((ing) => {
    if (typeof ing === "string") return ing.trim();
    if (ing && typeof ing === "object" && "name" in ing) return (ing as Ingredient).name.trim();
    return "";
  }).filter(Boolean);

  return `${title.trim()}. Ingredients: ${names.join(", ")}`;
}

/**
 * Generate a 1536-dim embedding for the given recipe title + ingredients.
 * Returns the raw float array.
 */
export async function generateRecipeEmbedding(
  openai: OpenAI,
  title: string,
  ingredients: (string | Ingredient)[],
): Promise<number[]> {
  const text = buildEmbeddingText(title, ingredients);
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * Batch-generate embeddings for multiple recipes in a single API call.
 * Returns an array of float arrays in the same order as the input.
 */
export async function generateRecipeEmbeddingsBatch(
  openai: OpenAI,
  recipes: { title: string; ingredients: (string | Ingredient)[] }[],
): Promise<number[][]> {
  if (recipes.length === 0) return [];

  const texts = recipes.map((r) => buildEmbeddingText(r.title, r.ingredients));
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });

  // The API may return results out of order; sort by index.
  const sorted = response.data.sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}

// ─── Similarity search ──────────────────────────────────────────────────────

/**
 * Format the embedding as a pgvector-compatible string literal: "[0.1,0.2,…]"
 */
function embeddingToVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * Find recipes in the database that are semantically similar to the given
 * embedding. Returns a structured result that tells callers whether to
 * reuse an existing recipe or warn the user.
 */
export async function findSimilarRecipes(
  supabase: SupabaseClient,
  embedding: number[],
  userId: string | null,
): Promise<{ globalMatch: SimilarRecipeMatch | null; userMatches: SimilarRecipeMatch[] }> {
  const { data, error } = await supabase.rpc("match_similar_recipes", {
    p_embedding: embeddingToVector(embedding),
    p_threshold: USER_WARNING_THRESHOLD,
    p_limit: 10,
    p_user_id: userId,
  });

  if (error) {
    console.error("[dedup] match_similar_recipes RPC error", error);
    return { globalMatch: null, userMatches: [] };
  }

  const matches: SimilarRecipeMatch[] = (data || []).map((row: Record<string, unknown>) => ({
    recipe_id: row.recipe_id as string,
    recipe_title: row.recipe_title as string,
    similarity: row.similarity as number,
    is_owned_by_user: row.is_owned_by_user as boolean,
  }));

  // Best global match above reuse threshold (any recipe, regardless of ownership).
  const globalMatch = matches.find((m) => m.similarity >= GLOBAL_REUSE_THRESHOLD) ?? null;

  // Matches the user already owns (for duplicate warning).
  const userMatches = userId
    ? matches.filter((m) => m.is_owned_by_user && m.similarity >= USER_WARNING_THRESHOLD)
    : [];

  return { globalMatch, userMatches };
}

/**
 * Full dedup pipeline: generate embedding → search → return result.
 */
export async function checkRecipeDuplicate(
  openai: OpenAI,
  supabase: SupabaseClient,
  title: string,
  ingredients: (string | Ingredient)[],
  userId: string | null,
): Promise<DedupResult> {
  const embedding = await generateRecipeEmbedding(openai, title, ingredients);
  const { globalMatch, userMatches } = await findSimilarRecipes(supabase, embedding, userId);

  console.log("[dedup] result", {
    title,
    globalMatch: globalMatch
      ? { id: globalMatch.recipe_id, title: globalMatch.recipe_title, sim: globalMatch.similarity }
      : null,
    userMatchCount: userMatches.length,
  });

  return { globalMatch, userMatches, embedding };
}
