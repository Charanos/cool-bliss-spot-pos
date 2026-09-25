import { memo, useState } from 'react';

/**
 * AmbientConsoleArtwork — "VIP & Lounge" (photographic)
 *
 * The previous two passes were hand-built SVG paths — Bézier bottle
 * profiles, procedural ice, hex facets. Those get the *composition* right
 * but hit a hard ceiling on *finish*: no path fill reproduces real label
 * typography, true photographic specular bloom on foil, or the soft
 * contact shadow a lens actually captures. That gap isn't a construction
 * bug to fix with more control points — it's a different medium. This
 * version uses real product cutouts instead, with the same anchors, the
 * same "recede near the keypad" behavior, and the same drop-in export the
 * SVG versions used.
 *
 * Assets expected at (adjust BOTTLE_SRC / SHISHA_SRC to your actual path):
 *   /console-artwork/champagne-bottle.png  — 142×487, transparent bg
 *   /console-artwork/shisha.png            — 539×706, transparent bg
 * Both are pre-cropped to content bounds (no dead margin), so the size
 * props below map directly to rendered pixels at scale 1.
 *
 * Anchors, kept identical to the SVG pass for continuity:
 *   Champagne — top-right corner, tilted into the corner, bleeding off the
 *   top and right edges.
 *   Shisha — bottom-left of the right panel, bleeding off the bottom edge.
 *
 * Falloff: both objects fade as they approach the keypad's footprint
 * (roughly centered at 46%/60% of the panel in the reference layout) via a
 * radial-gradient mask on each wrapper, so the art recedes near the
 * interactive zone instead of overlapping digits at full strength — the
 * problem visible in the original screenshot.
 */

const BOTTLE_SRC = '/champagne-bottle.png';
const SHISHA_SRC = '/shisha.png';

/** Native pixel dimensions of the source assets, used to lock aspect ratio
 *  when scaling — never stretch a photographic cutout to a target box. */
const BOTTLE_NATIVE = { w: 142, h: 487 };
const SHISHA_NATIVE = { w: 539, h: 706 };

function PhotoArt({
  src,
  alt,
  onError,
}: {
  src: string;
  alt: string;
  onError: () => void;
}) {
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      onError={onError}
      style={{
        display: 'block',
        width: '100%',
        height: 'auto',
        objectFit: 'contain',
        userSelect: 'none',
      }}
    />
  );
}

export const AmbientConsoleArtwork = memo(function AmbientConsoleArtwork() {
  // If either asset 404s (wrong deploy path, not yet uploaded), fall back
  // to nothing rather than showing a broken-image icon over the sign-in
  // panel — an empty corner reads better than a visibly broken asset.
  const [bottleFailed, setBottleFailed] = useState(false);
  const [shishaFailed, setShishaFailed] = useState(false);

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* Keypad-proximity falloff: a radial mask centered near where the PIN
          pad sits, shared by both wrappers below via CSS mask. Objects
          fade to ~15% opacity as they approach that center, full strength
          at the corners. */}
      <div
        className="absolute inset-0"
        style={{
          maskImage:
            'radial-gradient(circle at 46% 60%, transparent 0%, rgba(0,0,0,0.35) 55%, black 100%)',
          WebkitMaskImage:
            'radial-gradient(circle at 46% 60%, transparent 0%, rgba(0,0,0,0.35) 55%, black 100%)',
        }}
      >
        {/* ── Top-right: champagne bottle ── */}
        {!bottleFailed && (
          <div
            className="absolute"
            style={{
              top: '-8%',
              right: '-19%',
              width: 'clamp(120px, 12vw, 180px)',
              aspectRatio: `${BOTTLE_NATIVE.w} / ${BOTTLE_NATIVE.h}`,
              transform: 'rotate(12deg)',
              transformOrigin: 'top right',
              filter: 'drop-shadow(-8px 12px 24px rgba(0,0,0,0.12))',
              opacity: 0.85,
            }}
          >
            <PhotoArt src={BOTTLE_SRC} alt="" onError={() => setBottleFailed(true)} />
          </div>
        )}

        {/* ── Bottom-left of the right panel: shisha ── */}
        {!shishaFailed && (
          <div
            className="absolute"
            style={{
              bottom: '-5%',
              left: '-4%',
              width: 'clamp(180px, 18vw, 260px)',
              aspectRatio: `${SHISHA_NATIVE.w} / ${SHISHA_NATIVE.h}`,
              transform: 'rotate(-6deg)',
              transformOrigin: 'bottom left',
              filter: 'drop-shadow(10px 14px 24px rgba(0,0,0,0.12))',
              opacity: 0.8,
            }}
          >
            <PhotoArt src={SHISHA_SRC} alt="" onError={() => setShishaFailed(true)} />
          </div>
        )}
      </div>
    </div>
  );
});