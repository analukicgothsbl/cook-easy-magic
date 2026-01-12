import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import OpenAI from 'https://esm.sh/openai@4.20.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ImagePayload {
  recipe_id: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const requestId = crypto.randomUUID()
  console.log(`[${requestId}] Starting image generation request`)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const openai = new OpenAI({ apiKey: openaiApiKey })

    // Parse request body
    const payload: ImagePayload = await req.json()
    
    if (!payload.recipe_id) {
      console.log(`[${requestId}] Missing recipe_id`)
      return new Response(
        JSON.stringify({ error: 'recipe_id is required', request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user is authenticated and is admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.log(`[${requestId}] No authorization header`)
      return new Response(
        JSON.stringify({ error: 'Authentication required', request_id: requestId }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      console.log(`[${requestId}] Invalid auth token`)
      return new Response(
        JSON.stringify({ error: 'Invalid authentication', request_id: requestId }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is admin
    const { data: userExtended, error: roleError } = await supabase
      .from('user_extended')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleError || !userExtended || userExtended.role !== 'admin') {
      console.log(`[${requestId}] User ${user.id} is not admin. Role: ${userExtended?.role}`)
      return new Response(
        JSON.stringify({ error: 'Admin access required', request_id: requestId }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[${requestId}] Admin ${user.id} generating image for recipe ${payload.recipe_id}`)

    // Fetch recipe details
    const { data: recipe, error: recipeError } = await supabase
      .from('recipe')
      .select('id, title, description_short, description_long, cuisine, meal_category, ingredients')
      .eq('id', payload.recipe_id)
      .single()

    if (recipeError || !recipe) {
      console.log(`[${requestId}] Recipe not found: ${recipeError?.message}`)
      return new Response(
        JSON.stringify({ error: 'Recipe not found', request_id: requestId }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build a descriptive prompt for the image
    const ingredientsList = Array.isArray(recipe.ingredients) 
      ? recipe.ingredients.map((i: { name?: string } | string) => 
          typeof i === 'string' ? i : i.name
        ).filter(Boolean).slice(0, 5).join(', ')
      : ''

    const imagePrompt = `Professional food photography of ${recipe.title}. ${recipe.description_short || recipe.description_long || ''}. ${recipe.cuisine ? `${recipe.cuisine} cuisine.` : ''} ${recipe.meal_category ? `A delicious ${recipe.meal_category}.` : ''} ${ingredientsList ? `Featuring ${ingredientsList}.` : ''} Beautiful plating, natural lighting, appetizing presentation, high-end restaurant quality, shallow depth of field, warm tones.`

    console.log(`[${requestId}] Image prompt: ${imagePrompt.substring(0, 200)}...`)

    // Generate image using DALL-E 3
    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "natural",
    })

    const tempImageUrl = imageResponse.data[0]?.url
    if (!tempImageUrl) {
      console.error(`[${requestId}] No image URL in OpenAI response`)
      return new Response(
        JSON.stringify({ error: 'Failed to generate image', request_id: requestId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[${requestId}] Image generated, downloading...`)

    // Download the image
    const imageRes = await fetch(tempImageUrl)
    const imageBlob = await imageRes.blob()
    const imageBuffer = await imageBlob.arrayBuffer()

    // Upload to Supabase Storage
    const fileName = `${payload.recipe_id}-${Date.now()}.png`
    const { error: uploadError } = await supabase.storage
      .from('recipe-images')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      })

    if (uploadError) {
      console.error(`[${requestId}] Storage upload error:`, uploadError)
      return new Response(
        JSON.stringify({ error: 'Failed to store image', request_id: requestId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('recipe-images')
      .getPublicUrl(fileName)

    const finalImageUrl = publicUrlData.publicUrl
    console.log(`[${requestId}] Image uploaded to: ${finalImageUrl}`)

    // Approximate cost for DALL-E 3 standard 1024x1024: $0.040
    const costUsd = 0.04

    // Save to recipe_image table
    const { data: savedImage, error: saveError } = await supabase
      .from('recipe_image')
      .insert({
        recipe_id: payload.recipe_id,
        image_url: finalImageUrl,
        usd_costs: costUsd,
      })
      .select('id, image_url')
      .single()

    if (saveError) {
      console.error(`[${requestId}] Failed to save image record:`, saveError)
      return new Response(
        JSON.stringify({ error: 'Failed to save image record', request_id: requestId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[${requestId}] Image saved successfully. Image ID: ${savedImage.id}`)

    return new Response(
      JSON.stringify({
        success: true,
        image_id: savedImage.id,
        image_url: finalImageUrl,
        request_id: requestId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error(`[${requestId}] Unexpected error:`, error)
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred', request_id: requestId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
