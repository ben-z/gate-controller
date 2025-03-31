'use client';

import { GateController } from '@/components/gate-controller';
import { ScheduleManager } from '@/components/schedule-manager';
import { LoginForm } from '@/components/login-form';
import { UserManagement } from '@/components/user-management';
import { useAuth } from '@/contexts/auth-context';
import { User } from '@/services/users';
import { useState, useEffect } from 'react';

export function ClientPage() {
  const { isAuthenticated, isLoading, username, role, currentPassword, logout } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  // Fetch users when authentication state changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchUsers();
    }
  }, [isAuthenticated]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleUserCreate = async (newUsername: string, newPassword: string, newRole: 'admin' | 'user') => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          role: newRole,
          creatorUsername: username,
          creatorPassword: currentPassword
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to create user: ${response.status} ${response.statusText}`);
      }
      
      await fetchUsers();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create user: ${error.message}`);
      }
      throw new Error('Failed to create user: Unknown error occurred');
    }
  };

  const handleUserUpdate = async (id: number, password?: string, role?: 'admin' | 'user') => {
    const response = await fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        password,
        role,
        updaterUsername: username
      }),
    });
    if (!response.ok) throw new Error('Failed to update user');
    await fetchUsers();
  };

  const handleUserDelete = async (id: number) => {
    const response = await fetch('/api/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        deleterUsername: username
      }),
    });
    if (!response.ok) throw new Error('Failed to delete user');
    await fetchUsers();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <LoginForm />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen p-4 font-[family-name:var(--font-geist-sans)] safe-top safe-bottom bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <main className="flex flex-col items-center gap-12 flex-1">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Gate Controller</h1>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            Refresh
          </button>
          <button
            onClick={() => logout()}
            className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200 rounded-lg hover:bg-red-200 dark:hover:bg-red-900"
          >
            Logout
          </button>
        </div>

        {/* Add user info display */}
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span>Logged in as:</span>
          <span className="font-medium" data-testid="user-info-username">{username}</span>
          <span className="text-gray-400 dark:text-gray-500">·</span>
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" data-testid="user-info-role">
            {role}
          </span>
        </div>

        <GateController />
        <ScheduleManager />
        {!isLoadingUsers && role === 'admin' && (
          <UserManagement
            users={users}
            onUserCreate={handleUserCreate}
            onUserUpdate={handleUserUpdate}
            onUserDelete={handleUserDelete}
          />
        )}
      </main>
    </div>
  );
} 