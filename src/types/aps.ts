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
  hubName?: string;
  projectType?: string;
  region?: string;
  status?: string;
  attributes?: Record<string, any>;
}

export interface ProjectSection {
  id: string;
  name: string;
  category?: string;
  source: 'model' | 'project' | 'custom';
  elementCount: number;
  dbIds?: number[];
  assignedIdents: string[];
  completionPercentage?: number;
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

export interface ViewerProperty {
  displayName: string;
  displayValue: any;
  displayCategory: string;
  attributeName?: string;
  type?: number;
  units?: string;
  hidden?: boolean;
}

export interface ViewerSelectedObject {
  dbId: number;
  name: string;
  properties: ViewerProperty[];
}

export type ScheduleStatus = 'not_started' | 'in_progress' | 'completed' | 'delayed';

export interface ElementScheduleData {
  saipemIdent: string;
  projectId?: string;
  projectName?: string;
  modelUrn?: string;
  dbId?: number;
  elementName?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  completionPercentage: number; // 0 to 100
  status: ScheduleStatus;
  assignee?: string;
  notes?: string;
  customFields?: Record<string, string>;
  updatedAt?: string;
}

export interface ScannedModelElement {
  name?: string;
  category?: string;
  externalId?: string;
  parameters: Record<string, string>;
}

export interface ScannedModelIdentInfo {
  elements?: Record<number, ScannedModelElement>;
  dbIds: number[];
  name?: string;
  category?: string;
}

export type ScannedModelIdentMap = Record<string, ScannedModelIdentInfo>;


