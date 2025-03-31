import { NextRequest, NextResponse } from 'next/server';
import { createSchedule, updateSchedule, deleteSchedule, getSchedules } from '@/services/schedule';
import { validateCredentials } from '@/services/users';

export async function GET() {
  try {
    const schedules = getSchedules();
    return NextResponse.json(schedules);
  } catch (error) {
    console.error('Error getting schedules:', error);
    return NextResponse.json({ error: 'Failed to get schedules' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    // Validate user credentials
    const user = await validateCredentials(username, password);
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Create schedule with user ID
    const schedule = createSchedule({
      name: body.name,
      cronExpression: body.cronExpression,
      action: body.action,
      enabled: body.enabled,
      created_by: user.id
    }, user.id);

    return NextResponse.json(schedule);
  } catch (error) {
    console.error('Error creating schedule:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create schedule' },
      { status: 400 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'Schedule ID is required' }, { status: 400 });
    }

    const schedule = updateSchedule(Number(id), updates);
    return NextResponse.json(schedule);
  } catch (error) {
    console.error('Error updating schedule:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update schedule' },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Schedule ID is required' }, { status: 400 });
    }

    deleteSchedule(Number(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete schedule' },
      { status: 400 }
    );
  }
} 