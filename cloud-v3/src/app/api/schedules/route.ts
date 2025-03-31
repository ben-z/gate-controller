import { NextRequest } from 'next/server';
import { ensureSession } from '@/lib/auth/ensure-session';
import { getSchedules, createSchedule, updateSchedule, deleteSchedule } from '@/lib/db';
import { validateCronExpression, startSchedule, stopSchedule } from '@/lib/scheduler';

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
    const { name, cron_expression, action, enabled } = body;

    if (!name || !cron_expression || !action) {
      return new Response('Missing required fields', { status: 400 });
    }

    if (action !== 'open' && action !== 'close') {
      return new Response('Invalid action', { status: 400 });
    }

    // Validate cron expression
    if (!validateCronExpression(cron_expression)) {
      return new Response('Invalid cron expression', { status: 400 });
    }

    // Create schedule
    const newSchedule = createSchedule({
      name,
      cron_expression,
      action,
      enabled: enabled ?? true,
      created_by: user.username
    });

    // Start the schedule if enabled
    if (newSchedule.enabled) {
      startSchedule(newSchedule);
    }

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
    const { id, name, cron_expression, action, enabled } = body;

    if (!id) {
      return new Response('Missing schedule ID', { status: 400 });
    }

    if (action && action !== 'open' && action !== 'close') {
      return new Response('Invalid action', { status: 400 });
    }

    // Validate cron expression if provided
    if (cron_expression && !validateCronExpression(cron_expression)) {
      return new Response('Invalid cron expression', { status: 400 });
    }

    // Update schedule
    const updatedSchedule = updateSchedule(id, {
      name,
      cron_expression,
      action,
      enabled
    });

    // Update the cron job
    if (updatedSchedule.enabled) {
      startSchedule(updatedSchedule);
    } else {
      stopSchedule(updatedSchedule.id.toString());
    }

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

    // Get schedule ID from query params
    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return new Response('Missing schedule ID', { status: 400 });
    }

    // Stop the schedule's cron job
    stopSchedule(id);

    // Delete schedule
    deleteSchedule(parseInt(id));

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
} 