'use server';

import { cookies } from "next/headers";
import { authenticateUser } from "@/lib/db";
import { redirect } from "next/navigation";

export async function login(
  prevState: { error: string } | null,
  formData: FormData
) {

  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  const authResult = await authenticateUser(username, password);

  if (!authResult) {
    return { error: "Invalid username or password" };
  }

  const cookieStore = await cookies();
  cookieStore.set("session_key", authResult.session.session_key, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: authResult.session.expires_at - Date.now(),
    path: "/",
  });

  redirect("/dashboard");
}
