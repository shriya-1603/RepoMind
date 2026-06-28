export interface ApiErrorResponse {
  status: number;
  message: string;
  detail?: string;
}

// In dev, use a relative base URL so all requests go through the Vite proxy
// and never hit CORS. In production, use the configured API URL.
const IS_DEV = import.meta.env.DEV;
const BASE_URL = IS_DEV ? '' : (import.meta.env.VITE_API_URL ?? 'http://localhost:8000');

export const apiFetch = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const url = `${BASE_URL}${path}`;

  if (IS_DEV) {
    console.debug(`[API] ${init.method ?? 'GET'} ${url}`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...init,
    });
  } catch (networkError) {
    // Network-level failure (CORS block, server unreachable, DNS failure, etc.)
    const msg = networkError instanceof Error
      ? networkError.message
      : 'Network request failed';
    if (IS_DEV) {
      console.error(`[API] Network error for ${url}:`, networkError);
    }
    throw new Error(`Network error: ${msg}`);
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const errorMessage = errorBody?.detail || errorBody?.message || response.statusText;
    if (IS_DEV) {
      console.error(`[API] HTTP ${response.status} for ${url}:`, errorBody);
    }
    throw new Error(`HTTP ${response.status}: ${errorMessage}`);
  }

  return response.json() as Promise<T>;
};
