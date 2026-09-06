import express from 'express';
import {
  getAuthorizationUrl,
  authCallbackMiddleware,
  authRefreshMiddleware,
  getUserProfile
} from '../services/aps.js';

const router = express.Router();

router.get('/login', (req, res) => {
  try {
    const authUrl = getAuthorizationUrl();
    console.log('Redirecting user to Autodesk OAuth URL:', authUrl);
    res.redirect(authUrl);
  } catch (err) {
    console.error('Error generating authorization URL:', err);
    res.status(500).json({ error: 'Failed to initiate login', details: err.message });
  }
});

router.get('/logout', (req, res) => {
  req.session = null;
  res.redirect('/');
});

router.get('/callback', authCallbackMiddleware, (req, res) => {
  console.log('OAuth Callback successful. Session internal token exists:', !!req.session?.internal_token);
  res.redirect('/');
});

router.get('/token', authRefreshMiddleware, (req, res) => {
  res.json(req.publicOAuthToken);
});

router.get('/profile', authRefreshMiddleware, async (req, res, next) => {
  try {
    let name = 'Autodesk User';
    let email = '';
    let picture = null;
    let raw = null;

    try {
      const profile = await getUserProfile(req.internalOAuthToken.access_token);
      name = profile.name || `${profile.given_name || ''} ${profile.family_name || ''}`.trim() || 'Autodesk User';
      email = profile.email || profile.emailId || '';
      picture = profile.picture || profile.profileImages?.sizeX80 || null;
      raw = profile;
    } catch (profileErr) {
      console.warn('getUserInfo notice (proceeding with fallback session user):', profileErr.message);
    }

    res.json({
      name,
      email,
      picture,
      raw
    });
  } catch (err) {
    console.error('Error in /api/auth/profile route:', err);
    next(err);
  }
});

export default router;
