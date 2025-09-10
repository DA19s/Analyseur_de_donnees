export const API_BASE_URL: string =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  "http://localhost:8000";

function joinUrl(base: string, path: string): string {
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export async function apiFetch(inputPath: string, init?: RequestInit): Promise<Response> {
  const url = joinUrl(API_BASE_URL, inputPath);
  return fetch(url, init);
}



