import { memo } from 'react';

/**
 * The Console sign-in artwork, a bottle and a pipe in a lounge, drawn in SVG (D-19).
 *
 * This version uses pure SVG to construct the champagne bottle and shisha,
 * ensuring high-fidelity rendering at any resolution with complex gradients
 * to simulate reflections, glass, and liquid accurately, replacing the static 
 * image assets while preserving the exact layout constraints.
 */

function ChampagneSVG({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 160 500" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bottle-glass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0a0f0a" />
          <stop offset="15%" stopColor="#122515" />
          <stop offset="30%" stopColor="#224225" />
          <stop offset="50%" stopColor="#081009" />
          <stop offset="85%" stopColor="#0a180c" />
          <stop offset="95%" stopColor="#1e3820" />
          <stop offset="100%" stopColor="#050a05" />
        </linearGradient>
        
        <linearGradient id="foil" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5E4E1C" />
          <stop offset="15%" stopColor="#B89947" />
          <stop offset="25%" stopColor="#FCE488" />
          <stop offset="45%" stopColor="#A3822B" />
          <stop offset="75%" stopColor="#735B16" />
          <stop offset="90%" stopColor="#D4B65B" />
          <stop offset="100%" stopColor="#3B2E09" />
        </linearGradient>
        
        <linearGradient id="foil-bottom" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.6)" />
        </linearGradient>
        
        <linearGradient id="glass-highlight" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.7)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>

        <linearGradient id="label-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#C9A64A" />
          <stop offset="50%" stopColor="#F9E596" />
          <stop offset="100%" stopColor="#9C7E2E" />
        </linearGradient>
      </defs>
      
      {/* 
        Champagne Silhouette:
        Neck: x=66 to 94. 
        Shoulder: gentle bezier from y=140 to y=280, x expanding to 25 and 135
        Body: straight down to y=470
        Base: curved bottom
      */}
      <path d="
        M 66 10 
        C 66 80, 68 130, 68 140 
        C 68 200, 25 220, 25 280 
        L 25 470
        C 25 490, 45 495, 80 495
        C 115 495, 135 490, 135 470
        L 135 280
        C 135 220, 92 200, 92 140
        C 92 130, 94 80, 94 10
        Z
      " fill="url(#bottle-glass)" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
      
      {/* Strong left highlight for thick glossy glass */}
      <path d="
        M 71 140 
        C 71 200, 32 220, 32 280 
        L 32 465
        C 32 475, 34 480, 38 480
        C 34 480, 38 475, 38 465
        L 38 280
        C 38 220, 77 200, 77 140
        Z
      " fill="url(#glass-highlight)" opacity="0.75" />
      
      {/* Subtle right highlight */}
      <path d="
        M 90 140
        C 90 200, 128 220, 128 280
        L 128 465
        L 125 465
        L 125 280
        C 125 220, 87 200, 87 140
        Z
      " fill="rgba(255,255,255,0.15)" />

      {/* Punt (bottom indentation shadow) */}
      <path d="M 40 493 C 60 483, 100 483, 120 493 C 100 497, 60 497, 40 493 Z" fill="rgba(0,0,0,0.8)" />

      {/* Foil Top Cork Bulge (Muzzle) */}
      <path d="M 63 10 C 63 -2, 97 -2, 97 10 L 94 25 Q 80 30, 66 25 Z" fill="url(#foil)" />
      {/* Cork Bulge Shadow */}
      <path d="M 66 25 Q 80 30, 94 25 L 94 20 Q 80 25, 66 20 Z" fill="rgba(0,0,0,0.4)" />

      {/* Main Foil Cover (Capsule) */}
      <path d="
        M 66 20
        C 66 80, 68 130, 68 140
        C 68 160, 60 175, 52 190
        Q 80 220, 108 190
        C 100 175, 92 160, 92 140
        C 92 130, 94 80, 94 20
        Z
      " fill="url(#foil)" />
      
      {/* Foil shadow at the cut */}
      <path d="
        M 52 190
        Q 80 220, 108 190
        L 105 185
        Q 80 213, 55 185 Z
      " fill="url(#foil-bottom)" />
      
      {/* Foil Neck Details (Creases and Wire outline) */}
      <path d="M 66 40 Q 80 43, 94 40" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="2" />
      <path d="M 66 45 Q 80 48, 94 45" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1" />
      
      {/* Foil sweeping creases */}
      <path d="M 72 45 C 70 80, 78 120, 65 170" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
      <path d="M 85 45 C 87 80, 80 120, 90 165" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />

      {/* Neck Label (Collar) */}
      <path d="
        M 36 235
        Q 80 255, 124 235
        L 128 265
        Q 80 295, 32 265
        Z
      " fill="#111" stroke="url(#label-gold)" strokeWidth="2" />
      <path d="M 45 250 Q 80 272, 115 250" fill="none" stroke="url(#label-gold)" strokeWidth="1" opacity="0.8" />
      <path d="M 50 255 Q 80 275, 110 255" fill="none" stroke="url(#label-gold)" strokeWidth="1" opacity="0.5" />

      {/* Main Label: Prestige Cuvée Shield */}
      <g transform="translate(80, 360)">
        {/* Shield shape */}
        <path d="M -30 -40 L 30 -40 L 35 0 C 35 30, 10 45, 0 55 C -10 45, -35 30, -35 0 Z" fill="#111" stroke="url(#label-gold)" strokeWidth="3" />
        {/* Inner gold line */}
        <path d="M -26 -35 L 26 -35 L 31 0 C 31 26, 8 38, 0 46 C -8 38, -31 26, -31 0 Z" fill="none" stroke="url(#label-gold)" strokeWidth="1" opacity="0.6" />
        
        {/* Faux elegant typography / crest */}
        <circle cx="0" cy="-15" r="8" fill="url(#label-gold)" />
        <path d="M -15 5 L 15 5 L 10 7 L -10 7 Z" fill="url(#label-gold)" />
        <path d="M -20 15 L 20 15 L 15 17 L -15 17 Z" fill="url(#label-gold)" opacity="0.7" />
        <path d="M -10 25 L 10 25 L 8 26 L -8 26 Z" fill="url(#label-gold)" opacity="0.5" />
      </g>
    </svg>
  );
}

function ShishaSVG({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 -180 300 680" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="smoke" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#E8F0FF" stopOpacity="0" />
          <stop offset="20%" stopColor="#E8F0FF" stopOpacity="0.6" />
          <stop offset="60%" stopColor="#E8F0FF" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#E8F0FF" stopOpacity="0" />
        </linearGradient>

        <linearGradient id="vase-glass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(20, 25, 40, 0.8)" />
          <stop offset="10%" stopColor="rgba(180, 220, 255, 0.5)" />
          <stop offset="25%" stopColor="rgba(60, 80, 120, 0.4)" />
          <stop offset="50%" stopColor="rgba(100, 130, 180, 0.15)" />
          <stop offset="75%" stopColor="rgba(60, 80, 120, 0.4)" />
          <stop offset="90%" stopColor="rgba(180, 220, 255, 0.4)" />
          <stop offset="100%" stopColor="rgba(10, 15, 30, 0.9)" />
        </linearGradient>
        
        <linearGradient id="vase-water" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(20, 60, 100, 0.9)" />
          <stop offset="20%" stopColor="rgba(60, 140, 220, 0.8)" />
          <stop offset="50%" stopColor="rgba(100, 180, 255, 0.5)" />
          <stop offset="80%" stopColor="rgba(40, 100, 180, 0.8)" />
          <stop offset="100%" stopColor="rgba(15, 40, 80, 0.95)" />
        </linearGradient>

        <linearGradient id="chrome" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#444" />
          <stop offset="20%" stopColor="#CCC" />
          <stop offset="40%" stopColor="#FFF" />
          <stop offset="60%" stopColor="#777" />
          <stop offset="80%" stopColor="#BBB" />
          <stop offset="100%" stopColor="#222" />
        </linearGradient>
        
        <linearGradient id="gold-accent" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8A6B22" />
          <stop offset="30%" stopColor="#E6C261" />
          <stop offset="50%" stopColor="#FFF2A8" />
          <stop offset="70%" stopColor="#B38F24" />
          <stop offset="100%" stopColor="#3D2F0C" />
        </linearGradient>

        <linearGradient id="hose" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#222" />
          <stop offset="50%" stopColor="#444" />
          <stop offset="100%" stopColor="#111" />
        </linearGradient>
      </defs>

      {/* Smoke */}
      <path d="M140 25 C 120 -20, 180 -60, 130 -100 C 100 -130, 160 -160, 150 -180" fill="none" stroke="url(#smoke)" strokeWidth="16" style={{ filter: 'blur(6px)' }} opacity="0.8" />
      <path d="M160 25 C 180 -10, 130 -40, 170 -80 C 190 -110, 130 -150, 160 -170" fill="none" stroke="url(#smoke)" strokeWidth="12" style={{ filter: 'blur(4px)' }} opacity="0.9" />
      <path d="M150 25 C 150 -30, 150 -60, 150 -100" fill="none" stroke="url(#smoke)" strokeWidth="24" style={{ filter: 'blur(8px)' }} opacity="0.6" />

      {/* Downstem (inside vase) */}
      <rect x="142" y="320" width="16" height="120" fill="url(#chrome)" opacity="0.8" />
      <circle cx="150" cy="445" r="10" fill="url(#chrome)" opacity="0.9" />

      {/* Water Body */}
      <path d="M70 410 C100 420, 200 420, 230 410 C235 440, 220 485, 150 485 C80 485, 65 440, 70 410 Z" fill="url(#vase-water)" />
      
      {/* Water Meniscus */}
      <ellipse cx="150" cy="412" rx="80" ry="8" fill="rgba(60, 180, 255, 0.3)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
      
      {/* Bubbles */}
      <circle cx="130" cy="450" r="3" fill="rgba(255,255,255,0.6)" />
      <circle cx="160" cy="430" r="4" fill="rgba(255,255,255,0.5)" />
      <circle cx="145" cy="470" r="2" fill="rgba(255,255,255,0.7)" />
      <circle cx="110" cy="440" r="2.5" fill="rgba(255,255,255,0.5)" />
      <circle cx="180" cy="460" r="3" fill="rgba(255,255,255,0.6)" />

      {/* Vase */}
      <path d="M120 320 C120 320, 60 380, 60 460 C60 490, 90 495, 150 495 C210 495, 240 490, 240 460 C240 380, 180 320, 180 320 Z" fill="url(#vase-glass)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
      
      {/* Left strong glass reflection */}
      <path d="M70 450 C70 410, 115 350, 125 330 C128 325, 125 340, 115 360 C100 390, 85 430, 85 460 C85 470, 95 480, 110 485 C90 480, 70 470, 70 450 Z" fill="rgba(255,255,255,0.4)" />
      
      {/* Right subtle reflection */}
      <path d="M225 450 C225 410, 180 350, 170 330 C167 325, 170 340, 180 360 C195 390, 210 430, 210 460 C210 470, 200 480, 185 485 C205 480, 225 470, 225 450 Z" fill="rgba(255,255,255,0.15)" />

      {/* Center Hub & Hose Port */}
      <path d="M110 320 L190 320 L185 290 L115 290 Z" fill="url(#chrome)" />
      <rect x="105" y="295" width="90" height="10" rx="3" fill="url(#gold-accent)" />
      <path d="M115 305 L85 320 L80 305 L110 295 Z" fill="url(#chrome)" />

      {/* Hose */}
      <path d="M80 312 C40 330, 20 380, 20 440 C20 490, 60 490, 60 490" fill="none" stroke="url(#hose)" strokeWidth="18" strokeLinecap="round" />
      <path d="M80 312 C40 330, 20 380, 20 440 C20 490, 60 490, 60 490" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="18" strokeLinecap="round" strokeDasharray="3 6" opacity="0.4" />

      {/* Upper Stem */}
      <rect x="135" y="150" width="30" height="140" fill="url(#chrome)" />
      <path d="M120 250 L180 250 L175 220 L125 220 Z" fill="url(#gold-accent)" />
      <path d="M125 180 L175 180 L170 150 L130 150 Z" fill="url(#gold-accent)" />
      
      {/* Tray */}
      <path d="M70 150 L230 150 C235 155, 235 160, 230 165 L70 165 C65 160, 65 155, 70 150 Z" fill="url(#chrome)" />
      <ellipse cx="150" cy="150" rx="80" ry="10" fill="url(#chrome)" opacity="0.8" />

      {/* Bowl Core */}
      <path d="M130 145 L170 145 L175 100 L125 100 Z" fill="#4A2F1D" />
      <path d="M110 100 C110 60, 190 60, 190 100 Z" fill="#6A4228" />
      <ellipse cx="150" cy="65" rx="36" ry="6" fill="#8C5836" />
      
      {/* Heat Management / Coils (Top) */}
      <rect x="120" y="45" width="60" height="20" rx="2" fill="url(#chrome)" />
      <path d="M125 45 L140 30 L160 30 L175 45 Z" fill="url(#chrome)" opacity="0.9" />
      
      {/* Glowing Coals */}
      <circle cx="140" cy="38" r="4" fill="#FF5500" />
      <circle cx="155" cy="39" r="5" fill="#FF3300" />
      <circle cx="165" cy="37" r="3" fill="#FF7700" />
    </svg>
  );
}

export const AmbientConsoleArtwork = memo(function AmbientConsoleArtwork() {
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
        {/* ── Top-right: shisha ── */}
        <div
          className="absolute"
          style={{
            top: '-5%',
            right: '-12%',
            width: 'clamp(180px, 18vw, 260px)',
            transform: 'rotate(-8deg)',
            transformOrigin: 'center right',
            filter: 'drop-shadow(-8px 12px 24px rgba(0,0,0,0.25))',
            opacity: 0.8,
          }}
        >
          <ShishaSVG style={{ display: 'block', width: '100%', height: 'auto' }} />
        </div>

        {/* ── Bottom-left of the right panel: champagne bottle ── */}
        <div
          className="absolute"
          style={{
            bottom: '-2%',
            left: '-22%',
            width: 'clamp(140px, 15vw, 210px)',
            transform: 'rotate(15deg)',
            transformOrigin: 'bottom left',
            filter: 'drop-shadow(10px 14px 24px rgba(0,0,0,0.25))',
            opacity: 0.9,
          }}
        >
          <ChampagneSVG style={{ display: 'block', width: '100%', height: 'auto' }} />
        </div>
      </div>
    </div>
  );
});