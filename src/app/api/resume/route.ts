import { NextRequest, NextResponse } from 'next/server'
import { resumeMonitor } from '@/lib/storage'
import { z } from 'zod'

const resumeSchema = z.object({
  id: z.string().uuid()
})

// POST /api/resume - Resume a paused monitor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = resumeSchema.parse(body)

    const monitor = resumeMonitor(validated.id)
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
