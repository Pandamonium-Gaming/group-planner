'use client';

import { useState } from 'react';
import { Users, X } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { submitGuestRsvp } from '@/lib/actions/guest-rsvp';
import { EventRole, EVENT_ROLES } from '@/lib/events';

interface GuestSignupFormProps {
  eventId: string;
  alliedClanId: string;
  onSuccess: () => void;
}

export function GuestSignupForm({ eventId, alliedClanId, onSuccess }: GuestSignupFormProps) {
  const { success, error } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    guestName: '',
    classId: '',
    role: 'ranged_dps' as EventRole,
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!formData.guestName.trim()) {
      error('Please enter your character name');
      return;
    }
    
    if (!formData.role) {
      error('Please select a role');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitGuestRsvp({
        eventId,
        guestName: formData.guestName.trim(),
        classId: formData.classId || null,
        role: formData.role,
        alliedClanId,
      });

      if ('error' in result) {
        error(result.error || 'Unknown error occurred');
      } else {
        success(`${formData.guestName} has been added to the event!`);
        setFormData({ guestName: '', classId: '', role: 'ranged_dps' });
        setIsOpen(false);
        onSuccess();
      }
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors cursor-pointer"
      >
        <Users size={16} />
        Sign up as guest
      </button>
    );
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Users size={16} />
          Guest Sign-up
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Character Name */}
        <div>
          <label className="block text-xs text-slate-300 mb-1">
            Character Name *
          </label>
          <input
            type="text"
            value={formData.guestName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, guestName: e.target.value })}
            placeholder="Enter your character name"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSubmitting}
          />
        </div>

        {/* Role Selection */}
        <div>
          <label className="block text-xs text-slate-300 mb-2">
            Role *
          </label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(EVENT_ROLES).map(([roleKey, roleConfig]) => (
              <button
                key={roleKey}
                type="button"
                onClick={() => setFormData({ ...formData, role: roleKey as EventRole })}
                disabled={isSubmitting}
                className={`flex flex-col items-center p-2 rounded transition-all text-xs cursor-pointer ${
                  formData.role === roleKey
                    ? 'ring-2 ring-offset-2 ring-offset-slate-800'
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
                style={formData.role === roleKey ? { 
                  backgroundColor: roleConfig.color + '30',
                  color: roleConfig.color
                } : undefined}
              >
                <span className="text-lg">{roleConfig.icon}</span>
                <span>{roleConfig.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            disabled={isSubmitting}
            className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? 'Signing up...' : 'Sign up'}
          </button>
        </div>
      </form>
    </div>
  );
}

