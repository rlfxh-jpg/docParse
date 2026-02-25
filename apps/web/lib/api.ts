export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api/v1";

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH";
  token?: string;
  body?: unknown;
}

export async function apiRequest<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    credentials: "include",
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as T | { message?: string }) : ({} as T);

  if (!response.ok) {
    const errorMessage =
      (data as { message?: string }).message ??
      `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(errorMessage);
  }

  return data as T;
}
