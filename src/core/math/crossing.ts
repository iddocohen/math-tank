/** Ten and hundred boundaries crossed when moving from one number to another (FR-022, FR-023). */
import { crossesMultiple } from './skills';

/** True when a multiple of 10 lies strictly between `a` and `b`: 24 → 32 crosses 30, 24 → 30 does not. */
export function crossesTen(a: number, b: number): boolean {
  return crossesMultiple(a, b, 10);
}

/** True when a multiple of 100 lies strictly between `a` and `b`: 95 → 103 crosses 100. */
export function crossesHundred(a: number, b: number): boolean {
  return crossesMultiple(a, b, 100);
}
