'use client';

import { useState } from 'react';
import { useUsers, createUser, updateUser, deleteUser } from '@/hooks/useUsers';
import { User, CreateUserParams } from '@/types/user';
import { formatInTimeZone } from 'date-fns-tz';
import { config } from '@/config';

export function UserManagement() {
  const { users, isLoading, isError, mutate } = useUsers();
  const [isCreating, setIsCreating] = useState(false);
  const [editingUsername, setEditingUsername] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateUserParams>({
    username: '',
    password: '',
    role: 'user',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUsername) {
        await updateUser({
          username: editingUsername,
          password: formData.password,
          role: formData.role,
        });
      } else {
        await createUser(formData);
      }
      await mutate(); // Revalidate the data
      setIsCreating(false);
      setEditingUsername(null);
      setFormData({
        username: '',
        password: '',
        role: 'user',
      });
    } catch (error) {
      console.error('Failed to save user:', error);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUsername(user.username);
    setFormData({
      username: user.username,
      password: '',
      role: user.role,
    });
    setIsCreating(true);
  };

  const handleDelete = async (username: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await deleteUser(username);
      await mutate(); // Revalidate the data
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingUsername(null);
    setFormData({
      username: '',
      password: '',
      role: 'user',
    });
  };

  if (isError) {
    return <div>Error loading users</div>;
  }

  if (isLoading && !users) {
    return <div>Loading users...</div>;
  }

  if (!users) {
    return <div>No users available</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">User Management</h2>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add User
          </button>
        )}
      </div>

      {isCreating && (
        <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              disabled={!!editingUsername}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 disabled:opacity-50"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              {editingUsername ? 'New Password (leave blank to keep current)' : 'Password'}
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800"
              required={!editingUsername}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {editingUsername ? 'Update' : 'Create'} User
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {users && users.length > 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Username
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created At
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-transparent divide-y divide-gray-200 dark:divide-gray-700">
              {users.map((user) => (
                <tr key={user.username}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {user.username}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.role === 'admin'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {formatInTimeZone(user.created_at, config.controllerTimezone, 'yyyy-MM-dd HH:mm:ss zzz')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <button
                      onClick={() => handleEdit(user)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(user.username)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                      disabled={user.role === 'admin'}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No users found. Click &quot;Add User&quot; to create one.
        </div>
      )}
    </div>
  );
} 