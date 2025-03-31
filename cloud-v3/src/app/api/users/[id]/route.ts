import { NextRequest } from 'next/server';
import { ensureSession } from '@/lib/auth/ensure-session';
import { updateUser, deleteUser } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Ensure user is authenticated and is admin
    const { user } = await ensureSession();
    if (user.role !== 'admin') {
      return new Response('Unauthorized', { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { password, role } = body;

    // Update user
    await updateUser({ username: params.id, password, role });
    return new Response('OK');
  } catch (error) {
    console.error('Error updating user:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Ensure user is authenticated and is admin
    const { user } = await ensureSession();
    if (user.role !== 'admin') {
      return new Response('Unauthorized', { status: 403 });
    }

    // Delete user
    await deleteUser(params.id);
    return new Response('OK');
  } catch (error) {
    console.error('Error deleting user:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
} 