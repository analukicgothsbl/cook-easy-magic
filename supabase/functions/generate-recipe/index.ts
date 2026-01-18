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
// costUsd = (inputTokens * 0.00015) + (outputTokens * 0.0006)
function calcCostUsd(inputTokens: number, outputTokens: number) {
  return inputTokens * 0.00015 + outputTokens * 0.0006;
}

// -------------------- FIXED MINIMUM CREDITS PRECHECK --------------------
// Minimum credits required for recipe generation (precheck)
const MIN_CREDITS_REQUIRED = 0.9;
// ----------------------------------------------------------------------

type CreditSnapshot = {
  walletBalance: number;
  dailyBonus: number;
  bonusUsage: number;
  bonusRemaining: number;
  totalAvailable: number;
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;
    const openaiModel = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // ------------------------------------------------------------------
    // Helper: read wallet+bonus ONCE (snapshot) for logged-in users
    // ------------------------------------------------------------------
    async function readCreditSnapshotOnce(userId: string): Promise<CreditSnapshot> {
      console.log("[credits] snapshot: start", { userId });

      // 1) Read wallet balance ONCE (your requirement)
      const { data: wallet, error: walletErr } = await supabase
        .from("credit_wallet")
        .select("balance, daily_remaining")
        .eq("user_id", userId)
        .maybeSingle();

      if (walletErr || !wallet) {
        console.error("[credits] snapshot: credit_wallet read error", walletErr);
        throw new Error("Could not verify credit wallet");
      }

      // 2) Read bonus state (daily_bonus & usage)
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
      const dailyBonus = Number(bonus?.daily_bonus ?? 1); // daily_bonus default = 1
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
      });

      return { walletBalance, dailyBonus, bonusUsage, bonusRemaining, totalAvailable };
    }

    // ------------------------------------------------------------------
    // Helper: apply ONE charge (USD) AFTER recipe generation
    //
    // Rules you asked:
    // - First use bonusRemaining
    // - If bonus is used, insert TWO rows into credit_usage:
    //     1) income row (recipe_id=null, reason=bonus_credit, amount=usedBonus)
    //     2) cost row (recipe_id=recipeId, reason=generate_recipe, amount=usedBonus)
    // - Remaining cost (if any) goes as normal cost row:
    //     cost row (recipe_id=recipeId, reason=generate_recipe, amount=usedWallet)
    // - If bonus not available => only the normal cost row with full amount.
    // - Update credit_bonus.usage += usedBonus
    // - Update credit_wallet.balance -= usedWallet
    // ------------------------------------------------------------------
    async function applySingleChargeUsd(params: {
      userId: string;
      recipeId: string;
      costUsd: number;
      snapshot: CreditSnapshot;
    }) {
      const { userId, recipeId, costUsd, snapshot } = params;

      // safety: normalize
      const charge = Math.max(0, Number(costUsd || 0));
      console.log("[credits] charge: start", { userId, recipeId, charge, snapshot });

      if (charge <= 0) {
        console.log("[credits] charge: cost is 0, skipping any wallet/bonus updates");
        return;
      }

      // Check against snapshot availability (NO second wallet read)
      if (snapshot.totalAvailable < charge) {
        console.error("[credits] charge: insufficient based on snapshot", {
          totalAvailable: snapshot.totalAvailable,
          charge,
        });
        throw new Error("Not enough credits");
      }

      const useFromBonus = Math.min(snapshot.bonusRemaining, charge);
      const useFromWallet = charge - useFromBonus;

      // New computed bonus usage
      const newBonusUsage = snapshot.bonusUsage + useFromBonus;
      const newBonusRemaining = Math.max(0, snapshot.dailyBonus - newBonusUsage);

      // New wallet balance
      const newWalletBalance = snapshot.walletBalance - useFromWallet;

      console.log("[credits] charge: split", {
        charge,
        useFromBonus,
        useFromWallet,
        newBonusUsage,
        newBonusRemaining,
        newWalletBalance,
      });

      // ---- 1) Update credit_bonus (usage) ----
      // NOTE: if there was no row, we insert it (as before).
      // If useFromBonus is 0, we still keep the bonus row consistent if it already exists,
      // but we do NOT need to insert it if it doesn't exist.
      if (useFromBonus > 0) {
        const { data: existingBonus, error: existingBonusErr } = await supabase
          .from("credit_bonus")
          .select("user_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (existingBonusErr) {
          console.error("[credits] charge: credit_bonus existence check error", existingBonusErr);
          throw new Error("Failed to verify bonus credit row");
        }

        if (!existingBonus) {
          const { error: insBonusErr } = await supabase.from("credit_bonus").insert({
            user_id: userId,
            daily_bonus: snapshot.dailyBonus,
            usage: newBonusUsage,
            updated_at: new Date().toISOString(),
          });
          if (insBonusErr) {
            console.error("[credits] charge: credit_bonus insert error", insBonusErr);
            throw new Error("Failed to update bonus credit");
          }
          console.log("[credits] charge: credit_bonus inserted", { userId, newBonusUsage });
        } else {
          const { error: updBonusErr } = await supabase
            .from("credit_bonus")
            .update({
              usage: newBonusUsage,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);

          if (updBonusErr) {
            console.error("[credits] charge: credit_bonus update error", updBonusErr);
            throw new Error("Failed to update bonus credit");
          }
          console.log("[credits] charge: credit_bonus updated", { userId, newBonusUsage });
        }
      } else {
        console.log("[credits] charge: no bonus used, skipping credit_bonus update");
      }

      // ---- 2) Insert credit_usage rows ----
      // If bonus used => insert income + cost for that bonus portion
      if (useFromBonus > 0) {
        console.log("[credits] charge: inserting bonus usage rows", { useFromBonus });

        const now = new Date().toISOString();

        const { error: bonusUsageErr } = await supabase.from("credit_usage").insert([
          {
            user_id: userId,
            recipe_id: null,
            type: "income",
            amount: useFromBonus,
            reason: "bonus_credit",
            created_at: now,
          },
          {
            user_id: userId,
            recipe_id: recipeId,
            type: "cost",
            amount: useFromBonus,
            reason: "generate_recipe",
            created_at: now,
          },
        ]);

        if (bonusUsageErr) {
          console.error("[credits] charge: credit_usage bonus insert error", bonusUsageErr);
          throw new Error("Failed to record bonus credit usage");
        }

        console.log("[credits] charge: bonus usage rows inserted");
      }

      // Remaining cost => normal cost row (wallet portion)
      if (useFromWallet > 0) {
        console.log("[credits] charge: inserting wallet cost row", { useFromWallet });

        const { error: walletUsageErr } = await supabase.from("credit_usage").insert({
          user_id: userId,
          recipe_id: recipeId,
          type: "cost",
          amount: useFromWallet,
          reason: "generate_recipe",
          created_at: new Date().toISOString(),
        });

        if (walletUsageErr) {
          console.error("[credits] charge: credit_usage wallet insert error", walletUsageErr);
          throw new Error("Failed to record wallet credit usage");
        }

        console.log("[credits] charge: wallet cost row inserted");
      } else {
        console.log("[credits] charge: no wallet used (covered fully by bonus)");
      }

      // ---- 3) Update credit_wallet with new balance + daily_remaining (derived from bonus) ----
      // daily_remaining is optional/legacy but you were tracking it, so we keep it updated.
      const newDailyRemaining = newBonusRemaining;

      const { error: walletUpdateErr } = await supabase
        .from("credit_wallet")
        .update({
          balance: newWalletBalance,
          daily_remaining: newDailyRemaining,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (walletUpdateErr) {
        console.error("[credits] charge: credit_wallet update error", walletUpdateErr);
        throw new Error("Failed to update wallet");
      }

      console.log("[credits] charge: done", {
        userId,
        recipeId,
        charge,
        useFromBonus,
        useFromWallet,
        newWalletBalance,
        newDailyRemaining,
      });
    }

    // -------------------- Parse request body --------------------
    const payload: RecipePayload = await req.json();
    console.log("[request] payload", payload);

    // Validate ingredients
    if (!payload.ingredients || payload.ingredients.length === 0) {
      return new Response(JSON.stringify({ error: "Ingredients are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------------------- Auth (logged in vs guest) --------------------
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    console.log("[auth] authHeader present:", !!authHeader);

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      console.log("[auth] token length:", token?.length);
      
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser(token);
        
        if (error) {
          console.error("[auth] getUser error:", error.message);
        }
        
        if (user) {
          userId = user.id;
          console.log("[auth] user authenticated:", userId);
        }
      } catch (authErr) {
        console.error("[auth] exception:", authErr);
      }
    }

    console.log("[auth] userId", userId);

    // Guest mode logic (unchanged)
    if (!userId && payload.guest_id) {
      const { data: guestRecord, error: guestError } = await supabase
        .from("guest_recipe_allowance")
        .select("*")
        .eq("guest_id", payload.guest_id)
        .maybeSingle();

      if (guestError) {
        console.error("[guest] error checking allowance", guestError);
        return new Response(JSON.stringify({ error: "Error checking guest allowance" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (guestRecord && guestRecord.used) {
        return new Response(JSON.stringify({ error: "Guest free generation already used" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (!userId && !payload.guest_id) {
      return new Response(JSON.stringify({ error: "Authentication required or guest_id must be provided" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ------------------------------------------------------------------
    // ✅ CREDIT PRE-CHECK (logged-in): READ WALLET ONCE + BONUS ONCE
    // We must precheck before calling OpenAI.
    // Since real cost depends on tokens, we use MAX_POSSIBLE_COST_USD.
    // ------------------------------------------------------------------
    let creditSnapshot: CreditSnapshot | null = null;

    if (userId) {
      try {
        creditSnapshot = await readCreditSnapshotOnce(userId);
      } catch (e) {
        console.error("[credits] precheck snapshot error", e);
        return new Response(JSON.stringify({ error: "Could not verify credit balance" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("[credits] precheck", {
        userId,
        totalAvailable: creditSnapshot.totalAvailable,
        MIN_CREDITS_REQUIRED,
      });

      if (creditSnapshot.totalAvailable < MIN_CREDITS_REQUIRED) {
        console.log("[credits] insufficient credits for recipe generation", {
          available: creditSnapshot.totalAvailable,
          required: MIN_CREDITS_REQUIRED,
        });
        return new Response(
          JSON.stringify({
            error: "INSUFFICIENT_CREDITS",
            min_required: MIN_CREDITS_REQUIRED,
            available: creditSnapshot.totalAvailable,
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // -------------------- Build prompts --------------------
    const cuisineLabel = payload.cuisine === "any_surprise_me" ? "any cuisine (surprise me)" : payload.cuisine;
    const timeLabel = payload.time_available === "minimum" ? "quick (under 20 minutes)" : "normal cooking time";
    const difficultyLabel = payload.difficulty || "any difficulty";
    const budgetLabel = payload.budget_level || "normal budget";
    const kidsFriendlyLabel = payload.kids_friendly ? "kid-friendly" : "for adults";

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

You may add common pantry staples (salt, pepper, oil, common spices) if needed, but focus on the provided ingredients.`;

    // -------------------- Call OpenAI (recipe) --------------------
    console.log("[openai] recipe request start", { model: openaiModel });

    const completion = await openai.chat.completions.create({
      model: openaiModel,
      max_tokens: 2000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
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
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------------------- Token usage and USD cost --------------------
    const inputTokens = completion.usage?.prompt_tokens || 0;
    const outputTokens = completion.usage?.completion_tokens || 0;
    const totalTokens = inputTokens + outputTokens;
    const costUsd = calcCostUsd(inputTokens, outputTokens);

    console.log("[openai] usage", { inputTokens, outputTokens, totalTokens, costUsd });

    // -------------------- Insert recipe (includes cost_usd) --------------------
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
        instructions: recipe.instructions.join("\n"),
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
      console.error("[db] error inserting recipe", insertError);
      return new Response(JSON.stringify({ error: "Failed to save recipe" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipeId = insertedRecipe.id;
    console.log("[db] recipe saved", { recipeId });

    // -------------------- Link recipe to user (recipe_user) --------------------
    if (userId) {
      console.log("[recipe_user] linking", { userId, recipeId });
      const { error: linkError } = await supabase
        .from("recipe_user")
        .upsert(
          { user_id: userId, recipe_id: recipeId, created_at: new Date().toISOString() },
          { onConflict: "user_id,recipe_id" },
        );

      if (linkError) {
        console.error("[recipe_user] failed", linkError);
        return new Response(JSON.stringify({ error: "Failed to link recipe to user" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log("[recipe_user] linked OK");
    }

    // ------------------------------------------------------------------
    // ✅ APPLY CREDIT CHARGE ONCE (AFTER recipe generation)
    // - based ONLY on tokens costUsd from recipe generation
    // - uses the snapshot read before OpenAI (wallet read ONCE)
    // ------------------------------------------------------------------
    if (userId && creditSnapshot) {
      try {
        console.log("[credits] applying single charge after generation", {
          userId,
          recipeId,
          costUsd,
        });

        await applySingleChargeUsd({
          userId,
          recipeId,
          costUsd,
          snapshot: creditSnapshot,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Not enough credits";

        // This should be rare because we prechecked against MAX_POSSIBLE_COST_USD.
        // If it happens, we return 403 so UI can handle it, but recipe is already saved.
        console.error("[credits] apply charge error", { msg, error: e });

        if (msg === "Not enough credits") {
          return new Response(
            JSON.stringify({
              error: "Not enough credits",
              recipe_id: recipeId,
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({
            error: "Failed to process credits for recipe generation",
            recipe_id: recipeId,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // -------------------- Guest: mark as used after success --------------------
    if (!userId && payload.guest_id) {
      const { data: existingGuest } = await supabase
        .from("guest_recipe_allowance")
        .select("guest_id")
        .eq("guest_id", payload.guest_id)
        .maybeSingle();

      if (existingGuest) {
        await supabase
          .from("guest_recipe_allowance")
          .update({
            used: true,
            first_used_at: new Date().toISOString(),
            last_payload: payload,
          })
          .eq("guest_id", payload.guest_id);
      } else {
        await supabase.from("guest_recipe_allowance").insert({
          guest_id: payload.guest_id,
          used: true,
          first_used_at: new Date().toISOString(),
          last_payload: payload,
        });
      }
      console.log("[guest] marked used", { guest_id: payload.guest_id });
    }

    // -------------------- Return response (no image fields) --------------------
    return new Response(
      JSON.stringify({
        recipe_id: recipeId,
        recipe: {
          ...recipe,
          id: recipeId,
        },
        usage: {
          inputTokens,
          outputTokens,
          totalTokens,
          costUsd,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[fatal] unexpected error", error);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
