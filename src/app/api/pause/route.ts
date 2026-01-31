import { NextRequest, NextResponse } from 'next/server'
import { pauseMonitor } from '@/lib/storage'
import { z } from 'zod'

const pauseSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().optional(),
  until: z.string().datetime().optional()
})

// POST /api/pause - Pause a monitor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = pauseSchema.parse(body)

    const monitor = pauseMonitor(validated.id, validated.reason, validated.until)
    if (!monitor) {
      return NextResponse.json({ error: 'Monitor not found' }, { status: 404 })
    }

    return NextResponse.json(monitor)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: error.issues.map(e => e.message).join(', ')
      }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
