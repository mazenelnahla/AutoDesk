import express from 'express';
import axios from 'axios';

const router = express.Router();
const APS_BASE_URL = 'https://developer.api.autodesk.com';

// 1. Get 2-Legged Public Token for Autodesk Viewer SDK
router.get('/token', async (req, res) => {
  const clientId = process.env.APS_CLIENT_ID || req.query.clientId;
  const clientSecret = process.env.APS_CLIENT_SECRET || req.query.clientSecret;

  if (!clientId || !clientSecret) {
    return res.status(400).json({
      error: 'Missing APS_CLIENT_ID or APS_CLIENT_SECRET in backend environment or query parameters.',
    });
  }

  try {
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'data:read viewables:read',
    });

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await axios.post(`${APS_BASE_URL}/authentication/v2/token`, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error('2-Legged Token Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to retrieve 2-legged access token from Autodesk',
      details: error.response?.data || error.message,
    });
  }
});

// 2. Redirect User to Autodesk OAuth v2 Authorize URL
router.get('/login', (req, res) => {
  const clientId = process.env.APS_CLIENT_ID || req.query.clientId;
  const callbackUrl = process.env.APS_CALLBACK_URL || req.query.redirectUri || 'http://localhost:3001/api/auth/callback';
  const scopes = 'data:read data:write data:search viewables:read user-profile:read account:read account:write';

  if (!clientId) {
    return res.status(400).json({ error: 'APS_CLIENT_ID is required to initiate OAuth login.' });
  }

  const authUrl = `${APS_BASE_URL}/authentication/v2/authorize?response_type=code&client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${encodeURIComponent(scopes)}`;

  res.redirect(authUrl);
});

// 3. OAuth Callback Code Exchange using Client Secret
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  const clientId = process.env.APS_CLIENT_ID;
  const clientSecret = process.env.APS_CLIENT_SECRET;
  const callbackUrl = process.env.APS_CALLBACK_URL || 'http://localhost:3001/api/auth/callback';

  if (!code) {
    return res.status(400).send('Authorization code missing in callback request.');
  }

  try {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: callbackUrl,
    });

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await axios.post(`${APS_BASE_URL}/authentication/v2/token`, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
    });

    const { access_token, refresh_token, expires_in } = response.data;

    // Redirect user back to Vite frontend with access token and refresh token
    const queryParams = new URLSearchParams({
      access_token,
      expires_in: expires_in ? expires_in.toString() : '3600',
    });
    if (refresh_token) {
      queryParams.append('refresh_token', refresh_token);
    }

    res.redirect(`http://localhost:5173/?${queryParams.toString()}`);
  } catch (error) {
    console.error('OAuth Callback Token Exchange Error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to exchange authorization code for tokens',
      details: error.response?.data || error.message,
    });
  }
});

// 4. Refresh Access Token using Refresh Token
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  const clientId = process.env.APS_CLIENT_ID;
  const clientSecret = process.env.APS_CLIENT_SECRET;

  if (!refresh_token) {
    return res.status(400).json({ error: 'refresh_token is required' });
  }

  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh_token,
    });

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await axios.post(`${APS_BASE_URL}/authentication/v2/token`, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error('Refresh Token Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to refresh access token',
      details: error.response?.data || error.message,
    });
  }
});

// 4. Fetch User Profile
router.get('/profile', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  let authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header required.' });
  }

  // Ensure Bearer prefix is present and token is valid
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = tokenMatch ? tokenMatch[1].trim() : authHeader.trim();

  if (!token || token === 'undefined' || token === 'null') {
    return res.status(401).json({ error: 'Invalid or missing Bearer token.' });
  }

  // 1. Decode access_token JWT payload directly to extract authentic Autodesk userid
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payloadJson = Buffer.from(parts[1], 'base64').toString('utf-8');
      const payload = JSON.parse(payloadJson);
      if (payload && payload.userid) {
        const id = payload.userid;
        return res.json({
          userId: id,
          userName: `Autodesk User (${id})`,
          emailId: payload.email || payload.emailId || '',
        });
      }
    }
  } catch (jwtErr) {
    console.error('JWT decode error:', jwtErr);
  }

  // 2. Candidate user info endpoints as fallback
  const formattedAuthHeader = `Bearer ${token}`;
  const endpoints = [
    'https://api.aps.autodesk.com/userinfo',
    `${APS_BASE_URL}/userprofile/v1/users/@me`,
    `${APS_BASE_URL}/authentication/v2/userinfo`,
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(endpoint, {
        headers: { Authorization: formattedAuthHeader },
      });
      if (response.data && typeof response.data === 'object') {
        return res.json(response.data);
      }
    } catch {
      // Continue trying next endpoint
    }
  }

  res.status(401).json({
    error: 'Failed to authenticate user profile from token',
  });
});

export default router;
