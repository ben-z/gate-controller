'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { AuthState, Credentials } from '@/types/auth';

interface AuthContextType extends AuthState {
  login: (credentials: Credentials) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    username: null,
    role: null,
    isLoading: true,
    currentPassword: null,
  });

  // Load persisted auth state on mount
  useEffect(() => {
    const loadPersistedState = async () => {
      try {
        const persistedState = localStorage.getItem('auth');
        if (persistedState) {
          setState(JSON.parse(persistedState));
        } else {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('Failed to load persisted auth state:', error);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    loadPersistedState();
  }, []);

  const login = async (credentials: Credentials): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (data.success) {
        const newState = {
          isAuthenticated: true,
          username: data.user.username,
          role: data.user.role,
          isLoading: false,
          currentPassword: credentials.password,
        };
        setState(newState);
        localStorage.setItem('auth', JSON.stringify(newState));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    const newState = {
      isAuthenticated: false,
      username: null,
      role: null,
      isLoading: false,
      currentPassword: null,
    };
    setState(newState);
    localStorage.removeItem('auth');
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 