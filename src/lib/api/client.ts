/**
 * API Client Configuration
 * Centralized API client with timeout, retry, proper error handling,
 * and automatic JWT authentication for POST requests.
 */

import { API_CONFIG } from '@/lib/constants';
import { getJWT, clearAuth } from '@/lib/auth/auth.service';

type RequestConfig = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string | number | boolean>;
  /** Override default timeout (ms) */
  timeout?: number;
  /** Override default retry count */
  retries?: number;
  /** AbortSignal for external cancellation */
  signal?: AbortSignal;
  /** Skip automatic auth header injection (e.g. for /auth/* endpoints) */
  skipAuth?: boolean;
};

type ApiError = {
  message: string;
  status: number;
  data?: unknown;
};

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL?: string) {
    this.baseURL = baseURL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  }

  private async request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    const {
      method = 'GET',
      headers = {},
      body,
      params,
      timeout = API_CONFIG.timeout,
      retries = method === 'GET' ? API_CONFIG.retryAttempts : 0, // Only retry reads by default
      signal: externalSignal,
      skipAuth = false,
    } = config;

    // Build URL with query parameters
    const url = endpoint.startsWith('http') ? new URL(endpoint) : new URL(endpoint, this.baseURL);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    // Automatically attach JWT for:
    // - all non-GET requests
    // - GET /withdraw-intents* requests (currently auth-protected on backend)
    const resolvedHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    const isAuthEndpoint = endpoint.startsWith('/auth/') || endpoint.startsWith('/auth');
    const isProtectedWithdrawGet = method === 'GET' && endpoint.startsWith('/withdraw-intents');
    const isProtectedPortfolioGet =
      method === 'GET' && endpoint.startsWith('/aggregated/portfolio');
    if (
      !skipAuth &&
      !isAuthEndpoint &&
      (method !== 'GET' || isProtectedWithdrawGet || isProtectedPortfolioGet)
    ) {
      const jwt = getJWT();
      if (jwt) {
        resolvedHeaders['Authorization'] = `Bearer ${jwt}`;
      }
    }

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers: resolvedHeaders,
    };

    // Add body for non-GET requests
    if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify(body);
    }

    let lastError: ApiError | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      // Create a timeout-aware AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort('Request timeout'), timeout);

      // Combine external signal with our timeout signal
      if (externalSignal) {
        externalSignal.addEventListener('abort', () => controller.abort(externalSignal.reason), {
          once: true,
        });
      }

      try {
        const response = await fetch(url.toString(), {
          ...requestOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle non-OK responses
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const error: ApiError = {
            message: errorData.message || `HTTP error! status: ${response.status}`,
            status: response.status,
            data: errorData,
          };

          // On 401, clear auth state so the app can trigger re-login
          if (response.status === 401 && !isAuthEndpoint) {
            clearAuth();
          }

          // Don't retry client errors (4xx) — they won't succeed on retry
          if (response.status >= 400 && response.status < 500) {
            throw error;
          }

          // Server errors (5xx) — retry
          lastError = error;
          if (attempt < retries) {
            const delay = API_CONFIG.retryDelay * 2 ** attempt;
            console.warn(
              `[ApiClient] Request failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms:`,
              error.message
            );
            await sleep(delay);
            continue;
          }
          throw error;
        }

        // Handle empty responses
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          return {} as T;
        }

        return await response.json();
      } catch (error) {
        clearTimeout(timeoutId);

        // If externally aborted, throw immediately without retry
        if (externalSignal?.aborted) {
          throw {
            message: 'Request was cancelled',
            status: 0,
          } as ApiError;
        }

        // Re-throw API errors (already formatted)
        if (error && typeof error === 'object' && 'status' in error && (error as ApiError).status >= 400) {
          throw error;
        }

        // Handle timeout
        if (error instanceof DOMException && error.name === 'AbortError') {
          lastError = {
            message: `Request timed out after ${timeout}ms`,
            status: 408,
          };
          if (attempt < retries) {
            const delay = API_CONFIG.retryDelay * 2 ** attempt;
            console.warn(
              `[ApiClient] Request timed out (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms`
            );
            await sleep(delay);
            continue;
          }
          throw lastError;
        }

        // Handle network errors
        lastError = {
          message: 'Network error. Please check your connection.',
          status: 0,
        };
        if (attempt < retries) {
          const delay = API_CONFIG.retryDelay * 2 ** attempt;
          console.warn(
            `[ApiClient] Network error (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms`
          );
          await sleep(delay);
          continue;
        }
        throw lastError;
      }
    }

    // Should not reach here, but just in case
    throw lastError || { message: 'Unknown error', status: 0 };
  }

  // HTTP Methods
  async get<T>(endpoint: string, params?: RequestConfig['params'], config?: Pick<RequestConfig, 'signal' | 'timeout'>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', params, ...config });
  }

  async post<T>(
    endpoint: string,
    body?: unknown,
    config?: Omit<RequestConfig, 'method' | 'body'>
  ): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body, ...config });
  }

  async put<T>(
    endpoint: string,
    body?: unknown,
    config?: Omit<RequestConfig, 'method' | 'body'>
  ): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body, ...config });
  }

  async patch<T>(
    endpoint: string,
    body?: unknown,
    config?: Omit<RequestConfig, 'method' | 'body'>
  ): Promise<T> {
    return this.request<T>(endpoint, { method: 'PATCH', body, ...config });
  }

  async delete<T>(endpoint: string, config?: Omit<RequestConfig, 'method'>): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', ...config });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export types
export type { ApiError, RequestConfig };
