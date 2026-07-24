import React from 'react';

interface LogoProps {
  className?: string;
  height?: number | string;
}

const Logo: React.FC<LogoProps> = ({ className = '', height = '100%' }) => {
  return (
    <svg
      viewBox="0 0 250 80"
      height={height}
      className={`select-none ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Stroke gradient for Z outline */}
        <linearGradient id="z-stroke-grad" x1="12" y1="22" x2="74" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00F0FF" />
          <stop offset="100%" stopColor="#1E40AF" />
        </linearGradient>

        {/* Play button gradient */}
        <linearGradient id="play-btn-grad" x1="30.5" y1="25" x2="55.5" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>

        {/* ZE text gradient: light cyan/white metallic look */}
        <linearGradient id="ze-text-grad" x1="80" y1="20" x2="130" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="60%" stopColor="#E2F8FF" />
          <stop offset="100%" stopColor="#93C5FD" stopOpacity="0.8" />
        </linearGradient>

        {/* PLAY text gradient: solid blue electric gradient */}
        <linearGradient id="play-text-grad" x1="130" y1="20" x2="210" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>
        
        {/* Shadow filter for 3D play button effect */}
        <filter id="play-shadow" x="25" y="20" width="40" height="40" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.4" />
        </filter>
      </defs>

      {/* Outlined Z bracket (Top) */}
      <path
        d="M 22 44 L 30 35 L 42 22 H 74 L 62 42"
        stroke="url(#z-stroke-grad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Outlined Z bracket (Bottom) */}
      <path
        d="M 64 36 L 56 45 L 44 58 H 12 L 24 38"
        stroke="url(#z-stroke-grad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* 3D Play Button (Triangle) */}
      <path
        d="M 30.5 26.5 C 30.5 25 32 24 33.5 25 L 55.5 37.5 C 57 38.5 57 40.5 55.5 41.5 L 33.5 54 C 32 55 30.5 54 30.5 52.5 Z"
        fill="url(#play-btn-grad)"
        filter="url(#play-shadow)"
      />

      {/* Main ZEPLAY Text */}
      <text
        x="80"
        y="49"
        fontFamily="Outfit, system-ui, sans-serif"
        fontWeight="900"
        fontStyle="italic"
        fontSize="32"
        letterSpacing="0.5"
      >
        <tspan fill="url(#ze-text-grad)">ZE</tspan>
        <tspan fill="url(#play-text-grad)">PLAY</tspan>
      </text>

      {/* Tagline */}
      <text
        x="84"
        y="62"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="800"
        fontSize="7.5"
        letterSpacing="4"
        fill="#55779D"
      >
        STREAM. WATCH. ENJOY.
      </text>
    </svg>
  );
};

export default Logo;
