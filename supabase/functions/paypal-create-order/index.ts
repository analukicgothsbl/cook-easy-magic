import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CREDIT_PACKAGES: Record<string, { price: number; credits: number }> = {
  pkg_10: { price: 1, credits: 10 },
  pkg_32: { price: 3, credits: 32 },
  pkg_55: { price: 5, credits: 55 },
  pkg_115: { price: 10, credits: 115 },
};

async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  const env = Deno.env.get("PAYPAL_ENV") || "sandbox";

  const baseUrl = env === "production" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("PayPal auth error:", error);
    throw new Error("Failed to get PayPal access token");
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client with user's token
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get user from token
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Please sign in to buy credits" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { package_id } = await req.json();

    if (!package_id || !CREDIT_PACKAGES[package_id]) {
      return new Response(JSON.stringify({ error: "Invalid package selected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pkg = CREDIT_PACKAGES[package_id];
    const env = Deno.env.get("PAYPAL_ENV") || "sandbox";
    const baseUrl = env === "production" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

    const siteUrl = req.headers.get("origin")!;

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Create PayPal order
    const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "USD",
              value: pkg.price.toFixed(2),
            },
            description: `CookMaster - ${pkg.credits} Credits`,
            custom_id: JSON.stringify({ user_id: user.id, package_id }),
          },
        ],
        application_context: {
          brand_name: "CookMaster",
          landing_page: "NO_PREFERENCE",
          user_action: "PAY_NOW",
          return_url: `${siteUrl}/dashboard?paypal_success=true`,
          cancel_url: `${siteUrl}/dashboard?paypal_cancel=true`,
        },
      }),
    });

    if (!orderResponse.ok) {
      const error = await orderResponse.text();
      console.error("PayPal create order error:", error);
      return new Response(JSON.stringify({ error: "Failed to create PayPal order" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderData = await orderResponse.json();

    // Find approval URL
    const approvalUrl = orderData.links?.find((link: { rel: string }) => link.rel === "approve")?.href;

    if (!approvalUrl) {
      console.error("No approval URL found in PayPal response:", orderData);
      return new Response(JSON.stringify({ error: "Failed to get PayPal approval URL" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Store pending purchase in database
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    const { error: insertError } = await adminSupabase.from("credit_purchases").insert({
      user_id: user.id,
      package_id: package_id,
      credits: pkg.credits,
      amount: pkg.price,
      currency: "USD",
      provider: "paypal",
      status: "pending",
      paypal_order_id: orderData.id,
    });

    if (insertError) {
      console.error("Error storing purchase:", insertError);
      // Continue anyway - we can reconcile later
    }

    return new Response(
      JSON.stringify({
        approvalUrl,
        orderId: orderData.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in paypal-create-order:", error);
    return new Response(JSON.stringify({ error: "Payment could not be started. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
