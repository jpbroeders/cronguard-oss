import { NextResponse } from 'next/server'

// Standardized API response helpers for consistent error/success formats

interface ErrorResponse {
  error: string
  details?: unknown
}

interface SuccessResponse<T> {
  success: true
  data: T
}

export function errorResponse(message: string, status: number, details?: unknown): NextResponse<ErrorResponse> {
  const body: ErrorResponse = { error: message }
  if (details !== undefined) {
    body.details = details
  }
  return NextResponse.json(body, { status })
}

export function successResponse<T>(data: T, status: number = 200): NextResponse<SuccessResponse<T>> {
  return NextResponse.json({ success: true, data }, { status })
}

// Common error responses
export const Errors = {
  notFound: (resource: string) => errorResponse(`${resource} not found`, 404),
  badRequest: (message: string, details?: unknown) => errorResponse(message, 400, details),
  rateLimited: (retryAfter: number) =>
    NextResponse.json(
      { error: 'Rate limit exceeded' },
      {
        status: 429,
        headers: { 'Retry-After': retryAfter.toString() }
      }
    ),
}
