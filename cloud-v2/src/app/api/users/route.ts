import { NextResponse } from 'next/server';
import { getAllUsers, createUser, updateUser, deleteUser, validateCredentials, getUserByUsername } from '@/services/users';

export async function GET() {
  try {
    const users = getAllUsers().map(user => ({
      id: user.id,
      username: user.username,
      role: user.role,
      created_at: user.created_at,
      created_by: user.created_by
    }));
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { username, password, role, creatorUsername, creatorPassword } = await request.json();

    // Validate the creator is an admin
    const creator = await validateCredentials(creatorUsername, creatorPassword);
    if (!creator || creator.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await createUser({ 
      username, 
      password, 
      role, 
      created_by: creator.id 
    });

    // Don't send password hash in response
    const { password_hash, ...userWithoutPassword } = user;
    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { id, password, role, updaterUsername } = await request.json();

    // Validate the updater is an admin
    const updater = await getUserByUsername(updaterUsername);
    if (!updater || updater.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = updateUser({ id, password, role });

    // Don't send password hash in response
    const { password_hash, ...userWithoutPassword } = user;
    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { id, deleterUsername } = await request.json();

    // Validate the deleter is an admin
    const deleter = await getUserByUsername(deleterUsername);
    if (!deleter || deleter.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    deleteUser(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 