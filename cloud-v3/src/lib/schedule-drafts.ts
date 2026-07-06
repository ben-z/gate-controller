import { config, secrets } from "@/config";
import {
  describeCronExpression,
  getNextCronExecutions,
  validateCronExpression,
} from "@/lib/cron";
import { ApiError } from "@/lib/api";
import {
  Schedule,
  ScheduleDraftProgress,
  ScheduleDraftResponse,
} from "@/types/schedule";

type ModelScheduleDraftResponse = {
  interpretation: string;
  drafts: Array<{
    name: string;
    action: "open" | "close";
    cron_expression: string;
    enabled: boolean;
    summary: string;
  }>;
  questions: string[];
  warnings: string[];
};

const SCHEDULE_DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["interpretation", "drafts", "questions", "warnings"],
  properties: {
    interpretation: { type: "string" },
    drafts: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "action", "cron_expression", "enabled", "summary"],
        properties: {
          name: { type: "string" },
          action: { type: "string", enum: ["open", "close"] },
          cron_expression: { type: "string" },
          enabled: { type: "boolean" },
          summary: { type: "string" },
        },
      },
    },
    questions: { type: "array", items: { type: "string" }, maxItems: 3 },
    warnings: { type: "array", items: { type: "string" }, maxItems: 5 },
  },
} as const;

const SYSTEM_PROMPT = `
You convert plain English into gate schedule drafts.

Rules:
- Return drafts only. Never open or close the gate immediately.
- The scheduler supports only recurring five-field cron: minute hour day-of-month month day-of-week.
- Use the supplied controller timezone for interpreting times.
- Use 24-hour values in cron expressions.
- Use action "open" only for opening and "close" only for closing.
- If the request needs one-time dates, exceptions, holidays, sensors, sunrise/sunset, or unclear timing, do not guess. Return no drafts and add a concise question.
- If the user asks for multiple actions, return multiple drafts.
- Names must be short, human readable, and unique against the existing schedule names.
- Default drafts to enabled.
`.trim();

export async function draftSchedules(
  prompt: string,
  existingSchedules: Schedule[],
  onProgress?: (progress: ScheduleDraftProgress) => void
): Promise<ScheduleDraftResponse> {
  requireScheduleDraftingConfigured();

  onProgress?.({
    title: "Thinking through the schedule",
    detail: "Asking AI for recurring open/close drafts in controller time.",
  });

  const response = await fetchOpenAiDraft(
    JSON.stringify({
      model: config.scheduleDraftModel,
      store: false,
      input: [
        { role: "developer", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            controller_timezone: config.controllerTimezone,
            existing_schedule_names: existingSchedules.map((schedule) => schedule.name),
            request: prompt,
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "gate_schedule_draft",
          strict: true,
          schema: SCHEDULE_DRAFT_SCHEMA,
        },
      },
    }),
    onProgress
  );

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, openAiErrorMessage(response.status, body));
  }

  onProgress?.({
    title: "Validating drafts",
    detail: "Checking cron expressions and previewing upcoming run times.",
  });

  return normalizeDraftResponse(parseModelResponse(body), existingSchedules);
}

export function requireScheduleDraftingConfigured() {
  if (!secrets.openaiApiKey) {
    throw new ApiError(503, "AI schedule drafting is not configured. Set OPENAI_API_KEY.");
  }
}

async function fetchOpenAiDraft(
  body: string,
  onProgress?: (progress: ScheduleDraftProgress) => void
) {
  try {
    return await postOpenAiDraft(body);
  } catch {
    onProgress?.({
      title: "Retrying AI request",
      detail: "The connection dropped before OpenAI replied; trying once more.",
    });
    return postOpenAiDraft(body);
  }
}

function postOpenAiDraft(body: string) {
  return fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${secrets.openaiApiKey}`,
      "content-type": "application/json",
    },
    body,
  });
}

function parseModelResponse(body: unknown): ModelScheduleDraftResponse {
  const outputText = extractOutputText(body);
  if (!outputText) throw new ApiError(502, "OpenAI returned no schedule draft");

  try {
    return JSON.parse(outputText) as ModelScheduleDraftResponse;
  } catch {
    throw new ApiError(502, "OpenAI returned an invalid schedule draft");
  }
}

function normalizeDraftResponse(
  response: ModelScheduleDraftResponse,
  existingSchedules: Schedule[]
): ScheduleDraftResponse {
  const usedNames = new Set(existingSchedules.map((schedule) => schedule.name));
  const warnings = [...cleanStringArray(response.warnings)];
  const rawDrafts = Array.isArray(response.drafts) ? response.drafts : [];

  const drafts = rawDrafts.flatMap((draft) => {
    if (!draft || typeof draft !== "object") return [];
    if (draft.action !== "open" && draft.action !== "close") return [];
    if (typeof draft.name !== "string" || typeof draft.cron_expression !== "string") {
      return [];
    }

    if (!validateCronExpression(draft.cron_expression)) {
      warnings.push(`Skipped invalid cron expression: ${draft.cron_expression}`);
      return [];
    }

    const name = nextAvailableName(cleanName(draft.name), usedNames);
    usedNames.add(name);

    return {
      name,
      action: draft.action,
      cron_expression: draft.cron_expression.trim(),
      enabled: draft.enabled === true,
      summary: typeof draft.summary === "string" ? draft.summary.trim() : "",
      description: describeCronExpression(draft.cron_expression),
      nextExecutions: getNextCronExecutions(
        draft.cron_expression,
        config.controllerTimezone,
        5
      ),
    };
  });

  return {
    interpretation:
      typeof response.interpretation === "string" ? response.interpretation.trim() : "",
    drafts,
    questions: cleanStringArray(response.questions),
    warnings,
  };
}

function extractOutputText(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  if ("output_text" in body && typeof body.output_text === "string") {
    return body.output_text;
  }

  if (!("output" in body) || !Array.isArray(body.output)) return null;

  for (const item of body.output) {
    if (!item || typeof item !== "object") continue;
    if (!("content" in item) || !Array.isArray(item.content)) continue;

    for (const content of item.content) {
      if (!content || typeof content !== "object") continue;
      if ("text" in content && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  return null;
}

function openAiErrorMessage(status: number, body: unknown): string {
  if (status === 401 || status === 403) {
    return "OpenAI rejected OPENAI_API_KEY";
  }
  if (status === 429) {
    return "OpenAI rate limit reached";
  }

  const type = readOpenAiErrorType(body);
  return type ? `OpenAI schedule draft failed: ${type}` : "OpenAI schedule draft failed";
}

function readOpenAiErrorType(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  if (!("error" in body) || !body.error || typeof body.error !== "object") return null;
  if (!("type" in body.error) || typeof body.error.type !== "string") return null;
  return body.error.type;
}

function cleanStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function cleanName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9 -]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "gate schedule";
}

function nextAvailableName(name: string, usedNames: Set<string>): string {
  if (!usedNames.has(name)) return name;

  for (let suffix = 2; suffix < 100; suffix += 1) {
    const candidate = `${name} ${suffix}`;
    if (!usedNames.has(candidate)) return candidate;
  }

  return `${name} ${Date.now()}`;
}
