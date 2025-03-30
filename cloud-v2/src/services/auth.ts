import { Credentials } from '@/types/auth';
import { validateCredentials as validateUserCredentials, User } from './users';

// Parse credentials from environment variables
const parseCredentials = (): Credentials[] => {
  const credentialsStr = process.env.AUTH_CREDENTIALS;
  if (!credentialsStr) return [];

  try {
    return JSON.parse(credentialsStr);
  } catch (error) {
    console.error('Failed to parse credentials:', error);
    return [];
  }
};

export async function validateCredentials(credentials: Credentials): Promise<boolean> {
  const validCredentials = parseCredentials();
  return validCredentials.some(
    cred => cred.username === credentials.username && cred.password === credentials.password
  );
}

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