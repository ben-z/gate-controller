import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => {
  process.env.NODE_ENV = 'production';
  vi.doMock('bullmq', () => ({
    Queue: class { constructor(public name:string, public opts:any){} async upsertJobScheduler(){} async removeJobScheduler(){} async getDelayed(){ return [];} },
    QueueEvents: class { constructor(){ } on(){ } },
    Worker: class {}
  }));
});

describe('scheduler production init', () => {
  it('loads without errors', async () => {
    const scheduler = await import('../src/lib/scheduler');
    expect(scheduler.validateCronExpression('* * * * *')).toBe(true);
  });
});
