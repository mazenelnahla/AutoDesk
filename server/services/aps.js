import { AuthenticationClient } from '@aps_sdk/authentication';
import { DataManagementClient } from '@aps_sdk/data-management';
import { APS_CLIENT_ID, APS_CLIENT_SECRET, INTERNAL_TOKEN_SCOPES, PUBLIC_TOKEN_SCOPES } from '../config.js';

const authenticationClient = new AuthenticationClient();
const dataManagementClient = new DataManagementClient();
const tokenCache = new Map();

// Cache by scope and share in-flight requests across concurrent browser/API calls.
export async function getApplicationToken(scopes) {
  if (!APS_CLIENT_ID || !APS_CLIENT_SECRET) {
    throw new Error('Configure APS_CLIENT_ID and APS_CLIENT_SECRET on the server.');
  }
  const key = [...scopes].sort().join(' ');
  let entry = tokenCache.get(key);
  if (entry?.credentials && entry.expiresAt > Date.now() + 60000) {
    return { access_token: entry.credentials.access_token, expires_in: Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000)) };
  }
  if (!entry?.pending) {
    entry = {};
    tokenCache.set(key, entry);
    entry.pending = authenticationClient.getTwoLeggedToken(APS_CLIENT_ID, APS_CLIENT_SECRET, scopes)
      .then(credentials => {
        entry.credentials = credentials;
        entry.expiresAt = Date.now() + credentials.expires_in * 1000;
        return { access_token: credentials.access_token, expires_in: credentials.expires_in };
      }).finally(() => { delete entry.pending; });
  }
  return entry.pending;
}

export const applicationAuthMiddleware = async (req, res, next) => {
  try {
    req.internalOAuthToken = await getApplicationToken(INTERNAL_TOKEN_SCOPES);
    next();
  } catch (error) {
    console.error('APS application authentication failed:', error.message);
    res.status(503).json({ error: 'APS application connection failed. Check server credentials and try again.' });
  }
};

export const getViewerToken = () => getApplicationToken(PUBLIC_TOKEN_SCOPES);

export const getHubs = async (accessToken) => {
  const resp = await dataManagementClient.getHubs({ accessToken });
  return resp.data;
};

export const getProjects = async (hubId, accessToken) => {
  const resp = await dataManagementClient.getHubProjects(hubId, { accessToken });
  return resp.data;
};

export const getProjectContents = async (hubId, projectId, folderId, accessToken) => {
  if (!folderId) {
    const resp = await dataManagementClient.getProjectTopFolders(hubId, projectId, { accessToken });
    return resp.data;
  } else {
    const resp = await dataManagementClient.getFolderContents(projectId, folderId, { accessToken });
    return resp.data;
  }
};

export const getItemVersions = async (projectId, itemId, accessToken) => {
  const resp = await dataManagementClient.getItemVersions(projectId, itemId, { accessToken });
  return resp.data;
};
