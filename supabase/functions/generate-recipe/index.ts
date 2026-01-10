import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import OpenAI from 'https://esm.sh/openai@4.20.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RecipePayload {
  ingredients: string[]
  meal_category: string | null
  time_available: string | null
  difficulty: string | null
  cuisine: string | null
  servings: number | null
  budget_level: string | null
  kids_friendly: boolean | null
  guest_id: string | null
}

interface Ingredient {
  name: string
  quantity: string
  unit: string
}

interface NutritionEstimate {
  calories: number
  protein: string
  carbs: string
  fat: string
}

interface GeneratedRecipe {
  title: string
  description_short: string
  description_long: string
  meal_category: string
  cuisine: string
  time_minutes: number
  difficulty: string
  servings: number
  budget_level: string
  kids_friendly: boolean
  ingredients: Ingredient[]
  instructions: string[]
  tips: string
  nutrition_estimate: NutritionEstimate
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!
    const openaiModel = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini'

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const openai = new OpenAI({ apiKey: openaiApiKey })

    // Parse request body
    const payload: RecipePayload = await req.json()
    
    // Validate ingredients
    if (!payload.ingredients || payload.ingredients.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Ingredients are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get authorization header to check if user is logged in
    const authHeader = req.headers.get('Authorization')
    let userId: string | null = null

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (!error && user) {
        userId = user.id
      }
    }

    // Guest mode logic
    if (!userId && payload.guest_id) {
      // Check if guest has already used their free recipe
      const { data: guestRecord, error: guestError } = await supabase
        .from('guest_recipe_allowance')
        .select('*')
        .eq('guest_id', payload.guest_id)
        .maybeSingle()

      if (guestError) {
        console.error('Error checking guest allowance:', guestError)
        return new Response(
          JSON.stringify({ error: 'Error checking guest allowance' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (guestRecord && guestRecord.used) {
        return new Response(
          JSON.stringify({ error: 'Guest free generation already used' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else if (!userId && !payload.guest_id) {
      return new Response(
        JSON.stringify({ error: 'Authentication required or guest_id must be provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If logged in user, check credit balance
    if (userId) {
      const { data: wallet, error: walletError } = await supabase
        .from('credit_wallet')
        .select('balance')
        .eq('user_id', userId)
        .single()

      if (walletError || !wallet) {
        console.error('Error fetching wallet:', walletError)
        return new Response(
          JSON.stringify({ error: 'Could not verify credit balance' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (wallet.balance < 1) {
        return new Response(
          JSON.stringify({ error: 'Not enough credits' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Build the prompt
    const cuisineLabel = payload.cuisine === 'any_surprise_me' ? 'any cuisine (surprise me)' : payload.cuisine
    const timeLabel = payload.time_available === 'minimum' ? 'quick (under 20 minutes)' : 'normal cooking time'
    const difficultyLabel = payload.difficulty || 'any difficulty'
    const budgetLabel = payload.budget_level || 'normal budget'
    const kidsFriendlyLabel = payload.kids_friendly ? 'kid-friendly' : 'for adults'

    const systemPrompt = `You are a professional chef and recipe creator. Generate a delicious, practical recipe based on the user's ingredients and preferences. 

Respond ONLY with a valid JSON object (no markdown, no extra text) with this exact structure:
{
  "title": "Recipe Title",
  "description_short": "One sentence description",
  "description_long": "Detailed 2-3 sentence description",
  "meal_category": "${payload.meal_category || 'lunch'}",
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
}`

    const userPrompt = `Create a ${payload.meal_category || 'meal'} recipe using these ingredients: ${payload.ingredients.join(', ')}.

Preferences:
- Cuisine: ${cuisineLabel}
- Time available: ${timeLabel}
- Difficulty: ${difficultyLabel}
- Servings: ${payload.servings || 2}
- Budget: ${budgetLabel}
- ${kidsFriendlyLabel}

You may add common pantry staples (salt, pepper, oil, common spices) if needed, but focus on the provided ingredients.`

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: openaiModel,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
    })

    const responseText = completion.choices[0]?.message?.content || ''
    
    // Parse the JSON response
    let recipe: GeneratedRecipe
    try {
      // Remove any markdown code blocks if present
      const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim()
      recipe = JSON.parse(cleanedResponse)
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', responseText)
      return new Response(
        JSON.stringify({ error: 'Failed to generate recipe. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate token usage and cost
    const inputTokens = completion.usage?.prompt_tokens || 0
    const outputTokens = completion.usage?.completion_tokens || 0
    const totalTokens = inputTokens + outputTokens
    // Approximate cost for gpt-4o-mini: $0.15/1M input, $0.60/1M output
    const costUsd = (inputTokens * 0.00000015) + (outputTokens * 0.0000006)

    // Insert recipe into database using service role (bypasses RLS)
    const { data: insertedRecipe, error: insertError } = await supabase
      .from('recipe')
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
        instructions: recipe.instructions.join('\n'),
        tips: recipe.tips,
        nutrition_estimate: recipe.nutrition_estimate,
        input_ingredients: payload.ingredients,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        cost_usd: costUsd,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Error inserting recipe:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to save recipe' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const recipeId = insertedRecipe.id

    // Handle credits/usage tracking
    if (userId) {
      // Deduct credit from logged-in user
      const { error: deductError } = await supabase
        .from('credit_wallet')
        .update({ 
          balance: supabase.rpc('decrement_balance', { user_id_param: userId }),
        })
        .eq('user_id', userId)

      // Actually let's just do a simple update
      const { data: currentWallet } = await supabase
        .from('credit_wallet')
        .select('balance')
        .eq('user_id', userId)
        .single()

      if (currentWallet) {
        await supabase
          .from('credit_wallet')
          .update({ balance: currentWallet.balance - 1 })
          .eq('user_id', userId)
      }

      // Log credit usage
      await supabase
        .from('credit_usage')
        .insert({
          user_id: userId,
          recipe_id: recipeId,
          type: 'cost',
          amount: 1,
          reason: 'generate_recipe',
        })
    } else if (payload.guest_id) {
      // Mark guest as having used their free recipe
      const { data: existingGuest } = await supabase
        .from('guest_recipe_allowance')
        .select('guest_id')
        .eq('guest_id', payload.guest_id)
        .maybeSingle()

      if (existingGuest) {
        await supabase
          .from('guest_recipe_allowance')
          .update({
            used: true,
            first_used_at: new Date().toISOString(),
            last_payload: payload,
          })
          .eq('guest_id', payload.guest_id)
      } else {
        await supabase
          .from('guest_recipe_allowance')
          .insert({
            guest_id: payload.guest_id,
            used: true,
            first_used_at: new Date().toISOString(),
            last_payload: payload,
          })
      }
    }

    return new Response(
      JSON.stringify({
        recipe_id: recipeId,
        recipe: {
          ...recipe,
          id: recipeId,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
