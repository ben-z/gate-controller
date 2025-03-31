import { NextRequest } from 'next/server';
import { ensureSession } from '@/lib/auth/ensure-session';
import { getSchedules, createSchedule, updateSchedule, deleteSchedule } from '@/lib/db';

// Get all schedules
export async function GET() {
  try {
    // Ensure user is authenticated
    await ensureSession();

    // Get schedules
    const schedules = getSchedules();

    return Response.json(schedules);
  } catch (error) {
    console.error('Error getting schedules:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Create new schedule
export async function POST(request: NextRequest) {
  try {
    // Ensure user is authenticated
    const { user } = await ensureSession();

    // Get request body
    const body = await request.json();
    const { name, cronExpression, action, enabled } = body;

    if (!name || !cronExpression || !action) {
      return new Response('Missing required fields', { status: 400 });
    }

    if (action !== 'open' && action !== 'close') {
      return new Response('Invalid action', { status: 400 });
    }

    // Create schedule
    const newSchedule = createSchedule({
      name,
      cronExpression,
      action,
      enabled: enabled ?? true,
      created_by: user.username
    });

    return Response.json(newSchedule);
  } catch (error) {
    console.error('Error creating schedule:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Update schedule
export async function PUT(request: NextRequest) {
  try {
    // Ensure user is authenticated
    await ensureSession();

    // Get request body
    const body = await request.json();
    const { id, name, cronExpression, action, enabled } = body;

    if (!id) {
      return new Response('Missing schedule ID', { status: 400 });
    }

    if (action && action !== 'open' && action !== 'close') {
      return new Response('Invalid action', { status: 400 });
    }

    // Update schedule
    const updatedSchedule = updateSchedule(id, {
      name,
      cronExpression,
      action,
      enabled
    });

    return Response.json(updatedSchedule);
  } catch (error) {
    console.error('Error updating schedule:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Delete schedule
export async function DELETE(request: NextRequest) {
  try {
    // Ensure user is authenticated
    await ensureSession();

    // Get schedule ID from URL
    const id = parseInt(request.nextUrl.searchParams.get('id') || '0', 10);
    if (!id) {
      return new Response('Missing schedule ID', { status: 400 });
    }

    // Delete schedule
    deleteSchedule(id);

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
} 