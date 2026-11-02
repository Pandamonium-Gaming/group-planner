"use client";
import { useState, useEffect } from 'react';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { updateClanIconUrl } from '@/lib/auth';

// Use env var for bucket name, fallback to 'aoc-guild-icons'
const GUILD_ICON_BUCKET = process.env.NEXT_PUBLIC_GUILD_ICON_BUCKET || 'aoc-guild-icons';

interface GuildIconUploaderProps {
  groupId: string;
  currentUrl?: string;
  onUploaded?: (url: string) => void;
}


export function GuildIconUploader({ groupId, currentUrl, onUploaded }: GuildIconUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedIconUrl, setUploadedIconUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { user, session } = useAuthContext();
  const iconUrl = uploadedIconUrl || currentUrl || '';

  // Clean up previewUrl when component unmounts or iconUrl changes
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    if (!user || !session) {
      setError('You must be logged in to upload a group icon.');
      return;
    }
    setUploading(true);
    const filePath = `${groupId}/icon.png`;
    const { error } = await supabase.storage
      .from(GUILD_ICON_BUCKET)
      .upload(filePath, file, { upsert: true });
    if (error) {
      setError('Upload failed! ' + (error.message || ''));
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from(GUILD_ICON_BUCKET).getPublicUrl(filePath);
    if (data?.publicUrl) {
      await updateClanIconUrl(groupId, data.publicUrl);
      setUploadedIconUrl(data.publicUrl);
      setSuccess('Icon uploaded successfully!');
      if (onUploaded) onUploaded(data.publicUrl);
      setPreviewUrl(null); // clear preview after upload
    }
    setUploading(false);
    // Reset file input
    if (e.target) e.target.value = '';
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-row items-center gap-6 w-full">
        {(previewUrl || iconUrl) && (
          <img
            src={previewUrl || iconUrl}
            alt="Group Icon Preview"
            className="w-16 h-16 rounded-full border border-slate-700"
            style={{ objectFit: 'cover' }}
          />
        )}
        <label
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-800/50 hover:bg-slate-700/50 border border-dashed border-slate-600 hover:border-orange-500/50 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={{ position: 'relative' }}
        >
          {uploading ? (
            <span className="font-medium">Uploading...</span>
          ) : (
            <span className="font-medium">Choose File</span>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </label>
      </div>
      {error && <div className="text-red-500 text-sm mt-1">{error}</div>}
      {success && <div className="text-green-500 text-sm mt-1">{success}</div>}
    </div>
  );
}

