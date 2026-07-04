import { NextRequest } from "next/server";
import { getSchedules } from "@/lib/db";
import { draftSchedules } from "@/lib/schedule-drafts";
import {
  apiError,
  readJsonBody,
  requireApiSession,
  requireObject,
  requireString,
} from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    await requireApiSession();
    const body = requireObject(await readJsonBody(request));
    const prompt = requireString(body, "prompt");

    return Response.json(await draftSchedules(prompt, getSchedules()));
  } catch (error) {
    return apiError(error, "Error drafting schedules:");
  }
}
