import type { APSHub, APSProject, APSItem } from '../types/aps';

const BACKEND_BASE = '/api/data';

async function fetchJson(url: string, token: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const res = await fetch(url, { headers });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message = errorData.error || errorData.details || res.statusText;
    throw new Error(`API Error (${res.status}): ${typeof message === 'object' ? JSON.stringify(message) : message}`);
  }

  return res.json();
}

export async function fetchLiveHubs(token: string): Promise<APSHub[]> {
  return await fetchJson(`${BACKEND_BASE}/hubs`, token);
}

export async function fetchLiveProjects(hubId: string, token: string): Promise<APSProject[]> {
  return await fetchJson(`${BACKEND_BASE}/hubs/${hubId}/projects`, token);
}

export async function fetchLiveTopFolders(
  hubId: string,
  projectId: string,
  token: string
): Promise<APSItem[]> {
  return await fetchJson(
    `${BACKEND_BASE}/hubs/${hubId}/projects/${projectId}/topFolders`,
    token
  );
}

export async function fetchLiveFolderContents(
  projectId: string,
  folderId: string,
  token: string
): Promise<APSItem[]> {
  return await fetchJson(
    `${BACKEND_BASE}/projects/${projectId}/folders/${folderId}/contents`,
    token
  );
}
