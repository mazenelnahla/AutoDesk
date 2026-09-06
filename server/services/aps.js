import { AuthenticationClient, ResponseType } from '@aps_sdk/authentication';
import { DataManagementClient } from '@aps_sdk/data-management';
import {
  APS_CLIENT_ID,
  APS_CLIENT_SECRET,
  APS_CALLBACK_URL,
  INTERNAL_TOKEN_SCOPES,
  PUBLIC_TOKEN_SCOPES
} from '../config.js';

const authenticationClient = new AuthenticationClient();
const dataManagementClient = new DataManagementClient();

export const getAuthorizationUrl = () =>
  authenticationClient.authorize(
    APS_CLIENT_ID,
    ResponseType.Code,
    APS_CALLBACK_URL,
    INTERNAL_TOKEN_SCOPES
  );

export const authCallbackMiddleware = async (req, res, next) => {
  try {
    const internalCredentials = await authenticationClient.getThreeLeggedToken(
      APS_CLIENT_ID,
      req.query.code,
      APS_CALLBACK_URL,
      {
        clientSecret: APS_CLIENT_SECRET
      }
    );
    const publicCredentials = await authenticationClient.refreshToken(
      internalCredentials.refresh_token,
      APS_CLIENT_ID,
      {
        clientSecret: APS_CLIENT_SECRET,
        scopes: PUBLIC_TOKEN_SCOPES
      }
    );
    req.session.public_token = publicCredentials.access_token;
    req.session.internal_token = internalCredentials.access_token;
    req.session.refresh_token = publicCredentials.refresh_token;
    req.session.expires_at = Date.now() + internalCredentials.expires_in * 1000;
    next();
  } catch (err) {
    next(err);
  }
};

export const authRefreshMiddleware = async (req, res, next) => {
  const { refresh_token, expires_at } = req.session || {};
  if (!refresh_token) {
    res.status(401).json({ error: 'Unauthorized: Session missing refresh_token' });
    return;
  }

  try {
    if (expires_at < Date.now()) {
      const internalCredentials = await authenticationClient.refreshToken(
        refresh_token,
        APS_CLIENT_ID,
        {
          clientSecret: APS_CLIENT_SECRET,
          scopes: INTERNAL_TOKEN_SCOPES
        }
      );
      const publicCredentials = await authenticationClient.refreshToken(
        internalCredentials.refresh_token,
        APS_CLIENT_ID,
        {
          clientSecret: APS_CLIENT_SECRET,
          scopes: PUBLIC_TOKEN_SCOPES
        }
      );
      req.session.public_token = publicCredentials.access_token;
      req.session.internal_token = internalCredentials.access_token;
      req.session.refresh_token = publicCredentials.refresh_token;
      req.session.expires_at = Date.now() + internalCredentials.expires_in * 1000;
    }
    req.internalOAuthToken = {
      access_token: req.session.internal_token,
      expires_in: Math.round((req.session.expires_at - Date.now()) / 1000)
    };
    req.publicOAuthToken = {
      access_token: req.session.public_token,
      expires_in: Math.round((req.session.expires_at - Date.now()) / 1000)
    };
    next();
  } catch (err) {
    req.session = null;
    res.status(401).json({ error: 'Failed to refresh token. Session cleared.' });
  }
};

export const getUserProfile = async (accessToken) => {
  const resp = await authenticationClient.getUserInfo(accessToken);
  return resp;
};

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
