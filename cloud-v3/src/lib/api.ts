import { getSession } from "@/lib/auth/ensure-session";
import { NextRequest, NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export async function requireApiSession() {
  const session = await getSession();
  if (!session) throw new ApiError(401, "Unauthorized");
  return session;
}

export async function requireAdminSession() {
  const session = await requireApiSession();
  if (session.user.role !== "admin") throw new ApiError(403, "Forbidden");
  return session;
}

export async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
}

export function requireObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "Expected a JSON object");
  }
  return value as Record<string, unknown>;
}

export function requireString(
  body: Record<string, unknown>,
  field: string
): string {
  const value = body[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(400, `Missing ${field}`);
  }
  return value.trim();
}

export function optionalString(
  body: Record<string, unknown>,
  field: string
): string | undefined {
  const value = body[field];
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string") throw new ApiError(400, `Invalid ${field}`);
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function requireGateAction(value: unknown): "open" | "close" {
  if (value !== "open" && value !== "close") {
    throw new ApiError(400, "Invalid action");
  }
  return value;
}

export function optionalBoolean(
  body: Record<string, unknown>,
  field: string,
  fallback: boolean
): boolean {
  const value = body[field];
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new ApiError(400, `Invalid ${field}`);
  return value;
}

export function apiError(error: unknown, logMessage: string): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(logMessage, error);
  return NextResponse.json(
    { error: "Internal Server Error" },
    { status: 500 }
  );
}
