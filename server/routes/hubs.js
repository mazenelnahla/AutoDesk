import express from 'express';
import {
  authRefreshMiddleware,
  getHubs,
  getProjects,
  getProjectContents,
  getItemVersions
} from '../services/aps.js';

const router = express.Router();

router.use(authRefreshMiddleware);

// Get hubs
router.get('/hubs', async (req, res, next) => {
  try {
    const hubs = await getHubs(req.internalOAuthToken.access_token);
    res.json(
      (hubs || []).map((hub) => ({
        id: hub.id,
        name: hub.attributes?.name || 'Unnamed Hub',
        type: 'hubs',
        region: hub.attributes?.region || 'US',
        hubType: hub.id.startsWith('b.') ? 'bim360' : hub.id.startsWith('a.') ? 'acc' : 'team'
      }))
    );
  } catch (err) {
    next(err);
  }
});

// Get projects for a hub
router.get('/hubs/:hub_id/projects', async (req, res, next) => {
  try {
    const projects = await getProjects(req.params.hub_id, req.internalOAuthToken.access_token);
    res.json(
      (projects || []).map((project) => ({
        id: project.id,
        name: project.attributes?.name || 'Unnamed Project',
        type: 'projects',
        hubId: req.params.hub_id
      }))
    );
  } catch (err) {
    next(err);
  }
});

// Get contents (top folders or folder subcontents)
router.get('/hubs/:hub_id/projects/:project_id/contents', async (req, res, next) => {
  try {
    const entries = await getProjectContents(
      req.params.hub_id,
      req.params.project_id,
      req.query.folder_id,
      req.internalOAuthToken.access_token
    );

    res.json(
      (entries || []).map((entry) => {
        const displayName = entry.attributes?.displayName || entry.attributes?.name || 'Untitled';
        const isFolder = entry.type === 'folders';
        const extension = displayName.includes('.')
          ? displayName.substring(displayName.lastIndexOf('.')).toLowerCase()
          : '';
        const isRevit =
          extension === '.rvt' ||
          entry.attributes?.extension?.type?.includes('Revit') ||
          entry.attributes?.extension?.type?.includes('revit') ||
          false;

        return {
          id: entry.id,
          name: displayName,
          displayName: displayName,
          folder: isFolder,
          isFolder: isFolder,
          isRevit: isRevit,
          extension: extension,
          size: entry.attributes?.storageSize || 0,
          lastModified: entry.attributes?.lastModifiedTime || entry.attributes?.createTime
        };
      })
    );
  } catch (err) {
    next(err);
  }
});

// Get versions for an item
router.get('/hubs/:hub_id/projects/:project_id/contents/:item_id/versions', async (req, res, next) => {
  try {
    const versions = await getItemVersions(
      req.params.project_id,
      req.params.item_id,
      req.internalOAuthToken.access_token
    );
    res.json(
      (versions || []).map((version) => ({
        id: version.id,
        name: version.attributes?.name || version.attributes?.displayName || version.attributes?.createTime || 'Version',
        createTime: version.attributes?.createTime
      }))
    );
  } catch (err) {
    next(err);
  }
});

export default router;
