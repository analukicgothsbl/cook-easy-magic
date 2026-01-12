import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { order_id } = await req.json();

    if (!order_id) {
      return new Response(JSON.stringify({ error: "Order ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const env = Deno.env.get("PAYPAL_ENV") || "sandbox";
    const baseUrl = env === "production" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Capture the PayPal order
    const captureResponse = await fetch(`${baseUrl}/v2/checkout/orders/${order_id}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!captureResponse.ok) {
      const error = await captureResponse.text();
      console.error("PayPal capture error:", error);
      return new Response(JSON.stringify({ error: "Failed to capture payment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const captureData = await captureResponse.json();

    if (captureData.status !== "COMPLETED") {
      console.error("PayPal order not completed:", captureData);
      return new Response(JSON.stringify({ error: "Payment was not completed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get capture ID
    const captureId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id;

    // Use service role to update database
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // Get the pending purchase
    const { data: purchase, error: purchaseError } = await adminSupabase
      .from("credit_purchases")
      .select("*")
      .eq("paypal_order_id", order_id)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .single();

    if (purchaseError || !purchase) {
      console.error("Purchase not found:", purchaseError);
      return new Response(JSON.stringify({ error: "Purchase record not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update purchase status
    const { error: updateError } = await adminSupabase
      .from("credit_purchases")
      .update({
        status: "completed",
        paypal_capture_id: captureId,
      })
      .eq("id", purchase.id);

    if (updateError) {
      console.error("Error updating purchase:", updateError);
    }

    // Add credits to user's wallet
    const { data: wallet } = await adminSupabase
      .from("credit_wallet")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();

    const currentBalance = wallet?.balance || 0;
    const newBalance = currentBalance + purchase.credits;

    if (wallet) {
      await adminSupabase
        .from("credit_wallet")
        .update({
          balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    } else {
      await adminSupabase.from("credit_wallet").insert({
        user_id: user.id,
        balance: newBalance,
        daily_remaining: 0,
      });
    }

    // Record credit usage
    await adminSupabase.from("credit_usage").insert({
      user_id: user.id,
      type: "income",
      amount: purchase.credits,
      reason: "buy_credits_paypal",
    });

    return new Response(
      JSON.stringify({
        success: true,
        credits: purchase.credits,
        newBalance,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in paypal-capture-order:", error);
    return new Response(JSON.stringify({ error: "Failed to process payment. Please contact support." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
