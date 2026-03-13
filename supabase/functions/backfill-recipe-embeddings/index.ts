// One-time admin utility: generate and store embeddings for all recipes that
// don't have one yet.  Invoke manually via:
//   curl -X POST https://<project>.supabase.co/functions/v1/backfill-recipe-embeddings \
//        -H "Authorization: Bearer <service_role_key>"
//
// Processes recipes in batches of 50. Safe to re-run (skips already-embedded).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import OpenAI from "https://esm.sh/openai@4.20.1";
import { generateRecipeEmbeddingsBatch } from "../_shared/dedup.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 50;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const openai = new OpenAI({ apiKey: openaiApiKey });

  let totalProcessed = 0;
  let totalSkipped = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: recipes, error } = await supabase
      .from("recipe")
      .select("id, title, ingredients")
      .is("embedding", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (error) {
      console.error("[backfill] fetch error", error);
      return new Response(JSON.stringify({ error: "Failed to fetch recipes", detail: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!recipes || recipes.length === 0) {
      hasMore = false;
      break;
    }

    const recipeInputs = recipes.map((r) => ({
      title: r.title || "",
      ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
    }));

    let embeddings: number[][];
    try {
      embeddings = await generateRecipeEmbeddingsBatch(openai, recipeInputs);
    } catch (embErr) {
      console.error("[backfill] embedding generation failed", embErr);
      return new Response(
        JSON.stringify({
          error: "Embedding generation failed",
          processed_so_far: totalProcessed,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    for (let i = 0; i < recipes.length; i++) {
      const embeddingStr = `[${embeddings[i].join(",")}]`;
      const { error: updateErr } = await supabase
        .from("recipe")
        .update({ embedding: embeddingStr })
        .eq("id", recipes[i].id);

      if (updateErr) {
        console.error("[backfill] update error", { recipeId: recipes[i].id, error: updateErr });
        totalSkipped++;
      } else {
        totalProcessed++;
      }
    }

    console.log("[backfill] batch complete", {
      batchSize: recipes.length,
      totalProcessed,
      totalSkipped,
    });

    if (recipes.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  console.log("[backfill] done", { totalProcessed, totalSkipped });

  return new Response(
    JSON.stringify({
      success: true,
      processed: totalProcessed,
      skipped: totalSkipped,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
