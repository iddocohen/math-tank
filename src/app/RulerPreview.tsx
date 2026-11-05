/**
 * Ruler preview on the settings page (FR-017, FR-069, T218, contracts/ui-flows.md "Settings page extras"): an SVG
 * ruler drawn with the game's tick and label rules (`ticksFor`, `labelFontSize`, the label rows of T217) and the
 * game's layout (`DEFAULT_LAYOUT`, `numberToX`), so it shows what the game ruler shows. The SVG fills the width of
 * its container; `width` is the logical width the layout is scaled to (the game's world width by default).
 */
import { DEFAULT_LAYOUT, numberToX } from '../core/numberline/mapping';
import { labelFontSize, ticksFor, type RulerLevel } from '../core/numberline/ticks';
import { t } from '../i18n';

interface Props {
  range: { min: number; max: number };
  level: RulerLevel;
  /** Logical width of the drawing; the SVG itself is always as wide as its container. */
  width?: number;
}

/** Vertical positions in game units, matching src/game/NumberLineView.ts (axis 742, label rows 772 and 798). */
const AXIS_Y = 20;
const MAJOR_TICK = 26;
const MINOR_TICK = 14;
const ROW_Y = [AXIS_Y + 30, AXIS_Y + 56] as const;
const HEIGHT = 96;

export function RulerPreview({ range, level, width = DEFAULT_LAYOUT.worldWidth }: Props) {
  const k = width / DEFAULT_LAYOUT.worldWidth;
  const layout = { worldWidth: width, left: DEFAULT_LAYOUT.left * k, right: DEFAULT_LAYOUT.right * k };
  const { ticks, labelRows } = ticksFor(range, level, 0);
  const visible = ticks.filter((tk) => tk.visible);
  const isEnd = (v: number) => v === range.min || v === range.max;
  const x = (v: number) => numberToX(v, range.min, range.max, layout);
  return (
    <svg
      className="ruler-preview"
      data-testid="ruler-preview"
      role="img"
      aria-label={t().settings.preview(range.min, range.max, level)}
      viewBox={`0 0 ${width} ${HEIGHT * k}`}
      width="100%"
    >
      <line x1={layout.left} x2={layout.right} y1={AXIS_Y * k} y2={AXIS_Y * k} strokeWidth={4 * k} />
      {visible.map((tk) => {
        const big = tk.major || isEnd(tk.value);
        const len = (big ? MAJOR_TICK : MINOR_TICK) * k;
        return (
          <line
            key={`l${tk.value}`}
            data-testid="preview-line"
            data-major={tk.major}
            x1={x(tk.value)}
            x2={x(tk.value)}
            y1={AXIS_Y * k - len / 2}
            y2={AXIS_Y * k + len / 2}
            strokeWidth={(big ? 4 : 2) * k}
          />
        );
      })}
      {visible
        .filter((tk) => tk.labeled)
        .map((tk) => (
          <text
            key={`t${tk.value}`}
            data-testid="preview-label"
            data-row={tk.row}
            x={x(tk.value) + tk.shift * k}
            y={ROW_Y[tk.row] * k}
            fontSize={labelFontSize(tk, labelRows, range) * k}
            textAnchor="middle"
            dominantBaseline="hanging"
          >
            {tk.value}
          </text>
        ))}
    </svg>
  );
}
