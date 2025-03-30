'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { User } from '@/services/users';

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
      setError(error instanceof Error ? error.message : 'Failed to create user');
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
      setError(error instanceof Error ? error.message : 'Failed to update user');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      setError(null);
      try {
        await onUserDelete(id);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to delete user');
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
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
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
                      className="text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">New Password (leave blank to keep current)</label>
                    <input
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
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
                </form>
              ) : (
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-medium">{user.username}</h3>
                    <p className="text-sm text-gray-500">
                      Role: {user.role} | Created: {new Date(user.created_at).toLocaleDateString()}
                      {isInitialAdmin && (
                        <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded">
                          Initial Admin
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {canEdit && (
                      <button
                        onClick={() => {
                          setEditingUser(user);
                          setEditRole(user.role);
                          setError(null);
                        }}
                        className="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                      >
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="px-3 py-1 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
                      >
                        Delete
                      </button>
                    )}
                    {!canEdit && !canDelete && (
                      <span className="text-sm text-gray-500">
                        {isInitialAdmin ? 'Cannot modify initial admin' : 'Cannot modify current user'}
                      </span>
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