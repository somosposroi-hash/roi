/**
 * Safe API fetcher with automatic JSON validation, retry on server startup/wake-up,
 * and prevention of SyntaxError: Unexpected token '<' on HTML error responses.
 */

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  pagination?: any;
  rawJson?: any;
  error?: string;
}

export async function safeFetchJson<T = any>(
  url: string,
  options: RequestInit = {},
  retries = 3
): Promise<ApiResponse<T>> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const mergedOptions: RequestInit = {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  };

  let lastError: any = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, mergedOptions);
      const contentType = res.headers.get('content-type') || '';

      if (!contentType.includes('application/json')) {
        // If the server returned HTML (e.g., 502/503 during cold boot or 404 page),
        // retry after delay
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
          continue;
        }
        return {
          ok: false,
          status: res.status,
          error: `Respuesta no válida del servidor (${res.status})`,
        };
      }

      const json = await res.json();
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          error: json.error || json.message || `Error HTTP ${res.status}`,
          data: json.data,
        };
      }

      return {
        ok: true,
        status: res.status,
        data: json.data !== undefined ? json.data : json,
        pagination: json.pagination,
        rawJson: json,
      };
    } catch (err: any) {
      lastError = err;
      // If network failed (e.g. Failed to fetch while server was starting/waking), retry
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
      }
    }
  }

  // Graceful failure return instead of unhandled rejection
  return {
    ok: false,
    status: 0,
    error: lastError?.message || 'No se pudo conectar con el servidor',
  };
}
