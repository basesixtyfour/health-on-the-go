/**
 * API Utility functions for consistent error handling and responses
 */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

/**
 * Standard API error codes
 */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Standard error response format
 */
export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Create a standardized error response
 */
export function errorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  details?: Record<string, unknown>
): NextResponse<ApiError> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status }
  );
}

/**
 * Create a success response
 */
export function successResponse<T>(data: T, status: number = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

/**
 * Get the authenticated session or return an error response
 */
export async function getAuthenticatedSession() {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({
      headers: headersList,
    });
    return session;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

/**
 * Require authentication - returns session or throws
 */
export async function requireAuth(): Promise<{
  session: NonNullable<Awaited<ReturnType<typeof getAuthenticatedSession>>>;
  errorResponse: null;
} | {
  session: null;
  errorResponse: NextResponse<ApiError>;
}> {
  const session = await getAuthenticatedSession();

  if (!session) {
    return {
      session: null,
      errorResponse: errorResponse(
        ErrorCodes.UNAUTHORIZED,
        'Authentication required',
        401
      ),
    };
  }

  return { session, errorResponse: null };
}

// Re-export shared types for backward compatibility on server-side
export * from './types';

