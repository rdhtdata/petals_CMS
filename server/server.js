/**
 * Petals Suites & Hotel - Server Application
 * Hosts Website Frontend & eZee PMS Backend API Gateway
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hotelCode: process.env.EZEE_HOTEL_CODE ? 'Configured' : 'Not Configured',
    timestamp: new Date().toISOString()
  });
});

// Serve Static Frontend Assets
const rootDir = path.join(__dirname, '..');
app.use(express.static(rootDir));

// SPA fallback to index.html
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(rootDir, 'index.html'));
});

// Start Server with fallback port handling
const startServer = (port) => {
  const server = app.listen(port, () => {
    console.log('====================================================');
    console.log(`🌸 Petals Suites & Hotel PMS Server running on port ${port}`);
    console.log(`🌐 Local URL: http://localhost:${port}`);
    console.log(`⚡ eZee PMS Gateway ready`);
    console.log('====================================================');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️ Port ${port} is in use, attempting port ${Number(port) + 1}...`);
      startServer(Number(port) + 1);
    } else {
      console.error('Server failed to start:', err);
    }
  });
};

startServer(Number(PORT));
