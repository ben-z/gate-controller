import { cookies } from "next/headers";
import Form from "next/form";
import { logout } from "@/lib/auth/logout";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')!;

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Token: {token.value}</p>
      <Form action={logout}>
        <button type="submit">Logout</button>
      </Form>
    </div>
  );
}
