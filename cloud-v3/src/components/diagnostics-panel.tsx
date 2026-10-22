import { config, secrets } from '@/config';
import { BrowserDiagnostics } from './browser-diagnostics';
import { DiagnosticGrid } from './diagnostic-grid';
import { Icon } from './icon';
import { getAppVersion } from '@/lib/app-version';
import { SystemStatus } from './system-status';

const serverDiagnostics = [
  ['Database path', config.dbPath],
  ['Redis', `${config.redis.host}:${config.redis.port}`],
  ['Agent auth', secrets.agentToken ? 'required' : 'not required'],
  ['Node environment', process.env.NODE_ENV || 'development'],
] as const;

export function DiagnosticsPanel({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="diagnostics-layout">
      <section className="card">
        <div className="card-header">
          <h2 className="section-heading">
            <Icon name="settings" />
            Diagnostics
          </h2>
          <span className="small-label">SERVER</span>
        </div>
        <div className="card-body">
          <SystemStatus version={getAppVersion()} />
        </div>
      </section>
      <section className="card">
        <div className="card-header">
          <h2 className="section-heading">
            <Icon name="activity" />
            Browser storage
          </h2>
          <span className="small-label">THIS DEVICE</span>
        </div>
        <div className="card-body">
          <BrowserDiagnostics />
        </div>
      </section>
      {isAdmin && (
        <section className="card">
          <div className="card-header">
            <h2 className="section-heading">
              <Icon name="settings" />
              Server configuration
            </h2>
          </div>
          <div className="card-body">
            <DiagnosticGrid items={serverDiagnostics} />
          </div>
        </section>
      )}
      {isAdmin && Object.keys(config.buildInfo).length > 0 && (
        <section className="card diagnostics-build">
          <div className="card-header">
            <h2 className="section-heading">
              <Icon name="gate" />
              Build information
            </h2>
          </div>
          <div className="card-body">
            <pre className="build-output">
              {JSON.stringify(config.buildInfo, null, 2)}
            </pre>
          </div>
        </section>
      )}
    </div>
  );
}
