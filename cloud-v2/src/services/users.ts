import bcrypt from 'bcrypt';
import db from './db';

export interface User {
  id: number;
  username: string;
  role: 'admin' | 'user';
  created_at: number;
  created_by: number | null;
  password_hash: string;
}

export interface CreateUserParams {
  username: string;
  password: string;
  role: 'admin' | 'user';
  created_by: number;
}

export interface UpdateUserParams {
  id: number;
  password?: string;
  role?: 'admin' | 'user';
}

export class UserError extends Error {
  constructor(
    message: string,
    public code: 'USERNAME_EXISTS' | 'USER_NOT_FOUND' | 'DATABASE_ERROR' | 'INVALID_INPUT'
  ) {
    super(message);
    this.name = 'UserError';
  }
}

export async function validateCredentials(username: string, password: string): Promise<User | null> {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
  if (!user) return null;

  try {
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return null;
  } catch (error) {
    console.error('Error comparing passwords:', error);
    return null;
  }

  return user;
}

export async function createUser({ username, password, role, created_by }: CreateUserParams): Promise<User> {
  const passwordHash = await bcrypt.hash(password, 10);
  const now = Date.now();

  try {
    const result = db.prepare(`
      INSERT INTO users (username, password_hash, role, created_at, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(username, passwordHash, role, now, created_by);

    return {
      id: result.lastInsertRowid as number,
      username,
      role,
      created_at: now,
      created_by,
      password_hash: passwordHash
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new UserError(`Username "${username}" is already taken`, 'USERNAME_EXISTS');
    }
    console.error('Database error creating user:', error);
    throw new UserError('Failed to create user', 'DATABASE_ERROR');
  }
}

export function updateUser({ id, password, role }: UpdateUserParams): User {
  const updates: string[] = [];
  const params: (string | number)[] = [];

  if (password) {
    updates.push('password_hash = ?');
    params.push(bcrypt.hashSync(password, 10));
  }

  if (role) {
    updates.push('role = ?');
    params.push(role);
  }

  if (updates.length === 0) {
    throw new UserError('No updates provided', 'INVALID_INPUT');
  }

  params.push(id);

  try {
    const query = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = ?
    `;

    const result = db.prepare(query).run(...params);
    
    if (result.changes === 0) {
      throw new UserError(`User with ID ${id} not found`, 'USER_NOT_FOUND');
    }

    return getUserById(id);
  } catch (error) {
    if (error instanceof UserError) throw error;
    console.error('Database error updating user:', error);
    throw new UserError('Failed to update user', 'DATABASE_ERROR');
  }
}

export function deleteUser(id: number): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

export function getUserById(id: number): User {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
    if (!user) {
      throw new UserError(`User with ID ${id} not found`, 'USER_NOT_FOUND');
    }
    return user;
  } catch (error) {
    if (error instanceof UserError) throw error;
    console.error('Database error getting user:', error);
    throw new UserError('Failed to get user', 'DATABASE_ERROR');
  }
}

export function getAllUsers(): User[] {
  return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as User[];
}

export function getUserByUsername(username: string): User | null {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | null;
} 