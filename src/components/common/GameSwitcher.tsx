'use client';

import React, { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import { getAllGames } from '@/lib/games';
import { ChevronDown } from 'lucide-react';

export function GameSwitcher() {
  const { selectedGame, setSelectedGame, clearSelectedGame } = useGame();
  const [isOpen, setIsOpen] = useState(false);
  const games = getAllGames();
  const currentGame = selectedGame ? games.find((g) => g.id === selectedGame) : null;

  if (!currentGame) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-slate-600 text-white transition-colors"
      >
        <span className="text-lg">{currentGame.icon}</span>
        <span className="text-sm font-medium hidden sm:inline">{currentGame.name}</span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50">
          <div className="p-2">
            {games.map((game) => (
              <button
                key={game.id}
                onClick={() => {
                  setSelectedGame(game.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  selectedGame === game.id
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{game.icon}</span>
                  <div className="flex-1">
                    <p className="font-medium">{game.name}</p>
                    <p className="text-xs text-slate-400">{game.description}</p>
                  </div>
                </div>
              </button>
            ))}
            <button
              onClick={() => {
                clearSelectedGame();
                setIsOpen(false);
              }}
              className="w-full text-left mt-2 pt-2 border-t border-slate-700 px-4 py-2 rounded-lg text-slate-400 hover:text-slate-300 text-sm transition-colors"
            >
              Choose game again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

