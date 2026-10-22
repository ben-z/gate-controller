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
        <span className="brand-period">.</span>
      </span>
    </Link>
  );
}

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);
  const [username, setUsername] = useState('');

  return (
    <main className="login-page">
      <section className="login-story" aria-label="Welcome to Gate Controller">
        <Brand />
        <div className="login-story-copy">
          <span className="eyebrow">A WARMER WELCOME HOME</span>
          <h2>
            A smoother
            <br />
            way in.
          </h2>
          <p>
            A little control. A daily routine.
            <br />
            One less thing to think about.
          </p>
          <GateIllustration open={false} />
        </div>
        <span className="login-story-footer">
          YOUR GATE. YOUR SPACE. YOUR PACE.
        </span>
      </section>
      <section className="login-panel" aria-labelledby="login-heading">
        <div className="login-form">
          <div className="login-mobile-brand">
            <Brand />
          </div>
          <p className="eyebrow">GATE CONTROLLER</p>
          <h1 id="login-heading">Welcome back.</h1>
          <p className="muted">Sign in to make yourself at home.</p>
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
                placeholder="Your username"
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
                placeholder="Your password"
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
            Access is managed by your gate administrator.
          </p>
        </div>
      </section>
    </main>
  );
}
