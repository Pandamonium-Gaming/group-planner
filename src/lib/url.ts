export const getURL = () => {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_VERCEL_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    'http://localhost:3000';

  const parsed = new URL(url.includes('://') ? url : `https://${url}`);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Site URL must use HTTP or HTTPS');
  }
  return `${parsed.origin}/`;
};
