/**
 * Timing helper for the speed tests of the solvers (P5, T302). Used only by tests.
 *
 * The speed tests failed when other test files kept every core busy: wall-clock time then counts the time the test
 * process waited for a core. This helper measures the CPU time of the test process instead (Node's
 * `process.cpuUsage()`, which Vitest's forked workers provide; wall-clock time only where it is missing), so waiting
 * does not count but slower code does. It also takes the median of several calls, which ignores a call slowed by
 * garbage collection, yet still fails when the code itself got slower, because then most calls are slow.
 */

interface CpuUsage {
  user: number;
  system: number;
}

const cpuUsage = (globalThis as { process?: { cpuUsage?: () => CpuUsage } }).process?.cpuUsage;

/** Milliseconds of CPU time used by this process so far, or wall-clock milliseconds without `process.cpuUsage`. */
export function nowMs(): number {
  if (!cpuUsage) return performance.now();
  const u = cpuUsage();
  return (u.user + u.system) / 1000;
}

/** The median time of `runs` calls of `fn`, in milliseconds (see nowMs). */
export function medianMs(runs: number, fn: () => unknown, clock: () => number = nowMs): number {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = clock();
    fn();
    times.push(clock() - t0);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)]!;
}
