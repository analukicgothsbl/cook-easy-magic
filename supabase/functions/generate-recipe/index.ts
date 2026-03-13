import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import OpenAI from "https://esm.sh/openai@4.20.1";
import {
  checkRecipeDuplicate,
  type SimilarRecipeMatch,
} from "../_shared/dedup.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RecipePayload {
  ingredients: string[];
  meal_category: string | null;
  time_available: string | null;
  difficulty: string | null;
  cuisine: string | null;
  servings: number | null;
  budget_level: string | null;
  kids_friendly: boolean | null;
  guest_id: string | null;
  force_save?: boolean;
  recipe_to_save?: GeneratedRecipe;
  original_cost_usd?: number;
}

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
}

interface NutritionEstimate {
  calories: number;
  protein: string;
  carbs: string;
  fat: string;
}

interface GeneratedRecipe {
  title: string;
  description_short: string;
  description_long: string;
  meal_category: string;
  cuisine: string;
  time_minutes: number;
  difficulty: string;
  servings: number;
  budget_level: string;
  kids_friendly: boolean;
  ingredients: Ingredient[];
  instructions: string[];
  tips: string;
  nutrition_estimate: NutritionEstimate;
}

// -------------------- CREDIT COST (USD) from tokens --------------------
function calcCostUsd(inputTokens: number, outputTokens: number) {
  return inputTokens * 0.0015 + outputTokens * 0.0006;
}

// -------------------- FIXED MINIMUM CREDITS PRECHECK --------------------
const MIN_CREDITS_REQUIRED = 0.9;

type CreditSnapshot = {
  walletBalance: number;
  dailyBonus: number;
  bonusUsage: number;
  bonusRemaining: number;
  totalAvailable: number;
};

interface RecipeWithTitle {
  title: string;
}

