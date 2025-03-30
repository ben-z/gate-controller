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
    throw new Error('No updates provided');
  }

  params.push(id);

  const query = `
    UPDATE users 
    SET ${updates.join(', ')}
    WHERE id = ?
  `;

  db.prepare(query).run(...params);

  return getUserById(id);
}

export function deleteUser(id: number): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

export function getUserById(id: number): User {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  if (!user) throw new Error(`User not found: ${id}`);
  return user;
}

export function getAllUsers(): User[] {
  return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as User[];
}

export function getUserByUsername(username: string): User | null {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | null;
} 