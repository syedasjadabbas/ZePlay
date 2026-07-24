import React from 'react';

interface PremiumPosterProps {
  title: string;
  className?: string;
  aspectRatio?: 'portrait' | 'landscape';
}

const PremiumPoster: React.FC<PremiumPosterProps> = ({
  title,
  className = '',
  aspectRatio = 'portrait',
}) => {
  // Deterministic seed based on title length and characters for distinct high-end color combos
  const charSum = title.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const colorIndex = charSum % 5;

  const colorPalettes = [
    // 0: Deep Crimson & Crimson Glow
    {
      from: 'from-[#1a080f]',
      via: 'via-[#0a0508]',
      to: 'to-[#050204]',
      glow: 'shadow-red-950/40',
      textGlow: 'text-red-500/80',
      accent: 'border-red-500/20 text-red-400 bg-red-500/10',
      circle: 'bg-red-900/15',
    },
    // 1: Emerald & Cyberpunk Teal
    {
      from: 'from-[#071b19]',
      via: 'via-[#030d0d]',
      to: 'to-[#010606]',
      glow: 'shadow-emerald-950/40',
      textGlow: 'text-emerald-500/80',
      accent: 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10',
      circle: 'bg-emerald-900/15',
    },
    // 2: Royal Gold & Warm Bronze
    {
      from: 'from-[#1d1408]',
      via: 'via-[#0e0a04]',
      to: 'to-[#070502]',
      glow: 'shadow-amber-950/40',
      textGlow: 'text-amber-500/80',
      accent: 'border-amber-500/20 text-amber-400 bg-amber-500/10',
      circle: 'bg-amber-900/15',
    },
    // 3: Deep Space Blue & Stellar Indigo
    {
      from: 'from-[#081329]',
      via: 'via-[#040915]',
      to: 'to-[#02040a]',
      glow: 'shadow-blue-950/40',
      textGlow: 'text-blue-500/80',
      accent: 'border-blue-500/20 text-blue-400 bg-blue-500/10',
      circle: 'bg-blue-900/15',
    },
    // 4: Neon Purple & Velvet Violet
    {
      from: 'from-[#140b24]',
      via: 'via-[#0a0512]',
      to: 'to-[#050209]',
      glow: 'shadow-purple-950/40',
      textGlow: 'text-purple-500/80',
      accent: 'border-purple-500/20 text-purple-400 bg-purple-500/10',
      circle: 'bg-purple-950/20',
    },
  ];

  const palette = colorPalettes[colorIndex];
  const isLandscape = aspectRatio === 'landscape';

  return (
    <div
      className={`absolute inset-0 bg-gradient-to-br ${palette.from} ${palette.via} ${palette.to} flex flex-col justify-end overflow-hidden shadow-2xl relative select-none ${className}`}
    >
      {/* Film Grain Texture Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />

      {/* Movie Icon / Watermark Overlay */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none select-none">
        <svg className="w-48 h-48 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
        </svg>
      </div>

      {/* Footer Text Details */}
      <div className={`p-4 z-10 w-full text-left space-y-1.5 ${isLandscape ? 'pb-3.5' : 'pb-5'}`}>
        <h5 
          className={`font-black text-white uppercase tracking-wider font-display line-clamp-2 leading-none text-shadow-cinematic ${
            isLandscape ? 'text-xs md:text-sm' : 'text-sm md:text-base'
          }`}
        >
          {title}
        </h5>
        
        <div className="flex items-center gap-1.5 text-[8px] font-bold text-neutral-500 uppercase tracking-widest">
          <span>Dolby Atmos</span>
          <span className="text-neutral-700">•</span>
          <span>Ultra HD</span>
        </div>
      </div>
    </div>
  );
};

export default PremiumPoster;
