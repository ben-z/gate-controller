'use client';

import { useRef, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { useUsers, createUser, updateUser, deleteUser } from '@/hooks/useUsers';
import { useFocusAfterCommit } from '@/hooks/useFocusAfterCommit';
import { CreateUserParams, UpdateUserParams, User } from '@/types/user';
import { publicConfig } from '@/config';
import { Icon } from './icon';

type Editor = { original: User | null; data: CreateUserParams };
type Notice = { kind: 'error' | 'success'; message: string };

export function UserManagement() {
  const { users, isError, mutate } = useUsers();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deletingUsername, setDeletingUsername] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const focusAfterCommit = useFocusAfterCommit(pending);
  const [notice, setNotice] = useState<Notice | null>(null);

  const trigger = useRef<HTMLButtonElement | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const retryButton = useRef<HTMLButtonElement>(null);
  const editorInput = useRef<HTMLInputElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const locked =
    pending || editor !== null || deletingUsername !== null || !!isError;

  function restoreFocus(button: HTMLButtonElement | null) {
    focusAfterCommit(() => {
      if (button?.disabled) retryButton.current?.focus();
      else button?.focus();
    });
  }

  async function handleRetry() {
    const initiatingButton = retryButton.current;
    await mutate();
    focusAfterCommit(() => {
      if (
        document.activeElement !== document.body &&
        document.activeElement !== initiatingButton
      ) return;
      if (retryButton.current) retryButton.current.focus();
      else if (editorInput.current) editorInput.current.focus();
      else addButton.current?.focus();
    });
  }

  function openEditor(user: User | undefined, button: HTMLButtonElement) {
    trigger.current = button;
    setNotice(null);
    setEditor({
      original: user ?? null,
      data: {
        username: user?.username ?? '',
        password: '',
        role: user?.role ?? 'user',
      },
    });
  }

  function cancelEditor() {
    setEditor(null);
    restoreFocus(trigger.current);
  }

  function cancelDelete() {
    setDeletingUsername(null);
    restoreFocus(trigger.current);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || pending) return;
    setPending(true);
    setNotice(null);
    let saved = false;
    try {
      if (!users)
        throw new Error('Users must be loaded before access can be changed.');
      if (editor.original) {
        const changes: UpdateUserParams = {
          username: editor.original.username,
        };
        if (editor.data.password) changes.password = editor.data.password;
        if (editor.data.role !== editor.original.role)
          changes.role = editor.data.role;
        await updateUser(changes);
        saved = true;
        await mutate(
          users.map((user) =>
            user.username === changes.username && changes.role !== undefined
              ? { ...user, role: changes.role }
              : user,
          ),
          { revalidate: false },
        );
      } else {
        const created: User = await createUser(editor.data);
        saved = true;
        await mutate([...users, created], { revalidate: false });
      }
      setNotice({
        kind: 'success',
        message: `${editor.data.username} ${editor.original ? 'updated' : 'added'}.`,
      });
      setEditor(null);
      await mutate();
    } catch (error) {
      const failureMessage =
        error instanceof Error ? error.message : 'Unable to save this user.';
      setNotice({
        kind: 'error',
        message: saved
          ? `${editor.data.username} was saved, but the people list could not be refreshed.`
          : failureMessage,
      });
    } finally {
      setPending(false);
      if (saved) restoreFocus(trigger.current);
      else focusAfterCommit(() => noticeRef.current?.focus());
    }
  }

  async function handleDelete(username: string) {
    if (pending) return;
    setPending(true);
    setNotice(null);
    let saved = false;
    try {
      if (!users)
        throw new Error('Users must be loaded before access can be changed.');
      await deleteUser(username);
      saved = true;
      await mutate(
        users.filter((user) => user.username !== username),
        { revalidate: false },
      );
      setDeletingUsername(null);
      setNotice({ kind: 'success', message: `${username} removed.` });
      await mutate();
    } catch (error) {
      const failureMessage =
        error instanceof Error ? error.message : 'Unable to remove this user.';
      setNotice({
        kind: 'error',
        message: saved
          ? `${username} was removed, but the people list could not be refreshed.`
          : failureMessage,
      });
    } finally {
      setPending(false);
      if (saved) restoreFocus(addButton.current);
      else focusAfterCommit(() => noticeRef.current?.focus());
    }
  }

  if (!users) {
    return (
      <div
        className={isError ? 'inline-alert' : 'empty-state'}
        role={isError ? 'alert' : 'status'}
      >
        {isError ? 'Unable to load users.' : 'Loading users…'}
        {isError && (
          <button
            ref={retryButton}
            className="button button-secondary"
            onClick={handleRetry}
          >
            Try again
          </button>
        )}
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
          ref={addButton}
          onClick={(event) => openEditor(undefined, event.currentTarget)}
          disabled={locked}
        >
          <Icon name="plus" /> Add User
        </button>
      </div>

      {isError && (
        <div className="inline-alert" role="alert">
          The people list could not be refreshed. Reload it before making
          another change.
          <button
            ref={retryButton}
            className="button button-secondary"
            onClick={handleRetry}
          >
            Try again
          </button>
        </div>
      )}

      {notice && (
        <div
          ref={noticeRef}
          tabIndex={-1}
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
            {editor.original
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
                  ref={editor.original ? undefined : editorInput}
                  id="user-username"
                  type="text"
                  autoComplete="off"
                  autoFocus={!editor.original}
                  value={editor.data.username}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      data: { ...editor.data, username: event.target.value },
                    })
                  }
                  disabled={!!editor.original}
                  className="field"
                  required
                />
              </div>
              <div>
                <label htmlFor="user-password" className="field-label">
                  {editor.original ? 'New password' : 'Password'}
                </label>
                <input
                  ref={editor.original ? editorInput : undefined}
                  id="user-password"
                  type="password"
                  autoComplete="new-password"
                  autoFocus={!!editor.original}
                  value={editor.data.password}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      data: { ...editor.data, password: event.target.value },
                    })
                  }
                  aria-describedby={
                    editor.original ? 'password-hint' : undefined
                  }
                  className="field"
                  required={!editor.original}
                />
                {editor.original && (
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
              <button
                type="submit"
                className="button button-primary"
                disabled={!!isError}
              >
                {pending
                  ? 'Saving…'
                  : `${editor.original ? 'Update' : 'Create'} User`}
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={cancelEditor}
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
                  onClick={(event) => openEditor(user, event.currentTarget)}
                  aria-label={`Edit ${user.username}`}
                  disabled={locked}
                >
                  <Icon name="edit" />
                </button>
                <button
                  className="icon-button"
                  onClick={(event) => {
                    trigger.current = event.currentTarget;
                    setNotice(null);
                    setDeletingUsername(user.username);
                  }}
                  aria-label={`Delete ${user.username}`}
                  disabled={locked}
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
                      onClick={cancelDelete}
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
