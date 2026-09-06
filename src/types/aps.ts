export interface APSUser {
  userId: string;
  userName: string;
  emailId: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
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
  rootFolderId?: string;
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
  versions?: APSVersion[];
}

export interface APSVersion {
  id: string;
  name: string;
  createTime?: string;
}
