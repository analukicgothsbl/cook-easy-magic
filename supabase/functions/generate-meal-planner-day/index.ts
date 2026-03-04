// supabase/functions/generate-meal-planner-day/index.ts
//
// Generates a Full-Day Meal Plan with 5 recipes (breakfast, snack_morning, lunch, snack_afternoon, dinner)
// without requiring ingredients.
//
// ✅ Auth required (logged-in users only)
// ✅ Credit precheck before OpenAI call
// ✅ Generates 5 recipes in one OpenAI call
// ✅ Deletes existing meal plan for today before inserting
// ✅ Inserts recipes + meal_plan rows
// ✅ Calculates total tokens and cost, applies one combined charge
// ✅ Background image generation for each recipe
//
// Env vars required:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - OPENAI_API_KEY
// - OPENAI_MODEL (optional, defaults to gpt-4o-mini)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import OpenAI from "https://esm.sh/openai@4.20.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MealPlanPayload {
  plan_date: string; // YYYY-MM-DD format - the target date for the meal plan
  time_available: string | null;
  difficulty: string | null;
  cuisine: string | null;
  servings: number | null;
  budget_level: string | null;
  kids_friendly: boolean | null;
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
  meal_slot: string;
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

interface GeneratedMealPlan {
  recipes: GeneratedRecipe[];
}

// -------------------- CREDIT COST (USD) from tokens --------------------
// costUsd = (inputTokens * 0.0015) + (outputTokens * 0.0006)
// Note: user spec says 0.0015 and 0.0006, but generate-recipe uses 0.00015 and 0.0006
// Using user spec values as per instructions
function calcCostUsd(inputTokens: number, outputTokens: number) {
  return inputTokens * 0.0015 + outputTokens * 0.0006;
}

// Minimum credits required for meal plan generation (precheck)
const MIN_CREDITS_REQUIRED = 2.9;

// Max tokens for estimation
const MAX_OUTPUT_TOKENS = 4000; // Higher for 5 recipes
const MAX_INPUT_TOKENS_ESTIMATE = 2000;

type CreditSnapshot = {
  walletBalance: number;
  dailyBonus: number;
  bonusUsage: number;
  bonusRemaining: number;
  totalAvailable: number;
};

