/**
 * Petals Suites & Hotel - Server Application
 * Hosts Website Frontend & eZee PMS Backend API Gateway
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security HTTP Headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdnjs.cloudflare.com",
        "https://fonts.googleapis.com"
      ],
      fontSrc: [
        "'self'",
        "https://cdnjs.cloudflare.com",
        "https://fonts.gstatic.com",
        "data:"
      ],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      frameSrc: [
        "'self'",
        "https://maps.google.com",
        "https://www.google.com"
      ],
      connectSrc: ["'self'"],
      upgradeInsecureRequests: null
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS Configuration
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request Body Parsers with strict size limits
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: true, limit: '20kb' }));

// Block access to sensitive files and directories
app.use((req, res, next) => {
  const normalizedPath = decodeURIComponent(req.path).toLowerCase();
  const blockedPatterns = [
    /^\/server(\/|$)/,
    /^\/node_modules(\/|$)/,
    /^\/\..*/, // Any dotfile like .env, .git, .gitignore
    /\.(env|json|lock|md|log|yml|yaml|config|sh|bak|dist)$/i
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(normalizedPath)) {
      return res.status(403).json({ error: 'Access forbidden' });
    }
  }
  next();
});

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

// Serve Static Frontend Assets with strict dotfiles policy
const rootDir = path.join(__dirname, '..');
app.use(express.static(rootDir, {
  dotfiles: 'deny',
  index: 'index.html',
  maxAge: '1d'
}));

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
