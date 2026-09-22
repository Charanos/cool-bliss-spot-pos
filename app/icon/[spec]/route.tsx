import { colour } from '@bliss/ui/tokens';
import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';

/**
 * The Bliss mark as a PNG, for the places that cannot take the SVG: the Android home screen wants
 * 192 and 512, and iOS ignores manifest icons entirely and reads apple-touch-icon, which has never
 * supported SVG. Drawn from the same two rounded squares as icon.svg, in tokens, with no text, so
 * it needs no font to render.
 *
 *   /icon/192            the home screen icon
 *   /icon/512            the splash and the install prompt
 *   /icon/maskable       512 with the mark inside the safe circle Android crops to
 */
export function generateStaticParams() {
  return [{ spec: '192' }, { spec: '512' }, { spec: 'maskable' }];
}

export async function GET(_request: Request, { params }: { params: Promise<{ spec: string }> }) {
  const { spec } = await params;
  const maskable = spec === 'maskable';
  const size = maskable ? 512 : Math.min(1024, Math.max(48, Number(spec) || 512));

  // The mark sits in 64 units. Maskable keeps it inside the middle 60%, which survives any crop.
  const unit = size / 64;
  const scale = maskable ? 0.62 : 0.86;
  const inset = (size - size * scale) / 2;
  const square = 24 * unit * scale;
  const radius = 7 * unit * scale;

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          position: 'relative',
          background: colour.frost[950],
          borderRadius: maskable ? 0 : 14 * unit,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: inset + 14 * unit * scale,
            top: inset + 24 * unit * scale,
            width: square,
            height: square,
            borderRadius: radius,
            background: colour.glacier[600],
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: inset + 26 * unit * scale,
            top: inset + 14 * unit * scale,
            width: square,
            height: square,
            borderRadius: radius,
            background: colour.glacier[300],
          }}
        />
      </div>
    ),
    { width: size, height: size },
  );
}
