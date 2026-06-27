import { config, secrets } from "@/config";
import { BrowserDiagnostics } from "./browser-diagnostics";
import { DiagnosticGrid } from "./diagnostic-grid";

const serverDiagnostics = [
  ["Controller timezone", config.controllerTimezone],
  ["Database path", config.dbPath],
  ["Redis", `${config.redis.host}:${config.redis.port}`],
  ["Agent auth", secrets.agentToken ? "required" : "not required"],
  ["Node environment", process.env.NODE_ENV || "development"],
] as const;

export function DiagnosticsPanel() {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Diagnostics</h2>
        <span className="text-sm text-gray-500 group-open:hidden dark:text-gray-400">
          Show
        </span>
        <span className="hidden text-sm text-gray-500 group-open:inline dark:text-gray-400">
          Hide
        </span>
      </summary>

      <div className="mt-6 space-y-6">
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase text-gray-500 dark:text-gray-400">
            Server
          </h3>
          <DiagnosticGrid items={serverDiagnostics} />
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase text-gray-500 dark:text-gray-400">
            Browser
          </h3>
          <BrowserDiagnostics />
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase text-gray-500 dark:text-gray-400">
            Build
          </h3>
          <pre className="max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-900 dark:bg-gray-900/60 dark:text-gray-100">
            {JSON.stringify(config.buildInfo, null, 2)}
          </pre>
        </div>
      </div>
    </details>
  );
}
