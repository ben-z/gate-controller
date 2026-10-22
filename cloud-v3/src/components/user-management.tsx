'use client';

import { useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { useUsers, createUser, updateUser, deleteUser } from '@/hooks/useUsers';
import { CreateUserParams, User } from '@/types/user';
import { publicConfig } from '@/config';
import { Icon } from './icon';

type Editor = { mode: 'create' | 'edit'; data: CreateUserParams };
type Notice = { kind: 'error' | 'success'; message: string };

export function UserManagement() {
  const { users, isError, mutate } = useUsers();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deletingUsername, setDeletingUsername] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  function openEditor(user?: User) {
    setNotice(null);
    setDeletingUsername(null);
    setEditor({
      mode: user ? 'edit' : 'create',
      data: {
        username: user?.username ?? '',
        password: '',
        role: user?.role ?? 'user',
      },
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || pending) return;
    setPending(true);
    setNotice(null);
    try {
      if (editor.mode === 'edit') {
        await updateUser(editor.data);
      } else {
        await createUser(editor.data);
      }
      await mutate();
      setNotice({
        kind: 'success',
        message: `${editor.data.username} ${editor.mode === 'edit' ? 'updated' : 'added'}.`,
      });
      setEditor(null);
    } catch (error) {
      setNotice({
        kind: 'error',
        message:
          error instanceof Error ? error.message : 'Unable to save this user.',
      });
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(username: string) {
    if (pending) return;
    setPending(true);
    setNotice(null);
    try {
      await deleteUser(username);
      await mutate();
      setDeletingUsername(null);
      setNotice({ kind: 'success', message: `${username} removed.` });
    } catch (error) {
      setNotice({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to remove this user.',
      });
    } finally {
      setPending(false);
    }
  }

  if (isError) {
    return (
      <div className="inline-alert" role="alert">
        Unable to load users. Refresh to try again.
      </div>
    );
  }

  if (!users) {
    return (
      <div className="card-body muted" role="status">
        Loading users…
      </div>
    );
  }

  return (
    <section className="card" aria-labelledby="users-heading">
      <div className="card-header">
        <div>
          <p className="eyebrow">PEOPLE & PERMISSIONS</p>
          <h2 className="section-heading" id="users-heading">
            User Management
          </h2>
          <p className="muted">Choose who can control your gate.</p>
        </div>
        <button
          className="button button-primary"
          onClick={() => openEditor()}
          disabled={pending || editor !== null}
        >
          <Icon name="plus" /> Add User
        </button>
      </div>

      {notice && (
        <div
          className={
            notice.kind === 'error' ? 'inline-alert' : 'feedback-success'
          }
          role={notice.kind === 'error' ? 'alert' : 'status'}
        >
          <Icon name={notice.kind === 'error' ? 'alert' : 'check'} />
          {notice.message}
        </div>
      )}

      {editor && (
        <form
          onSubmit={handleSubmit}
          className="editor-panel"
          aria-labelledby="user-editor-heading"
        >
          <h3 className="section-heading" id="user-editor-heading">
            {editor.mode === 'edit'
              ? `Edit ${editor.data.username}`
              : 'Give someone access'}
          </h3>
          <fieldset disabled={pending}>
            <div className="form-grid">
              <div>
                <label htmlFor="user-username" className="field-label">
                  Username
                </label>
                <input
                  id="user-username"
                  type="text"
                  autoComplete="off"
                  autoFocus={editor.mode === 'create'}
                  value={editor.data.username}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      data: { ...editor.data, username: event.target.value },
                    })
                  }
                  disabled={editor.mode === 'edit'}
                  className="field"
                  required
                />
              </div>
              <div>
                <label htmlFor="user-password" className="field-label">
                  {editor.mode === 'edit' ? 'New password' : 'Password'}
                </label>
                <input
                  id="user-password"
                  type="password"
                  autoComplete="new-password"
                  autoFocus={editor.mode === 'edit'}
                  value={editor.data.password}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      data: { ...editor.data, password: event.target.value },
                    })
                  }
                  aria-describedby={
                    editor.mode === 'edit' ? 'password-hint' : undefined
                  }
                  className="field"
                  required={editor.mode === 'create'}
                />
                {editor.mode === 'edit' && (
                  <p id="password-hint" className="field-hint">
                    Leave blank to keep the current password.
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="user-role" className="field-label">
                  Role
                </label>
                <select
                  id="user-role"
                  value={editor.data.role}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      data: {
                        ...editor.data,
                        role: event.target.value as User['role'],
                      },
                    })
                  }
                  className="field"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="button button-primary">
                {pending
                  ? 'Saving…'
                  : `${editor.mode === 'edit' ? 'Update' : 'Create'} User`}
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setEditor(null)}
              >
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      )}

      <div className="access-summary">
        <Icon name="users" />
        <p>
          <strong>
            {users.length} {users.length === 1 ? 'person has' : 'people have'}{' '}
            access.
          </strong>{' '}
          Users can control the gate and manage schedules. Admins can also
          manage people and view system details.
        </p>
      </div>

      {users.length > 0 ? (
        <ul className="member-list" aria-label="Users">
          {users.map((user) => (
            <li key={user.username} className="member-row">
              <div className="member-avatar" aria-hidden="true">
                {user.username.slice(0, 1).toUpperCase()}
              </div>
              <div className="member-identity">
                <strong>{user.username}</strong>
                <p className="member-meta">
                  Added{' '}
                  {formatInTimeZone(
                    user.created_at,
                    publicConfig.controllerTimezone,
                    'yyyy-MM-dd',
                  )}
                </p>
              </div>
              <span
                className={`status-pill ${user.role === 'admin' ? 'positive' : 'neutral'}`}
              >
                {user.role === 'admin' ? 'Admin' : 'User'}
              </span>
              <div className="member-actions">
                <button
                  className="icon-button"
                  onClick={() => openEditor(user)}
                  aria-label={`Edit ${user.username}`}
                  disabled={pending}
                >
                  <Icon name="edit" />
                </button>
                <button
                  className="icon-button"
                  onClick={() => {
                    setEditor(null);
                    setNotice(null);
                    setDeletingUsername(user.username);
                  }}
                  aria-label={`Delete ${user.username}`}
                  disabled={pending}
                >
                  <Icon name="trash" />
                </button>
              </div>
              {deletingUsername === user.username && (
                <div className="delete-confirmation">
                  <p>
                    Remove <strong>{user.username}</strong>? They will lose
                    access to the gate.
                  </p>
                  <div className="form-actions">
                    <button
                      className="button button-danger"
                      onClick={() => handleDelete(user.username)}
                      disabled={pending}
                    >
                      {pending ? 'Removing…' : 'Delete user'}
                    </button>
                    <button
                      className="button button-secondary"
                      onClick={() => setDeletingUsername(null)}
                      disabled={pending}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state">
          <Icon name="users" />
          <h3>No users yet</h3>
          <p>Add a user to give them access to your gate.</p>
        </div>
      )}
    </section>
  );
}
