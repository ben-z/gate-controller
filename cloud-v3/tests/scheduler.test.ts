import { describe, it, expect } from 'vitest';
import { validateCronExpression } from '../src/lib/scheduler';

describe('validateCronExpression', () => {
  it('accepts valid cron expressions', () => {
    expect(validateCronExpression('* * * * *')).toBe(true);
  });

  it('rejects invalid cron expressions', () => {
    expect(validateCronExpression('bad expression')).toBe(false);
  });
});
