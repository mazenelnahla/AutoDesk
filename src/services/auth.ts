import type { APSUser } from '../types/aps';

export async function fetchUserProfile(): Promise<APSUser> {
  const resp = await fetch('/api/auth/profile', {
    credentials: 'include',
  });
  if (!resp.ok) {
    throw new Error('Not authenticated');
  }
  const data = await resp.json();
  return {
    userId: data.name || 'User',
    userName: data.name || 'Autodesk User',
    emailId: data.email || '',
    picture: data.picture || undefined,
  };
}

export function initiateLogin(): void {
  window.location.href = '/api/auth/login';
}

export function initiateLogout(): void {
  const iframe = document.createElement('iframe');
  iframe.style.visibility = 'hidden';
  iframe.src = 'https://accounts.autodesk.com/Authentication/LogOut';
  document.body.appendChild(iframe);
  iframe.onload = () => {
    window.location.replace('/api/auth/logout');
    try {
      document.body.removeChild(iframe);
    } catch (e) {
      console.warn('Logout iframe removal notice:', e);
    }
  };
}
