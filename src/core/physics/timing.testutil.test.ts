import { describe, expect, it } from 'vitest';
import { medianMs, nowMs } from './timing.testutil';

/** Busy-waits for `ms` milliseconds of CPU time. */
function spin(ms: number): void {
  const end = nowMs() + ms;
  while (nowMs() < end) {
    // wait
  }
}

describe('medianMs (T302)', () => {
  it('ignores one slow call among fast ones', () => {
    let call = 0;
    expect(medianMs(5, () => spin(call++ === 2 ? 60 : 1))).toBeLessThan(20);
  });

  it('reports a slowdown that affects most calls', () => {
    let call = 0;
    expect(medianMs(5, () => spin(call++ === 0 ? 1 : 30))).toBeGreaterThanOrEqual(30);
  });

  it('counts CPU time, so time spent waiting for a core does not count', async () => {
    const t0 = nowMs();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(nowMs() - t0).toBeLessThan(50);
  });
});
