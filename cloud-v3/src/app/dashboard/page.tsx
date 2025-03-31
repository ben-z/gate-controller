import Form from "next/form";
import { logout } from "@/lib/auth/logout";
import { ensureSession } from "@/lib/auth/ensure-session";

export default async function DashboardPage() {
  const { user, session } = await ensureSession();

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Session Key: {session.session_key}</p>
      <p>Session Created At: {session.created_at}</p>
      <p>Session Expires At: {session.expires_at}</p>
      <p>User: {user.username}</p>
      <Form action={logout}>
        <button type="submit">Logout</button>
      </Form>
    </div>
  );
}
