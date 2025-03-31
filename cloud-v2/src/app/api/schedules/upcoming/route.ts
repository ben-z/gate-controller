import { NextRequest, NextResponse } from 'next/server';
import { getUpcomingExecutions } from '@/services/schedule';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5', 10);
    
    const upcoming = getUpcomingExecutions(limit);
    // The Date objects will be automatically serialized to ISO strings by NextResponse.json
    return NextResponse.json(upcoming);
  } catch (error) {
    console.error('Error getting upcoming executions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get upcoming executions' },
      { status: 500 }
    );
  }
} 