import { validateCredentials as validateUserCredentials, User } from './users';
export type AuthUser = Pick<User, 'id' | 'username' | 'role'>;

export async function login(username: string, password: string): Promise<AuthUser | null> {
  const user = await validateUserCredentials(username, password);
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    role: user.role
  };
} 