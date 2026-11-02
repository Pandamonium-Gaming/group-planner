/**
 * Standardized error handling utilities to reduce boilerplate in try/catch blocks
 * 
 * @example
 * try {
 *   // ... async operation
 * } catch (err) {
 *   handleAsyncError(err, 'Operation failed', {
 *     context: 'UserUpdate',
 *     userId: user.id
 *   });
 *   setError('Failed to update user');
 * }
 */

export interface ErrorContext {
  context?: string;
  [key: string]: unknown;
}

/**
 * Log an error with optional context
 * - Console error for development
 * - Could be extended for error tracking services
 */
export function logError(error: unknown, message: string, context?: ErrorContext): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  if (context) {
    console.error(`${message} (${context.context || 'unknown context'}):`, {
      error: errorMessage,
      ...context,
    });
  } else {
    console.error(`${message}:`, errorMessage);
  }
}

/**
 * Extract a user-friendly error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message : String(message ?? 'An unknown error occurred');
  }
  return 'An unknown error occurred';
}

/**
 * Handle async operation errors with consistent logging
 * @returns User-friendly error message
 */
export function handleAsyncError(
  error: unknown,
  fallbackMessage: string,
  context?: ErrorContext
): string {
  logError(error, fallbackMessage, context);
  return getErrorMessage(error) || fallbackMessage;
}
