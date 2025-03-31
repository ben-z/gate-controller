import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { refreshSession } from "@/lib/db";

/**
 * Ensures that the current request has a valid session.
 * 
 * This function checks for a session cookie, validates it, and refreshes the session.
 * If the session is invalid or expired, the user is redirected to the login page.
 * 
 * @returns An object containing the user and session information if the session is valid
 * @throws Redirects to /login if no valid session is found
 */
export async function ensureSession() {
  const cookieStore = await cookies();
  const sessionKey = cookieStore.get("session_key");

  if (!sessionKey) {
    return redirect("/login");
  }

  // validate session key
  const refreshResult = refreshSession(sessionKey.value);

  if (!refreshResult) {
    return redirect("/login");
  }

  return refreshResult;
}