import useSWR from 'swr';
import { User, CreateUserParams, UpdateUserParams } from '@/types/user';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch users');
  }
  return res.json();
};

export function useUsers() {
  const { data, error, isLoading, mutate } = useSWR<User[]>('/api/users', fetcher);

  return {
    users: data,
    isLoading,
    isError: error,
    mutate,
  };
}

// Helper functions for mutations
export async function createUser(user: CreateUserParams) {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(user),
  });

  if (!res.ok) {
    throw new Error('Failed to create user');
  }

  return res.json();
}

export async function updateUser(user: UpdateUserParams) {
  const res = await fetch('/api/users', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(user),
  });

  if (!res.ok) {
    throw new Error('Failed to update user');
  }

  return res.json();
}

export async function deleteUser(username: string) {
  const res = await fetch(`/api/users?username=${encodeURIComponent(username)}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    throw new Error('Failed to delete user');
  }
} 