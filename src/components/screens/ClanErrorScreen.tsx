import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

export function ClanErrorScreen({
  title,
  message,
  error,
  retryLabel,
  onRetry,
  homeLabel
}: {
  title: string;
  message: string;
  error?: string;
  retryLabel?: string;
  onRetry?: () => void;
  homeLabel?: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-grid-pattern px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-red-500/10 rounded-full blur-[100px]" />
      </div>
      <div className="text-center max-w-md mx-auto">
        <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-red-400" />
        </div>
        <h2 className="text-xl sm:text-2xl font-semibold text-white mb-3">{title}</h2>
        <p className="text-slate-400 mb-6 text-sm sm:text-base">{message}</p>
        {error && (
          <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800/50 rounded-xl p-4 mb-6 font-mono text-xs text-red-300 text-left overflow-auto max-h-32">
            {error}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-6 py-3 bg-slate-800/60 hover:bg-slate-700/60 backdrop-blur-sm border border-slate-700/50 text-white font-medium rounded-xl transition-all cursor-pointer"
            >
              {retryLabel || 'Retry'}
            </button>
          )}
          {homeLabel && (
            <Link
              href="/"
              className="px-6 py-3 text-slate-400 hover:text-white transition-colors text-sm sm:text-base"
            >
              {homeLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
