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
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdnjs.cloudflare.com",
        "https://cdn.jsdelivr.net",
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

// Cache-busted version metadata
const fs = require('fs');
const pkg = require('../package.json');
const BUILD_TIME = new Date().toISOString();
const APP_VERSION = `${pkg.version || '1.0.0'}-${Buffer.from(BUILD_TIME).toString('base64url').slice(-8)}`;

const rootDir = path.join(__dirname, '..');

// Helper to serve cache-busted index.html
const serveIndexHtml = (req, res) => {
  const indexPath = path.join(rootDir, 'index.html');
  fs.readFile(indexPath, 'utf8', (err, html) => {
    if (err) {
      return res.status(500).send('Error loading page');
    }

    // Dynamic asset versioning
    let versionedHtml = html
      .replace(/href="style\.css(\?[^"]*)?"/g, `href="style.css?v=${APP_VERSION}"`)
      .replace(/src="main\.js(\?[^"]*)?"/g, `src="main.js?v=${APP_VERSION}"`);

    if (!versionedHtml.includes('name="app-version"')) {
      versionedHtml = versionedHtml.replace('</head>', `  <meta name="app-version" content="${APP_VERSION}">\n</head>`);
    }

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('ETag', `"${APP_VERSION}"`);
    res.type('html').send(versionedHtml);
  });
};

// Root routes with dynamic cache-busting
app.get('/', serveIndexHtml);
app.get('/index.html', serveIndexHtml);

// Serve Static Frontend Assets with strict dotfiles policy
app.use(express.static(rootDir, {
  dotfiles: 'deny',
  index: false,
  maxAge: '1d'
}));

// SPA fallback to index.html
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  serveIndexHtml(req, res);
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
