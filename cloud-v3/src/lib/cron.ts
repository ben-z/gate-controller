import cronParser from "cron-parser";
import cronstrue from "cronstrue";

export function validateCronExpression(expression: string): boolean {
  try {
    if (expression.trim().split(/\s+/).length !== 5) return false;
    describeCronExpression(expression);
    getNextCronExecutions(expression, "UTC", 1);
    return true;
  } catch {
    return false;
  }
}

export function describeCronExpression(expression: string): string {
  return cronstrue.toString(expression);
}

export function getNextCronExecutions(
  expression: string,
  timezone: string,
  count = 5
): string[] {
  const interval = cronParser.parseExpression(expression, {
    currentDate: new Date(),
    tz: timezone,
  });

  return Array.from({ length: count }, () => interval.next().toISOString());
}
