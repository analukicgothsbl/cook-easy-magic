import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CREDIT_TYPES = new Set(["income", "cost"]);
const CREDIT_REASONS = new Set([
  "signup_bonus",
  "friend_bonus",
  "generate_recipe",
  "generate_recipe_image",
  "bonus_credit",
  "donate_bonus",
  "purchased_credit",
  "admin_bonus",
  "buy_credits_paypal",
  "generate_meal_planner",
]);

type CreditType = "income" | "cost";

interface Payload {
  identifier?: unknown;
  email?: unknown;
  user_id?: unknown;
  type?: unknown;
  amount?: unknown;
  reason?: unknown;
}

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseLookup(payload: Payload): { email: string | null; userId: string | null } {
  const email = parseString(payload.email);
  const userId = parseString(payload.user_id);
  const identifier = parseString(payload.identifier);

  if (email && userId) {
    return { email: null, userId: null };
  }

  if (email) {
    return { email: email.toLowerCase(), userId: null };
  }

  if (userId) {
    return { email: null, userId };
  }

  if (!identifier) {
    return { email: null, userId: null };
  }

  if (identifier.includes("@")) {
    return { email: identifier.toLowerCase(), userId: null };
  }

  return { email: null, userId: identifier };
}

async function findUserIdByEmail(
  adminClient: ReturnType<typeof createClient>,
  email: string,
): Promise<string | null> {
  const normalizedEmail = email.toLowerCase();
  const perPage = 200;
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    const users = data?.users ?? [];
    const matched = users.find((user) => (user.email ?? "").toLowerCase() === normalizedEmail);
    if (matched?.id) return matched.id;
    if (users.length < perPage) return null;

    page += 1;
    if (page > 500) {
      throw new Error("User lookup pagination exceeded safe limit");
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return response(405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return response(500, { error: "Server misconfigured" });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return response(400, { error: "Invalid JSON body" });
  }

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user?.id) {
    return response(401, { error: "Authentication required" });
  }

  const { data: isAdminResult, error: isAdminError } = await adminClient.rpc("is_admin", {
    _user_id: user.id,
  });

  if (isAdminError) {
    return response(500, { error: `Failed to verify admin role: ${isAdminError.message}` });
  }

  if (!isAdminResult) {
    return response(403, { error: "Admin access required" });
  }

  const { email, userId } = parseLookup(payload);
  if (!email && !userId) {
    return response(400, { error: "Provide exactly one of: email or user_id" });
  }

  let targetUserId: string | null = null;

  if (email) {
    if (!EMAIL_REGEX.test(email)) {
      return response(400, { error: "Invalid email format" });
    }

    targetUserId = await findUserIdByEmail(adminClient, email);
    if (!targetUserId) {
      return response(404, { error: "User not found for provided email" });
    }
  } else {
    if (!UUID_REGEX.test(userId!)) {
      return response(400, { error: "Invalid user_id format (UUID expected)" });
    }

    const { data: foundUser, error: foundUserError } = await adminClient.auth.admin.getUserById(userId!);
    if (foundUserError || !foundUser?.user?.id) {
      return response(404, { error: "User not found for provided user_id" });
    }
    targetUserId = foundUser.user.id;
  }

  const creditType = parseString(payload.type) as CreditType | null;
  const reason = parseString(payload.reason);
  const amount = Number(payload.amount);

  if (!creditType || !CREDIT_TYPES.has(creditType)) {
    return response(400, { error: "Invalid credit type" });
  }
  if (!reason || !CREDIT_REASONS.has(reason)) {
    return response(400, { error: "Invalid credit reason" });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return response(400, { error: "Amount must be a positive number" });
  }

  const { data: wallet, error: walletReadError } = await adminClient
    .from("credit_wallet")
    .select("balance, daily_remaining")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (walletReadError) {
    return response(500, { error: `Failed to read wallet: ${walletReadError.message}` });
  }

  const currentBalance = Number(wallet?.balance ?? 0);
  const newBalance = creditType === "income" ? currentBalance + amount : currentBalance - amount;

  if (wallet) {
    const { error: walletUpdateError } = await adminClient
      .from("credit_wallet")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("user_id", targetUserId);

    if (walletUpdateError) {
      return response(500, { error: `Failed to update wallet: ${walletUpdateError.message}` });
    }
  } else {
    const { error: walletInsertError } = await adminClient.from("credit_wallet").insert({
      user_id: targetUserId,
      balance: newBalance,
      daily_remaining: 0,
      updated_at: new Date().toISOString(),
    });

    if (walletInsertError) {
      return response(500, { error: `Failed to create wallet: ${walletInsertError.message}` });
    }
  }

  const { error: usageInsertError } = await adminClient.from("credit_usage").insert({
    user_id: targetUserId,
    type: creditType,
    amount,
    reason,
    recipe_id: null,
    created_at: new Date().toISOString(),
  });

  if (usageInsertError) {
    return response(500, { error: `Failed to insert credit usage: ${usageInsertError.message}` });
  }

  return response(200, {
    ok: true,
    target_user_id: targetUserId,
    type: creditType,
    amount,
    reason,
    new_balance: newBalance,
  });
});
