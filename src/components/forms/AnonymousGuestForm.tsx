'use client';

import React, { useState } from 'react';
import { Users, X } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { submitAnonymousGuestRsvp } from '@/lib/actions/anonymous-guest-rsvp';
import { EventRole, getEventRolesForGame } from '@/lib/events';
import { useLanguage } from '@/contexts/LanguageContext';

interface AnonymousGuestFormProps {
  eventId: string;
  gameSlug?: string;
  onSuccess: () => void;
}

export function AnonymousGuestForm({ eventId, gameSlug, onSuccess }: AnonymousGuestFormProps) {
  const { success, error } = useToast();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    guestName: '',
    guestEmail: '',
    classId: '',
    role: 'ranged_dps' as EventRole,
  });

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    if (!formData.guestName.trim()) {
      error('Please enter your character name');
      return;
    }

    // Email is optional
    if (formData.guestEmail.trim() && !formData.guestEmail.includes('@')) {
      error('Please enter a valid email address');
      return;
    }

    if (!formData.role) {
      error('Please select a role');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitAnonymousGuestRsvp({
        eventId,
        guestName: formData.guestName.trim(),
        guestEmail: formData.guestEmail.trim(),
        classId: formData.classId || null,
        role: formData.role,
      });

      if ('error' in result) {
        error(result.error || 'Unknown error occurred');
      } else {
        success(`${formData.guestName} has been registered for the event!`);
        setFormData({ guestName: '', guestEmail: '', classId: '', role: 'ranged_dps' });
        setIsOpen(false);
        onSuccess();
      }
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to register');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Sign up as guest for this event"
        className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900"
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
          Public Event Sign-up
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          aria-label="Close guest sign-up form"
          className="p-1 text-slate-300 hover:text-white active:text-slate-100 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-500 rounded"
        >
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Character Name */}
        <div>
          <label htmlFor="guestName" className="block text-xs text-slate-200 font-medium mb-1">
            Character Name <span className="text-red-400" aria-label="required">*</span>
          </label>
          <input
            id="guestName"
            type="text"
            value={formData.guestName}
            onChange={(e: any) => setFormData({ ...formData, guestName: e.target.value })}
            placeholder="Enter your character name"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-500 rounded text-slate-100 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
            required
            aria-required="true"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="guestEmail" className="block text-xs text-slate-200 font-medium mb-1">
            Email <span className="text-slate-400 text-xs">(optional)</span>
          </label>
          <input
            type="email"
            value={formData.guestEmail}
            onChange={(e: any) => setFormData({ ...formData, guestEmail: e.target.value })}
            placeholder="your@email.com"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSubmitting}
          />
        </div>

        {/* Role Selection */}
        <div>
          <label className="block text-xs text-slate-200 font-medium mb-2">
            Role <span className="text-red-400" aria-label="required">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(getEventRolesForGame(gameSlug)).map(([roleKey, roleConfig]) => (
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
                style={
                  formData.role === roleKey
                    ? {
                        backgroundColor: roleConfig.color + '30',
                        color: roleConfig.color,
                      }
                    : undefined
                }
              >
                <span className="text-lg">{roleConfig.icon}</span>
                <span>{roleConfig.nameKey ? t(roleConfig.nameKey) : roleConfig.name}</span>
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
            className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-slate-100 text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {isSubmitting ? 'Registering...' : 'Register'}
          </button>
        </div>
      </form>
    </div>
  );
}
