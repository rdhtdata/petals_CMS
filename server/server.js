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
const rootDir = path.join(__dirname, '..');

// Helper to serve cache-busted index.html
const serveIndexHtml = (req, res) => {
  const indexPath = path.join(rootDir, 'index.html');
  fs.readFile(indexPath, 'utf8', (err, html) => {
    if (err) {
      return res.status(500).send('Error loading page');
    }

    // Dynamic asset versioning timestamp
    const dynamicVersion = `${pkg.version || '1.0.0'}-${Date.now()}`;

    let versionedHtml = html
      .replace(/href="style\.css(\?[^"]*)?"/g, `href="style.css?v=${dynamicVersion}"`)
      .replace(/src="main\.js(\?[^"]*)?"/g, `src="main.js?v=${dynamicVersion}"`);

    if (!versionedHtml.includes('name="app-version"')) {
      versionedHtml = versionedHtml.replace('</head>', `  <meta name="app-version" content="${dynamicVersion}">\n</head>`);
    }

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('ETag', `"${dynamicVersion}"`);
    res.type('html').send(versionedHtml);
  });
};

// Helper to serve cache-busted blogs.html
const serveBlogsHtml = (req, res) => {
  const blogsPath = path.join(rootDir, 'blogs.html');
  fs.readFile(blogsPath, 'utf8', (err, html) => {
    if (err) {
      return res.status(500).send('Error loading blogs page');
    }

    const dynamicVersion = `${pkg.version || '1.0.0'}-${Date.now()}`;
    let versionedHtml = html
      .replace(/href="style\.css(\?[^"]*)?"/g, `href="style.css?v=${dynamicVersion}"`)
      .replace(/href="css\/blog\.css(\?[^"]*)?"/g, `href="css/blog.css?v=${dynamicVersion}"`)
      .replace(/src="js\/blogs-data\.js(\?[^"]*)?"/g, `src="js/blogs-data.js?v=${dynamicVersion}"`)
      .replace(/src="js\/blog\.js(\?[^"]*)?"/g, `src="js/blog.js?v=${dynamicVersion}"`);

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('ETag', `"${dynamicVersion}"`);
    res.type('html').send(versionedHtml);
  });
};

// Root routes with dynamic cache-busting
app.get('/', serveIndexHtml);
app.get('/index.html', serveIndexHtml);

// Blog routes
app.get('/blogs', serveBlogsHtml);
app.get('/blog', serveBlogsHtml);
app.get('/blogs.html', serveBlogsHtml);

// Serve Static Frontend Assets with zero-cache for active dev
app.use(express.static(rootDir, {
  dotfiles: 'deny',
  index: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Fallback routing
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  if (req.path.startsWith('/blog') || req.path.startsWith('/blogs')) {
    return serveBlogsHtml(req, res);
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
