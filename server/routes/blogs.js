/**
 * Petals Suites & Hotel - Public Blogs API & Sitemap Generator
 */

const express = require('express');
const router = express.Router();
const { DB } = require('../db');

// Cache sitemap for 1 hour but allow dynamic regeneration
let cachedSitemap = null;
let lastSitemapTime = 0;

/**
 * GET /api/blogs
 * Retrieves published blog articles for petalshotels.com
 */
router.get('/', (req, res) => {
  try {
    const { category, search, limit, offset, sort } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

    let blogs = DB.getPublicBlogs({
      category: category || 'all',
      search: search || '',
      limit: parsedLimit,
      offset: parsedOffset
    });

    // Client-side requested sort order
    if (sort === 'oldest') {
      blogs.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (sort === 'readtime') {
      blogs.sort((a, b) => parseInt(a.readTime, 10) - parseInt(b.readTime, 10));
    } else {
      // Default: latest first
      blogs.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    // Ensure real-time updates when marketing publishes/edits articles
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json({
      success: true,
      count: blogs.length,
      data: blogs
    });
  } catch (err) {
    console.error('[Public Blogs API] Error listing blogs:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve blog articles' });
  }
});

/**
 * GET /api/blogs/:id
 * Retrieves a single published blog article by slug or ID
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { preview, token } = req.query;

    const blog = DB.getBlogByIdOrSlug(id);

    if (!blog) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }

    // If it's a draft, check for valid session or preview token
    if (blog.status === 'draft') {
      let isAuthorizedPreview = false;

      // Check session cookie or token
      const cookies = req.headers.cookie ? require('../middleware/auth').parseCookies(req.headers.cookie) : {};
      const sessionToken = token || cookies['petals_cms_session'];
      if (sessionToken) {
        const session = DB.getSession(sessionToken);
        if (session) isAuthorizedPreview = true;
      }

      if (!isAuthorizedPreview) {
        return res.status(404).json({ success: false, error: 'Article not found or not published' });
      }
    } else {
      // Increment views only for public published views
      DB.incrementBlogViews(blog.id);
    }

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json({
      success: true,
      data: blog
    });
  } catch (err) {
    console.error('[Public Blogs API] Error retrieving blog:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve article details' });
  }
});

/**
 * GET /api/categories
 * Retrieves all public categories with active blog counts
 */
router.get('/categories/all', (req, res) => {
  try {
    const categories = DB.getAllCategories();
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.json({
      success: true,
      data: categories
    });
  } catch (err) {
    console.error('[Public Categories API] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve categories' });
  }
});

/**
 * Helper to build dynamic XML Sitemap
 */
function buildXmlSitemap() {
  const publishedBlogs = DB.getPublicBlogs({ limit: 1000 });
  const baseUrl = 'https://petalshotels.com';
  const now = new Date().toISOString().split('T')[0];

  const staticUrls = [
    { loc: `${baseUrl}/`, changefreq: 'daily', priority: '1.0', lastmod: now },
    { loc: `${baseUrl}/blogs.html`, changefreq: 'daily', priority: '0.9', lastmod: now }
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

  // Static Pages
  for (const page of staticUrls) {
    xml += `  <url>\n`;
    xml += `    <loc>${page.loc}</loc>\n`;
    xml += `    <lastmod>${page.lastmod}</lastmod>\n`;
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += `  </url>\n`;
  }

  // Published Blogs
  for (const blog of publishedBlogs) {
    const blogUrl = `${baseUrl}/blogs.html?article=${encodeURIComponent(blog.slug || blog.id)}`;
    const lastModDate = (blog.updated_at || blog.published_at || blog.created_at || now).split('T')[0];

    xml += `  <url>\n`;
    xml += `    <loc>${blogUrl}</loc>\n`;
    xml += `    <lastmod>${lastModDate}</lastmod>\n`;
    xml += `    <changefreq>weekly</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;

    if (blog.image) {
      const imgUrl = blog.image.startsWith('http') ? blog.image : `${baseUrl}/${blog.image.replace(/^\//, '')}`;
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${imgUrl}</image:loc>\n`;
      xml += `      <image:title><![CDATA[${blog.title}]]></image:title>\n`;
      xml += `      <image:caption><![CDATA[${blog.excerpt || blog.title}]]></image:caption>\n`;
      xml += `    </image:image>\n`;
    }

    xml += `  </url>\n`;
  }

  xml += `</urlset>`;
  return xml;
}

/**
 * Invalidate cached sitemap so changes reflect immediately
 */
function invalidateSitemapCache() {
  cachedSitemap = null;
  lastSitemapTime = 0;
}

/**
 * GET /api/blogs/sitemap.xml
 */
router.get('/sitemap.xml', (req, res) => {
  try {
    const now = Date.now();
    // Cache for 60 seconds
    if (!cachedSitemap || (now - lastSitemapTime > 60000)) {
      cachedSitemap = buildXmlSitemap();
      lastSitemapTime = now;
    }
    res.setHeader('Content-Type', 'application/xml');
    res.send(cachedSitemap);
  } catch (err) {
    console.error('[Sitemap Error]', err);
    res.status(500).send('Error generating sitemap');
  }
});

module.exports = {
  router,
  buildXmlSitemap,
  invalidateSitemapCache
};
