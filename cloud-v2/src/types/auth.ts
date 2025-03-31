export interface Credentials {
  username: string;
  password: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  role: 'admin' | 'user' | null;
  isLoading: boolean;
  currentPassword: string | null;
} 