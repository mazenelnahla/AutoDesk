import express from 'express';
import axios from 'axios';

const router = express.Router();

const DEFAULT_LM_STUDIO_URL = 'http://127.0.0.1:1234';

function sanitizeUrl(rawUrl) {
  let url = (rawUrl || DEFAULT_LM_STUDIO_URL).trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `http://${url}`;
  }
  // Remove trailing slashes
  return url.replace(/\/+$/, '');
}

// Check LM Studio server status and retrieve loaded models
router.get('/health', async (req, res) => {
  const baseUrl = sanitizeUrl(req.query.url);

  try {
    const response = await axios.get(`${baseUrl}/v1/models`, {
      timeout: 4000,
      headers: {
        'Accept': 'application/json',
      },
    });

    const models = response.data?.data || [];
    res.json({
      online: true,
      url: baseUrl,
      modelCount: models.length,
      models: models.map((m) => ({
        id: m.id || m.name,
        name: m.id || m.name,
        owned_by: m.owned_by || 'lmstudio',
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.json({
      online: false,
      url: baseUrl,
      error: err.code === 'ECONNREFUSED' 
        ? 'Connection refused. Ensure LM Studio local server is running on ' + baseUrl
        : err.message || 'Failed to connect to LM Studio',
      models: [],
      timestamp: new Date().toISOString(),
    });
  }
});

// List available models from LM Studio
router.get('/models', async (req, res) => {
  const baseUrl = sanitizeUrl(req.query.url);

  try {
    const response = await axios.get(`${baseUrl}/v1/models`, {
      timeout: 5000,
      headers: { 'Accept': 'application/json' },
    });
    res.json(response.data);
  } catch (err) {
    res.status(502).json({
      error: 'Cannot reach LM Studio on ' + baseUrl,
      details: err.message,
    });
  }
});

// Proxy chat completion to LM Studio OpenAI-compatible endpoint
router.post('/chat', async (req, res) => {
  const baseUrl = sanitizeUrl(req.body.url);
  const { model, messages, temperature = 0.2, max_tokens = 800 } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  try {
    const payload = {
      model: model || 'default',
      messages,
      temperature,
      max_tokens,
      stream: false,
    };

    const response = await axios.post(`${baseUrl}/v1/chat/completions`, payload, {
      timeout: 90000, // 90 seconds for local LLMs
      headers: {
        'Content-Type': 'application/json',
      },
    });

    res.json(response.data);
  } catch (err) {
    console.error('LM Studio Chat Proxy Error:', err.message);
    const status = err.response?.status || 502;
    res.status(status).json({
      error: err.response?.data?.error || err.message || 'Error communicating with LM Studio',
      code: err.code,
    });
  }
});

export default router;
