import { NextResponse } from 'next/server';
import { login } from '@/services/auth';
import { Credentials } from '@/types/auth';

export async function POST(request: Request) {
  try {
    const { username, password }: Credentials = await request.json();
    const user = await login(username, password);

    if (user) {
      return NextResponse.json({ 
        success: true, 
        user
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid credentials' },
      { status: 401 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 