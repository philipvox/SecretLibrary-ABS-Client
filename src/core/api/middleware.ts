/**
 * src/core/api/middleware.ts
 *
 * Request/response middleware system for the API client.
 * Allows hooking into the request lifecycle for logging, auth refresh, offline handling, etc.
 */

import { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

/**
 * Request middleware context
 */
export interface RequestContext {
  url: string;
  method: string;
  config: AxiosRequestConfig;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Response middleware context
 */
export interface ResponseContext<T = unknown> {
  request: RequestContext;
  response: AxiosResponse<T>;
  duration: number;
}

/**
 * Error middleware context
 */
export interface ErrorContext {
  request: RequestContext;
  error: AxiosError;
  duration: number;
}

/**
 * Request middleware function signature
 */
export type RequestMiddleware = (
  context: RequestContext
) => Promise<RequestContext> | RequestContext;

/**
 * Response middleware function signature
 */
export type ResponseMiddleware = <T>(
  context: ResponseContext<T>
) => Promise<ResponseContext<T>> | ResponseContext<T>;

/**
 * Error middleware function signature
 */
export type ErrorMiddleware = (
  context: ErrorContext
) => Promise<ErrorContext | never> | ErrorContext | never;

/**
 * Middleware manager for API requests
 */
class MiddlewareManager {
  private requestMiddleware: RequestMiddleware[] = [];
  private responseMiddleware: ResponseMiddleware[] = [];
  private errorMiddleware: ErrorMiddleware[] = [];

  /**
   * Add request middleware (runs before request is sent)
   */
  useRequest(middleware: RequestMiddleware): () => void {
    this.requestMiddleware.push(middleware);
    return () => {
      const index = this.requestMiddleware.indexOf(middleware);
      if (index > -1) this.requestMiddleware.splice(index, 1);
    };
  }

  /**
   * Add response middleware (runs after successful response)
   */
  useResponse(middleware: ResponseMiddleware): () => void {
    this.responseMiddleware.push(middleware);
    return () => {
      const index = this.responseMiddleware.indexOf(middleware);
      if (index > -1) this.responseMiddleware.splice(index, 1);
    };
  }

  /**
   * Add error middleware (runs on request error)
   */
  useError(middleware: ErrorMiddleware): () => void {
    this.errorMiddleware.push(middleware);
    return () => {
      const index = this.errorMiddleware.indexOf(middleware);
      if (index > -1) this.errorMiddleware.splice(index, 1);
    };
  }

  /**
   * Execute request middleware chain
   */
  async executeRequestMiddleware(
    context: RequestContext
  ): Promise<RequestContext> {
    let ctx = context;
    for (const middleware of this.requestMiddleware) {
      ctx = await middleware(ctx);
    }
    return ctx;
  }

  /**
   * Execute response middleware chain
   */
  async executeResponseMiddleware<T>(
    context: ResponseContext<T>
  ): Promise<ResponseContext<T>> {
    let ctx = context;
    for (const middleware of this.responseMiddleware) {
      ctx = (await middleware(ctx)) as ResponseContext<T>;
    }
    return ctx;
  }

  /**
   * Execute error middleware chain
   */
  async executeErrorMiddleware(context: ErrorContext): Promise<ErrorContext> {
    let ctx = context;
    for (const middleware of this.errorMiddleware) {
      ctx = await middleware(ctx);
    }
    return ctx;
  }

  /**
   * Clear all middleware
   */
  clear(): void {
    this.requestMiddleware = [];
    this.responseMiddleware = [];
    this.errorMiddleware = [];
  }
}

/**
 * Singleton middleware manager instance
 */
export const middlewareManager = new MiddlewareManager();

// ============================================================================
// Built-in Middleware
// ============================================================================

/**
 * Logging middleware - logs all requests/responses in development
 */
export const loggingMiddleware = {
  request: ((context: RequestContext) => {
    if (__DEV__) {
      console.log(`[API] → ${context.method} ${context.url}`);
    }
    return context;
  }) as RequestMiddleware,

  response: (<T>(context: ResponseContext<T>) => {
    if (__DEV__) {
      console.log(
        `[API] ← ${context.request.method} ${context.request.url} (${context.duration}ms)`
      );
    }
    return context;
  }) as ResponseMiddleware,

  error: ((context: ErrorContext) => {
    if (__DEV__) {
      console.error(
        `[API] ✗ ${context.request.method} ${context.request.url} (${context.duration}ms)`,
        context.error.message
      );
    }
    return context;
  }) as ErrorMiddleware,
};

/**
 * Performance tracking middleware
 */
interface PerformanceMetrics {
  requestCount: number;
  errorCount: number;
  totalDuration: number;
  averageDuration: number;
  slowRequests: Array<{ url: string; duration: number }>;
}

class PerformanceTracker {
  private metrics: PerformanceMetrics = {
    requestCount: 0,
    errorCount: 0,
    totalDuration: 0,
    averageDuration: 0,
    slowRequests: [],
  };
  private readonly slowThreshold = 3000; // 3 seconds

  response: ResponseMiddleware = <T>(context: ResponseContext<T>) => {
    this.metrics.requestCount++;
    this.metrics.totalDuration += context.duration;
    this.metrics.averageDuration =
      this.metrics.totalDuration / this.metrics.requestCount;

    if (context.duration > this.slowThreshold) {
      this.metrics.slowRequests.push({
        url: context.request.url,
        duration: context.duration,
      });
      // Keep only last 10 slow requests
      if (this.metrics.slowRequests.length > 10) {
        this.metrics.slowRequests.shift();
      }
    }

    return context;
  };

  error: ErrorMiddleware = (context: ErrorContext) => {
    this.metrics.errorCount++;
    return context;
  };

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      totalDuration: 0,
      averageDuration: 0,
      slowRequests: [],
    };
  }
}

export const performanceTracker = new PerformanceTracker();

/**
 * Auth token refresh middleware
 * Can be used to automatically refresh tokens on 401 errors
 */
export function createAuthRefreshMiddleware(
  refreshToken: () => Promise<string | null>,
  setToken: (token: string) => void
): ErrorMiddleware {
  let isRefreshing = false;
  let refreshPromise: Promise<string | null> | null = null;

  return async (context: ErrorContext) => {
    const status = context.error.response?.status;

    if (status !== 401 || isRefreshing) {
      return context;
    }

    isRefreshing = true;

    try {
      // Reuse existing refresh promise to prevent multiple refresh calls
      if (!refreshPromise) {
        refreshPromise = refreshToken();
      }

      const newToken = await refreshPromise;

      if (newToken) {
        setToken(newToken);
        // Note: The actual retry would need to be handled by the caller
        // This middleware just handles the token refresh
      }
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }

    return context;
  };
}

/**
 * Offline detection middleware
 * Adds offline flag to request context
 */
export const offlineMiddleware: RequestMiddleware = (context: RequestContext) => {
  return {
    ...context,
    metadata: {
      ...context.metadata,
      offline: typeof navigator !== 'undefined' && !navigator.onLine,
    },
  };
};
