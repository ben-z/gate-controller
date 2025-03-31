export interface User {
  id: number;
  username: string;
  role: 'admin' | 'user';
  created_at: number;
  created_by?: string;
}

export interface CreateUserParams {
  username: string;
  password: string;
  role: 'admin' | 'user';
  created_by?: string;
}

export interface UpdateUserParams {
  id: number;
  password?: string;
  role?: 'admin' | 'user';
}