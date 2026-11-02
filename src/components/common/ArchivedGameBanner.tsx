'use client';

import { AlertCircle, Archive } from 'lucide-react';

interface ArchivedGameBannerProps {
  gameName: string;
}

export function ArchivedGameBanner({ gameName }: ArchivedGameBannerProps) {
  return (
    <div className="bg-amber-900/30 border-t border-b border-amber-700/50 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <div className="flex-shrink-0">
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-amber-500/20">
            <Archive className="h-5 w-5 text-amber-400" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-100">
            {gameName} is archived
          </p>
          <p className="text-xs text-amber-200/80 mt-0.5">
            This game is archived. You cannot create, edit, or delete data. All existing data is preserved and read-only.
          </p>
        </div>
        <div className="flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-amber-400/60" />
        </div>
      </div>
    </div>
  );
}
