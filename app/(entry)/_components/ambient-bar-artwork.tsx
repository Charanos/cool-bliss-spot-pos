import React from 'react';

/**
 * Premium "Glass & Light" Bar Artwork (High-Fidelity).
 * Masterfully drafted glassmorphism vectors with complex liquid ellipses,
 * edge highlights, and deep gradients for a production-grade SaaS aesthetic.
 */
export function AmbientBarArtwork() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[-1] overflow-hidden bg-page">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1600 960"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Glass edge highlight */}
          <linearGradient id="highlight" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.15" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.0" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
          </linearGradient>

          {/* Heavy glass body shadow */}
          <linearGradient id="glass-dark" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-ink)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="var(--color-ink)" stopOpacity="0.02" />
          </linearGradient>

          {/* Liquid Teal (Coupe) */}
          <linearGradient id="liquid-teal-surface" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="liquid-teal-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.02" />
          </linearGradient>

          {/* Liquid Amber (Rocks) */}
          <linearGradient id="liquid-amber-surface" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-attention)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--color-attention)" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="liquid-amber-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-attention)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--color-attention)" stopOpacity="0.02" />
          </linearGradient>

          {/* Protective Vignette */}
          <radialGradient id="center-clear" cx="50%" cy="50%" r="65%" fx="50%" fy="50%">
            <stop offset="0%" stopColor="var(--color-page)" stopOpacity="1" />
            <stop offset="45%" stopColor="var(--color-page)" stopOpacity="1" />
            <stop offset="90%" stopColor="var(--color-page)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ===================== LEFT FLANK: HIGH FIDELITY COUPE ===================== */}
        {/* Placed at the bottom left to avoid top logo collision, gracefully tilted outward */}
        <g transform="translate(-100, 480) scale(1.6) rotate(-12, 150, 150)">
          {/* Stem & Base */}
          <path d="M 146 160 L 146 320" stroke="url(#highlight)" strokeWidth="8" strokeLinecap="round" />
          <path d="M 154 160 L 154 320" stroke="var(--color-ink)" strokeOpacity="0.1" strokeWidth="4" />
          <ellipse cx="150" cy="320" rx="80" ry="12" fill="url(#glass-dark)" />
          <ellipse cx="150" cy="320" rx="80" ry="12" stroke="url(#highlight)" strokeWidth="2" />

          {/* Back Rim of the Coupe Bowl */}
          <ellipse cx="150" cy="60" rx="140" ry="25" stroke="var(--color-ink)" strokeOpacity="0.15" strokeWidth="4" />
          
          {/* Liquid Body */}
          <path d="M 30 90 C 30 160, 120 180, 150 180 C 180 180, 270 160, 270 90 Z" fill="url(#liquid-teal-body)" style={{ mixBlendMode: 'overlay' }} />
          {/* Liquid Surface */}
          <ellipse cx="150" cy="90" rx="120" ry="20" fill="url(#liquid-teal-surface)" style={{ mixBlendMode: 'overlay' }} />

          {/* Front Body of the Coupe */}
          <path d="M 10 60 C 10 160, 100 200, 150 200 C 200 200, 290 160, 290 60" fill="url(#glass-dark)" />
          {/* Front Rim Highlight */}
          <path d="M 10 60 C 10 160, 100 200, 150 200 C 200 200, 290 160, 290 60" stroke="url(#highlight)" strokeWidth="6" strokeLinecap="round" />
          
          {/* Side Highlight Curve for volume */}
          <path d="M 25 75 C 25 140, 80 180, 140 190" stroke="url(#highlight)" strokeWidth="3" strokeLinecap="round" />

          {/* Playful Citrus Twist (Amber) overlapping */}
          <path d="M 250 10 C 320 20, 240 100, 280 140 C 320 180, 260 160, 220 120" fill="none" stroke="var(--color-attention)" strokeOpacity="0.3" strokeWidth="16" strokeLinecap="round" style={{ mixBlendMode: 'overlay' }} />
        </g>

        {/* ===================== RIGHT FLANK: HIGH FIDELITY ROCKS & SHAKER ===================== */}
        {/* Placed gracefully at middle-right. Tilted elegantly outward. */}
        <g transform="translate(1300, 120) scale(1.6) rotate(10, 100, 150)">
          
          {/* High Fidelity Rocks Glass */}
          <g transform="translate(0, 0)">
            {/* Back Rim */}
            <ellipse cx="100" cy="20" rx="80" ry="15" stroke="var(--color-ink)" strokeOpacity="0.15" strokeWidth="4" />
            
            {/* Liquid Body */}
            <path d="M 32 100 L 40 220 C 45 230, 155 230, 160 220 L 168 100 Z" fill="url(#liquid-amber-body)" style={{ mixBlendMode: 'overlay' }} />
            {/* Liquid Surface */}
            <ellipse cx="100" cy="100" rx="68" ry="12" fill="url(#liquid-amber-surface)" style={{ mixBlendMode: 'overlay' }} />
            
            {/* High Fidelity Ice Block */}
            <g style={{ mixBlendMode: 'overlay' }} transform="translate(60, 60)">
              {/* Top Face */}
              <polygon points="40,0 80,15 40,30 0,15" fill="#ffffff" fillOpacity="0.15" />
              {/* Left Face */}
              <polygon points="0,15 40,30 40,80 0,65" fill="#ffffff" fillOpacity="0.05" />
              {/* Right Face */}
              <polygon points="40,30 80,15 80,65 40,80" fill="#ffffff" fillOpacity="0.1" />
              {/* Highlight Edges */}
              <path d="M 0 15 L 40 30 L 40 80 M 40 30 L 80 15" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="2" strokeLinejoin="round" />
            </g>
            
            {/* Glass Front Body & Sham */}
            {/* Left Wall */}
            <path d="M 20 20 L 35 260" stroke="url(#highlight)" strokeWidth="6" strokeLinecap="round" />
            {/* Right Wall */}
            <path d="M 180 20 L 165 260" stroke="url(#highlight)" strokeWidth="6" strokeLinecap="round" />
            
            {/* Bottom Sham Curve */}
            <path d="M 35 260 C 70 275, 130 275, 165 260" stroke="url(#highlight)" strokeWidth="8" strokeLinecap="round" />
            <path d="M 35 260 C 70 275, 130 275, 165 260" fill="url(#glass-dark)" />
            
            {/* Inner Sham line */}
            <path d="M 40 220 C 75 235, 125 235, 160 220" stroke="var(--color-ink)" strokeOpacity="0.2" strokeWidth="4" />
          </g>

          {/* Tumbling High Fidelity Shaker */}
          <g transform="translate(-30, 320) rotate(-35, 60, 100)">
            {/* Large Tin */}
            <path d="M 0 0 L 20 240 C 40 255, 80 255, 100 240 L 120 0 Z" fill="url(#glass-dark)" />
            <path d="M 0 0 C 40 20, 80 20, 120 0" stroke="url(#highlight)" strokeWidth="4" />
            <path d="M 20 240 C 40 255, 80 255, 100 240" stroke="url(#highlight)" strokeWidth="6" strokeLinecap="round" />
            
            {/* Side Highlights */}
            <path d="M 15 30 L 25 220" stroke="url(#highlight)" strokeWidth="4" strokeLinecap="round" />
            
            {/* Small Tin Nested */}
            <g transform="rotate(12, 60, 0)">
              <path d="M 15 -100 L 0 0 C 40 15, 80 15, 120 0 L 105 -100 Z" fill="var(--color-ink)" fillOpacity="0.15" />
              <path d="M 15 -100 C 40 -85, 80 -85, 105 -100" stroke="url(#highlight)" strokeWidth="3" />
            </g>
          </g>
        </g>

        {/* Central Protective Vignette */}
        <rect width="100%" height="100%" fill="url(#center-clear)" />
      </svg>
    </div>
  );
}
