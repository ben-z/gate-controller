import { logout } from "@/lib/auth/logout";
import { ensureSession } from "@/lib/auth/ensure-session";
import { GateController } from "@/components/gate-controller";
import { ScheduleManager } from "@/components/schedule-manager";
import { UserManagement } from "@/components/user-management";
import { getInitialData } from "@/lib/data";
import { SWRConfig } from "swr";

export default async function DashboardPage() {
  const { user } = await ensureSession();
  const initialData = await getInitialData();

  return (
    <SWRConfig value={{ fallback: {
      '/api/gate?history=true': initialData.gateStatus,
      '/api/schedules': initialData.schedules,
      '/api/users': initialData.users,
      '/api/schedules/upcoming': initialData.upcomingSchedules,
    }}}>
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        {/* Header */}
        <header className="border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                <h1 className="text-xl sm:text-2xl font-bold">Gate Controller</h1>
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span>Logged in as:</span>
                  <span className="font-medium">{user.username}</span>
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {user.role}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="space-y-4 sm:space-y-8">
            {/* Gate Control Section */}
            <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
              <GateController />
            </section>

            {/* Schedule Manager Section */}
            <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
              <ScheduleManager />
            </section>

            {/* User Management Section (Admin only) */}
            {user.role === 'admin' && (
              <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
                <UserManagement />
              </section>
            )}

            {/* Logout Button */}
            <div className="flex justify-center">
              <form action={logout}>
                <button
                  type="submit"
                  className="px-6 py-3 text-sm font-medium text-red-700 dark:text-red-200 bg-red-100 dark:bg-red-900/50 rounded-lg hover:bg-red-200 dark:hover:bg-red-900 transition-colors"
                >
                  Logout
                </button>
              </form>
            </div>
          </div>
        </main>
      </div>
    </SWRConfig>
  );
}
