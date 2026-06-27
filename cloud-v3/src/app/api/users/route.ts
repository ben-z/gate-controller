import { NextRequest } from 'next/server';
import { getUsers, createUser, updateUser, deleteUser } from '@/lib/db';
import {
  ApiError,
  apiError,
  optionalString,
  readJsonBody,
  requireAdminSession,
  requireObject,
  requireString,
} from '@/lib/api';

export async function GET() {
  try {
    await requireAdminSession();
    const users = getUsers();

    return Response.json(users);
  } catch (error) {
    return apiError(error, 'Error getting users:');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAdminSession();

    const body = requireObject(await readJsonBody(request));
    const username = requireString(body, 'username');
    const password = requireString(body, 'password');
    const role = requireRole(body.role);

    const newUser = createUser({
      username,
      password,
      role,
      created_by: user.username
    });

    return Response.json(newUser);
  } catch (error) {
    return apiError(error, 'Error creating user:');
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdminSession();
    const body = requireObject(await readJsonBody(request));
    const username = requireString(body, 'username');
    const password = optionalString(body, 'password');
    const role = body.role === undefined ? undefined : requireRole(body.role);

    updateUser({
      username,
      password,
      role
    });

    return Response.json({ success: true });
  } catch (error) {
    return apiError(error, 'Error updating user:');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdminSession();

    const username = request.nextUrl.searchParams.get('username');
    if (!username) {
      throw new ApiError(400, 'Missing username');
    }

    try {
      deleteUser(username);
    } catch (error) {
      if (error instanceof Error) {
        throw new ApiError(400, error.message);
      }
      throw error;
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error, 'Error deleting user:');
  }
}

function requireRole(value: unknown): 'admin' | 'user' {
  if (value !== 'admin' && value !== 'user') {
    throw new ApiError(400, 'Invalid role');
  }
  return value;
}
