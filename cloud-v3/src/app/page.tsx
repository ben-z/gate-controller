import { getSession } from "@/lib/auth/ensure-session";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getSession();
  redirect(session ? "/dashboard" : "/login");
}
