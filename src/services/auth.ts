import type { OAuthTokens, APSUser, APSSettings } from '../types/aps';

const STORAGE_KEYS = {
  SETTINGS: 'aps_settings_v1',
  TOKENS: 'aps_tokens_v1',
  USER: 'aps_user_v1',
  CODE_VERIFIER: 'aps_pkce_verifier',
};

export const DEFAULT_SETTINGS: APSSettings = {
  clientId: import.meta.env.VITE_APS_CLIENT_ID || '',
  redirectUri: window.location.origin + '/',
  scopes: ['data:read', 'viewables:read', 'user-profile:read'],
};

export function loadSettings(): APSSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Error loading settings from localStorage', e);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: APSSettings): void {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

// PKCE Helper Functions
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = new Uint8Array(length);
  window.crypto.getRandomValues(values);
  return Array.from(values)
    .map((x) => possible[x % possible.length])
    .join('');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function base64UrlEncode(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  let string = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    string += String.fromCharCode(bytes[i]);
  }
  return btoa(string)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function initiatePKCELogin(settings: APSSettings): Promise<void> {
  if (!settings.clientId) {
    throw new Error('Autodesk Client ID is required for Live Mode.');
  }

  const verifier = generateRandomString(64);
  sessionStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, verifier);

  const hashed = await sha256(verifier);
  const challenge = base64UrlEncode(hashed);

  const authUrl = new URL('https://developer.api.autodesk.com/authentication/v2/authorize');
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('client_id', settings.clientId);
  authUrl.searchParams.append('redirect_uri', settings.redirectUri);
  authUrl.searchParams.append('scope', settings.scopes.join(' '));
  authUrl.searchParams.append('code_challenge', challenge);
  authUrl.searchParams.append('code_challenge_method', 'S256');

  window.location.href = authUrl.toString();
}

export async function exchangeCodeForTokens(
  code: string,
  settings: APSSettings
): Promise<OAuthTokens> {
  const verifier = sessionStorage.getItem(STORAGE_KEYS.CODE_VERIFIER);
  if (!verifier) {
    throw new Error('PKCE verifier missing from session storage. Please try logging in again.');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: settings.clientId,
    code: code,
    redirect_uri: settings.redirectUri,
    code_verifier: verifier,
  });

  const response = await fetch('https://developer.api.autodesk.com/authentication/v2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.developerMessage ||
        errorData.error_description ||
        `Token exchange failed with status ${response.status}`
    );
  }

  const data = await response.json();
  const tokens: OAuthTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    token_type: data.token_type || 'Bearer',
    expires_at: Date.now() + data.expires_in * 1000,
  };

  saveTokens(tokens);
  sessionStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);
  return tokens;
}

export function saveTokens(tokens: OAuthTokens): void {
  localStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(tokens));
}

export function getTokens(): OAuthTokens | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.TOKENS);
    if (!stored) return null;
    const tokens: OAuthTokens = JSON.parse(stored);
    if (Date.now() >= tokens.expires_at - 60000) {
      // If expired but refresh_token exists, return token object so app can auto-refresh
      if (!tokens.refresh_token) {
        return null;
      }
    }
    return tokens;
  } catch (e) {
    return null;
  }
}

export async function refreshAuthTokens(refreshToken: string): Promise<OAuthTokens> {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    clearAuth();
    throw new Error('Failed to refresh authentication token');
  }

  const data = await response.json();
  const newTokens: OAuthTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_in: data.expires_in,
    token_type: data.token_type || 'Bearer',
    expires_at: Date.now() + data.expires_in * 1000,
  };

  saveTokens(newTokens);
  return newTokens;
}

export function clearAuth(): void {
  localStorage.removeItem(STORAGE_KEYS.TOKENS);
  localStorage.removeItem(STORAGE_KEYS.USER);
  sessionStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);
}

export async function fetchUserProfile(accessToken: string): Promise<APSUser> {
  if (!accessToken || accessToken === 'undefined' || accessToken === 'null') {
    throw new Error('Valid access token is required to fetch user profile.');
  }

  let data: any = null;

  try {
    // Call Express backend proxy endpoint with cache-busting
    const response = await fetch(`/api/auth/profile?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Cache-Control': 'no-cache',
      },
    });
    if (response.ok) {
      data = await response.json();
    }
  } catch (e) {
    console.warn('Backend user profile proxy error:', e);
  }

  // Client-side JWT fallback if backend proxy call failed
  if (!data) {
    try {
      const parts = accessToken.split('.');
      if (parts.length === 3) {
        const base64Url = parts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payloadJson = window.atob(base64);
        const payload = JSON.parse(payloadJson);
        if (payload && payload.userid) {
          data = {
            userId: payload.userid,
            userName: `Autodesk User (${payload.userid})`,
            emailId: payload.email || payload.emailId || '',
          };
        }
      }
    } catch (jwtErr) {
      console.warn('Client-side JWT parse fallback warning:', jwtErr);
    }
  }

  if (!data) {
    throw new Error('Failed to fetch user profile from Autodesk.');
  }

  const firstName = data.firstName || data.given_name || '';
  const lastName = data.lastName || data.family_name || '';
  const fullName = `${firstName} ${lastName}`.trim();
  const email = data.emailId || data.email || '';
  const rawId = data.userId || data.sub || data.id || '';

  let userName =
    (fullName.length > 0 ? fullName : null) ||
    (data.userName && !data.userName.match(/^[A-Z0-9]{8,}$/) ? data.userName : null) ||
    data.preferred_username ||
    data.name ||
    email;

  if (!userName) {
    userName = rawId ? `Autodesk User (${rawId})` : 'Autodesk User';
  }

  const user: APSUser = {
    userId: rawId || 'autodesk-user',
    userName: userName,
    emailId: email,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    profileImages: data.profileImages || (data.picture ? { sizeX40: data.picture, sizeX80: data.picture } : undefined),
  };

  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  return user;
}

export function getStoredUser(): APSUser | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.USER);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function safeBase64URN(urn: string): string {
  // Convert standard string/URN to base64 unpadded URL safe format for Model Derivative API
  const base64 = btoa(urn);
  return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export async function fetchBackend2LeggedToken(clientId?: string): Promise<string> {
  const url = clientId ? `/api/auth/token?clientId=${encodeURIComponent(clientId)}` : '/api/auth/token';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to retrieve 2-legged access token from backend');
  }
  const data = await res.json();
  return data.access_token;
}
