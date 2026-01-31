import { NextRequest, NextResponse } from 'next/server'
import { recordPing, getMonitor } from '@/lib/storage'
import { pingSchema } from '@/lib/validation'
import { checkRateLimit } from '@/lib/rate-limit'
import { ZodError } from 'zod'

function getClientIp(request: NextRequest): string | undefined {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
         request.headers.get('x-real-ip') ||
         undefined
}

function rateLimitHeaders(remaining: number, resetAt: number): HeadersInit {
  return {
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(resetAt / 1000).toString()
  }
}

// GET /api/ping/[id] - Record a ping (for simplicity, using GET like healthchecks.io)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const startTime = Date.now()

  // Check rate limit
  const rateLimit = checkRateLimit(id)
  if (!rateLimit.allowed) {
    return new NextResponse('Rate limit exceeded', {
      status: 429,
      headers: {
        'Content-Type': 'text/plain',
        'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
        ...rateLimitHeaders(rateLimit.remaining, rateLimit.resetAt)
      }
    })
  }

  const monitor = getMonitor(id)
  if (!monitor) {
    return NextResponse.json({ error: 'Monitor not found' }, { status: 404 })
  }

  const duration = Date.now() - startTime
  const ip = getClientIp(request)
  const ping = recordPing(id, true, duration, undefined, ip)

  return new NextResponse('OK', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'X-Ping-ID': ping?.id || '',
      ...rateLimitHeaders(rateLimit.remaining, rateLimit.resetAt)
    }
  })
}

// POST /api/ping/[id] - Record a ping with details
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Check rate limit
  const rateLimit = checkRateLimit(id)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
          ...rateLimitHeaders(rateLimit.remaining, rateLimit.resetAt)
        }
      }
    )
  }

  const monitor = getMonitor(id)
  if (!monitor) {
    return NextResponse.json({ error: 'Monitor not found' }, { status: 404 })
  }

  let success = true
  let duration: number | undefined
  let message: string | undefined

  // Check if there's a request body
  const contentLength = request.headers.get('content-length')
  const hasBody = contentLength && parseInt(contentLength) > 0

  if (hasBody) {
    try {
      const body = await request.json()
      const validated = pingSchema.parse(body)
      success = validated.success
      duration = validated.duration
      message = validated.message
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json({ error: 'Invalid request body', details: error.issues }, { status: 400 })
      }
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
  }

  const ip = getClientIp(request)
  const ping = recordPing(id, success, duration, message, ip)

  return NextResponse.json(
    {
      status: 'ok',
      ping_id: ping?.id,
      monitor: {
        id: monitor.id,
        name: monitor.name,
        status: monitor.status
      }
    },
    {
      headers: rateLimitHeaders(rateLimit.remaining, rateLimit.resetAt)
    }
  )
}
