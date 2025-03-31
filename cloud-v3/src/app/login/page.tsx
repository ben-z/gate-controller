"use client";
import { login } from "@/lib/auth/login";
import Form from "next/form";
import { useActionState } from "react";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <div>
      <h1>Login</h1>
      <Form action={formAction}>
        <input type="text" name="username" />
        <input type="password" name="password" />
        <button type="submit" disabled={pending}>
          Login
        </button>
        {state?.error && <p>{state.error}</p>}
      </Form>
    </div>
  );
}
