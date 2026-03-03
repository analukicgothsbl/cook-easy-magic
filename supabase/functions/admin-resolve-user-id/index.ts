import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleResolveUserRequest } from "./handler.ts";

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    console.error("[admin-resolve-user-id] Missing required environment variables");
    return response(500, { error: "Server misconfigured" });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    return await handleResolveUserRequest(req, {
      authenticate: async () => {
        const {
          data: { user },
          error,
        } = await userClient.auth.getUser();

        if (error || !user) {
          return null;
        }

        return user.id;
      },
      isAdmin: async (userId: string) => {
        const { data, error } = await adminClient
          .from("user_extended")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle();

        if (error) {
          throw new Error(`Failed to verify admin role: ${error.message}`);
        }

        return data?.role === "admin";
      },
      findUserIdByEmail: async (email: string) => {
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

          if (matched?.id) {
            return matched.id;
          }

          if (users.length < perPage) {
            return null;
          }

          page += 1;

          // Guard against non-terminating pagination in case of unexpected API behavior.
          if (page > 500) {
            throw new Error("User lookup pagination exceeded safe limit");
          }
        }
      },
      userExists: async (userId: string) => {
        const { data, error } = await adminClient.auth.admin.getUserById(userId);

        if (error) {
          const message = error.message.toLowerCase();
          if (message.includes("not found")) {
            return false;
          }

          throw new Error(`Failed to fetch user by id: ${error.message}`);
        }

        return Boolean(data?.user?.id);
      },
    });
  } catch (error) {
    console.error("[admin-resolve-user-id] Error processing request:", error);
    return response(500, { error: "Failed to resolve user ID" });
  }
});
