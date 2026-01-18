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

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MealPlanPayload {
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
const MIN_CREDITS_REQUIRED = 4;

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

// Meal slot to meal_category mapping
const SLOT_TO_CATEGORY: Record<string, string> = {
  breakfast: "breakfast",
  snack_morning: "snack",
  lunch: "lunch",
  snack_afternoon: "snack",
  dinner: "dinner",
};

const VALID_SLOTS = ["breakfast", "snack_morning", "lunch", "snack_afternoon", "dinner"];

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
      return new Response(
        JSON.stringify({ error: "Server misconfigured", request_id: requestId }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    // ------------------------------------------------------------------
    // Helper: apply ONE combined charge (USD) AFTER recipe generation
    // Uses the first recipe_id as anchor if required, otherwise null
    // ------------------------------------------------------------------
    async function applyCombinedCharge(params: {
      userId: string;
      firstRecipeId: string | null;
      costUsd: number;
      snapshot: CreditSnapshot;
    }) {
      const { userId, firstRecipeId, costUsd, snapshot } = params;

      const charge = Math.max(0, Number(costUsd || 0));
      console.log("[credits] charge: start", { userId, firstRecipeId, charge, snapshot, requestId });

      if (charge <= 0) {
        console.log("[credits] charge: cost is 0, skipping", { requestId });
        return;
      }

      if (snapshot.totalAvailable < charge) {
        console.error("[credits] charge: insufficient based on snapshot", {
          totalAvailable: snapshot.totalAvailable,
          charge,
          requestId,
        });
        throw new Error("Not enough credits");
      }

      const useFromBonus = Math.min(snapshot.bonusRemaining, charge);
      const useFromWallet = charge - useFromBonus;

      const newBonusUsage = snapshot.bonusUsage + useFromBonus;
      const newBonusRemaining = Math.max(0, snapshot.dailyBonus - newBonusUsage);
      const newWalletBalance = snapshot.walletBalance - useFromWallet;

      console.log("[credits] charge: split", {
        charge,
        useFromBonus,
        useFromWallet,
        newBonusUsage,
        newBonusRemaining,
        newWalletBalance,
        requestId,
      });

      // Update credit_bonus if bonus was used
      if (useFromBonus > 0) {
        const { data: existingBonus } = await supabase
          .from("credit_bonus")
          .select("user_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (!existingBonus) {
          const { error: insBonusErr } = await supabase.from("credit_bonus").insert({
            user_id: userId,
            daily_bonus: snapshot.dailyBonus,
            usage: newBonusUsage,
            updated_at: new Date().toISOString(),
          });
          if (insBonusErr) {
            console.error("[credits] charge: credit_bonus insert error", insBonusErr, { requestId });
            throw new Error("Failed to update bonus credit");
          }
        } else {
          const { error: updBonusErr } = await supabase
            .from("credit_bonus")
            .update({
              usage: newBonusUsage,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);

          if (updBonusErr) {
            console.error("[credits] charge: credit_bonus update error", updBonusErr, { requestId });
            throw new Error("Failed to update bonus credit");
          }
        }
      }

      // Insert credit_usage rows
      const now = new Date().toISOString();
      const usageRows = [];

      // If bonus used, insert income + cost rows for bonus portion
      if (useFromBonus > 0) {
        usageRows.push({
          user_id: userId,
          recipe_id: null, // null for combined charge
          type: "income",
          amount: useFromBonus,
          reason: "bonus_credit",
          created_at: now,
        });
        usageRows.push({
          user_id: userId,
          recipe_id: firstRecipeId, // Use first recipe as anchor if needed
          type: "cost",
          amount: useFromBonus,
          reason: "generate_recipe", // Using existing reason for compatibility
          created_at: now,
        });
      }

      // Remaining cost from wallet
      if (useFromWallet > 0) {
        usageRows.push({
          user_id: userId,
          recipe_id: firstRecipeId,
          type: "cost",
          amount: useFromWallet,
          reason: "generate_recipe",
          created_at: now,
        });
      }

      if (usageRows.length > 0) {
        const { error: usageErr } = await supabase.from("credit_usage").insert(usageRows);
        if (usageErr) {
          console.error("[credits] charge: credit_usage insert error", usageErr, { requestId });
          throw new Error("Failed to record credit usage");
        }
      }

      // Update credit_wallet
      const { error: walletUpdateErr } = await supabase
        .from("credit_wallet")
        .update({
          balance: newWalletBalance,
          daily_remaining: newBonusRemaining,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (walletUpdateErr) {
        console.error("[credits] charge: credit_wallet update error", walletUpdateErr, { requestId });
        throw new Error("Failed to update wallet");
      }

      console.log("[credits] charge: done", {
        userId,
        charge,
        useFromBonus,
        useFromWallet,
        newWalletBalance,
        newBonusRemaining,
        requestId,
      });
    }

    // -------------------- Auth: logged-in users only --------------------
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
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
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      return new Response(
        JSON.stringify({ error: "Could not verify credit balance" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // -------------------- Build prompts --------------------
    const cuisineLabel = payload.cuisine === "any_surprise_me" ? "any cuisine (surprise me)" : payload.cuisine || "any";
    const timeLabel = payload.time_available === "minimum" ? "quick (under 20 minutes for main meals, snacks under 10 minutes)" : "normal cooking time";
    const difficultyLabel = payload.difficulty || "any difficulty";
    const budgetLabel = payload.budget_level || "normal budget";
    const kidsFriendlyLabel = payload.kids_friendly ? "kid-friendly" : "for adults";
    const servingsCount = payload.servings || 2;

    const systemPrompt = `You are a professional chef and meal planner. Generate a complete Full-Day Meal Plan with exactly 5 recipes for the following meal slots: breakfast, snack_morning, lunch, snack_afternoon, dinner.

Important constraints:
- No repeated main dish type (e.g., not pasta twice)
- Balanced day (protein + veggies + carbs across the day)
- Shared prep allowed but max 1-2 overlapping ingredients across recipes
- Snacks (snack_morning and snack_afternoon) MUST be light & quick (≤10 minutes prep time)

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
- snack_afternoon → "snack"
- dinner → "dinner"

You MUST include all 5 recipes in the exact order: breakfast, snack_morning, lunch, snack_afternoon, dinner.`;

    const userPrompt = `Create a Full-Day Meal Plan with these preferences:

- Cuisine: ${cuisineLabel}
- Time available: ${timeLabel}
- Difficulty: ${difficultyLabel}
- Servings: ${servingsCount}
- Budget: ${budgetLabel}
- ${kidsFriendlyLabel}

Remember:
- Generate exactly 5 recipes for: breakfast, snack_morning, lunch, snack_afternoon, dinner
- Snacks must be ≤10 minutes prep time
- Ensure variety and nutritional balance across the day`;

    // -------------------- Call OpenAI --------------------
    console.log("[openai] meal plan request start", { model: openaiModel, requestId });

    const completion = await openai.chat.completions.create({
      model: openaiModel,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    });

    const responseText = completion.choices[0]?.message?.content || "";
    console.log("[openai] raw meal plan response length:", responseText.length, { requestId });

    // -------------------- Parse JSON response --------------------
    let mealPlan: GeneratedMealPlan;
    try {
      const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, "").trim();
      mealPlan = JSON.parse(cleanedResponse);
    } catch {
      console.error("[openai] failed to parse meal plan JSON", responseText.substring(0, 500), { requestId });
      return new Response(
        JSON.stringify({ error: "MODEL_JSON_PARSE_FAILED" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate: must have exactly 5 recipes
    if (!mealPlan.recipes || mealPlan.recipes.length !== 5) {
      console.error("[validation] did not receive exactly 5 recipes", {
        count: mealPlan.recipes?.length,
        requestId,
      });
      return new Response(
        JSON.stringify({ error: "MODEL_JSON_PARSE_FAILED", detail: "Expected 5 recipes" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate meal slots
    const receivedSlots = mealPlan.recipes.map(r => r.meal_slot);
    const allSlotsValid = receivedSlots.every(slot => VALID_SLOTS.includes(slot));
    if (!allSlotsValid) {
      console.error("[validation] invalid meal slots", { receivedSlots, requestId });
      return new Response(
        JSON.stringify({ error: "MODEL_JSON_PARSE_FAILED", detail: "Invalid meal slots" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate snacks have time_minutes <= 10
    for (const recipe of mealPlan.recipes) {
      if ((recipe.meal_slot === "snack_morning" || recipe.meal_slot === "snack_afternoon") && recipe.time_minutes > 10) {
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

    // -------------------- Clear existing meal plan for today --------------------
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD UTC

    console.log("[db] clearing existing meal plan for today", { userId, today, requestId });
    const { error: deleteError } = await supabase
      .from("meal_plan")
      .delete()
      .eq("user_id", userId)
      .eq("plan_date", today);

    if (deleteError) {
      console.error("[db] error deleting existing meal plan", deleteError, { requestId });
      // Continue anyway - not critical
    }

    // -------------------- Insert recipes and meal plan --------------------
    const createdRecipes: Array<{ meal_slot: string; recipe_id: string; title: string; meal_category: string; time_minutes: number; servings: number }> = [];
    const perRecipeCost = totalCostUsd / 5;

    for (const recipe of mealPlan.recipes) {
      // Map meal_slot to meal_category
      const mealCategory = SLOT_TO_CATEGORY[recipe.meal_slot] || "lunch";

      // Insert recipe
      const { data: insertedRecipe, error: insertError } = await supabase
        .from("recipe")
        .insert({
          title: recipe.title,
          description_short: recipe.description_short,
          description_long: recipe.description_long,
          meal_category: mealCategory,
          cuisine: payload.cuisine,
          time_minutes: recipe.time_minutes,
          difficulty: recipe.difficulty || payload.difficulty,
          servings: recipe.servings,
          budget_level: payload.budget_level,
          kids_friendly: recipe.kids_friendly,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions.join("\n"),
          tips: recipe.tips,
          nutrition_estimate: recipe.nutrition_estimate,
          input_tokens: Math.round(inputTokens / 5),
          output_tokens: Math.round(outputTokens / 5),
          total_tokens: Math.round(totalTokens / 5),
          cost_usd: perRecipeCost,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("[db] error inserting recipe", insertError, { slot: recipe.meal_slot, requestId });
        return new Response(
          JSON.stringify({ error: "Failed to save recipe" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const recipeId = insertedRecipe.id;
      console.log("[db] recipe saved", { recipeId, slot: recipe.meal_slot, requestId });

      // Link recipe to user
      const { error: linkError } = await supabase
        .from("recipe_user")
        .upsert(
          { user_id: userId, recipe_id: recipeId, created_at: new Date().toISOString() },
          { onConflict: "user_id,recipe_id" }
        );

      if (linkError) {
        console.error("[recipe_user] failed", linkError, { requestId });
        // Continue anyway
      }

      // Insert meal plan entry
      const { error: mealPlanError } = await supabase
        .from("meal_plan")
        .insert({
          user_id: userId,
          plan_date: today,
          meal_slot: recipe.meal_slot,
          recipe_id: recipeId,
        });

      if (mealPlanError) {
        console.error("[db] error inserting meal plan", mealPlanError, { slot: recipe.meal_slot, requestId });
        // Continue anyway
      }

      createdRecipes.push({
        meal_slot: recipe.meal_slot,
        recipe_id: recipeId,
        title: recipe.title,
        meal_category: mealCategory,
        time_minutes: recipe.time_minutes,
        servings: recipe.servings,
      });
    }

    // -------------------- Apply combined credit charge --------------------
    const firstRecipeId = createdRecipes.length > 0 ? createdRecipes[0].recipe_id : null;

    try {
      await applyCombinedCharge({
        userId,
        firstRecipeId,
        costUsd: totalCostUsd,
        snapshot: creditSnapshot,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Credit charge failed";
      console.error("[credits] apply charge error", { msg, error: e, requestId });
      // Recipes are already saved, return success but log error
    }

    // -------------------- Background image generation --------------------
    console.log("[images] starting background image generation", { count: createdRecipes.length, requestId });

    // Use EdgeRuntime.waitUntil for background processing
    const generateImagesInBackground = async () => {
      const authToken = authHeader || "";
      
      for (const recipe of createdRecipes) {
        try {
          console.log("[images] generating image for recipe", { recipeId: recipe.recipe_id, requestId });
          
          const imageResponse = await fetch(`${supabaseUrl}/functions/v1/generate-recipe-image`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": authToken,
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
          } else {
            console.log("[images] image generated successfully", { recipeId: recipe.recipe_id, requestId });
          }
        } catch (imgErr) {
          console.warn("[images] exception generating image", { recipeId: recipe.recipe_id, error: imgErr, requestId });
        }
      }
      
      console.log("[images] background image generation complete", { requestId });
    };

    // Start background task without blocking response
    EdgeRuntime.waitUntil(generateImagesInBackground());

    // -------------------- Return response --------------------
    console.log("[response] returning success", { recipeCount: createdRecipes.length, requestId });

    return new Response(
      JSON.stringify({
        date: today,
        recipes: createdRecipes,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[fatal] unexpected error", error, { requestId });
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
