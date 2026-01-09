/**
 * API Client Configuration
 * Centralized API client for making HTTP requests
 */

type RequestConfig = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string | number | boolean>;
};

type ApiError = {
  message: string;
  status: number;
  data?: unknown;
};

class ApiClient {
  private baseURL: string;

  constructor(baseURL?: string) {
    this.baseURL = baseURL || process.env.NEXT_PUBLIC_API_URL || '';
  }

  private async request<T>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<T> {
    const { method = 'GET', headers = {}, body, params } = config;

    // Build URL with query parameters
    const url = new URL(endpoint, this.baseURL);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    // Add body for non-GET requests
    if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url.toString(), requestOptions);

      // Handle non-OK responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error: ApiError = {
          message: errorData.message || `HTTP error! status: ${response.status}`,
          status: response.status,
          data: errorData,
        };
        throw error;
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return {} as T;
      }

      return await response.json();
    } catch (error) {
      // Re-throw API errors
      if (error && typeof error === 'object' && 'status' in error) {
        throw error;
      }

      // Handle network errors
      throw {
        message: 'Network error. Please check your connection.',
        status: 0,
      } as ApiError;
    }
  }

  // HTTP Methods
  async get<T>(endpoint: string, params?: RequestConfig['params']): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', params });
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

  async delete<T>(
    endpoint: string,
    config?: Omit<RequestConfig, 'method'>
  ): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', ...config });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export types
export type { ApiError, RequestConfig };

