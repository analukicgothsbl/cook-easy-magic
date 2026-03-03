export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ResolveUserDeps {
  authenticate: () => Promise<string | null>;
  isAdmin: (userId: string) => Promise<boolean>;
  findUserIdByEmail: (email: string) => Promise<string | null>;
  userExists: (userId: string) => Promise<boolean>;
}

interface ResolveUserPayload {
  identifier?: unknown;
  email?: unknown;
  user_id?: unknown;
}

function jsonResponse(status: number, body: Record<string, unknown>) {
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

function parseLookup(payload: ResolveUserPayload): { email: string | null; userId: string | null } {
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

export async function handleResolveUserRequest(req: Request, deps: ResolveUserDeps): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const authedUserId = await deps.authenticate();
  if (!authedUserId) {
    return jsonResponse(401, { error: "Authentication required" });
  }

  const hasAdminAccess = await deps.isAdmin(authedUserId);
  if (!hasAdminAccess) {
    return jsonResponse(403, { error: "Admin access required" });
  }

  let payload: ResolveUserPayload;
  try {
    payload = (await req.json()) as ResolveUserPayload;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const { email, userId } = parseLookup(payload);

  if (!email && !userId) {
    return jsonResponse(400, { error: "Provide exactly one of: email or user_id" });
  }

  if (email) {
    if (!EMAIL_REGEX.test(email)) {
      return jsonResponse(400, { error: "Invalid email format" });
    }

    const resolvedUserId = await deps.findUserIdByEmail(email);
    if (!resolvedUserId) {
      return jsonResponse(404, { error: "User not found for provided email" });
    }

    return jsonResponse(200, { user_id: resolvedUserId });
  }

  if (!UUID_REGEX.test(userId!)) {
    return jsonResponse(400, { error: "Invalid user_id format (UUID expected)" });
  }

  const exists = await deps.userExists(userId!);
  if (!exists) {
    return jsonResponse(404, { error: "User not found for provided user_id" });
  }

  return jsonResponse(200, { user_id: userId });
}
