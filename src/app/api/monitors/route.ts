import { NextRequest, NextResponse } from 'next/server'
import { getAllMonitors, getMonitor, createMonitor, updateMonitor, deleteMonitor, getStats } from '@/lib/storage'
import { createMonitorSchema, updateMonitorSchema, monitorIdSchema } from '@/lib/validation'
import { ZodError } from 'zod'

function formatZodError(error: ZodError<unknown>): string {
  return error.issues.map((e) => e.message).join(', ')
}

// GET /api/monitors - List all monitors or get one by id
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  const stats = request.nextUrl.searchParams.get('stats')

  if (stats === 'true') {
    return NextResponse.json(getStats())
  }

  if (id) {
    const parseResult = monitorIdSchema.safeParse(id)
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid monitor ID format' }, { status: 400 })
    }

    const monitor = getMonitor(id)
    if (!monitor) {
      return NextResponse.json({ error: 'Monitor not found' }, { status: 404 })
    }
    return NextResponse.json(monitor)
  }

  return NextResponse.json(getAllMonitors())
}

// POST /api/monitors - Create a new monitor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = createMonitorSchema.parse(body)

    const monitor = createMonitor(validated.name, validated.schedule, validated.graceMinutes)

    return NextResponse.json({
      ...monitor,
      ping_url: `/api/ping/${monitor.id}`
    }, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: formatZodError(error) }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

// PATCH /api/monitors - Update a monitor
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = updateMonitorSchema.parse(body)
    const { id, ...updates } = validated

    const monitor = updateMonitor(id, updates)
    if (!monitor) {
      return NextResponse.json({ error: 'Monitor not found' }, { status: 404 })
    }

    return NextResponse.json(monitor)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: formatZodError(error) }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

// DELETE /api/monitors - Delete a monitor
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Monitor ID is required' }, { status: 400 })
  }

  const parseResult = monitorIdSchema.safeParse(id)
  if (!parseResult.success) {
    return NextResponse.json({ error: 'Invalid monitor ID format' }, { status: 400 })
  }

  const deleted = deleteMonitor(id)
  if (!deleted) {
    return NextResponse.json({ error: 'Monitor not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
