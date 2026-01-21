// supabase/functions/generate-recipe-image-gemini/index.ts
//
// Generates an image for a recipe using Google Gemini model,
// uploads it to Supabase Storage, and inserts/updates a row in `recipe_image`.
//
// Env vars required:
// - SUPABASE_URL
// - SUPABASE_ANON_KEY
// - SUPABASE_SERVICE_ROLE_KEY
// - GEMINI_API_KEY
// - GEMINI_MODEL (optional, defaults to gemini-2.0-flash-exp-image-generation)
//
// Storage:
// - Bucket name default: "recipe-images"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload = {
  recipe_id: string;
  bucket?: string;
  overwrite?: boolean;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getExtAndMimeFromB64(dataUrlOrB64: string): { ext: string; mime: string; b64: string } {
  if (dataUrlOrB64.startsWith("data:")) {
    const match = dataUrlOrB64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
    if (!match) throw new Error("Invalid data URL base64 image");
    const mime = match[1];
    const b64 = match[2];
    const ext = mime.includes("png") ? "png" : mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "png";
    return { ext, mime, b64 };
  }
  return { ext: "png", mime: "image/png", b64: dataUrlOrB64 };
}

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();

  try {
    if (req.method !== "POST") {
      return jsonResponse(405, { error: "Method not allowed", request_id: requestId });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
    const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3-pro-image";

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !GEMINI_API_KEY) {
      console.error("[generate-recipe-image-gemini] Missing env vars", { requestId });
      return jsonResponse(500, { error: "Server misconfigured", request_id: requestId });
    }

    const payload = (await req.json()) as Payload;

    const recipe_id = payload.recipe_id?.trim();
    const bucket = (payload.bucket?.trim() || "recipe-images").trim();
    const overwrite = payload.overwrite === true;

    if (!recipe_id) {
      return jsonResponse(400, { error: "recipe_id is required", request_id: requestId });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: authData } = await userClient.auth.getUser();
    const authedUserId = authData?.user?.id ?? null;

    // Only admins can use this function
    if (!authedUserId) {
      return jsonResponse(401, { error: "Authentication required", request_id: requestId });
    }

    const { data: userExt } = await adminClient
      .from("user_extended")
      .select("role")
      .eq("user_id", authedUserId)
      .maybeSingle();

    const isAdmin = userExt?.role === "admin";

    if (!isAdmin) {
      console.error("[generate-recipe-image-gemini] Non-admin user attempted access", {
        requestId,
        authedUserId,
      });
      return jsonResponse(403, { error: "Admin access required", request_id: requestId });
    }

    // Read recipe
    const { data: recipe, error: recipeErr } = await adminClient
      .from("recipe")
      .select("id, title, description_short, ingredients")
      .eq("id", recipe_id)
      .maybeSingle();

    if (recipeErr) {
      console.error("[generate-recipe-image-gemini] Recipe fetch error", { requestId, recipeErr });
      return jsonResponse(500, { error: "Failed to read recipe", request_id: requestId });
    }

    if (!recipe) {
      return jsonResponse(404, { error: "Recipe not found", request_id: requestId });
    }

    // Build prompt
    const title = recipe.title ?? "Recipe";
    const summary = recipe.description_short ?? "";
    const ingredients = Array.isArray(recipe.ingredients)
      ? recipe.ingredients
      : typeof recipe.ingredients === "string"
        ? recipe.ingredients
        : "";

    const imagePrompt = `
Photorealistic food photography of the finished dish: "${title}".
Style: natural light, appetizing, high detail, shallow depth of field, plated nicely, kitchen background softly blurred.
No text, no watermarks, no logos.
Context: ${summary}
Key ingredients: ${typeof ingredients === "string" ? ingredients : JSON.stringify(ingredients)}
`.trim();

    console.log("[generate-recipe-image-gemini] Generating image with Gemini", {
      requestId,
      recipe_id,
      model: GEMINI_MODEL,
    });

    // Generate image using Gemini API
    let b64Image: string | null = null;

    try {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: imagePrompt }],
              },
            ],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
            },
            safetySettings: [{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }],
          }),
        },
      );

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        console.error("[generate-recipe-image-gemini] Gemini API error", {
          requestId,
          status: geminiResponse.status,
          error: errorText,
        });
        throw new Error(`Gemini API error: ${geminiResponse.status}`);
      }

      const geminiData = await geminiResponse.json();

      // 1. Check if candidates exist (Safety filters can sometimes block the response)
      if (!geminiData.candidates || geminiData.candidates.length === 0) {
        console.error("[generate-recipe-image-gemini] No candidates found. Check safety ratings.", { geminiData });
        throw new Error("Gemini safety filters may have blocked this image.");
      }

      const parts = geminiData.candidates[0].content?.parts;

      if (!parts || !Array.isArray(parts)) {
        throw new Error("No parts found in the Gemini response.");
      }

      // 2. Look for the part containing 'inlineData' (the actual image)
      const imagePart = parts.find((part) => part.inlineData);

      if (!imagePart) {
        console.error("[generate-recipe-image-gemini] No inlineData found in parts", { parts });
        throw new Error("The model did not return image data.");
      }

      // 3. Store the Base64 string
      b64Image = imagePart.inlineData.data;

      console.log("[generate-recipe-image-gemini] Image generated successfully", {
        requestId,
        recipe_id,
        mimeType: imagePart.inlineData.mimeType,
      });
    } catch (e) {
      console.error("[generate-recipe-image-gemini] Gemini image generation failed", {
        requestId,
        recipe_id,
        error: (e as Error)?.message ?? String(e),
      });
      return jsonResponse(502, { error: "Image generation failed", request_id: requestId });
    }

    // Convert to bytes
    let ext = "png";
    let mime = "image/png";
    let bytes: Uint8Array;

    if (!b64Image) {
      console.error("[generate-recipe-image-gemini] No image data", { requestId, recipe_id });
      return jsonResponse(502, { error: "No image data received", request_id: requestId });
    }

    try {
      const parsed = getExtAndMimeFromB64(b64Image);
      ext = parsed.ext;
      mime = parsed.mime;
      bytes = base64ToUint8Array(parsed.b64);
    } catch (e) {
      console.error("[generate-recipe-image-gemini] Base64 parse failed", {
        requestId,
        recipe_id,
        error: (e as Error)?.message ?? String(e),
      });
      return jsonResponse(500, { error: "Failed to process generated image", request_id: requestId });
    }

    // Upload to Storage
    const objectPath = `recipes/${recipe_id}.${ext}`;

    const { error: uploadErr } = await adminClient.storage.from(bucket).upload(objectPath, bytes, {
      contentType: mime,
      upsert: overwrite || true,
    });

    if (uploadErr) {
      console.error("[generate-recipe-image-gemini] Storage upload failed", { requestId, uploadErr });
      return jsonResponse(500, { error: "Failed to upload image", request_id: requestId });
    }

    // Build image URL
    let image_url: string | null = null;

    try {
      const { data } = adminClient.storage.from(bucket).getPublicUrl(objectPath);
      image_url = data.publicUrl ?? null;
    } catch {
      image_url = null;
    }

    if (!image_url) {
      const { data: signed, error: signedErr } = await adminClient.storage
        .from(bucket)
        .createSignedUrl(objectPath, 60 * 60 * 24 * 365);

      if (signedErr) {
        console.error("[generate-recipe-image-gemini] Signed URL failed", { requestId, signedErr });
        return jsonResponse(500, { error: "Failed to create image URL", request_id: requestId });
      }
      image_url = signed?.signedUrl ?? null;
    }

    if (!image_url) {
      console.error("[generate-recipe-image-gemini] Could not produce image_url", { requestId, recipe_id });
      return jsonResponse(500, { error: "Failed to create image URL", request_id: requestId });
    }

    // UPSERT into recipe_image
    const { data: upserted, error: upsertErr } = await adminClient
      .from("recipe_image")
      .upsert(
        {
          recipe_id,
          image_url,
          usd_costs: 0,
        },
        { onConflict: "recipe_id" },
      )
      .select("recipe_id, image_url, usd_costs, created_at")
      .maybeSingle();

    if (upsertErr) {
      console.error("[generate-recipe-image-gemini] DB upsert recipe_image failed", { requestId, upsertErr });

      return jsonResponse(500, {
        error: "Image uploaded but DB upsert failed",
        bucket,
        path: objectPath,
        image_url,
        request_id: requestId,
      });
    }

    return jsonResponse(200, {
      ok: true,
      request_id: requestId,
      recipe_id,
      image_url,
      storage: { bucket, path: objectPath },
      recipe_image: upserted ?? { recipe_id, image_url, usd_costs: 0 },
    });
  } catch (e) {
    console.error("[generate-recipe-image-gemini] Unhandled error", {
      requestId: "unknown",
      error: (e as Error)?.message ?? String(e),
    });
    return jsonResponse(500, { error: "Unhandled server error" });
  }
});
