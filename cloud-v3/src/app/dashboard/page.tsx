import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Form from "next/form";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')!;

  async function handleLogout() {
    'use server';

    const cookieStore1 = await cookies();
    cookieStore1.delete('token');
    redirect('/login');
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Token: {token.value}</p>
      <Form action={handleLogout}>
        <button type="submit">Logout</button>
      </Form>
    </div>
  );
}
