'use server';

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { deleteSession } from "../db";

export async function logout() {
  const cookieStore = await cookies();
  const sessionKey = cookieStore.get("session_key");
  if (!sessionKey) {
    return;
  }
  deleteSession(sessionKey.value);
  cookieStore.delete("session_key");
  redirect('/login');
} 