/**
 * Ruler preview on the settings page (FR-017, FR-069, contracts/ui-flows.md "Settings page extras"): a small SVG
 * ruler drawn with the game's tick rules (`ticksFor`) and number mapping (`numberToX`), scaled to the preview width.
 */
import { numberToX } from '../core/numberline/mapping';
import { ticksFor, type RulerLevel } from '../core/numberline/ticks';
import { t } from '../i18n';

interface Props {
  range: { min: number; max: number };
  level: RulerLevel;
  width?: number;
}

const HEIGHT = 56;
const PAD = 18;
const BASE_Y = 18;

export function RulerPreview({ range, level, width = 360 }: Props) {
  const layout = { worldWidth: width, left: PAD, right: width - PAD };
  const { ticks } = ticksFor(range, level, 0);
  const visible = ticks.filter((tk) => tk.visible);
  return (
    <svg
      className="ruler-preview"
      data-testid="ruler-preview"
      role="img"
      aria-label={t().settings.preview(range.min, range.max, level)}
      viewBox={`0 0 ${width} ${HEIGHT}`}
      width={width}
      height={HEIGHT}
    >
      <line x1={layout.left} x2={layout.right} y1={BASE_Y} y2={BASE_Y} className="ruler-preview-base" />
      {visible.map((tk) => {
        const x = numberToX(tk.value, range.min, range.max, layout);
        const len = tk.major || tk.value === range.min || tk.value === range.max ? 12 : 6;
        return <line key={`l${tk.value}`} data-testid="preview-line" data-major={tk.major} x1={x} x2={x} y1={BASE_Y - len / 2} y2={BASE_Y + len / 2} />;
      })}
      {visible
        .filter((tk) => tk.labeled)
        .map((tk) => (
          <text key={`t${tk.value}`} data-testid="preview-label" x={numberToX(tk.value, range.min, range.max, layout)} y={BASE_Y + 24} textAnchor="middle">
            {tk.value}
          </text>
        ))}
    </svg>
  );
}
