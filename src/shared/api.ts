export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path.startsWith("/api/") ? path : `/api/v1${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const data = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
  if (!response.ok) {
    throw new ApiError(response.status, data?.error?.code ?? "request_failed", data?.error?.message ?? "Koneksi belum tersedia.");
  }
  return data as T;
}

export function audioUrl(assetId?: string | null): string | null {
  return assetId ? `/api/v1/audio/${encodeURIComponent(assetId)}` : null;
}
