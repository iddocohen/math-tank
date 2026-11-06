import { describe, expect, it } from 'vitest';
import { crossesHundred, crossesTen } from './crossing';

describe('crossesTen and crossesHundred (FR-022, FR-023)', () => {
  it('detects a crossed ten in either direction', () => {
    expect(crossesTen(24, 32)).toBe(true);
    expect(crossesTen(24, 29)).toBe(false);
    expect(crossesTen(43, 36)).toBe(true);
  });

  it('does not count landing on or starting from a ten as crossing it', () => {
    expect(crossesTen(24, 30)).toBe(false);
    expect(crossesTen(30, 27)).toBe(false);
    expect(crossesTen(-3, 4)).toBe(true);
  });

  it('detects a crossed hundred', () => {
    expect(crossesHundred(95, 103)).toBe(true);
    expect(crossesHundred(95, 100)).toBe(false);
    expect(crossesHundred(203, 196)).toBe(true);
  });
});
