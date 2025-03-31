'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface User {
  id: number;
  username: string;
  role: 'admin' | 'user';
  created_at: number;
  created_by: number | null;
}

interface UserFormData {
  username: string;
  password: string;
  role: 'admin' | 'user';
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newUser, setNewUser] = useState<UserFormData>({
    username: '',
    password: '',
    role: 'user'
  });
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user');

  // Fetch users
  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Create user
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      if (!response.ok) throw new Error('Failed to create user');
      await fetchUsers();
      setIsCreating(false);
      setNewUser({ username: '', password: '', role: 'user' });
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      }
    }
  };

  // Update user
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setError(null);
    try {
      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: editPassword || undefined,
          role: editRole !== editingUser.role ? editRole : undefined
        }),
      });
      if (!response.ok) throw new Error('Failed to update user');
      await fetchUsers();
      setEditingUser(null);
      setEditPassword('');
      setEditRole('user');
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      }
    }
  };

  // Delete user
  const handleDelete = async (username: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    setError(null);
    try {
      const response = await fetch(`/api/users?username=${encodeURIComponent(username)}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete user');
      await fetchUsers();
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      }
    }
  };

  // Edit user
  const handleEdit = (user: User) => {
    setEditingUser(user);
    setEditRole(user.role);
    setEditPassword('');
  };

  // Reset form
  const resetForm = () => {
    setNewUser({
      username: '',
      password: '',
      role: 'user'
    });
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">User Management</h2>
        {!isCreating && !editingUser && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Add User
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {(isCreating || editingUser) && (
        <form onSubmit={isCreating ? handleCreate : handleUpdate} className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">
              {isCreating ? 'Create New User' : 'Edit User'}
            </h3>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setEditingUser(null);
                resetForm();
              }}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Cancel
            </button>
          </div>

          {isCreating && (
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <input
                type="text"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">
              {isCreating ? 'Password' : 'New Password (leave blank to keep current)'}
            </label>
            <input
              type="password"
              value={isCreating ? newUser.password : editPassword}
              onChange={(e) => {
                if (isCreating) {
                  setNewUser({ ...newUser, password: e.target.value });
                } else {
                  setEditPassword(e.target.value);
                }
              }}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
              required={isCreating}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              value={isCreating ? newUser.role : editRole}
              onChange={(e) => {
                if (isCreating) {
                  setNewUser({ ...newUser, role: e.target.value as 'admin' | 'user' });
                } else {
                  setEditRole(e.target.value as 'admin' | 'user');
                }
              }}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            {isCreating ? 'Create' : 'Save Changes'}
          </button>
        </form>
      )}

      <div className="space-y-4">
        {users.map((user) => {
          const isInitialAdmin = user.created_by === null;
          const canEdit = !isInitialAdmin;
          const canDelete = !isInitialAdmin;

          return (
            <div key={user.username} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              {editingUser?.username === user.username ? (
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

                  <div>
                    <label className="block text-sm font-medium mb-1">New Password</label>
                    <input
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                      placeholder="Leave blank to keep current password"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Role</label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as 'admin' | 'user')}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Save Changes
                  </button>
                </form>
              ) : (
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{user.username}</h3>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {user.role}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Created {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                      {user.created_by && (
                        <>
                          {' '}by{' '}
                          <span className="font-medium">
                            {user.created_by}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {canEdit && (
                      <button
                        onClick={() => handleEdit(user)}
                        className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(user.username)}
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