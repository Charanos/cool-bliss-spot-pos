import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { colour } from '@bliss/ui/tokens';
import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';

/**
 * The Cool Bliss mark as a PNG, for the places that cannot take the SVG: the Android home screen
 * wants 192 and 512, and iOS ignores manifest icons entirely and reads apple-touch-icon, which has
 * never supported SVG. The glass (public/brand/mark-on-dark-1024.png, rendered from mark-on-dark.svg)
 * on the station's dark ground, so the icon on a tablet matches what opens.
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
  const mark = await readFile(join(process.cwd(), 'public/brand/mark-on-dark-1024.png'));
  const src = `data:image/png;base64,${mark.toString('base64')}`;
  // Maskable keeps the glass inside the middle 60%, which survives any crop.
  const glass = Math.round(size * (maskable ? 0.58 : 0.78));

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: colour.frost[950],
          borderRadius: maskable ? 0 : Math.round(size * 0.22),
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered to a PNG by next/og, not the page */}
        <img src={src} width={glass} height={glass} alt="" />
      </div>
    ),
    { width: size, height: size },
  );
}
