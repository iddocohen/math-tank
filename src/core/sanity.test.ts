import { describe, expect, it } from 'vitest';

describe('toolchain sanity', () => {
  it('runs a Vitest test in the node environment', () => {
    expect(typeof window).toBe('undefined');
    expect(1 + 1).toBe(2);
  });
});
