/**
 * Production-ready error handling utility
 * Handles errors gracefully without cluttering console in production
 */

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

export interface ApiError extends Error {
  status?: number;
  code?: string;
}

export class AppApiError extends Error implements ApiError {
  status?: number;
  code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'AppApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Safely log errors - only in development
 */
export function logError(error: unknown, context?: string): void {
  // Don't log auth errors (401/403) as they are expected when session expires or checking auth status
  if (isAuthError(error)) return;

  if (isDevelopment) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const prefix = context ? `[${context}]` : '[Error]';
    console.error(`${prefix}`, errorMessage, error);
  }
  // In production, errors are silently handled or sent to error tracking service
}

/**
 * Handle API errors gracefully
 */
export function handleApiError(error: unknown): ApiError {
  if (error instanceof AppApiError) {
    return error;
  }

  if (error instanceof Error) {
    // Try to parse error message for status codes if it's a generic error
    const statusMatch = error.message.match(/status (?:of )?(\d+)/i);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : undefined;
    
    const apiError: ApiError = new AppApiError(error.message, status);
    
    return apiError;
  }
  
  return new AppApiError(String(error));
}

/**
 * Check if error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('invalid') ||
      message.includes('expired') ||
      message.includes('token') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('401') ||
      message.includes('403')
    );
  }
  return false;
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection') ||
      message.includes('failed to fetch')
    );
  }
  return false;
}

/**
 * Safely execute async operations with error handling
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  fallback?: T,
  context?: string
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    logError(error, context);
    return fallback;
  }
}



