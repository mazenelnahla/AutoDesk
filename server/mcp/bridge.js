import express from 'express';
import { randomUUID, timingSafeEqual } from 'node:crypto';

export const bridgeRouter = express.Router();
let snapshot;
let owner;
let updatedAt = 0;
const pending = new Map();
const token = process.env.MCP_BRIDGE_TOKEN;

function fresh() {
  if (!snapshot || Date.now() - updatedAt > 10000) throw new Error('Open one signed-in AutoDesk browser tab with a model loaded.');
}

bridgeRouter.use((req, res, next) => {
  // Browser publishing requires the existing Autodesk login and a same-origin request.
  if (req.path === '/sync') {
    if (!req.session?.internal_token) return res.sendStatus(401);
    if (req.get('origin') !== `${req.protocol}://${req.get('host')}`) return res.sendStatus(403);
  } else {
    const supplied = Buffer.from(req.get('authorization') || '');
    const expected = Buffer.from(`Bearer ${token || ''}`);
    if (!token || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return res.sendStatus(401);
  }
  next();
});

bridgeRouter.post('/sync', (req, res) => {
  if (!token) return res.status(503).json({ error: 'Set MCP_BRIDGE_TOKEN to enable MCP.' });
  const { tabId, context, results = [] } = req.body;
  if (typeof tabId !== 'string' || !context || !Array.isArray(results)) return res.sendStatus(400);
  if (owner && owner !== tabId && Date.now() - updatedAt < 10000) return res.status(409).json({ error: 'Another browser tab owns the MCP bridge.' });
  if (owner !== tabId || snapshot?.modelId !== context.modelId) {
    for (const command of pending.values()) command.resolve({ error: 'Active viewer changed.' });
    pending.clear();
  }
  owner = tabId;
  snapshot = context;
  updatedAt = Date.now();
  for (const result of results) {
    pending.get(result.id)?.resolve(result);
    pending.delete(result.id);
  }
  res.json({ commands: [...pending.values()].filter(c => !c.sent).map(c => {
    c.sent = true;
    return { id: c.id, action: c.action, dbIds: c.dbIds, modelId: snapshot.modelId };
  }) });
});

bridgeRouter.get('/context', (_req, res) => {
  try { fresh(); res.json(snapshot); } catch (error) { res.status(409).json({ error: error.message }); }
});

bridgeRouter.post('/command', async (req, res) => {
  try {
    fresh();
    const { action, dbIds } = req.body;
    if (!snapshot.modelId) throw new Error('Load a model first.');
    if (!['isolate', 'reset', 'fit'].includes(action)) throw new Error('Unsupported viewer action.');
    if (dbIds !== undefined && (!Array.isArray(dbIds) || dbIds.length > 10000 || !dbIds.every(id => Number.isSafeInteger(id) && id > 0))) throw new Error('Invalid element IDs.');
    if (action === 'isolate' && !dbIds?.length) throw new Error('Isolation requires element IDs.');
    if (pending.size >= 20) throw new Error('Too many pending commands.');
    const id = randomUUID();
    const result = await new Promise(resolve => {
      const timer = setTimeout(() => { pending.delete(id); resolve({ error: 'Viewer did not acknowledge command in time.' }); }, 8000);
      pending.set(id, { id, action, dbIds, resolve: value => { clearTimeout(timer); resolve(value); } });
    });
    res.json(result);
  } catch (error) { res.status(400).json({ error: error.message }); }
});
