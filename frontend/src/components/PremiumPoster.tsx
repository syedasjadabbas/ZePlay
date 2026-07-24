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
      className={`absolute inset-0 bg-gradient-to-br ${palette.from} ${palette.via} ${palette.to} flex flex-col justify-between overflow-hidden border border-white/5 shadow-2xl relative select-none ${className}`}
    >
      {/* Cinematic Lighting Background Effects */}
      <div className={`absolute top-[-20%] left-[-20%] w-[90%] h-[90%] rounded-full blur-[80px] pointer-events-none opacity-60 mix-blend-screen ${palette.circle}`} />
      <div className="absolute top-[30%] right-[-10%] w-[70%] h-[70%] rounded-full blur-[100px] pointer-events-none opacity-40 mix-blend-screen bg-blue-500/5" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/[0.03] via-transparent to-black/80 pointer-events-none" />

      {/* Film Grain Texture Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />

      {/* Top Header Badge */}
      <div className="flex items-center justify-between p-4 z-10 w-full">
        <div className="flex items-center gap-1.5">
          <span className={`text-[8px] font-black tracking-[0.25em] px-2 py-0.5 rounded border uppercase backdrop-blur-md ${palette.accent}`}>
            ZEPLAY
          </span>
          <span className="text-[7px] font-bold text-white/30 tracking-widest uppercase">ORIGINAL</span>
        </div>
        <div className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md">
          <svg className="w-2.5 h-2.5 text-white/65 fill-current" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
          </svg>
        </div>
      </div>

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
