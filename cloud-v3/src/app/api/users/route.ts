import { NextRequest } from 'next/server';
import { ensureSession } from '@/lib/auth/ensure-session';
import { getUsers, createUser, updateUser, deleteUser } from '@/lib/db';

// Get all users
export async function GET() {
  try {
    // Ensure user is authenticated and is admin
    const { user } = await ensureSession();
    if (user.role !== 'admin') {
      return new Response('Unauthorized', { status: 403 });
    }

    // Get users
    const users = getUsers();

    return Response.json(users);
  } catch (error) {
    console.error('Error getting users:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Create new user
export async function POST(request: NextRequest) {
  try {
    // Ensure user is authenticated and is admin
    const { user } = await ensureSession();
    if (user.role !== 'admin') {
      return new Response('Unauthorized', { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { username, password, role } = body;

    if (!username || !password || !role) {
      return new Response('Missing required fields', { status: 400 });
    }

    if (role !== 'admin' && role !== 'user') {
      return new Response('Invalid role', { status: 400 });
    }

    // Create user
    const newUser = createUser({
      username,
      password,
      role,
      created_by: user.username
    });

    return Response.json(newUser);
  } catch (error) {
    console.error('Error creating user:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Update user
export async function PUT(request: NextRequest) {
  try {
    // Ensure user is authenticated and is admin
    const { user } = await ensureSession();
    if (user.role !== 'admin') {
      return new Response('Unauthorized', { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { username, password, role } = body;

    if (!username) {
      return new Response('Missing username', { status: 400 });
    }

    if (role && role !== 'admin' && role !== 'user') {
      return new Response('Invalid role', { status: 400 });
    }

    // Update user
    updateUser({
      username,
      password,
      role
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error updating user:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Delete user
export async function DELETE(request: NextRequest) {
  try {
    // Ensure user is authenticated and is admin
    const { user } = await ensureSession();
    if (user.role !== 'admin') {
      return new Response('Unauthorized', { status: 403 });
    }

    // Get username from URL
    const username = request.nextUrl.searchParams.get('username');
    if (!username) {
      return new Response('Missing username', { status: 400 });
    }

    // Delete user
    try {
      deleteUser(username);
    } catch (error) {
      if (error instanceof ReferenceError) {
        return new Response(error.message, { status: 400 });
      }
      throw error;
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting user:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
} 