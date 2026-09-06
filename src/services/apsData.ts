import type { APSHub, APSProject, APSItem, APSVersion } from '../types/aps';

export function toUrlSafeBase64(stringToEncode: string): string {
  if (typeof window !== 'undefined' && window.Autodesk?.Viewing?.toUrlSafeBase64) {
    return window.Autodesk.Viewing.toUrlSafeBase64(stringToEncode);
  }
  return btoa(stringToEncode).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getJSON<T>(url: string): Promise<T> {
  const resp = await fetch(url, {
    credentials: 'include',
  });
  if (!resp.ok) {
    const errorText = await resp.text().catch(() => '');
    throw new Error(`Request to ${url} failed (${resp.status}): ${errorText || resp.statusText}`);
  }
  return resp.json();
}

export async function fetchLiveHubs(): Promise<APSHub[]> {
  return await getJSON<APSHub[]>('/api/hubs');
}

export async function fetchLiveProjects(hubId: string): Promise<APSProject[]> {
  return await getJSON<APSProject[]>(`/api/hubs/${encodeURIComponent(hubId)}/projects`);
}

export async function fetchLiveContents(
  hubId: string,
  projectId: string,
  folderId?: string | null
): Promise<APSItem[]> {
  const query = folderId ? `?folder_id=${encodeURIComponent(folderId)}` : '';
  const items = await getJSON<APSItem[]>(
    `/api/hubs/${encodeURIComponent(hubId)}/projects/${encodeURIComponent(projectId)}/contents${query}`
  );
  return items;
}

export async function fetchLiveItemVersions(
  hubId: string,
  projectId: string,
  itemId: string
): Promise<APSVersion[]> {
  return await getJSON<APSVersion[]>(
    `/api/hubs/${encodeURIComponent(hubId)}/projects/${encodeURIComponent(projectId)}/contents/${encodeURIComponent(itemId)}/versions`
  );
}

export async function getPublicToken(): Promise<{ access_token: string; expires_in: number }> {
  return await getJSON<{ access_token: string; expires_in: number }>('/api/auth/token');
}
