export interface User {
  username: string;
  role: 'admin' | 'user';
  created_at: number;
  created_by?: string;
}

export interface UserCredentials {
  username: string;
  password_hash: string;
}

export interface CreateUserParams {
  username: string;
  password: string;
  role: 'admin' | 'user';
  created_by?: string;
}

export interface UpdateUserParams {
  username: string;
  password?: string;
  role?: 'admin' | 'user';
}