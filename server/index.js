import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import dataRoutes from './routes/data.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || /^http:\/\/localhost:\d+$/.test(origin)) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'Autodesk Platform Services (APS) Backend',
    timestamp: new Date().toISOString(),
    hasClientId: !!process.env.APS_CLIENT_ID,
    hasClientSecret: !!process.env.APS_CLIENT_SECRET,
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  APS Backend running on http://localhost:${PORT}`);
  console.log(`  Health Check: http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
});
