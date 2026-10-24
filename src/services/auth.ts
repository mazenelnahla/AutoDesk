import type { APSUser } from '../types/aps';

export async function fetchUserProfile(): Promise<APSUser> {
  const resp = await fetch('/api/auth/profile', {
    credentials: 'include',
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || 'Could not connect to APS.');
  }
  const data = await resp.json();
  return {
    userId: data.name || 'User',
    userName: data.name || 'Autodesk User',
    emailId: data.email || '',
    picture: data.picture || undefined,
  };
}
