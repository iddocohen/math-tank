/**
 * SVG drawings for the tank garage (amendment 11, FR-091): the preview tank with the chosen color, flag, hat and a
 * short piece of the chosen trail, and one small icon per item. The shapes come from src/core/rewards/looks.ts, the
 * same shapes Phaser draws in battle, in tank coordinates (y up), so the group is flipped with scale(1, -1).
 * Amendment 14 (FR-110, FR-112): the tank body and turret come from src/core/view/tankDrawing.ts, the battle's drawing
 * code, and the trail lines are drawn thicker.
 * A locked item is drawn as a grey silhouette: every fill and line in one grey.
 */
import type { ReactElement } from 'react';
import type { GarageItem, Look, TrailId } from '../core/rewards/items';
import { STRIPE_COLOR, colorStripes, flagShapes, hatShapes, tankColor, trailStyle, type Shape } from '../core/rewards/looks';
import { playerTankShapes } from '../core/view/tankDrawing';
import { lookKey } from '../core/rewards/garage';
import { cssColor } from '../core/view/shade';

const SILHOUETTE = 0x8a9099;
const OUTLINE = 0x1b1f27;


function ShapeSvg({ shape, grey }: { shape: Shape; grey?: boolean }): ReactElement {
  const fill = (c: number) => cssColor(grey ? SILHOUETTE : c);
  switch (shape.type) {
    case 'poly':
      return (
        <polygon
          points={shape.points.map(([x, y]) => `${x},${y}`).join(' ')}
          fill={fill(shape.fill)}
          stroke={shape.stroke === undefined ? undefined : fill(shape.stroke)}
          strokeWidth={shape.stroke === undefined ? undefined : 1}
          strokeLinejoin="round"
          fillOpacity={shape.alpha}
        />
      );
    case 'circle':
      return (
        <circle
          cx={shape.x}
          cy={shape.y}
          r={shape.r}
          fill={fill(shape.fill)}
          stroke={shape.stroke === undefined ? undefined : fill(shape.stroke)}
          strokeWidth={shape.stroke === undefined ? undefined : 1}
          fillOpacity={shape.alpha}
        />
      );
    case 'line':
      return <line x1={shape.from[0]} y1={shape.from[1]} x2={shape.to[0]} y2={shape.to[1]} stroke={fill(shape.color)} strokeWidth={shape.width} strokeLinecap="round" />;
  }
}

/** A short shell arc with the trail drawn behind it, in tank coordinates. */
function TrailSvg({ trail, x0, y0, grey }: { trail: TrailId; x0: number; y0: number; grey?: boolean }): ReactElement {
  const style = trailStyle(trail);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 12; i++) {
    const tt = i / 12;
    pts.push([x0 + 70 * tt, y0 + 40 * tt - 30 * tt * tt]);
  }
  const color = (c: number) => cssColor(grey ? SILHOUETTE : c);
  const offset = (k: number) => (k - (style.line.length - 1) / 2) * 3;
  return (
    <g>
      {style.line.map((c, k) => (
        <polyline key={k} points={pts.map(([x, y]) => `${x},${y + offset(k)}`).join(' ')} fill="none" stroke={color(c)} strokeWidth={style.line.length > 1 ? 4.5 : 5} strokeLinecap="round" />
      ))}
      {style.dots === 'sparkles' &&
        pts.filter((_, i) => i % 3 === 1).map(([x, y], i) => <circle key={i} cx={x} cy={y + (i % 2 === 0 ? 5 : -5)} r={2.2} fill={color(i % 2 === 0 ? 0xffd23f : 0xffffff)} />)}
      {style.dots === 'bubbles' &&
        pts.filter((_, i) => i % 3 === 2).map(([x, y], i) => <circle key={i} cx={x} cy={y + 4} r={2 + i} fill="none" stroke={color(0xbfe8ff)} strokeWidth={1.5} />)}
      <circle cx={pts[12]![0]} cy={pts[12]![1]} r={3.5} fill={color(0x2b2f36)} />
    </g>
  );
}

/** The turret of the preview stands at this angle, like the child's fixed cannon angle in battle (FR-065). */
const PREVIEW_TURRET_DEG = 65;

function Shapes({ shapes, part }: { shapes: Shape[]; part: string }): ReactElement {
  return (
    <g data-part={part}>
      {shapes.map((s, i) => (
        <ShapeSvg key={i} shape={s} />
      ))}
    </g>
  );
}

/** The preview tank with the chosen look (FR-091). `data-look` carries lookKey for the tests. */
export function TankPreview({ look, label }: { look: Look; label: string }): ReactElement {
  // The same shapes as the battle (amendment 14, FR-110).
  const parts = playerTankShapes(look);
  return (
    <svg className="tank-preview" data-testid="garage-preview" data-look={lookKey(look)} viewBox="-70 -14 180 100" role="img" aria-label={label}>
      <g transform="translate(0 72) scale(1 -1)">
        <g data-part="trail">
          <TrailSvg trail={look.trail} x0={30} y0={50} />
        </g>
        <g transform={`translate(0 ${parts.anchors.turretPivot}) rotate(${PREVIEW_TURRET_DEG})`}>
          <Shapes shapes={parts.turret} part="turret" />
        </g>
        <Shapes shapes={parts.body} part="body" />
        <Shapes shapes={parts.antenna} part="antenna" />
        <Shapes shapes={parts.flag} part="flag" />
        <Shapes shapes={parts.hat} part="hat" />
      </g>
    </svg>
  );
}

/** A small drawing of one item; `grey` draws the silhouette of a locked item. */
export function ItemIcon({ item, grey }: { item: GarageItem; grey: boolean }): ReactElement {
  let content: ReactElement;
  let viewBox: string;
  switch (item.kind) {
    case 'color': {
      const id = item.id as Look['color'];
      viewBox = '-12 -12 24 24';
      content = (
        <g>
          <circle r={10} fill={cssColor(grey ? SILHOUETTE : tankColor(id))} stroke={cssColor(OUTLINE)} strokeWidth={1} />
          {colorStripes(id) && !grey && <path d="M-6,-6 L6,6 M-9,0 L0,9 M0,-9 L9,0" stroke={cssColor(STRIPE_COLOR)} strokeWidth={1.6} />}
        </g>
      );
      break;
    }
    case 'flag':
      viewBox = '-21 46 26 21';
      content = (
        <g transform="translate(0 113) scale(1 -1)">
          {flagShapes(item.id as Look['flag']).map((s, i) => (
            <ShapeSvg key={i} shape={s} grey={grey} />
          ))}
        </g>
      );
      break;
    case 'trail':
      viewBox = '25 -8 80 56';
      content = (
        <g transform="translate(0 50) scale(1 -1)">
          <TrailSvg trail={item.id as TrailId} x0={30} y0={10} grey={grey} />
        </g>
      );
      break;
    case 'hat': {
      const shapes = hatShapes(item.id as Look['hat']);
      viewBox = '-17 -3 34 24';
      content =
        shapes.length === 0 ? (
          <circle cx={0} cy={9} r={8} fill="none" stroke={cssColor(grey ? SILHOUETTE : OUTLINE)} strokeWidth={1.5} strokeDasharray="3 2" />
        ) : (
          <g transform="translate(0 44) scale(1 -1)">
            {shapes.map((s, i) => (
              <ShapeSvg key={i} shape={s} grey={grey} />
            ))}
          </g>
        );
      break;
    }
  }
  return (
    <svg className={grey ? 'garage-icon garage-silhouette' : 'garage-icon'} viewBox={viewBox} aria-hidden="true">
      {content}
    </svg>
  );
}
