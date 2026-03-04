import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import OpenAI from "https://esm.sh/openai@4.20.1";

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
  force_save?: boolean; // skip duplicate check when user confirms
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

// -------------------- DUPLICATE DETECTION HELPERS --------------------

/** Normalize a string for comparison: lowercase, trim, remove extra spaces */
function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Simple title similarity using word overlap (Jaccard-like) */
function titleSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalize(a).split(" ").filter(w => w.length > 2));
  const wordsB = new Set(normalize(b).split(" ").filter(w => w.length > 2));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}

/** Extract ingredient names from a recipe's ingredients array */
function extractIngredientNames(ingredients: unknown[]): Set<string> {
  const names = new Set<string>();
  for (const ing of ingredients) {
    if (typeof ing === "string") {
      names.add(normalize(ing));
    } else if (ing && typeof ing === "object" && "name" in ing) {
      names.add(normalize((ing as { name: string }).name));
    }
  }
  return names;
}

/** Ingredient overlap ratio (Jaccard) */
function ingredientOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const name of a) {
    if (b.has(name)) intersection++;
  }
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

interface SimilarRecipe {
  id: string;
  title: string;
  title_similarity: number;
  ingredient_overlap: number;
}

interface RecipeWithTitle {
  title: string;
}

interface ExistingRecipeForSimilarity {
  id: string;
  title: string;
  ingredients: unknown[];
}

function parseRecipeWithTitle(value: unknown): RecipeWithTitle | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return typeof record.title === "string" ? { title: record.title } : null;
}

function parseExistingRecipeForSimilarity(value: unknown): ExistingRecipeForSimilarity | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.title !== "string") {
    return null;
  }

  return {
    id: record.id,
    title: record.title,
    ingredients: Array.isArray(record.ingredients) ? record.ingredients : [],
  };
}

// Thresholds
const TITLE_SIMILARITY_THRESHOLD = 0.6;
const INGREDIENT_OVERLAP_THRESHOLD = 0.7;

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

    // -------------------- Build prompts --------------------
    const cuisineLabel = payload.cuisine === "any_surprise_me" ? "any cuisine (surprise me)" : payload.cuisine;
    const timeLabel = payload.time_available === "minimum" ? "quick (under 20 minutes)" : "normal cooking time";
    const difficultyLabel = payload.difficulty || "any difficulty";
    const budgetLabel = payload.budget_level || "normal budget";
    const kidsFriendlyLabel = payload.kids_friendly ? "kid-friendly" : "for adults";

    // -------------------- Fetch user's recent recipes to guide AI --------------------
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
            const recipe = parseRecipeWithTitle((row as { recipe?: unknown }).recipe);
            return recipe?.title ?? null;
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
      temperature: 0.7, // slightly higher for more variety
    });

    const responseText = completion.choices[0]?.message?.content || "";
    console.log("[openai] raw recipe response", responseText);

    // -------------------- Parse JSON response --------------------
    let recipe: GeneratedRecipe;
    try {
      const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, "").trim();
      recipe = JSON.parse(cleanedResponse);
    } catch {
      console.error("[openai] failed to parse recipe JSON", responseText);
      return new Response(JSON.stringify({ error: "Failed to generate recipe. Please try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------------------- Token usage and USD cost --------------------
    const inputTokens = completion.usage?.prompt_tokens || 0;
    const outputTokens = completion.usage?.completion_tokens || 0;
    const totalTokens = inputTokens + outputTokens;
    const costUsd = calcCostUsd(inputTokens, outputTokens);

    console.log("[openai] usage", { inputTokens, outputTokens, totalTokens, costUsd });

    // -------------------- DUPLICATE DETECTION (for logged-in users) --------------------
    if (userId && !payload.force_save) {
      // Fetch user's existing recipes for comparison
      const { data: userRecipes } = await supabase
        .from("recipe_user")
        .select("recipe_id, recipe:recipe_id(id, title, ingredients)")
        .eq("user_id", userId);

      if (userRecipes && userRecipes.length > 0) {
        const newIngredientNames = extractIngredientNames(recipe.ingredients || []);
        const similarRecipes: SimilarRecipe[] = [];

        for (const row of userRecipes) {
          if (!row || typeof row !== "object" || !("recipe" in row)) continue;
          const existing = parseExistingRecipeForSimilarity((row as { recipe?: unknown }).recipe);
          if (!existing) continue;

          const tSim = titleSimilarity(recipe.title, existing.title);
          const existingIngNames = extractIngredientNames(existing.ingredients);
          const iOverlap = ingredientOverlap(newIngredientNames, existingIngNames);

          // Flag if title is very similar OR ingredient overlap is high
          if (tSim >= TITLE_SIMILARITY_THRESHOLD || iOverlap >= INGREDIENT_OVERLAP_THRESHOLD) {
            similarRecipes.push({
              id: existing.id,
              title: existing.title,
              title_similarity: Math.round(tSim * 100),
              ingredient_overlap: Math.round(iOverlap * 100),
            });
          }
        }

        if (similarRecipes.length > 0) {
          console.log("[duplicate] similar recipes found", similarRecipes);
          // Return the generated recipe + warning, WITHOUT saving
          return new Response(
            JSON.stringify({
              duplicate_warning: true,
              similar_recipes: similarRecipes.slice(0, 3), // top 3
              recipe,
              usage: { inputTokens, outputTokens, totalTokens, costUsd },
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }
    const instructionsText = Array.isArray(recipe.instructions) ? recipe.instructions.join("\n") : "";
    let recipeId: string | null = null;

    if (userId) {
      // Logged-in users: save recipe + charge credits in one DB transaction via RPC.
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
      // Guests: save recipe only (no credit charge).
      const { data: insertedRecipe, error: insertError } = await supabase
        .from("recipe")
        .insert({
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
        })
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

