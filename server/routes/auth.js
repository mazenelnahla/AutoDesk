import express from 'express';
import { applicationAuthMiddleware, getViewerToken } from '../services/aps.js';

const router = express.Router();
router.get('/token', async (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  try { res.json(await getViewerToken()); } catch (error) { next(error); }
});

// Connection status represents the application, not an Autodesk user profile.
router.get('/profile', applicationAuthMiddleware, (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ name: 'APS Application', authType: 'two-legged' });
});

export default router;
