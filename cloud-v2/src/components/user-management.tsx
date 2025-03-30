'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { User } from '@/services/users';
import { formatInTimeZone } from 'date-fns-tz';
import { config } from '@/config';
import { formatDistanceToNow } from 'date-fns';

interface UserManagementProps {
  users: User[];
  onUserCreate: (username: string, password: string, role: 'admin' | 'user') => Promise<void>;
  onUserUpdate: (id: number, password?: string, role?: 'admin' | 'user') => Promise<void>;
  onUserDelete: (id: number) => Promise<void>;
}

export function UserManagement({ users, onUserCreate, onUserUpdate, onUserDelete }: UserManagementProps) {
  const { username: currentUser } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user');
  const [error, setError] = useState<string | null>(null);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const relativeTime = formatDistanceToNow(date, { 
      addSuffix: true,
      includeSeconds: true
    });
    const controllerTime = formatInTimeZone(date, config.controllerTimezone, 'MMM d, yyyy HH:mm:ss');
    return (
      <span title={controllerTime}>
        {relativeTime}
      </span>
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await onUserCreate(newUsername, newPassword, newRole);
      setNewUsername('');
      setNewPassword('');
      setNewRole('user');
      setIsCreating(false);
    } catch (error) {
      if (error instanceof Error) {
        // Handle specific error cases
        if (error.message.includes('already taken')) {
          setError(`Username "${newUsername}" is already taken. Please choose a different username.`);
        } else if (error.message.includes('Unauthorized')) {
          setError('You are not authorized to create users. Only admins can create new users.');
        } else {
          setError(`Failed to create user: ${error.message}`);
        }
      } else {
        setError('An unexpected error occurred while creating the user.');
      }
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setError(null);
    try {
      await onUserUpdate(
        editingUser.id,
        editPassword || undefined,
        editRole !== editingUser.role ? editRole : undefined
      );
      setEditingUser(null);
      setEditPassword('');
      setEditRole('user');
    } catch (error) {
      if (error instanceof Error) {
        // Handle specific error cases
        if (error.message.includes('not found')) {
          setError('This user no longer exists.');
        } else if (error.message.includes('Unauthorized')) {
          setError('You are not authorized to update users. Only admins can modify user accounts.');
        } else {
          setError(`Failed to update user: ${error.message}`);
        }
      } else {
        setError('An unexpected error occurred while updating the user.');
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      setError(null);
      try {
        await onUserDelete(id);
      } catch (error) {
        if (error instanceof Error) {
          // Handle specific error cases
          if (error.message.includes('not found')) {
            setError('This user no longer exists.');
          } else if (error.message.includes('Unauthorized')) {
            setError('You are not authorized to delete users. Only admins can delete user accounts.');
          } else {
            setError(`Failed to delete user: ${error.message}`);
          }
        } else {
          setError('An unexpected error occurred while deleting the user.');
        }
      }
    }
  };

  return (
    <div className="w-full max-w-2xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">User Management</h2>
        <button
          onClick={() => setIsCreating(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Add User
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/50 text-red-700 dark:text-red-200 rounded-lg">
          {error}
        </div>
      )}

      {isCreating && (
        <form onSubmit={handleCreate} className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h3 className="text-lg font-medium mb-4">Create New User</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'admin' | 'user')}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setError(null);
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {users.map((user) => {
          const isInitialAdmin = user.created_by === null;
          const isCurrentUser = user.username === currentUser;
          const canEdit = !isInitialAdmin && !isCurrentUser;
          const canDelete = !isInitialAdmin && !isCurrentUser;

          return (
            <div
              key={user.id}
              className="p-4 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700"
            >
              {editingUser?.id === user.id ? (
                <form onSubmit={handleUpdate} className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Edit User: {user.username}</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingUser(null);
                        setError(null);
                      }}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Password</label>
                      <input
                        type="password"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="Leave blank to keep current password"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Role</label>
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value as 'admin' | 'user')}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-medium">{user.username}</h3>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {user.role}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Created {formatTimestamp(user.created_at)}
                      {user.created_by && (
                        <>
                          {' '}by{' '}
                          <span className="font-medium">
                            {users.find(u => u.id === user.created_by)?.username || 'Unknown'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {canEdit && (
                      <button
                        onClick={() => {
                          setEditingUser(user);
                          setEditRole(user.role);
                          setEditPassword('');
                        }}
                        className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="px-3 py-1 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
} 