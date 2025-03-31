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
    const errorMessage = error instanceof Error ? error.message : 'Failed to get schedules';
    return new Response(JSON.stringify({ error: errorMessage }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
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
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    if (action !== 'open' && action !== 'close') {
      return new Response(JSON.stringify({ error: 'Invalid action' }), { 
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Validate cron expression
    if (!validateCronExpression(cron_expression)) {
      return new Response(JSON.stringify({ error: 'Invalid cron expression' }), { 
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
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
      await startSchedule(newSchedule);
    }

    return Response.json(newSchedule);
  } catch (error) {
    console.error('Error creating schedule:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create schedule';
    return new Response(JSON.stringify({ error: errorMessage }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

// Update schedule
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (!name) {
      return new Response(JSON.stringify({ error: 'Missing schedule name' }), { 
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const updates = await request.json();

    // Update schedule
    const updatedSchedule = updateSchedule(name, updates);

    // Handle schedule status changes
    if (updatedSchedule.enabled) {
      startSchedule(updatedSchedule);
    } else {
      stopSchedule(name);
    }

    return Response.json(updatedSchedule);
  } catch (error) {
    console.error('Error updating schedule:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update schedule';
    return new Response(JSON.stringify({ error: errorMessage }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

// Delete schedule
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (!name) {
      return new Response(JSON.stringify({ error: 'Missing schedule name' }), { 
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Stop the schedule's cron job
    stopSchedule(name);

    // Delete schedule
    deleteSchedule(name);

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete schedule';
    return new Response(JSON.stringify({ error: errorMessage }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
} 