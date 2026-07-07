import { NextRequest } from "next/server";
import { getSchedules } from "@/lib/db";
import {
  draftSchedules,
  requireScheduleDraftingConfigured,
} from "@/lib/schedule-drafts";
import {
  apiError,
  ApiError,
  readJsonBody,
  requireApiSession,
  requireObject,
  requireString,
} from "@/lib/api";
import { ScheduleDraftStreamEvent } from "@/types/schedule";

const encoder = new TextEncoder();

export async function POST(request: NextRequest) {
  try {
    await requireApiSession();
    const body = requireObject(await readJsonBody(request));
    const prompt = requireString(body, "prompt");
    requireScheduleDraftingConfigured();
    const schedules = getSchedules();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: ScheduleDraftStreamEvent) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };

        try {
          send({
            type: "progress",
            title: "Reading the request",
            detail: "Checking the prompt against existing schedules.",
          });
          const result = await draftSchedules(prompt, schedules, (progress) =>
            send({ type: "progress", ...progress })
          );
          send({ type: "result", result });
        } catch (error) {
          if (!(error instanceof ApiError)) {
            console.error("Error drafting schedules:", error);
          }
          send({
            type: "error",
            error: error instanceof Error ? error.message : "Failed to draft schedules",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        "Content-Type": "application/x-ndjson; charset=utf-8",
      },
    });
  } catch (error) {
    return apiError(error, "Error drafting schedules:");
  }
}