const VALID_SLOTS = ["breakfast", "snack_morning", "lunch", "dessert", "dinner"];

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;
    const openaiModel = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      console.error("[generate-meal-planner-day] Missing env vars", { requestId });
      return new Response(JSON.stringify({ error: "Server misconfigured", request_id: requestId }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // ------------------------------------------------------------------
    // Helper: read wallet+bonus ONCE (snapshot) for logged-in users
    // ------------------------------------------------------------------
    async function readCreditSnapshotOnce(userId: string): Promise<CreditSnapshot> {
      console.log("[credits] snapshot: start", { userId, requestId });

      const { data: wallet, error: walletErr } = await supabase
        .from("credit_wallet")
        .select("balance, daily_remaining")
        .eq("user_id", userId)
        .maybeSingle();

      if (walletErr || !wallet) {
        console.error("[credits] snapshot: credit_wallet read error", walletErr, { requestId });
        throw new Error("Could not verify credit wallet");
      }

      const { data: bonus, error: bonusErr } = await supabase
        .from("credit_bonus")
        .select("daily_bonus, usage")
        .eq("user_id", userId)
        .maybeSingle();

      if (bonusErr) {
        console.error("[credits] snapshot: credit_bonus read error", bonusErr, { requestId });
        throw new Error("Could not verify credit bonus");
      }

      const walletBalance = Number(wallet.balance ?? 0);
      const dailyBonus = Number(bonus?.daily_bonus ?? 1);
      const bonusUsage = Number(bonus?.usage ?? 0);
      const bonusRemaining = Math.max(0, dailyBonus - bonusUsage);
      const totalAvailable = walletBalance + bonusRemaining;

      console.log("[credits] snapshot: values", {
        userId,
        walletBalance,
        dailyBonus,
        bonusUsage,
        bonusRemaining,
        totalAvailable,
        requestId,
      });

      return { walletBalance, dailyBonus, bonusUsage, bonusRemaining, totalAvailable };
    }

    // -------------------- Auth: logged-in users only --------------------
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser(token);
        if (error) {
          console.error("[auth] getUser error:", error.message, { requestId });
        }
        if (user) {
          userId = user.id;
          console.log("[auth] user authenticated:", userId, { requestId });
        }
      } catch (authErr) {
        console.error("[auth] exception:", authErr, { requestId });
      }
    }

    if (!userId) {
      console.log("[auth] unauthorized - no valid user", { requestId });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------------------- Parse request body --------------------
    const payload: MealPlanPayload = await req.json();
    console.log("[request] payload", payload, { requestId });

    // -------------------- Credit precheck --------------------
    let creditSnapshot: CreditSnapshot;
    try {
      creditSnapshot = await readCreditSnapshotOnce(userId);
    } catch (e) {
      console.error("[credits] precheck snapshot error", e, { requestId });
      return new Response(JSON.stringify({ error: "Could not verify credit balance" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (creditSnapshot.totalAvailable < MIN_CREDITS_REQUIRED) {
      console.log("[credits] insufficient credits for meal plan", {
        available: creditSnapshot.totalAvailable,
        required: MIN_CREDITS_REQUIRED,
        requestId,
      });
      return new Response(
        JSON.stringify({
          error: "INSUFFICIENT_CREDITS",
          min_required: MIN_CREDITS_REQUIRED,
          available: creditSnapshot.totalAvailable,
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // -------------------- Build prompts --------------------
    const cuisineLabel = payload.cuisine === "any_surprise_me" ? "any cuisine (surprise me)" : payload.cuisine || "any";
    const timeLabel =
      payload.time_available === "minimum"
        ? "quick (under 20 minutes for main meals, snacks under 10 minutes)"
        : "normal cooking time";
    const difficultyLabel = payload.difficulty || "any difficulty";
    const budgetLabel = payload.budget_level || "normal budget";
    const kidsFriendlyLabel = payload.kids_friendly ? "kid-friendly" : "for adults";
    const servingsCount = payload.servings || 2;

    const systemPrompt = `You are a professional chef and meal planner. Generate a complete Full-Day Meal Plan with exactly 5 recipes for the following meal slots: breakfast, snack_morning, lunch, dessert, dinner.

Important constraints:
- No repeated main dish type (e.g., not pasta twice)
- Balanced day (protein + veggies + carbs across the day)
- Shared prep allowed but max 1-2 overlapping ingredients across recipes
- snack_morning MUST be light & quick (≤10 minutes prep time)
- dessert should be a sweet treat or light dessert

Respond ONLY with a valid JSON object (no markdown, no extra text) with this exact structure:
{
  "recipes": [
    {
      "meal_slot": "breakfast",
      "title": "Recipe Title",
      "description_short": "One sentence description",
      "description_long": "Detailed 2-3 sentence description",
      "meal_category": "breakfast",
      "cuisine": "${cuisineLabel}",
      "time_minutes": 20,
      "difficulty": "${difficultyLabel}",
      "servings": ${servingsCount},
      "budget_level": "${budgetLabel}",
      "kids_friendly": ${payload.kids_friendly || false},
      "ingredients": [
        {"name": "ingredient", "quantity": "2", "unit": "cups"}
      ],
      "instructions": ["Step 1...", "Step 2..."],
      "tips": "Optional cooking tip",
      "nutrition_estimate": {
        "calories": 350,
        "protein": "25g",
        "carbs": "30g",
        "fat": "15g"
      }
    }
  ]
}

Meal category mapping:
- breakfast → "breakfast"
- snack_morning → "snack"
- lunch → "lunch"
- dessert → "dessert"
- dinner → "dinner"

You MUST include all 5 recipes in the exact order: breakfast, snack_morning, lunch, dessert, dinner.`;

    const userPrompt = `Create a Full-Day Meal Plan with these preferences:

- Cuisine: ${cuisineLabel}
- Time available: ${timeLabel}
- Difficulty: ${difficultyLabel}
- Servings: ${servingsCount}
- Budget: ${budgetLabel}
- ${kidsFriendlyLabel}

Remember:
- Generate exactly 5 recipes for: breakfast, snack_morning, lunch, dessert, dinner
- Morning snack must be ≤10 minutes prep time
- Dessert should be a sweet treat or light dessert
- Ensure variety and nutritional balance across the day`;

    // -------------------- Call OpenAI --------------------
    console.log("[openai] meal plan request start", { model: openaiModel, requestId });

    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: openaiModel,
        max_tokens: MAX_OUTPUT_TOKENS,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      });
    } catch (openaiError) {
      const message = openaiError instanceof Error ? openaiError.message : String(openaiError);
      // Some newer models only support /v1/responses. Retry with a chat-completions compatible model.
      if (message.includes("supported in v1/responses")) {
        const fallbackModel = "gpt-4o-mini";
        console.warn("[openai] model incompatible with chat.completions, retrying with fallback", {
          requestedModel: openaiModel,
          fallbackModel,
          requestId,
        });
        completion = await openai.chat.completions.create({
          model: fallbackModel,
          max_tokens: MAX_OUTPUT_TOKENS,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
        });
      } else {
        throw openaiError;
      }
    }

    const responseText = completion.choices[0]?.message?.content || "";
    console.log("[openai] raw meal plan response length:", responseText.length, { requestId });

    // -------------------- Parse JSON response --------------------
    let mealPlan: GeneratedMealPlan;
    try {
      const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, "").trim();
      mealPlan = JSON.parse(cleanedResponse);
    } catch {
      console.error("[openai] failed to parse meal plan JSON", responseText.substring(0, 500), { requestId });
      return new Response(JSON.stringify({ error: "MODEL_JSON_PARSE_FAILED" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate: must have exactly 5 recipes
    if (!mealPlan.recipes || mealPlan.recipes.length !== 5) {
      console.error("[validation] did not receive exactly 5 recipes", {
        count: mealPlan.recipes?.length,
        requestId,
      });
      return new Response(JSON.stringify({ error: "MODEL_JSON_PARSE_FAILED", detail: "Expected 5 recipes" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate meal slots
    const receivedSlots = mealPlan.recipes.map((r) => r.meal_slot);
    const allSlotsValid = receivedSlots.every((slot) => VALID_SLOTS.includes(slot));
    if (!allSlotsValid) {
      console.error("[validation] invalid meal slots", { receivedSlots, requestId });
      return new Response(JSON.stringify({ error: "MODEL_JSON_PARSE_FAILED", detail: "Invalid meal slots" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate exactly one recipe per required slot.
    const uniqueSlots = new Set(receivedSlots);
    const hasExactlyRequiredSlots =
      uniqueSlots.size === VALID_SLOTS.length && VALID_SLOTS.every((slot) => uniqueSlots.has(slot));
    if (!hasExactlyRequiredSlots) {
      console.error("[validation] missing/duplicate meal slots", { receivedSlots, requestId });
      return new Response(
        JSON.stringify({ error: "MODEL_JSON_PARSE_FAILED", detail: "Missing or duplicate meal slots" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate morning snack has time_minutes <= 10
    for (const recipe of mealPlan.recipes) {
      if (recipe.meal_slot === "snack_morning" && recipe.time_minutes > 10) {
        console.warn("[validation] snack has time > 10 minutes, adjusting", {
          slot: recipe.meal_slot,
          time: recipe.time_minutes,
          requestId,
        });
        recipe.time_minutes = 10; // Enforce constraint
      }
    }

    // -------------------- Token usage and USD cost --------------------
    const inputTokens = completion.usage?.prompt_tokens || 0;
    const outputTokens = completion.usage?.completion_tokens || 0;
    const totalTokens = inputTokens + outputTokens;
    const totalCostUsd = calcCostUsd(inputTokens, outputTokens);

    console.log("[openai] usage", { inputTokens, outputTokens, totalTokens, totalCostUsd, requestId });

    // -------------------- Save meal plan + charge atomically --------------------
    // Use the plan_date from the request payload (selected day), fallback to server UTC today
    const targetDate = payload.plan_date || new Date().toISOString().split("T")[0];

    const perRecipeInputTokens = Math.round(inputTokens / 5);
    const perRecipeOutputTokens = Math.round(outputTokens / 5);
    const perRecipeTotalTokens = Math.round(totalTokens / 5);
    const perRecipeCost = totalCostUsd / 5;

    const recipesPayload = mealPlan.recipes.map((recipe) => {
      const parsedTime = Number(recipe.time_minutes);
      const safeTimeMinutes = Number.isFinite(parsedTime) ? Math.max(1, Math.round(parsedTime)) : null;

      const parsedServings = Number(recipe.servings ?? payload.servings ?? 2);
      const safeServings = Number.isFinite(parsedServings) ? Math.max(1, Math.round(parsedServings)) : 2;

      const safeIngredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
      const safeInstructions = Array.isArray(recipe.instructions)
        ? recipe.instructions.map((step) => String(step))
        : [];

      return {
        meal_slot: recipe.meal_slot,
        title: recipe.title,
        description_short: recipe.description_short,
        description_long: recipe.description_long,
        cuisine: payload.cuisine || recipe.cuisine || null,
        time_minutes: safeTimeMinutes,
        difficulty: recipe.difficulty || payload.difficulty || null,
        servings: safeServings,
        budget_level: payload.budget_level || recipe.budget_level || null,
        kids_friendly: Boolean(recipe.kids_friendly),
        ingredients: safeIngredients,
        instructions: safeInstructions,
        tips: recipe.tips,
        nutrition_estimate: recipe.nutrition_estimate,
        input_tokens: perRecipeInputTokens,
        output_tokens: perRecipeOutputTokens,
        total_tokens: perRecipeTotalTokens,
        cost_usd: perRecipeCost,
      };
    });

    const { data: rpcCreatedRecipes, error: rpcError } = await supabase.rpc("create_meal_plan_and_charge", {
      p_user_id: userId,
      p_plan_date: targetDate,
      p_recipes_json: recipesPayload,
      p_total_cost_usd: totalCostUsd,
    });

    if (rpcError) {
      console.error("[db] atomic meal plan+charge RPC failed", rpcError, { requestId });
      const msg = String(rpcError.message || "");
      if (msg.includes("INSUFFICIENT_CREDITS")) {
        return new Response(JSON.stringify({ error: "INSUFFICIENT_CREDITS" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (msg.includes("CREDIT_WALLET_NOT_FOUND")) {
        return new Response(JSON.stringify({ error: "Could not verify credit wallet" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Failed to save meal plan and process credits atomically" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let createdRecipes: Array<{
      meal_slot: string;
      recipe_id: string;
      title: string;
      meal_category: string;
      time_minutes: number;
      servings: number;
    }> = [];

    if (Array.isArray(rpcCreatedRecipes)) {
      createdRecipes = rpcCreatedRecipes as typeof createdRecipes;
    } else if (typeof rpcCreatedRecipes === "string") {
      try {
        const parsed = JSON.parse(rpcCreatedRecipes);
        if (Array.isArray(parsed)) {
          createdRecipes = parsed as typeof createdRecipes;
        }
      } catch {
        // ignore parse failure; handled below
      }
    }

    if (createdRecipes.length === 0) {
      console.error("[db] atomic meal plan+charge RPC returned no recipes", { requestId, rpcCreatedRecipes });
      return new Response(JSON.stringify({ error: "Failed to save meal plan and process credits atomically" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[db] meal plan saved and charged atomically", {
      userId,
      targetDate,
      recipeCount: createdRecipes.length,
      requestId,
    });

    // -------------------- Background image generation --------------------
    console.log("[images] starting background image generation", { count: createdRecipes.length, requestId });

    // Use EdgeRuntime.waitUntil for background processing
    // Generate all images IN PARALLEL to complete before function timeout
    const generateImagesInBackground = async () => {
      const authToken = authHeader || "";

      console.log("[images] starting parallel image generation for all recipes", { requestId });

      // Generate all images in parallel using Promise.allSettled
      const imagePromises = createdRecipes.map(async (recipe) => {
        try {
          console.log("[images] generating image for recipe", { recipeId: recipe.recipe_id, requestId });

          const imageResponse = await fetch(`${supabaseUrl}/functions/v1/generate-recipe-image`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: authToken,
            },
            body: JSON.stringify({
              recipe_id: recipe.recipe_id,
              bucket: "recipe-images",
            }),
          });

          if (!imageResponse.ok) {
            console.warn("[images] image generation failed for recipe", {
              recipeId: recipe.recipe_id,
              status: imageResponse.status,
              requestId,
            });
            return { recipeId: recipe.recipe_id, success: false };
          } else {
            console.log("[images] image generated successfully", { recipeId: recipe.recipe_id, requestId });
            return { recipeId: recipe.recipe_id, success: true };
          }
        } catch (imgErr) {
          console.warn("[images] exception generating image", { recipeId: recipe.recipe_id, error: imgErr, requestId });
          return { recipeId: recipe.recipe_id, success: false };
        }
      });

      const results = await Promise.allSettled(imagePromises);
      const successCount = results.filter((r) => r.status === "fulfilled" && r.value?.success).length;
      console.log("[images] background image generation complete", {
        total: createdRecipes.length,
        successful: successCount,
        requestId,
      });
    };

    // Start background task without blocking response.
    // Some runtimes may not expose EdgeRuntime.waitUntil; in that case run without throwing.
    try {
      const edgeRuntime = (globalThis as unknown as {
        EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void };
      }).EdgeRuntime;
      if (edgeRuntime?.waitUntil) {
        edgeRuntime.waitUntil(generateImagesInBackground());
      } else {
        void generateImagesInBackground();
      }
    } catch (waitUntilError) {
      console.warn("[images] failed to schedule waitUntil, continuing without blocking", {
        error: waitUntilError,
        requestId,
      });
      void generateImagesInBackground();
    }

    // -------------------- Return response --------------------
    console.log("[response] returning success", { recipeCount: createdRecipes.length, requestId });

    return new Response(
      JSON.stringify({
        date: targetDate,
        recipes: createdRecipes,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[fatal] unexpected error", error, { requestId });
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
