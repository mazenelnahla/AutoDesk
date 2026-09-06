import express from 'express';
import axios from 'axios';

const router = express.Router();
const APS_BASE_URL = 'https://developer.api.autodesk.com';

function safeBase64URN(urn) {
  return Buffer.from(urn)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// 1. Get Live Account Hubs
router.get('/hubs', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header is required.' });
  }

  try {
    const response = await axios.get(`${APS_BASE_URL}/project/v1/hubs`, {
      headers: { Authorization: authHeader },
    });

    const hubs = (response.data.data || []).map((hub) => ({
      id: hub.id,
      type: 'hubs',
      name: hub.attributes?.name || 'Unnamed Hub',
      region: hub.attributes?.region || 'US',
      hubType: hub.id.startsWith('b.') ? 'bim360' : hub.id.startsWith('a.') ? 'acc' : 'team',
    }));

    res.json(hubs);
  } catch (error) {
    console.error('Get Account Hubs Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch hubs from Autodesk Data Management API',
      details: error.response?.data || error.message,
    });
  }
});

// 2. Get Live Account Projects for Hub
router.get('/hubs/:hubId/projects', async (req, res) => {
  const authHeader = req.headers.authorization;
  const { hubId } = req.params;

  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header is required.' });
  }

  try {
    const response = await axios.get(`${APS_BASE_URL}/project/v1/hubs/${hubId}/projects`, {
      headers: { Authorization: authHeader },
    });

    const projects = (response.data.data || []).map((proj) => {
      const rootFolderId = proj.relationships?.rootFolder?.data?.id || '';
      return {
        id: proj.id,
        type: 'projects',
        name: proj.attributes?.name || 'Unnamed Project',
        rootFolderId: rootFolderId,
        hubId: hubId,
      };
    });

    res.json(projects);
  } catch (error) {
    if (error.response?.status === 400 || error.response?.status === 403 || error.response?.status === 404) {
      return res.json([]);
    }
    console.error('Get Account Projects Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch projects from Autodesk Data Management API',
      details: error.response?.data || error.message,
    });
  }
});

// 2b. Get Project Top Folders (BIM 360 / ACC root folders)
router.get('/hubs/:hubId/projects/:projectId/topFolders', async (req, res) => {
  const authHeader = req.headers.authorization;
  const { hubId, projectId } = req.params;

  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header is required.' });
  }

  try {
    const response = await axios.get(
      `${APS_BASE_URL}/project/v1/hubs/${hubId}/projects/${projectId}/topFolders`,
      { headers: { Authorization: authHeader } }
    );

    const items = (response.data.data || []).map((item) => {
      const displayName = item.attributes?.displayName || item.attributes?.name || 'Untitled Folder';
      return {
        id: item.id,
        type: 'folders',
        name: displayName,
        displayName: displayName,
        extension: '',
        isFolder: true,
        isRevit: false,
        size: 0,
        lastModified: item.attributes?.lastModifiedTime || item.attributes?.createTime,
        folderId: item.id,
      };
    });

    res.json(items);
  } catch (error) {
    console.error('Get Project Top Folders Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch project top folders from Autodesk Data Management API',
      details: error.response?.data || error.message,
    });
  }
});

// 3. Get Live Account Folder Contents
router.get('/projects/:projectId/folders/:folderId/contents', async (req, res) => {
  const authHeader = req.headers.authorization;
  const { projectId, folderId } = req.params;

  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header is required.' });
  }

  try {
    const response = await axios.get(
      `${APS_BASE_URL}/data/v1/projects/${projectId}/folders/${folderId}/contents`,
      { headers: { Authorization: authHeader } }
    );

    const items = (response.data.data || []).map((item) => {
      const displayName = item.attributes?.displayName || item.attributes?.name || 'Untitled';
      const isFolder = item.type === 'folders';
      const extension = displayName.includes('.')
        ? displayName.substring(displayName.lastIndexOf('.')).toLowerCase()
        : '';
      const isRevit =
        extension === '.rvt' ||
        item.attributes?.extension?.type?.includes('Revit') ||
        item.attributes?.extension?.type?.includes('revit') ||
        false;

      // Extract version URN from tip relationship or item id
      const tipVersionUrn = item.relationships?.tip?.data?.id || (item.type === 'items' ? item.id : undefined);
      const base64Urn = tipVersionUrn ? safeBase64URN(tipVersionUrn) : undefined;

      return {
        id: item.id,
        type: isFolder ? 'folders' : 'items',
        name: displayName,
        displayName: displayName,
        extension: extension,
        isFolder: isFolder,
        isRevit: isRevit,
        size: item.attributes?.storageSize || 0,
        lastModified: item.attributes?.lastModifiedTime || item.attributes?.createTime,
        folderId: folderId,
        versionUrn: tipVersionUrn,
        base64Urn: base64Urn,
      };
    });

    res.json(items);
  } catch (error) {
    console.error('Get Account Folder Contents Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch folder contents from Autodesk Data Management API',
      details: error.response?.data || error.message,
    });
  }
});

export default router;
