import type { Adapter, AdapterUser, AdapterAccount, VerificationToken } from "@auth/core/adapters";

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const ADAPTER_SECRET = process.env.ADAPTER_SECRET;

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

export function FastAPIAdapter(): Adapter {
  return {
    async createUser(data) {
      const user = await fetchAdapter<AdapterUser>("/api/internal/auth/users", {
        method: "POST",
        body: JSON.stringify({
          email: data.email,
          name: data.name,
          image: data.image,
          email_verified: data.emailVerified?.toISOString(),
        }),
      });
      if (!user) throw new Error("Failed to create user");
      return { ...(user as any), emailVerified: (user as any).email_verified ? new Date((user as any).email_verified) : null } as any;
    },

    async getUser(id) {
      const user = await fetchAdapter<any>(`/api/internal/auth/users/${id}`);
      if (!user) return null;
      return { ...user, emailVerified: user.email_verified ? new Date(user.email_verified) : null } as any;
    },

    async getUserByEmail(email) {
      const user = await fetchAdapter<any>(`/api/internal/auth/users/by-email/${encodeURIComponent(email)}`);
      if (!user) return null;
      return { ...user, emailVerified: user.email_verified ? new Date(user.email_verified) : null } as any;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const user = await fetchAdapter<any>(
        `/api/internal/auth/users/by-account/${provider}/${encodeURIComponent(providerAccountId)}`
      );
      if (!user) return null;
      return { ...user, emailVerified: user.email_verified ? new Date(user.email_verified) : null } as any;
    },

    async updateUser(data) {
      const user = await fetchAdapter<any>(`/api/internal/auth/users/${data.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: (data as any).name,
          image: (data as any).image,
          email_verified: (data as any).emailVerified?.toISOString(),
        }),
      });
      if (!user) throw new Error("Failed to update user");
      return { ...user, emailVerified: user.email_verified ? new Date(user.email_verified) : null } as any;
    },

    async deleteUser(id) {
      await fetchAdapter(`/api/internal/auth/users/${id}`, { method: "DELETE" });
    },

    async linkAccount(data) {
      const account = await fetchAdapter<AdapterAccount>("/api/internal/auth/accounts", {
        method: "POST",
        body: JSON.stringify({
          user_id: (data as any).userId,
          type: (data as any).type,
          provider: (data as any).provider,
          provider_account_id: (data as any).providerAccountId,
          refresh_token: (data as any).refresh_token,
          access_token: (data as any).access_token,
          expires_at: (data as any).expires_at,
          token_type: (data as any).token_type,
          scope: (data as any).scope,
          id_token: (data as any).id_token,
        }),
      });
      return account as any;
    },

    async unlinkAccount({ provider, providerAccountId }) {
      await fetchAdapter(`/api/internal/auth/accounts/${provider}/${encodeURIComponent(providerAccountId)}`, {
        method: "DELETE",
      });
    },

    async createVerificationToken(data) {
      const vt = await fetchAdapter<VerificationToken>("/api/internal/auth/verification-tokens", {
        method: "POST",
        body: JSON.stringify({
          identifier: (data as any).identifier,
          token: (data as any).token,
          expires: (data as any).expires.toISOString(),
        }),
      });
      if (!vt) return null;
      return { ...(vt as any), expires: new Date((vt as any).expires) } as any;
    },

    async useVerificationToken({ identifier, token }) {
      const vt = await fetchAdapter<any>("/api/internal/auth/verification-tokens/use", {
        method: "POST",
        body: JSON.stringify({ identifier, token }),
      });
      if (!vt) return null;
      return { ...vt, expires: new Date(vt.expires) } as any;
    },
  };
}

