import type { ReactNode } from 'react';
import Link from 'next/link';
import { logout } from '@/lib/auth/logout';
import { GateController } from './gate-controller';
import { ScheduleManager } from './schedule-manager';
import { UserManagement } from './user-management';
import { Icon } from './icon';
import { publicConfig } from '@/config';
import { ViewContent } from './view-content';

const views = [
  {
    id: 'overview',
    label: 'Overview',
    icon: 'gate',
  },
  {
    id: 'schedules',
    label: 'Schedules',
    icon: 'calendar',
  },
  {
    id: 'access',
    label: 'Access',
    icon: 'users',
  },
  {
    id: 'system',
    label: 'System',
    icon: 'settings',
  },
] as const;

export function getDashboardNavigation(
  view: string | undefined,
  isAdmin: boolean,
) {
  const availableViews = views.filter(
    (item) => isAdmin || item.id !== 'access',
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
            <h1>{current.label}</h1>
          </div>
          {current.id === 'system' ? (
            <div className="view-content">{diagnostics}</div>
          ) : (
            <ViewContent key={current.id}>
              {current.id === 'overview' && <GateController />}
              {current.id === 'schedules' && <ScheduleManager />}
              {current.id === 'access' && <UserManagement />}
            </ViewContent>
          )}
        </main>
      </div>
    </div>
  );
}
