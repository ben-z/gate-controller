'use client';

import { login } from '@/lib/auth/login';
import Form from 'next/form';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Icon } from '@/components/icon';
import { GateIllustration } from '@/components/gate-illustration';

function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Gate Controller home">
      <span className="brand-mark">
        <Icon name="gate" />
      </span>
      <span>
        Gate<span className="brand-light"> Controller</span>
      </span>
    </Link>
  );
}

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);
  const [username, setUsername] = useState('');

  return (
    <main className="login-page">
      <section className="login-story" aria-label="Gate Controller">
        <Brand />
        <div className="login-story-copy">
          <GateIllustration open={false} />
        </div>
      </section>
      <section className="login-panel" aria-labelledby="login-heading">
        <div className="login-form">
          <div className="login-mobile-brand">
            <Brand />
          </div>
          <h1 id="login-heading">Sign in</h1>
          <Form action={formAction}>
            {state?.error && (
              <div className="inline-alert" role="alert">
                <Icon name="alert" />
                {state.error}
              </div>
            )}
            <div>
              <label htmlFor="username" className="field-label">
                Username
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                className="field"
                disabled={pending}
              />
            </div>
            <div>
              <label htmlFor="password" className="field-label">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                required
                autoComplete="current-password"
                className="field"
                disabled={pending}
              />
            </div>
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className="button button-primary"
            >
              {pending ? 'Signing in…' : 'Sign in'}
              <Icon name="arrow-up-right" />
            </button>
          </Form>
          <p className="login-note">
            Contact an administrator if you need access.
          </p>
        </div>
      </section>
    </main>
  );
}
