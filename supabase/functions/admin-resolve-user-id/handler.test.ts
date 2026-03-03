import { handleResolveUserRequest, type ResolveUserDeps } from "./handler.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function buildDeps(overrides?: Partial<ResolveUserDeps>): ResolveUserDeps {
  return {
    authenticate: async () => "admin-user-id",
    isAdmin: async () => true,
    findUserIdByEmail: async () => null,
    userExists: async () => false,
    ...overrides,
  };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

Deno.test("returns user_id for valid email", async () => {
  const deps = buildDeps({
    findUserIdByEmail: async (email: string) => {
      assert(email === "target@example.com", "Email should be normalized to lowercase");
      return "123e4567-e89b-12d3-a456-426614174000";
    },
  });

  const response = await handleResolveUserRequest(
    new Request("http://localhost/admin-resolve-user-id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "Target@Example.com" }),
    }),
    deps,
  );

  const body = await readJson(response);
  assert(response.status === 200, "Expected 200 status");
  assert(body.user_id === "123e4567-e89b-12d3-a456-426614174000", "Expected resolved user_id");
});

Deno.test("returns 404 for unknown email", async () => {
  const response = await handleResolveUserRequest(
    new Request("http://localhost/admin-resolve-user-id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "missing@example.com" }),
    }),
    buildDeps({
      findUserIdByEmail: async () => null,
    }),
  );

  const body = await readJson(response);
  assert(response.status === 404, "Expected 404 status");
  assert(body.error === "User not found for provided email", "Expected unknown email error");
});

Deno.test("returns 403 for non-admin caller", async () => {
  const response = await handleResolveUserRequest(
    new Request("http://localhost/admin-resolve-user-id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "target@example.com" }),
    }),
    buildDeps({
      isAdmin: async () => false,
    }),
  );

  const body = await readJson(response);
  assert(response.status === 403, "Expected 403 status");
  assert(body.error === "Admin access required", "Expected admin access error");
});

Deno.test("returns 400 for invalid UUID", async () => {
  const response = await handleResolveUserRequest(
    new Request("http://localhost/admin-resolve-user-id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: "not-a-uuid" }),
    }),
    buildDeps(),
  );

  const body = await readJson(response);
  assert(response.status === 400, "Expected 400 status");
  assert(body.error === "Invalid user_id format (UUID expected)", "Expected invalid uuid error");
});
