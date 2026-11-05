/**
 * Petals Suites & Hotel - Server Application
 * Hosts Website Frontend, eZee PMS Backend API Gateway & Petals CMS
 */

// Tune libuv worker threadpool to minimize OS process/thread overhead on Hostinger (default is 4)
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '2';

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

// Enable reverse proxy trust for Hostinger, Cloudflare, and Nginx (accurate req.ip & secure cookies)
app.set('trust proxy', 1);

// Prevent technology footprint disclosure
app.disable('x-powered-by');

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

// Hardened CORS Origin Whitelist (blocks untrusted third-party sites from credentialed forgery)
const allowedOrigins = [
  'https://petalshotels.com',
  'https://www.petalshotels.com',
  'https://admin.petalshotels.com',
  process.env.APP_URL,
  process.env.CMS_FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests without Origin (same-origin browser navigation, curl, mobile apps)
    if (!origin) return callback(null, true);
    // Allow local development on localhost or 127.0.0.1 on any port
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Cross-origin request blocked by Petals CORS policy'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Request Body Parsers (25MB limit with inflate:false mitigation against stream crash CVE)
app.use(express.json({ limit: '25mb', inflate: false }));
app.use(express.urlencoded({ extended: true, limit: '25mb', inflate: false }));

// Block access to sensitive files, source code, and configuration
app.use((req, res, next) => {
  let normalizedPath = '';
  try {
    normalizedPath = decodeURIComponent(req.path).toLowerCase();
  } catch (_) {
    return res.status(400).json({ error: 'Malformed request URI' });
  }

  const blockedPatterns = [
    /^\/server(\/|$)/,
    /^\/node_modules(\/|$)/,
    /^\/\..*/, // Any dotfile like .env, .git, .gitignore
    /^\/package(-lock)?\.json$/i,
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

// Crawler & Search Engine Disallowance (Internal System Protection)
app.use((req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  next();
});

// Explicit robots.txt & robot.txt endpoints
app.get(['/robots.txt', '/robot.txt'], (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send('# Petals Internal Management & CMS - Crawler Directives\nUser-agent: *\nDisallow: /\n');
});

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

// In-memory HTML template cache (prevents continuous disk reads and threadpool pressure)
const templateCache = {
  index: { content: null, mtime: 0 },
  blogs: { content: null, mtime: 0 },
  admin: { content: null, mtime: 0 }
};

const getCachedHtml = (filePath, cacheKey, callback) => {
  fs.stat(filePath, (statErr, stats) => {
    if (statErr) return callback(statErr);
    const mtime = stats.mtimeMs;
    const entry = templateCache[cacheKey];
    if (entry && entry.content && entry.mtime === mtime) {
      return callback(null, entry.content);
    }
    fs.readFile(filePath, 'utf8', (readErr, html) => {
      if (readErr) return callback(readErr);
      templateCache[cacheKey] = { content: html, mtime };
      callback(null, html);
    });
  });
};

// Helper to serve cache-busted index.html
const serveIndexHtml = (req, res) => {
  const indexPath = path.join(rootDir, 'index.html');
  getCachedHtml(indexPath, 'index', (err, html) => {
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
  getCachedHtml(blogsPath, 'blogs', (err, html) => {
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
  getCachedHtml(adminIndexPath, 'admin', (err, html) => {
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

// Centralized Security Error Handler
app.use((err, req, res, next) => {
  // CORS rejection
  if (err && err.message && err.message.includes('CORS policy')) {
    return res.status(403).json({ success: false, error: 'Access denied: origin not allowed by Petals CORS policy' });
  }

  // Body parser / JSON syntax error
  if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
    return res.status(400).json({ success: false, error: 'Malformed JSON payload' });
  }

  console.error('[Unhandled Server Exception]', err);

  const isProduction = process.env.NODE_ENV === 'production';
  res.status(err.status || 500).json({
    success: false,
    error: isProduction ? 'An unexpected server error occurred' : (err.message || 'Server error')
  });
});

// Start Server with strict production port enforcement and graceful shutdown
let activeServer = null;
let retryCount = 0;
const MAX_PORT_RETRIES = 3;

const startServer = (port) => {
  const isProduction = process.env.NODE_ENV === 'production' || !!process.env.PORT;
  const targetPort = Number(port);

  const server = app.listen(targetPort, () => {
    activeServer = server;
    retryCount = 0;
    console.log('====================================================');
    console.log(`🌸 Petals Suites & Hotel Server running on port ${targetPort}`);
    console.log(`🌐 Public Website: http://localhost:${targetPort}`);
    console.log(`🔑 Petals CMS Dashboard: http://localhost:${targetPort}/admin`);
    console.log(`⚡ eZee PMS Gateway & Petals Blog API ready`);
    console.log('====================================================');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      if (isProduction) {
        if (retryCount < MAX_PORT_RETRIES) {
          retryCount++;
          console.warn(`⚠️ [Production] Port ${targetPort} is currently busy. Waiting 1.5s for previous instance to release (attempt ${retryCount}/${MAX_PORT_RETRIES})...`);
          setTimeout(() => {
            startServer(targetPort);
          }, 1500);
          return;
        }
        console.error(`🚨 [Production Fatal] Port ${targetPort} is in use after ${MAX_PORT_RETRIES} retries. Exiting cleanly to prevent orphaned instance duplication.`);
        process.exit(1);
      } else {
        console.log(`⚠️ [Dev] Port ${targetPort} is in use, attempting port ${targetPort + 1}...`);
        startServer(targetPort + 1);
      }
    } else {
      console.error('Server failed to start:', err);
      process.exit(1);
    }
  });
};

// Graceful process termination handlers (SIGTERM / SIGINT)
const gracefulShutdown = (signal) => {
  console.log(`\n[Process] Received ${signal}. Initiating graceful shutdown...`);
  if (activeServer) {
    activeServer.close(() => {
      console.log('[Process] HTTP server closed.');
      try {
        const { closeDatabase } = require('./db');
        if (typeof closeDatabase === 'function') {
          closeDatabase();
        }
      } catch (dbErr) {
        console.error('[Process] Error closing database during shutdown:', dbErr.message);
      }
      console.log('[Process] Graceful shutdown complete. Exiting.');
      process.exit(0);
    });

    // Force exit if connections do not drain within 4 seconds
    setTimeout(() => {
      console.error('[Process] Forced shutdown: connections did not drain in time.');
      process.exit(1);
    }, 4000).unref();
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer(Number(PORT));
