import express from 'express';
import http from 'http';
import session from 'cookie-session';
import cors from 'cors';
import { PORT, SERVER_SESSION_SECRET } from './config.js';
import authRoutes from './routes/auth.js';
import hubsRoutes from './routes/hubs.js';
import llmRoutes from './routes/llm.js';

import { bridgeRouter } from './mcp/bridge.js';

const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
  })
);

app.use(session({
  name: 'session',
  secret: SERVER_SESSION_SECRET,
  maxAge: 24 * 60 * 60 * 1000,
  signed: true,
}));

app.use('/api/mcp', express.json({ limit: '10mb' }), bridgeRouter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'Autodesk Platform Services (APS) Backend',
    timestamp: new Date().toISOString(),
    sessionActive: !!req.session?.internal_token
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/llm', llmRoutes);
app.use('/api', hubsRoutes);

// Frontend: In development, use Vite with HMR directly on port 3001. In production, serve dist.
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile('index.html', { root: 'dist' });
    }
    next();
  });
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      ws: { server },
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  APS App running on http://localhost:${PORT}`);
  console.log(`  HMR & Live-reload: Active on port ${PORT}`);
  console.log(`  Health Check: http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
});
