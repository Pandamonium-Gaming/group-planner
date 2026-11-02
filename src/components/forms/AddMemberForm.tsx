'use client';

import { useState } from 'react';
import { Plus, X, Check } from 'lucide-react';

interface AddMemberFormProps {
  onAdd: (name: string) => Promise<void>;
}

export function AddMemberForm({ onAdd }: AddMemberFormProps) {
  // ...existing code...

  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onAdd(name.trim());
      setName('');
      setIsAdding(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setName('');
      setIsAdding(false);
    }
  };

  if (!isAdding) {
    return (
      <button
        onClick={() => setIsAdding(true)}
        className="w-full p-4 border-2 border-dashed border-slate-700 rounded-lg text-slate-400 hover:border-slate-600 hover:text-slate-300 transition-colors flex items-center justify-center gap-2 cursor-pointer"
      >
        <Plus size={20} />
        Add Member
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700 p-4"
    >
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Member name..."
          aria-label="Member name"
          className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          autoFocus
          disabled={isSubmitting}
        />
        <button
          type="submit"
          disabled={!name.trim() || isSubmitting}
          className="p-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          aria-label="Add member"
          title="Add member"
        >
          <Check size={20} />
        </button>
        <button
          type="button"
          onClick={() => {
            setName('');
            setIsAdding(false);
          }}
          className="p-2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          aria-label="Cancel"
          title="Cancel"
        >
          <X size={20} />
        </button>
      </div>
    </form>
  );
}

