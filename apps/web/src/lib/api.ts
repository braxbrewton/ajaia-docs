// Thin typed fetch wrapper. The browser always talks to /api/*, which Next proxies to FastAPI
// (see next.config.ts), so the session cookie is same-origin.

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Options = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  json?: unknown;
  body?: FormData;
  keepalive?: boolean;
};

function describeValidation(details: unknown): string | null {
  if (!Array.isArray(details) || details.length === 0) return null;
  const first = details[0] as { msg?: string; loc?: (string | number)[] };
  const field = first.loc?.filter((p) => p !== "body").join(".");
  const msg = first.msg?.replace(/^Value error, /, "");
  return field ? `${field}: ${msg}` : (msg ?? null);
}

export async function api<T = void>(path: string, opts: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: opts.method ?? "GET",
      headers: opts.json !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body,
      credentials: "same-origin",
      keepalive: opts.keepalive,
    });
  } catch {
    throw new ApiError(0, "network", "Can't reach the server. Check your connection and try again.");
  }

  if (res.status === 204) return undefined as T;

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    const err = payload?.error;
    const message =
      (res.status === 422 ? describeValidation(err?.details) : null) ??
      err?.message ??
      (res.status >= 500 ? "The server had a problem. Please try again." : "Request failed");
    throw new ApiError(res.status, err?.code ?? `http_${res.status}`, message);
  }
  return payload as T;
}

export const fetcher = <T,>(path: string) => api<T>(path);
