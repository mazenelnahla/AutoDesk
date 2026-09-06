import express from 'express';
import session from 'cookie-session';
import cors from 'cors';
import { PORT, SERVER_SESSION_SECRET } from './config.js';
import authRoutes from './routes/auth.js';
import hubsRoutes from './routes/hubs.js';

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
  })
);

app.use(session({
  secret: SERVER_SESSION_SECRET,
  maxAge: 24 * 60 * 60 * 1000
}));

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

// Static files & fallback for production / unified port 3001
app.use(express.static('dist'));

// Routes matching aps-hubs-browser-nodejs API
app.use('/api/auth', authRoutes);
app.use('/api', hubsRoutes);

// Fallback for SPA routing in Express 5
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile('index.html', { root: 'dist' }, (err) => {
      if (err) res.redirect('http://localhost:5173/');
    });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  APS Backend running on http://localhost:${PORT}`);
  console.log(`  Health Check: http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
});
