/**
 * Petals Suites & Hotel - Server Application
 * Hosts Website Frontend, eZee PMS Backend API Gateway & Petals CMS
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
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

// CORS Configuration (supports subdomains like admin.petalshotels.com)
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Request Body Parsers (25MB limit to accommodate rich media uploads)
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Block access to sensitive files and directories
app.use((req, res, next) => {
  const normalizedPath = decodeURIComponent(req.path).toLowerCase();
  const blockedPatterns = [
    /^\/server(\/|$)/,
    /^\/node_modules(\/|$)/,
    /^\/\..*/, // Any dotfile like .env, .git, .gitignore
    /\.(env|lock|md|log|yml|yaml|config|sh|bak|dist|db|sqlite)$/i
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(normalizedPath)) {
      return res.status(403).json({ error: 'Access forbidden' });
    }
  }
  next();
});

// Subdomain Detection Middleware (admin.petalshotels.com)
app.use((req, res, next) => {
  const host = (req.headers.host || '').toLowerCase();
  req.isAdminSubdomain = host.startsWith('admin.');
  next();
});

// PMS and Booking API Routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Petals CMS & Blogs API Routes
const blogsModule = require('./routes/blogs');
const adminRoutes = require('./routes/admin');
app.use('/api/blogs', blogsModule.router);
app.use('/api/categories', (req, res) => res.redirect('/api/blogs/categories/all'));
app.use('/api/admin', adminRoutes);

// Dynamic XML Sitemap for SEO
app.get('/sitemap.xml', (req, res) => {
  try {
    const xml = blogsModule.buildXmlSitemap();
    res.setHeader('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    console.error('[Sitemap Error]', err);
    res.status(500).send('Error generating sitemap');
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hotelCode: process.env.EZEE_HOTEL_CODE ? 'Configured' : 'Not Configured',
    cms: 'Active',
    timestamp: new Date().toISOString()
  });
});

// Cache-busted version metadata
const pkg = require('../package.json');
const rootDir = path.join(__dirname, '..');
const adminDir = path.join(rootDir, 'admin');

// Helper to serve cache-busted index.html
const serveIndexHtml = (req, res) => {
  const indexPath = path.join(rootDir, 'index.html');
  fs.readFile(indexPath, 'utf8', (err, html) => {
    if (err) {
      return res.status(500).send('Error loading page');
    }

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

// Helper to serve cache-busted admin index.html
const serveAdminHtml = (req, res) => {
  const adminIndexPath = path.join(adminDir, 'index.html');
  fs.readFile(adminIndexPath, 'utf8', (err, html) => {
    if (err) {
      return res.status(500).send('Error loading admin dashboard');
    }

    const dynamicVersion = `${pkg.version || '1.0.0'}-${Date.now()}`;
    let versionedHtml = html
      .replace(/href="(\/admin\/)?css\/admin\.css(\?[^"]*)?"/g, `href="/admin/css/admin.css?v=${dynamicVersion}"`)
      .replace(/src="(\/admin\/)?js\/admin\.js(\?[^"]*)?"/g, `src="/admin/js/admin.js?v=${dynamicVersion}"`);

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.type('html').send(versionedHtml);
  });
};

// Root routes with Subdomain Awareness
app.get('/', (req, res) => {
  if (req.isAdminSubdomain) {
    return serveAdminHtml(req, res);
  }
  serveIndexHtml(req, res);
});

app.get('/index.html', (req, res) => {
  if (req.isAdminSubdomain) {
    return serveAdminHtml(req, res);
  }
  serveIndexHtml(req, res);
});

// Admin CMS Static Assets and Routing (mounted at /admin and root-compatible)
app.use('/admin', express.static(adminDir, {
  dotfiles: 'deny',
  index: false
}));

// If accessed on admin subdomain (admin.petalshotels.com), also serve adminDir assets directly
app.use((req, res, next) => {
  if (req.isAdminSubdomain) {
    return express.static(adminDir, { dotfiles: 'deny', index: false })(req, res, next);
  }
  next();
});

app.get('/admin', serveAdminHtml);
app.get('/admin/', serveAdminHtml);
app.get('/admin/index.html', serveAdminHtml);

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
  if (req.isAdminSubdomain || req.path.startsWith('/admin')) {
    return serveAdminHtml(req, res);
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
    console.log(`🌸 Petals Suites & Hotel Server running on port ${port}`);
    console.log(`🌐 Public Website: http://localhost:${port}`);
    console.log(`🔑 Petals CMS Dashboard: http://localhost:${port}/admin`);
    console.log(`⚡ eZee PMS Gateway & Petals Blog API ready`);
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
