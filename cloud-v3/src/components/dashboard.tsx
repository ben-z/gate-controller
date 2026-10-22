import type { ReactNode } from 'react';
import Link from 'next/link';
import { logout } from '@/lib/auth/logout';
import { GateController } from './gate-controller';
import { ScheduleManager } from './schedule-manager';
import { UserManagement } from './user-management';
import { Icon } from './icon';
import { publicConfig } from '@/config';

const views = [
  {
    id: 'overview',
    label: 'Overview',
    icon: 'gate',
    title: 'Your gate, at a glance.',
    description: 'Gate commands, recent activity, and what’s next.',
  },
  {
    id: 'schedules',
    label: 'Schedules',
    icon: 'calendar',
    title: 'A schedule that fits your day.',
    description: 'Set recurring times to open and close your gate.',
  },
  {
    id: 'access',
    label: 'Access',
    icon: 'users',
    title: 'Give the right people access.',
    description: 'Manage the people who can control your gate.',
  },
  {
    id: 'system',
    label: 'System',
    icon: 'settings',
    title: 'Keep an eye on your system.',
    description: 'Controller configuration and browser diagnostics.',
  },
] as const;

export function getDashboardNavigation(
  view: string | undefined,
  isAdmin: boolean,
) {
  const availableViews = views.filter(
    (item) => isAdmin || item.id === 'overview' || item.id === 'schedules',
  );
  return {
    availableViews,
    current: availableViews.find((item) => item.id === view) ?? views[0],
  };
}

export function Dashboard({
  username,
  isAdmin,
  view,
  diagnostics,
}: {
  username: string;
  isAdmin: boolean;
  view: string | undefined;
  diagnostics: ReactNode;
}) {
  const { availableViews, current } = getDashboardNavigation(view, isAdmin);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="app-header">
        <div className="header-inner">
          <Link
            href="/dashboard"
            className="brand"
            aria-label="Gate Controller home"
          >
            <span className="brand-mark">
              <Icon name="gate" />
            </span>
            <span>
              Gate<span className="brand-light"> Controller</span>
              <span className="brand-period">.</span>
            </span>
          </Link>
          <div className="account">
            <div className="account-copy">
              <span>{username}</span>
              <span className="muted">
                {isAdmin ? 'Administrator' : 'Member'}
              </span>
            </div>
            <span className="account-avatar" aria-hidden="true">
              {username.slice(0, 1).toUpperCase()}
            </span>
            <form action={logout}>
              <button
                className="icon-button"
                aria-label="Sign out"
                title="Sign out"
              >
                <Icon name="log-out" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="workspace">
        <nav className="view-nav" aria-label="Main navigation">
          {availableViews.map((view) => (
            <Link
              key={view.id}
              href={
                view.id === 'overview'
                  ? '/dashboard'
                  : `/dashboard?view=${view.id}`
              }
              scroll={false}
              className={`nav-item ${current.id === view.id ? 'active' : ''}`}
              aria-current={current.id === view.id ? 'page' : undefined}
            >
              <Icon name={view.icon} />
              {view.label}
            </Link>
          ))}
          <span className="nav-timezone">
            <Icon name="clock" />
            {publicConfig.controllerTimezone.replaceAll('_', ' ')}
          </span>
        </nav>
        <main id="main-content" tabIndex={-1}>
          <div className="page-intro">
            <p className="eyebrow">
              {current.label} <span>/</span> Gate Controller
            </p>
            <h1>{current.title}</h1>
            <p className="muted">{current.description}</p>
          </div>
          <div className="view-content" key={current.id}>
            {current.id === 'overview' && <GateController />}
            {current.id === 'schedules' && <ScheduleManager />}
            {current.id === 'access' && <UserManagement />}
            {current.id === 'system' && diagnostics}
          </div>
        </main>
        <footer className="app-footer">
          <span>
            <Icon name="gate" /> A smoother way in.
          </span>
          <span>
            Gate Controller <span className="footer-divider">/</span>{' '}
            {publicConfig.controllerTimezone.replaceAll('_', ' ')}
          </span>
        </footer>
      </div>
    </div>
  );
}
