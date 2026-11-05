/**
 * Tank shades and the color contrast rule (amendment 14, FR-109). Pure, so the rule is tested without Phaser.
 *
 * Each tank body gets a lighter highlight on top and a darker shadow band below, computed from its color, so every
 * garage color gets the same shading. The contrast rule uses the CIE76 color difference: the Euclidean distance in
 * CIE L*a*b* (D65). A difference of about 2.3 is just noticeable; MIN_DELTA_E (30) keeps two colors clearly different
 * at a glance, also for the darker shadow shades against the dark soil.
 */

export interface TankShades {
  base: number;
  /** Lighter shade on the top of the body. */
  highlight: number;
  /** Darker shade on the band below. */
  shadow: number;
  /** Thin outline around the body. */
  outline: number;
}

/** Smallest CIE76 difference between a garage color shade and an enemy shade or a ground color. */
export const MIN_DELTA_E = 30;

/**
 * Colors of the ground around the tanks (FR-107, FR-108). `dirt` is the average color of the bundled dirt texture
 * (src/assets/textures/dirt.png), measured over all its pixels.
 */
export const GROUND_COLORS = {
  dirt: 0xad7d44,
  soil: 0x5a3d22,
  grass: 0x5c9d3a,
  tuft: 0x3f7a2a,
  scorch: 0x2b1d12,
  bedrock: 0x3b2a1c,
} as const;

const HIGHLIGHT_MIX = 0.42;
const SHADOW_MIX = 0.35;
const OUTLINE_MIX = 0.6;

/** `a` blended toward `b` by `k` (0 gives `a`, 1 gives `b`), per channel. */
export function mixColor(a: number, b: number, k: number): number {
  const ch = (shift: number) => Math.round(((a >> shift) & 0xff) * (1 - k) + ((b >> shift) & 0xff) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

export function tankShades(color: number): TankShades {
  return {
    base: color,
    highlight: mixColor(color, 0xffffff, HIGHLIGHT_MIX),
    shadow: mixColor(color, 0x000000, SHADOW_MIX),
    outline: mixColor(color, 0x000000, OUTLINE_MIX),
  };
}

function linear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** CIE L*a*b* (D65) of an sRGB color 0xRRGGBB. */
export function lab(color: number): [number, number, number] {
  const r = linear((color >> 16) & 0xff);
  const g = linear((color >> 8) & 0xff);
  const b = linear(color & 0xff);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** CIE76 color difference between two colors. */
export function deltaE76(a: number, b: number): number {
  if (a === b) return 0;
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}
