import { Users, Zap, Gamepad2, Sparkles, Globe, Shield } from 'lucide-react';

export function LandingHero() {
  return (
    <div className="relative text-center max-w-5xl mx-auto px-4 py-8">
      {/* Background effects */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse-glow" />
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] animate-pulse-glow animation-delay-200" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-pink-500/5 rounded-full blur-[80px] animate-pulse-glow animation-delay-400" />
      </div>

      {/* Badge */}
      <div className="inline-flex items-center gap-2 mb-8 px-4 py-2 bg-indigo-500/10 border border-indigo-500/30 rounded-full animate-fade-in-up">
        <Sparkles className="w-4 h-4 text-indigo-400" />
        <span className="text-indigo-300 font-medium text-sm">Multi-Game Group Platform</span>
      </div>
      
      {/* Main heading */}
      <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight animate-fade-in-up animation-delay-100">
        <span className="text-gradient">
          Organize Your Group
        </span>
        <br />
        <span className="text-slate-200">Across Any Game</span>
      </h1>
      
      {/* Subtitle */}
      <p className="text-lg sm:text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed animate-fade-in-up animation-delay-200">
        The ultimate platform for managing your gaming community — track members, coordinate events, and build something great together.
      </p>

      {/* Feature grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12 max-w-3xl mx-auto animate-fade-in-up animation-delay-300">
        <FeaturePill icon={<Users className="w-4 h-4" />} label="Group Management" />
        <FeaturePill icon={<Zap className="w-4 h-4" />} label="Real-time Sync" />
        <FeaturePill icon={<Globe className="w-4 h-4" />} label="Multi-Game" />
        <FeaturePill icon={<Shield className="w-4 h-4" />} label="Role System" />
      </div>

      {/* Game types showcase */}
      <div className="flex items-center justify-center gap-6 sm:gap-12 flex-wrap animate-fade-in-up animation-delay-400">
        <GameType emoji="⚔️" label="MMO RPGs" />
        <div className="w-px h-8 bg-slate-700/50" />
        <GameType emoji="🚀" label="Space Sims" />
        <div className="w-px h-8 bg-slate-700/50 hidden sm:block" />
        <GameType emoji="🏰" label="Strategy" />
        <div className="w-px h-8 bg-slate-700/50 hidden sm:block" />
        <div className="flex flex-col items-center gap-2">
          <Gamepad2 className="w-8 h-8 text-slate-500" />
          <span className="text-xs text-slate-500 font-medium">+ More</span>
        </div>
      </div>
    </div>
  );
}

function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-700/50 hover:border-indigo-500/30 hover:bg-slate-800/60 transition-all duration-300 group">
      <span className="text-indigo-400 group-hover:text-indigo-300 transition-colors">{icon}</span>
      <span className="text-xs sm:text-sm text-slate-300 font-medium">{label}</span>
    </div>
  );
}

function GameType({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 group cursor-default">
      <span className="text-4xl sm:text-5xl group-hover:scale-110 transition-transform duration-300">{emoji}</span>
      <span className="text-xs sm:text-sm text-slate-400 font-medium">{label}</span>
    </div>
  );
}

