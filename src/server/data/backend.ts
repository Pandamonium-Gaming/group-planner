export function getDataBackend(): 'supabase' | 'postgres' {
  const value = process.env.APP_DATA_BACKEND;
  if (!value || value === 'supabase') return 'supabase';
  if (value === 'postgres') return 'postgres';
  throw new Error('Invalid APP_DATA_BACKEND; expected supabase or postgres');
}
