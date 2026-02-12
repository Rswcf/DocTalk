import type { Adapter, AdapterUser, AdapterAccount, VerificationToken } from "@auth/core/adapters";

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const ADAPTER_SECRET = process.env.ADAPTER_SECRET;

interface BackendUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  email_verified?: string | null;
  credits_balance?: number;
  created_at?: string;
  updated_at?: string;
}

interface BackendAccount {
  id: string;
  user_id: string;
  type: string;
  provider: string;
  provider_account_id: string;
}

interface BackendVerificationToken {
  identifier: string;
  token: string;
  expires: string;
}

interface BackendLinkAccountRequest {
  user_id: string;
  type: AdapterAccount["type"];
  provider: string;
  provider_account_id: string;
  refresh_token?: string;
  access_token?: string;
  expires_at?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
}

// Validate ADAPTER_SECRET at startup
if (!ADAPTER_SECRET) {
  console.error("ADAPTER_SECRET environment variable is required for auth adapter");
}

async function fetchAdapter<T>(path: string, options: RequestInit = {}): Promise<T | null> {
  if (!ADAPTER_SECRET) {
    throw new Error("ADAPTER_SECRET not configured");
  }

  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Adapter-Secret": ADAPTER_SECRET,
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    // Log error without exposing details
    console.error(`Adapter request failed: ${res.status} for ${path}`);
    if (res.status >= 500) {
      throw new Error("Auth service temporarily unavailable");
    }
    throw new Error("Auth request failed");
  }
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : null;
}

function parseBackendDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toAdapterUser(data: BackendUser): AdapterUser {
  return {
    id: data.id,
    email: data.email,
    name: data.name ?? null,
    image: data.image ?? null,
    emailVerified: parseBackendDate(data.email_verified),
  };
}

function toAdapterAccount(data: BackendAccount): AdapterAccount {
  return {
    userId: data.user_id,
    type: data.type as AdapterAccount["type"],
    provider: data.provider,
    providerAccountId: data.provider_account_id,
  };
}

function toVerificationToken(data: BackendVerificationToken): VerificationToken {
  return {
    identifier: data.identifier,
    token: data.token,
    expires: new Date(data.expires),
  };
}

export function FastAPIAdapter(): Adapter {
  return {
    async createUser(data) {
      const user = await fetchAdapter<BackendUser>("/api/internal/auth/users", {
        method: "POST",
        body: JSON.stringify({
          email: data.email,
          name: data.name,
          image: data.image,
          email_verified: data.emailVerified?.toISOString(),
        }),
      });
      if (!user) throw new Error("Failed to create user");
      return toAdapterUser(user);
    },

    async getUser(id) {
      const user = await fetchAdapter<BackendUser>(`/api/internal/auth/users/${id}`);
      return user ? toAdapterUser(user) : null;
    },

    async getUserByEmail(email) {
      const user = await fetchAdapter<BackendUser>(`/api/internal/auth/users/by-email/${encodeURIComponent(email)}`);
      return user ? toAdapterUser(user) : null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const user = await fetchAdapter<BackendUser>(
        `/api/internal/auth/users/by-account/${provider}/${encodeURIComponent(providerAccountId)}`
      );
      return user ? toAdapterUser(user) : null;
    },

    async updateUser(data) {
      const user = await fetchAdapter<BackendUser>(`/api/internal/auth/users/${data.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: data.name,
          image: data.image,
          email_verified: data.emailVerified?.toISOString(),
        }),
      });
      if (!user) throw new Error("Failed to update user");
      return toAdapterUser(user);
    },

    async deleteUser(id) {
      await fetchAdapter(`/api/internal/auth/users/${id}`, { method: "DELETE" });
    },

    async linkAccount(data) {
      const payload: BackendLinkAccountRequest = {
        user_id: data.userId,
        type: data.type,
        provider: data.provider,
        provider_account_id: data.providerAccountId,
      };

      if (typeof data.refresh_token === "string") payload.refresh_token = data.refresh_token;
      if (typeof data.access_token === "string") payload.access_token = data.access_token;
      if (typeof data.expires_at === "number") payload.expires_at = data.expires_at;
      if (typeof data.token_type === "string") payload.token_type = data.token_type;
      if (typeof data.scope === "string") payload.scope = data.scope;
      if (typeof data.id_token === "string") payload.id_token = data.id_token;

      const account = await fetchAdapter<BackendAccount>("/api/internal/auth/accounts", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      return account ? toAdapterAccount(account) : null;
    },

    async unlinkAccount({ provider, providerAccountId }) {
      await fetchAdapter(`/api/internal/auth/accounts/${provider}/${encodeURIComponent(providerAccountId)}`, {
        method: "DELETE",
      });
    },

    async createVerificationToken(data) {
      const vt = await fetchAdapter<BackendVerificationToken>("/api/internal/auth/verification-tokens", {
        method: "POST",
        body: JSON.stringify({
          identifier: data.identifier,
          token: data.token,
          expires: data.expires.toISOString(),
        }),
      });

      return vt ? toVerificationToken(vt) : null;
    },

    async useVerificationToken({ identifier, token }) {
      const vt = await fetchAdapter<BackendVerificationToken>("/api/internal/auth/verification-tokens/use", {
        method: "POST",
        body: JSON.stringify({ identifier, token }),
      });

      return vt ? toVerificationToken(vt) : null;
    },
  };
}
