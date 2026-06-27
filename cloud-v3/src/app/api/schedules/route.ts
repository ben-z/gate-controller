import { NextRequest } from 'next/server';
import {
  createSchedule,
  deleteSchedule,
  getSchedules,
  updateSchedule as saveSchedule,
} from '@/lib/db';
import {
  startSchedule,
  stopSchedule,
  updateSchedule as syncSchedule,
  validateCronExpression,
} from '@/lib/scheduler';
import {
  ApiError,
  apiError,
  optionalBoolean,
  readJsonBody,
  requireApiSession,
  requireGateAction,
  requireObject,
  requireString,
} from '@/lib/api';
import { Schedule } from '@/types/schedule';

export async function GET() {
  try {
    await requireApiSession();
    const schedules = getSchedules();

    return Response.json(schedules);
  } catch (error) {
    return apiError(error, 'Error getting schedules:');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireApiSession();
    const body = requireObject(await readJsonBody(request));
    const name = requireString(body, 'name');
    const cron_expression = requireString(body, 'cron_expression');
    const action = requireGateAction(body.action);
    const enabled = optionalBoolean(body, 'enabled', true);

    if (!validateCronExpression(cron_expression)) {
      throw new ApiError(400, 'Invalid cron expression');
    }

    const newSchedule = createSchedule({
      name,
      cron_expression,
      action,
      enabled,
      created_by: user.username
    });

    if (newSchedule.enabled) {
      await startSchedule(newSchedule);
    }

    return Response.json(newSchedule);
  } catch (error) {
    return apiError(error, 'Error creating schedule:');
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireApiSession();

    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (!name) {
      throw new ApiError(400, 'Missing schedule name');
    }

    const body = requireObject(await readJsonBody(request));
    const updates: Partial<Omit<Schedule, 'name'>> = {};

    if ('cron_expression' in body) {
      updates.cron_expression = requireString(body, 'cron_expression');
      if (!validateCronExpression(updates.cron_expression)) {
        throw new ApiError(400, 'Invalid cron expression');
      }
    }
    if ('action' in body) {
      updates.action = requireGateAction(body.action);
    }
    if ('enabled' in body) {
      updates.enabled = optionalBoolean(body, 'enabled', false);
    }

    const updatedSchedule = saveSchedule(name, updates);
    await syncSchedule(updatedSchedule);

    return Response.json(updatedSchedule);
  } catch (error) {
    return apiError(error, 'Error updating schedule:');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireApiSession();

    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (!name) {
      throw new ApiError(400, 'Missing schedule name');
    }

    await stopSchedule(name);
    deleteSchedule(name);

    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error, 'Error deleting schedule:');
  }
}
