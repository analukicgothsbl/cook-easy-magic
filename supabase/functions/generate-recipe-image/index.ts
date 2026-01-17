// supabase/functions/generate-recipe-image/index.ts
//
// Generates an image for an existing recipe (when previous image generation failed),
// uploads it to Supabase Storage, and inserts a row into `recipe_image`.
//
// ✅ Reads recipe
// ✅ Generates image
// ✅ Uploads to Storage
// ✅ Inserts into recipe_image: recipe_id, image_url, usd_costs=0, created_at
// ✅ Clean failure logging
//
// Env vars required:
// - SUPABASE_URL
// - SUPABASE_ANON_KEY
// - SUPABASE_SERVICE_ROLE_KEY
// - OPENAI_API_KEY
//
// Storage:
// - Bucket name default: "recipe-images" (change if you use a different bucket)
// - Bucket should be PUBLIC if you want a stable public URL. If not public, this function will try a signed URL.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import OpenAI from "https://esm.sh/openai@4.20.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload = {
  recipe_id: string;
  bucket?: string; // default "recipe-images"
  overwrite?: boolean; // default false
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
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
      console.error("[generate-recipe-image] Missing env vars", { requestId });
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

    if (!authedUserId) {
      return jsonResponse(401, { error: "Unauthorized", request_id: requestId });
    }

    // Check if user is admin OR owns the recipe
    const { data: userExt } = await adminClient
      .from("user_extended")
      .select("role")
      .eq("user_id", authedUserId)
      .maybeSingle();

    const isAdmin = userExt?.role === "admin";

    // If not admin, check if user owns this recipe
    if (!isAdmin) {
      const { data: recipeOwnership } = await adminClient
        .from("recipe_user")
        .select("user_id")
        .eq("recipe_id", recipe_id)
        .eq("user_id", authedUserId)
        .maybeSingle();

      if (!recipeOwnership) {
        console.error("[generate-recipe-image] User does not own recipe", {
          requestId,
          authedUserId,
          recipe_id,
        });
        return jsonResponse(403, {
          error: "You can only generate images for your own recipes",
          request_id: requestId,
        });
      }
    }

    // Read recipe
    const { data: recipe, error: recipeErr } = await adminClient
      .from("recipe")
      .select("id, title, description_short, ingredients")
      .eq("id", recipe_id)
      .maybeSingle();

    if (recipeErr) {
      console.error("[generate-recipe-image] Recipe fetch error", { requestId, recipeErr });
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

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // Generate image
    let b64Image: string | null = null;

    try {
      const img = await openai.images.generate({
        model: "gpt-image-1-mini",
        prompt: imagePrompt,
        size: "1024x1024",
      });

      const first = img.data?.[0] as any;
      b64Image = first?.b64_json ?? first?.base64 ?? null;

      if (!b64Image) {
        throw new Error("Image generation returned empty data");
      }
    } catch (e) {
      console.error("[generate-recipe-image] OpenAI image generation failed", {
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

    try {
      const parsed = getExtAndMimeFromB64(b64Image);
      ext = parsed.ext;
      mime = parsed.mime;
      bytes = base64ToUint8Array(parsed.b64);
    } catch (e) {
      console.error("[generate-recipe-image] Base64 parse failed", {
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
      upsert: overwrite || true, // always allow replacing file
    });

    if (uploadErr) {
      console.error("[generate-recipe-image] Storage upload failed", { requestId, uploadErr });
      return jsonResponse(500, { error: "Failed to upload image", request_id: requestId });
    }

    // Build image URL (public or signed)
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
        console.error("[generate-recipe-image] Signed URL failed", { requestId, signedErr });
        return jsonResponse(500, { error: "Failed to create image URL", request_id: requestId });
      }
      image_url = signed?.signedUrl ?? null;
    }

    if (!image_url) {
      console.error("[generate-recipe-image] Could not produce image_url", { requestId, recipe_id });
      return jsonResponse(500, { error: "Failed to create image URL", request_id: requestId });
    }

    // ✅ UPSERT into recipe_image (update if exists, insert if not)
    // IMPORTANT: requires UNIQUE(recipe_id) in DB
    const { data: upserted, error: upsertErr } = await adminClient
      .from("recipe_image")
      .upsert(
        {
          recipe_id,
          image_url,
          usd_costs: 0,
          // created_at: leave to DB default; existing row keeps its created_at
        },
        { onConflict: "recipe_id" },
      )
      .select("recipe_id, image_url, usd_costs, created_at")
      .maybeSingle();

    if (upsertErr) {
      console.error("[generate-recipe-image] DB upsert recipe_image failed", { requestId, upsertErr });

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
    console.error("[generate-recipe-image] Unhandled error", {
      requestId: "unknown",
      error: (e as Error)?.message ?? String(e),
    });
    return jsonResponse(500, { error: "Unhandled server error" });
  }
});