function parseRecipeWithTitle(value: unknown): RecipeWithTitle | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return typeof record.title === "string" ? { title: record.title } : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;
    const CHAT_MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-4", "gpt-3.5-turbo"];
    const envModel = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
    const openaiModel = CHAT_MODELS.includes(envModel) ? envModel : "gpt-4o-mini";
    console.log("[openai] resolved model", { envModel, openaiModel });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // ------------------------------------------------------------------
    // Helper: read wallet+bonus ONCE (snapshot) for logged-in users
    // ------------------------------------------------------------------
    async function readCreditSnapshotOnce(userId: string): Promise<CreditSnapshot> {
      console.log("[credits] snapshot: start", { userId });

      const { data: wallet, error: walletErr } = await supabase
        .from("credit_wallet")
        .select("balance, daily_remaining")
        .eq("user_id", userId)
        .maybeSingle();

      if (walletErr || !wallet) {
        console.error("[credits] snapshot: credit_wallet read error", walletErr);
        throw new Error("Could not verify credit wallet");
      }

      const { data: bonus, error: bonusErr } = await supabase
        .from("credit_bonus")
        .select("daily_bonus, usage")
        .eq("user_id", userId)
        .maybeSingle();

      if (bonusErr) {
        console.error("[credits] snapshot: credit_bonus read error", bonusErr);
        throw new Error("Could not verify credit bonus");
      }

      const walletBalance = Number(wallet.balance ?? 0);
      const dailyBonus = Number(bonus?.daily_bonus ?? 1);
      const bonusUsage = Number(bonus?.usage ?? 0);
      const bonusRemaining = Math.max(0, dailyBonus - bonusUsage);
      const totalAvailable = walletBalance + bonusRemaining;

      console.log("[credits] snapshot: values", {
        userId, walletBalance, dailyBonus, bonusUsage, bonusRemaining, totalAvailable,
      });

      return { walletBalance, dailyBonus, bonusUsage, bonusRemaining, totalAvailable };
    }

    // -------------------- Parse request body --------------------
    const payload: RecipePayload = await req.json();
    console.log("[request] payload", payload);

    if (!payload.ingredients || payload.ingredients.length === 0) {
      return new Response(JSON.stringify({ error: "Ingredients are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------------------- Auth (logged in vs guest) --------------------
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error) console.error("[auth] getUser error:", error.message);
        if (user) userId = user.id;
      } catch (authErr) {
        console.error("[auth] exception:", authErr);
      }
    }

    // Guest mode logic
    if (!userId && payload.guest_id) {
      const { data: guestRecord, error: guestError } = await supabase
        .from("guest_recipe_allowance")
        .select("*")
        .eq("guest_id", payload.guest_id)
        .maybeSingle();

      if (guestError) {
        return new Response(JSON.stringify({ error: "Error checking guest allowance" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (guestRecord && guestRecord.used) {
        return new Response(JSON.stringify({ error: "Guest free generation already used" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (!userId && !payload.guest_id) {
      return new Response(JSON.stringify({ error: "Authentication required or guest_id must be provided" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ✅ CREDIT PRE-CHECK
    let creditSnapshot: CreditSnapshot | null = null;

    if (userId) {
      try {
        creditSnapshot = await readCreditSnapshotOnce(userId);
      } catch (e) {
        console.error("[credits] precheck snapshot error", e);
        return new Response(JSON.stringify({ error: "Could not verify credit balance" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (creditSnapshot.totalAvailable < MIN_CREDITS_REQUIRED) {
        return new Response(
          JSON.stringify({
            error: "INSUFFICIENT_CREDITS",
            min_required: MIN_CREDITS_REQUIRED,
            available: creditSnapshot.totalAvailable,
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // -------------------- recipe_to_save shortcut (force-save already-generated recipe) ---
    let recipe: GeneratedRecipe;
    let inputTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;
    let costUsd = 0;

    if (payload.force_save && payload.recipe_to_save) {
      recipe = payload.recipe_to_save;
      costUsd = payload.original_cost_usd ?? 0;
      console.log("[force_save] using recipe_to_save, skipping OpenAI", { title: recipe.title, costUsd });
    } else {
      // -------------------- Build prompts --------------------
      const cuisineLabel = payload.cuisine === "any_surprise_me" ? "any cuisine (surprise me)" : payload.cuisine;
      const timeLabel = payload.time_available === "minimum" ? "quick (under 20 minutes)" : "normal cooking time";
      const difficultyLabel = payload.difficulty || "any difficulty";
      const budgetLabel = payload.budget_level || "normal budget";
      const kidsFriendlyLabel = payload.kids_friendly ? "kid-friendly" : "for adults";

      // Fetch user's recent recipes to guide AI towards variety.
      let recentTitles: string[] = [];
      if (userId) {
        const { data: recentRecipes } = await supabase
          .from("recipe_user")
          .select("recipe_id, recipe:recipe_id(title)")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20);

        if (recentRecipes) {
          recentTitles = recentRecipes
            .map((row) => {
              if (!row || typeof row !== "object" || !("recipe" in row)) return null;
              const r = parseRecipeWithTitle((row as { recipe?: unknown }).recipe);
              return r?.title ?? null;
            })
            .filter((t): t is string => typeof t === "string" && t.length > 0);
        }
      }

      const avoidDuplicatesNote = recentTitles.length > 0
        ? `\n\nIMPORTANT: The user already has these recipes. Create something DIFFERENT (different title, different approach): ${recentTitles.slice(0, 10).join(", ")}`
        : "";

      const systemPrompt = `You are a professional chef and recipe creator. Generate a delicious, practical recipe based on the user's ingredients and preferences.

Respond ONLY with a valid JSON object (no markdown, no extra text) with this exact structure:
{
  "title": "Recipe Title",
  "description_short": "One sentence description",
  "description_long": "Detailed 2-3 sentence description",
  "meal_category": "${payload.meal_category || "lunch"}",
  "cuisine": "${cuisineLabel}",
  "time_minutes": 30,
  "difficulty": "${difficultyLabel}",
  "servings": ${payload.servings || 2},
  "budget_level": "${budgetLabel}",
  "kids_friendly": ${payload.kids_friendly || false},
  "ingredients": [
    {"name": "ingredient", "quantity": "2", "unit": "cups"}
  ],
  "instructions": [
    "Step 1...",
    "Step 2..."
  ],
  "tips": "Optional cooking tip",
  "nutrition_estimate": {
    "calories": 350,
    "protein": "25g",
    "carbs": "30g",
    "fat": "15g"
  }
}`;

      const userPrompt = `Create a ${payload.meal_category || "meal"} recipe using these ingredients: ${payload.ingredients.join(", ")}.

Preferences:
- Cuisine: ${cuisineLabel}
- Time available: ${timeLabel}
- Difficulty: ${difficultyLabel}
- Servings: ${payload.servings || 2}
- Budget: ${budgetLabel}
- ${kidsFriendlyLabel}

You may add common pantry staples (salt, pepper, oil, common spices) if needed, but focus on the provided ingredients.${avoidDuplicatesNote}`;

      // -------------------- Call OpenAI (recipe) --------------------
      console.log("[openai] recipe request start", { model: openaiModel });

      const completion = await openai.chat.completions.create({
        model: openaiModel,
        max_tokens: 2000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      });

      const responseText = completion.choices[0]?.message?.content || "";
      console.log("[openai] raw recipe response", responseText);

      // -------------------- Parse JSON response --------------------
      try {
        const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, "").trim();
        recipe = JSON.parse(cleanedResponse);
      } catch {
        console.error("[openai] failed to parse recipe JSON", responseText);
        return new Response(JSON.stringify({ error: "Failed to generate recipe. Please try again." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      inputTokens = completion.usage?.prompt_tokens || 0;
      outputTokens = completion.usage?.completion_tokens || 0;
      totalTokens = inputTokens + outputTokens;
      costUsd = calcCostUsd(inputTokens, outputTokens);

      console.log("[openai] usage", { inputTokens, outputTokens, totalTokens, costUsd });
    }

    // -------------------- EMBEDDING-BASED DUPLICATE DETECTION --------------------
    let dedupResult: Awaited<ReturnType<typeof checkRecipeDuplicate>> | null = null;
    try {
      dedupResult = await checkRecipeDuplicate(
        openai, supabase, recipe.title, recipe.ingredients, userId,
      );
    } catch (dedupErr) {
      console.error("[dedup] embedding dedup failed, proceeding without dedup", dedupErr);
    }

    const embeddingVector = dedupResult?.embedding ?? null;

    // Global reuse: a very similar recipe already exists in the DB.
    if (dedupResult?.globalMatch) {
      const match = dedupResult.globalMatch;
      console.log("[dedup] global reuse", { matchId: match.recipe_id, sim: match.similarity });

      if (userId) {
        // Link the existing recipe to this user and charge credits.
        const { data: rpcRecipeId, error: rpcError } = await supabase.rpc("create_recipe_and_charge", {
          p_user_id: userId,
          p_title: recipe.title,
          p_description_short: recipe.description_short,
          p_description_long: recipe.description_long,
          p_meal_category: payload.meal_category,
          p_cuisine: payload.cuisine,
          p_time_minutes: recipe.time_minutes,
          p_difficulty: recipe.difficulty || payload.difficulty,
          p_servings: recipe.servings,
          p_budget_level: payload.budget_level,
          p_kids_friendly: recipe.kids_friendly,
          p_ingredients_json: recipe.ingredients,
          p_instructions: Array.isArray(recipe.instructions) ? recipe.instructions.join("\n") : "",
          p_tips: recipe.tips,
          p_nutrition_estimate: recipe.nutrition_estimate,
          p_input_ingredients_json: payload.ingredients,
          p_input_tokens: inputTokens,
          p_output_tokens: outputTokens,
          p_total_tokens: totalTokens,
          p_cost_usd: costUsd,
          p_existing_recipe_id: match.recipe_id,
        });

        if (rpcError) {
          console.error("[db] reuse RPC failed", rpcError);
          return new Response(JSON.stringify({ error: "Failed to save recipe" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const reusedId = typeof rpcRecipeId === "string" ? rpcRecipeId : match.recipe_id;
        return new Response(
          JSON.stringify({
            recipe_id: reusedId,
            recipe: { ...recipe, id: reusedId },
            reused_existing: true,
            usage: { inputTokens, outputTokens, totalTokens, costUsd },
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } else {
        // Guest: reuse without inserting a new row.
        return new Response(
          JSON.stringify({
            recipe_id: match.recipe_id,
            recipe: { ...recipe, id: match.recipe_id },
            reused_existing: true,
            usage: { inputTokens, outputTokens, totalTokens, costUsd },
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Per-user duplicate warning (logged-in, not force_save).
    if (userId && !payload.force_save && dedupResult && dedupResult.userMatches.length > 0) {
      const similarRecipes = dedupResult.userMatches.slice(0, 3).map((m: SimilarRecipeMatch) => ({
        id: m.recipe_id,
        title: m.recipe_title,
        similarity: Math.round(m.similarity * 100),
      }));

      console.log("[dedup] per-user warning", similarRecipes);
      return new Response(
        JSON.stringify({
          duplicate_warning: true,
          similar_recipes: similarRecipes,
          recipe,
          usage: { inputTokens, outputTokens, totalTokens, costUsd },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // -------------------- No duplicate — save new recipe --------------------
    const instructionsText = Array.isArray(recipe.instructions) ? recipe.instructions.join("\n") : "";
    const embeddingStr = embeddingVector ? `[${embeddingVector.join(",")}]` : null;
    let recipeId: string | null = null;

    if (userId) {
      const { data: rpcRecipeId, error: rpcError } = await supabase.rpc("create_recipe_and_charge", {
        p_user_id: userId,
        p_title: recipe.title,
        p_description_short: recipe.description_short,
        p_description_long: recipe.description_long,
        p_meal_category: payload.meal_category,
        p_cuisine: payload.cuisine,
        p_time_minutes: recipe.time_minutes,
        p_difficulty: recipe.difficulty || payload.difficulty,
        p_servings: recipe.servings,
        p_budget_level: payload.budget_level,
        p_kids_friendly: recipe.kids_friendly,
        p_ingredients_json: recipe.ingredients,
        p_instructions: instructionsText,
        p_tips: recipe.tips,
        p_nutrition_estimate: recipe.nutrition_estimate,
        p_input_ingredients_json: payload.ingredients,
        p_input_tokens: inputTokens,
        p_output_tokens: outputTokens,
        p_total_tokens: totalTokens,
        p_cost_usd: costUsd,
        p_embedding: embeddingStr,
      });

      if (rpcError) {
        console.error("[db] atomic create+charge RPC failed", rpcError);
        const msg = String(rpcError.message || "");

        if (msg.includes("INSUFFICIENT_CREDITS")) {
          return new Response(
            JSON.stringify({ error: "INSUFFICIENT_CREDITS" }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        if (msg.includes("CREDIT_WALLET_NOT_FOUND")) {
          return new Response(
            JSON.stringify({ error: "Could not verify credit wallet" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({ error: "Failed to save recipe and process credits atomically" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      recipeId = typeof rpcRecipeId === "string" ? rpcRecipeId : null;
      if (!recipeId) {
        console.error("[db] atomic create+charge RPC returned invalid recipe id", rpcRecipeId);
        return new Response(
          JSON.stringify({ error: "Failed to save recipe and process credits atomically" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      console.log("[db] recipe saved and charged atomically", { recipeId, userId });
    } else {
      // Guests: save recipe only (no credit charge), with embedding.
      const insertPayload: Record<string, unknown> = {
        title: recipe.title,
        description_short: recipe.description_short,
        description_long: recipe.description_long,
        meal_category: payload.meal_category,
        cuisine: payload.cuisine,
        time_minutes: recipe.time_minutes,
        difficulty: recipe.difficulty || payload.difficulty,
        servings: recipe.servings,
        budget_level: payload.budget_level,
        kids_friendly: recipe.kids_friendly,
        ingredients: recipe.ingredients,
        instructions: instructionsText,
        tips: recipe.tips,
        nutrition_estimate: recipe.nutrition_estimate,
        input_ingredients: payload.ingredients,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        cost_usd: costUsd,
      };
      if (embeddingStr) {
        insertPayload.embedding = embeddingStr;
      }

      const { data: insertedRecipe, error: insertError } = await supabase
        .from("recipe")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertError) {
        console.error("[db] error inserting guest recipe", insertError);
        return new Response(JSON.stringify({ error: "Failed to save recipe" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      recipeId = insertedRecipe.id;
      console.log("[db] guest recipe saved", { recipeId });
    }

    // -------------------- Guest: mark as used --------------------
    if (!userId && payload.guest_id) {
      const { data: existingGuest } = await supabase
        .from("guest_recipe_allowance")
        .select("guest_id")
        .eq("guest_id", payload.guest_id)
        .maybeSingle();

      if (existingGuest) {
        await supabase
          .from("guest_recipe_allowance")
          .update({ used: true, first_used_at: new Date().toISOString(), last_payload: payload })
          .eq("guest_id", payload.guest_id);
      } else {
        await supabase.from("guest_recipe_allowance").insert({
          guest_id: payload.guest_id, used: true,
          first_used_at: new Date().toISOString(), last_payload: payload,
        });
      }
    }

    // -------------------- Return response --------------------
    return new Response(
      JSON.stringify({
        recipe_id: recipeId,
        recipe: { ...recipe, id: recipeId },
        usage: { inputTokens, outputTokens, totalTokens, costUsd },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[fatal] unexpected error", error);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

