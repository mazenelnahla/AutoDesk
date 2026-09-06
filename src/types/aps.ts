export interface APSUser {
  userId: string;
  userName: string;
  emailId: string;
  firstName?: string;
  lastName?: string;
  profileImages?: {
    sizeX20?: string;
    sizeX40?: string;
    sizeX80?: string;
    sizeX120?: string;
  };
}

export interface APSHub {
  id: string;
  type: 'hubs';
  name: string;
  region: string;
  hubType: 'bim360' | 'acc' | 'personal' | 'team';
}

export interface APSProject {
  id: string;
  type: 'projects';
  name: string;
  rootFolderId: string;
  hubId: string;
}

export interface APSItem {
  id: string;
  type: 'items' | 'folders';
  name: string;
  displayName: string;
  extension?: string;
  isFolder: boolean;
  isRevit: boolean;
  size?: number;
  lastModified?: string;
  folderId?: string;
  path?: string;
  versionUrn?: string;
  base64Urn?: string;
  children?: APSItem[];
}

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  expires_at: number; // timestamp in ms
}

export interface APSSettings {
  clientId: string;
  redirectUri: string;
  scopes: string[];
}
