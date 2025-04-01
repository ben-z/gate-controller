import { getSession } from "@/lib/auth/ensure-session";
import Link from "next/link";

export default async function Home() {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">
            Welcome to Gate Controller
          </h1>
          <p className="text-lg text-gray-600 mb-12">
            Manage your access control system with ease and security
          </p>
          <div className="flex gap-4 justify-center">
            {session ? (
            <Link 
              href="/dashboard" 
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
            >
              Go to Dashboard
            </Link>
            ) : (
            <Link 
              href="/login" 
              className="px-6 py-3 bg-white text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors duration-200 font-medium"
            >
              Log in
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
