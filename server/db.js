/**
 * Petals Suites & Hotel - CMS Database Layer
 * High-performance, zero-external-dependency embedded database
 * Built on node:sqlite with file-based JSON fallback and WAL mode
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { stripHtml, sanitizeHtml } = require('./utils/sanitize');

// Data file paths (configurable via CMS_DATA_DIR / CMS_DB_FILE for persistent storage across versioned deployments)
const DATA_DIR = process.env.CMS_DATA_DIR ? path.resolve(process.env.CMS_DATA_DIR) : path.join(__dirname, 'data');
const DB_FILE = process.env.CMS_DB_FILE ? path.resolve(process.env.CMS_DB_FILE) : path.join(DATA_DIR, 'petals_cms.db');
const JSON_BACKUP_FILE = path.join(DATA_DIR, 'petals_cms_backup.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Password hashing utility with scrypt and timing-safe comparison
const toDb = (v) => v === undefined ? null : v;

function hashPassword(password, salt = null) {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { salt: actualSalt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  const bufA = Buffer.from(hash, 'hex');
  const bufB = Buffer.from(expectedHash, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Generate secure random preview / session tokens
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

// Initialize SQLite database
let db = null;
let useSqlite = false;

try {
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(DB_FILE);
  // Enable WAL mode for high concurrency
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec('PRAGMA synchronous = NORMAL;');
  useSqlite = true;
  console.log('[CMS Database] Initialized embedded SQLite database with WAL mode:', DB_FILE);
} catch (err) {
  console.warn('[CMS Database] node:sqlite not available on this Node version. Falling back to persistent JSON storage:', err.message);
  useSqlite = false;
}

// In-memory / JSON store fallback
let memoryStore = {
  users: [],
  categories: [],
  blogs: [],
  media: [],
  sessions: [],
  dev_test_logs: [],
  activity_logs: []
};

function saveJsonStore() {
  try {
    fs.writeFileSync(JSON_BACKUP_FILE, JSON.stringify(memoryStore, null, 2), 'utf8');
  } catch (err) {
    console.error('[CMS Database] Failed to write JSON backup:', err);
  }
}

function loadJsonStore() {
  if (fs.existsSync(JSON_BACKUP_FILE)) {
    try {
      const data = fs.readFileSync(JSON_BACKUP_FILE, 'utf8');
      memoryStore = JSON.parse(data);
    } catch (err) {
      console.error('[CMS Database] Failed to read JSON backup:', err);
    }
  }
}

// Schema setup
function initSchema() {
  if (useSqlite) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'editor',
        active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT DEFAULT '',
        display_order INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS blogs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        excerpt TEXT DEFAULT '',
        content TEXT NOT NULL,
        featured_image TEXT DEFAULT '',
        featured_image_alt TEXT DEFAULT '',
        category_id INTEGER,
        category TEXT NOT NULL,
        author TEXT NOT NULL DEFAULT 'Petals Hospitality Editorial',
        author_role TEXT NOT NULL DEFAULT 'Corporate Stays Desk',
        status TEXT NOT NULL DEFAULT 'draft',
        published_at TEXT,
        display_date TEXT,
        read_time TEXT DEFAULT '5 min read',
        tags TEXT DEFAULT '[]',
        seo_title TEXT DEFAULT '',
        seo_description TEXT DEFAULT '',
        seo_keywords TEXT DEFAULT '',
        canonical_url TEXT DEFAULT '',
        views INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS media (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        url TEXT NOT NULL,
        alt_text TEXT DEFAULT '',
        width INTEGER DEFAULT 0,
        height INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS dev_test_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL,
        summary TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        details_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT NOT NULL,
        user_name TEXT NOT NULL,
        user_role TEXT NOT NULL,
        action TEXT NOT NULL,
        action_label TEXT NOT NULL,
        blog_id TEXT,
        blog_title TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL
      );
    `);
  } else {
    loadJsonStore();
  }

  seedInitialData();
}

// Auto-seed initial admin, categories, and existing blogs
function seedInitialData() {
  const now = new Date().toISOString();

  // 1. Seed Initial Users (dev, admin, marketing)
  const initialAccounts = [
    {
      username: 'dev',
      email: process.env.CMS_DEV_EMAIL || 'dev@petalshotels.com',
      password: process.env.CMS_DEV_PASSWORD || 'PetalsDev2026!',
      full_name: 'Lead Developer',
      role: 'dev'
    },
    {
      username: process.env.CMS_ADMIN_USER || 'admin',
      email: process.env.CMS_ADMIN_EMAIL || 'admin@petalshotels.com',
      password: process.env.CMS_ADMIN_PASSWORD || 'PetalsAdmin2026!',
      full_name: 'Petals Administrator',
      role: 'admin'
    },
    {
      username: 'marketing',
      email: process.env.CMS_MARKETING_EMAIL || 'marketing@petalshotels.com',
      password: process.env.CMS_MARKETING_PASSWORD || 'PetalsMarket2026!',
      full_name: 'Marketing Desk',
      role: 'marketing'
    }
  ];

  for (const acc of initialAccounts) {
    let exists = false;
    if (useSqlite) {
      const row = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(acc.username, acc.email);
      exists = !!row;
    } else {
      exists = memoryStore.users.some(u => u.username === acc.username || u.email === acc.email);
    }

    if (!exists) {
      const { hash, salt } = hashPassword(acc.password);
      if (useSqlite) {
        db.prepare(`
          INSERT INTO users (username, email, password_hash, salt, full_name, role, active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
        `).run(acc.username, acc.email, hash, salt, acc.full_name, acc.role, now, now);
      } else {
        const nextId = (memoryStore.users.reduce((max, u) => Math.max(max, u.id), 0) || 0) + 1;
        memoryStore.users.push({
          id: nextId,
          username: acc.username,
          email: acc.email,
          password_hash: hash,
          salt,
          full_name: acc.full_name,
          role: acc.role,
          active: 1,
          created_at: now,
          updated_at: now
        });
        saveJsonStore();
      }
      console.log(`[CMS Database] Created default ${acc.role} user: ${acc.username} (${acc.email})`);
    }
  }

  // 2. Seed Default Categories
  let categoriesCount = 0;
  if (useSqlite) {
    const row = db.prepare('SELECT COUNT(*) as count FROM categories').get();
    categoriesCount = row.count;
  } else {
    categoriesCount = memoryStore.categories.length;
  }

  if (categoriesCount === 0) {
    const defaultCategories = [
      { name: 'Business Travel', slug: 'business-travel', description: 'Curated business travel tips, corporate stays, and productivity guides.', order: 1 },
      { name: 'Luxury Stays', slug: 'luxury-stays', description: 'Experience boutique comfort, suites, and bespoke hospitality in North Bangalore.', order: 2 },
      { name: 'Corporate Guide', slug: 'corporate-guide', description: 'Executive itineraries, conference stays, and corporate accommodation guides.', order: 3 },
      { name: 'Work & Comfort', slug: 'work-and-comfort', description: 'Balancing focused workspaces, high-speed connectivity, and restorative rest.', order: 4 },
      { name: 'Local Guides', slug: 'local-guides', description: 'Discover dining, shopping, breweries, and attractions around Manyata Tech Park.', order: 5 }
    ];

    if (useSqlite) {
      const stmt = db.prepare(`
        INSERT INTO categories (name, slug, description, display_order, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const cat of defaultCategories) {
        stmt.run(cat.name, cat.slug, cat.description, cat.order, now);
      }
    } else {
      let idCounter = 1;
      for (const cat of defaultCategories) {
        memoryStore.categories.push({ id: idCounter++, ...cat, created_at: now });
      }
      saveJsonStore();
    }
    console.log('[CMS Database] Seeded default categories');
  }

  // 3. Migrate Existing Blogs from js/blogs-data.js
  let blogsCount = 0;
  if (useSqlite) {
    const row = db.prepare('SELECT COUNT(*) as count FROM blogs').get();
    blogsCount = row.count;
  } else {
    blogsCount = memoryStore.blogs.length;
  }

  if (blogsCount === 0) {
    try {
      const blogsDataPath = path.join(__dirname, '..', 'js', 'blogs-data.js');
      if (fs.existsSync(blogsDataPath)) {
        const fileContent = fs.readFileSync(blogsDataPath, 'utf8');
        const vm = require('vm');
        const sandbox = {};
        vm.runInNewContext(fileContent, sandbox);

        if (Array.isArray(sandbox.BLOGS_DATA) && sandbox.BLOGS_DATA.length > 0) {
          if (useSqlite) {
            const stmt = db.prepare(`
              INSERT INTO blogs (
                id, title, slug, excerpt, content, featured_image, featured_image_alt,
                category, author, author_role, status, published_at, display_date,
                read_time, tags, seo_title, seo_description, seo_keywords,
                canonical_url, views, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const blog of sandbox.BLOGS_DATA) {
              const slug = blog.id;
              const tagsJson = JSON.stringify(blog.tags || []);
              const pubDate = blog.date ? new Date(blog.date).toISOString() : now;
              const dispDate = blog.displayDate || blog.date;

              stmt.run(
                slug,
                blog.title,
                slug,
                blog.excerpt || '',
                blog.content || '',
                blog.image || '',
                blog.title,
                blog.category || 'Business Travel',
                blog.author || 'Petals Hospitality Editorial',
                blog.authorRole || 'Corporate Stays Desk',
                'published',
                pubDate,
                dispDate,
                blog.readTime || '5 min read',
                tagsJson,
                blog.title,
                blog.excerpt || '',
                (blog.tags || []).join(', '),
                `https://petalshotels.com/blogs.html?article=${slug}`,
                0,
                pubDate,
                now
              );
            }
          } else {
            for (const blog of sandbox.BLOGS_DATA) {
              const slug = blog.id;
              const pubDate = blog.date ? new Date(blog.date).toISOString() : now;
              memoryStore.blogs.push({
                id: slug,
                title: blog.title,
                slug,
                excerpt: blog.excerpt || '',
                content: blog.content || '',
                featured_image: blog.image || '',
                featured_image_alt: blog.title,
                category: blog.category || 'Business Travel',
                author: blog.author || 'Petals Hospitality Editorial',
                author_role: blog.authorRole || 'Corporate Stays Desk',
                status: 'published',
                published_at: pubDate,
                display_date: blog.displayDate || blog.date,
                read_time: blog.readTime || '5 min read',
                tags: blog.tags || [],
                seo_title: blog.title,
                seo_description: blog.excerpt || '',
                seo_keywords: (blog.tags || []).join(', '),
                canonical_url: `https://petalshotels.com/blogs.html?article=${slug}`,
                views: 0,
                created_at: pubDate,
                updated_at: now
              });
            }
            saveJsonStore();
          }
          console.log(`[CMS Database] Migrated ${sandbox.BLOGS_DATA.length} existing articles to database!`);
        }
      }
    } catch (err) {
      console.warn('[CMS Database] Warning during blogs migration:', err.message);
    }
  }
}

// Initialise schema immediately on module load
initSchema();

/* ==========================================================================
   Database Operations API
   ========================================================================== */

const DB = {
  // ---- User Operations ----
  getUserByUsernameOrEmail(identifier) {
    if (useSqlite) {
      return db.prepare(`
        SELECT * FROM users WHERE (LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)) AND active = 1
      `).get(identifier, identifier);
    }
    const clean = identifier.toLowerCase();
    return memoryStore.users.find(u => (u.username.toLowerCase() === clean || u.email.toLowerCase() === clean) && u.active === 1) || null;
  },

  getUserById(id) {
    if (useSqlite) {
      return db.prepare('SELECT id, username, email, full_name, role, active, created_at, updated_at FROM users WHERE id = ?').get(id);
    }
    const u = memoryStore.users.find(x => x.id === Number(id));
    if (!u) return null;
    const { password_hash, salt, ...safeUser } = u;
    return safeUser;
  },

  getAllUsers() {
    if (useSqlite) {
      return db.prepare('SELECT id, username, email, full_name, role, active, created_at, updated_at FROM users ORDER BY id ASC').all();
    }
    return memoryStore.users.map(({ password_hash, salt, ...safeUser }) => safeUser);
  },

  createUser({ username, email, password, full_name, role = 'editor' }) {
    const { hash, salt } = hashPassword(password);
    const now = new Date().toISOString();

    if (useSqlite) {
      const stmt = db.prepare(`
        INSERT INTO users (username, email, password_hash, salt, full_name, role, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
      `);
      const result = stmt.run(username.trim(), email.trim().toLowerCase(), hash, salt, full_name.trim(), role, now, now);
      return this.getUserById(result.lastInsertRowid);
    } else {
      const newId = memoryStore.users.length ? Math.max(...memoryStore.users.map(u => u.id)) + 1 : 1;
      const newUser = {
        id: newId,
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password_hash: hash,
        salt,
        full_name: full_name.trim(),
        role,
        active: 1,
        created_at: now,
        updated_at: now
      };
      memoryStore.users.push(newUser);
      saveJsonStore();
      return this.getUserById(newId);
    }
  },

  updateUser(id, { full_name, email, role, active, password }) {
    const now = new Date().toISOString();
    let user = this.getUserById(id);
    if (!user) return null;

    if (useSqlite) {
      if (password) {
        const { hash, salt } = hashPassword(password);
        db.prepare(`
          UPDATE users SET full_name = COALESCE(?, full_name), email = COALESCE(?, email),
          role = COALESCE(?, role), active = COALESCE(?, active), password_hash = ?, salt = ?, updated_at = ?
          WHERE id = ?
        `).run(toDb(full_name), toDb(email), toDb(role), toDb(active), hash, salt, now, id);
      } else {
        db.prepare(`
          UPDATE users SET full_name = COALESCE(?, full_name), email = COALESCE(?, email),
          role = COALESCE(?, role), active = COALESCE(?, active), updated_at = ?
          WHERE id = ?
        `).run(toDb(full_name), toDb(email), toDb(role), toDb(active), now, id);
      }
      return this.getUserById(id);
    } else {
      const target = memoryStore.users.find(u => u.id === Number(id));
      if (!target) return null;
      if (full_name !== undefined) target.full_name = full_name;
      if (email !== undefined) target.email = email;
      if (role !== undefined) target.role = role;
      if (active !== undefined) target.active = active;
      if (password) {
        const { hash, salt } = hashPassword(password);
        target.password_hash = hash;
        target.salt = salt;
      }
      target.updated_at = now;
      saveJsonStore();
      return this.getUserById(id);
    }
  },

  deleteUser(id) {
    if (useSqlite) {
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
    } else {
      memoryStore.users = memoryStore.users.filter(u => u.id !== Number(id));
      saveJsonStore();
    }
    return true;
  },

  // ---- Session Management ----
  createSession(userId, role, days = 7) {
    const token = generateToken(32);
    const expiresAt = Date.now() + (days * 24 * 60 * 60 * 1000);
    const now = new Date().toISOString();

    if (useSqlite) {
      db.prepare('INSERT INTO sessions (token, user_id, role, expires_at, created_at) VALUES (?, ?, ?, ?, ?)').run(
        token, userId, role, expiresAt, now
      );
    } else {
      memoryStore.sessions.push({ token, user_id: userId, role, expires_at: expiresAt, created_at: now });
      saveJsonStore();
    }
    return { token, expiresAt };
  },

  getSession(token) {
    if (!token) return null;
    let session = null;
    if (useSqlite) {
      session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
    } else {
      session = memoryStore.sessions.find(s => s.token === token) || null;
    }

    if (!session) return null;
    if (session.expires_at < Date.now()) {
      this.deleteSession(token);
      return null;
    }

    const user = this.getUserById(session.user_id);
    if (!user || !user.active) {
      this.deleteSession(token);
      return null;
    }

    return { ...session, user };
  },

  deleteSession(token) {
    if (useSqlite) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    } else {
      memoryStore.sessions = memoryStore.sessions.filter(s => s.token !== token);
      saveJsonStore();
    }
    return true;
  },

  deleteSessionsByUserId(userId, exceptToken = null) {
    if (!userId) return false;
    if (useSqlite) {
      if (exceptToken) {
        db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(userId, exceptToken);
      } else {
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
      }
    } else {
      memoryStore.sessions = memoryStore.sessions.filter(s => s.user_id !== userId || (exceptToken && s.token === exceptToken));
      saveJsonStore();
    }
    return true;
  },

  // ---- Category Management ----
  getAllCategories() {
    if (useSqlite) {
      const categories = db.prepare('SELECT * FROM categories ORDER BY display_order ASC, name ASC').all();
      // Count blogs per category
      const counts = db.prepare(`
        SELECT category, COUNT(*) as blog_count FROM blogs GROUP BY category
      `).all();
      const countMap = {};
      counts.forEach(c => { countMap[c.category] = c.blog_count; });

      return categories.map(cat => ({
        ...cat,
        blog_count: countMap[cat.name] || 0
      }));
    } else {
      return memoryStore.categories.map(cat => ({
        ...cat,
        blog_count: memoryStore.blogs.filter(b => b.category === cat.name).length
      }));
    }
  },

  getCategoryById(id) {
    if (useSqlite) {
      return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    }
    return memoryStore.categories.find(c => c.id === Number(id)) || null;
  },

  createCategory({ name, slug, description = '', display_order = 0 }) {
    const now = new Date().toISOString();
    const finalSlug = (slug || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    if (useSqlite) {
      const stmt = db.prepare(`
        INSERT INTO categories (name, slug, description, display_order, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      const result = stmt.run(name.trim(), finalSlug, description.trim(), display_order, now);
      return this.getCategoryById(result.lastInsertRowid);
    } else {
      const newId = memoryStore.categories.length ? Math.max(...memoryStore.categories.map(c => c.id)) + 1 : 1;
      const cat = { id: newId, name: name.trim(), slug: finalSlug, description: description.trim(), display_order, created_at: now };
      memoryStore.categories.push(cat);
      saveJsonStore();
      return cat;
    }
  },

  updateCategory(id, { name, slug, description, display_order }) {
    const existing = this.getCategoryById(id);
    if (!existing) return null;

    const finalSlug = slug ? slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : existing.slug;

    if (useSqlite) {
      db.prepare(`
        UPDATE categories SET
          name = COALESCE(?, name),
          slug = COALESCE(?, slug),
          description = COALESCE(?, description),
          display_order = COALESCE(?, display_order)
        WHERE id = ?
      `).run(toDb(name), toDb(finalSlug), toDb(description), toDb(display_order), id);
      return this.getCategoryById(id);
    } else {
      const cat = memoryStore.categories.find(c => c.id === Number(id));
      if (!cat) return null;
      if (name !== undefined) cat.name = name;
      if (slug !== undefined) cat.slug = finalSlug;
      if (description !== undefined) cat.description = description;
      if (display_order !== undefined) cat.display_order = display_order;
      saveJsonStore();
      return cat;
    }
  },

  deleteCategory(id) {
    if (useSqlite) {
      db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    } else {
      memoryStore.categories = memoryStore.categories.filter(c => c.id !== Number(id));
      saveJsonStore();
    }
    return true;
  },

  // ---- Blog Operations ----
  getPublicBlogs({ category = 'all', search = '', limit = 100, offset = 0 } = {}) {
    let blogs = [];
    if (useSqlite) {
      let query = "SELECT * FROM blogs WHERE status = 'published'";
      const params = [];

      if (category && category !== 'all') {
        query += " AND LOWER(category) = LOWER(?)";
        params.push(category);
      }

      if (search && search.trim()) {
        query += " AND (title LIKE ? OR excerpt LIKE ? OR content LIKE ? OR tags LIKE ?)";
        const pattern = `%${search.trim()}%`;
        params.push(pattern, pattern, pattern, pattern);
      }

      query += " ORDER BY published_at DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      blogs = db.prepare(query).all(...params);
    } else {
      blogs = memoryStore.blogs.filter(b => b.status === 'published');
      if (category && category !== 'all') {
        blogs = blogs.filter(b => b.category.toLowerCase() === category.toLowerCase());
      }
      if (search && search.trim()) {
        const q = search.toLowerCase();
        blogs = blogs.filter(b => 
          b.title.toLowerCase().includes(q) ||
          b.excerpt.toLowerCase().includes(q) ||
          (Array.isArray(b.tags) && b.tags.some(t => t.toLowerCase().includes(q)))
        );
      }
      blogs.sort((a, b) => new Date(b.published_at || b.date) - new Date(a.published_at || a.date));
      blogs = blogs.slice(offset, offset + limit);
    }

    return blogs.map(this.formatBlogForOutput);
  },

  getAdminBlogs({ status = 'all', category = 'all', search = '' } = {}) {
    let blogs = [];
    if (useSqlite) {
      let query = "SELECT * FROM blogs WHERE 1=1";
      const params = [];

      if (status && status !== 'all') {
        query += " AND status = ?";
        params.push(status);
      }

      if (category && category !== 'all') {
        query += " AND LOWER(category) = LOWER(?)";
        params.push(category);
      }

      if (search && search.trim()) {
        query += " AND (title LIKE ? OR slug LIKE ? OR excerpt LIKE ? OR author LIKE ?)";
        const pattern = `%${search.trim()}%`;
        params.push(pattern, pattern, pattern, pattern);
      }

      query += " ORDER BY updated_at DESC, created_at DESC";
      blogs = db.prepare(query).all(...params);
    } else {
      blogs = [...memoryStore.blogs];
      if (status && status !== 'all') {
        blogs = blogs.filter(b => b.status === status);
      }
      if (category && category !== 'all') {
        blogs = blogs.filter(b => b.category.toLowerCase() === category.toLowerCase());
      }
      if (search && search.trim()) {
        const q = search.toLowerCase();
        blogs = blogs.filter(b =>
          b.title.toLowerCase().includes(q) ||
          b.slug.toLowerCase().includes(q) ||
          b.excerpt.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q)
        );
      }
      blogs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    }

    return blogs.map(this.formatBlogForOutput);
  },

  getBlogByIdOrSlug(idOrSlug) {
    if (!idOrSlug) return null;
    let blog = null;
    if (useSqlite) {
      blog = db.prepare('SELECT * FROM blogs WHERE id = ? OR slug = ?').get(idOrSlug, idOrSlug);
    } else {
      blog = memoryStore.blogs.find(b => b.id === idOrSlug || b.slug === idOrSlug) || null;
    }
    return blog ? this.formatBlogForOutput(blog) : null;
  },

  getDraftsCount() {
    if (useSqlite) {
      return db.prepare("SELECT COUNT(*) as count FROM blogs WHERE status = 'draft'").get().count;
    }
    return memoryStore.blogs.filter(b => b.status === 'draft').length;
  },

  getDraftBlogs() {
    if (useSqlite) {
      return db.prepare("SELECT * FROM blogs WHERE status = 'draft' ORDER BY updated_at DESC").all().map(this.formatBlogForOutput);
    }
    return memoryStore.blogs.filter(b => b.status === 'draft').sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).map(this.formatBlogForOutput);
  },

  createBlog(data) {
    const status = data.status || 'draft';

    // Enforcement: Maximum 5 drafts permitted to protect database integrity
    if (status === 'draft') {
      const MAX_DRAFTS = 5;
      const currentDraftsCount = this.getDraftsCount();
      if (currentDraftsCount >= MAX_DRAFTS) {
        const err = new Error(`Draft limit reached. A maximum of ${MAX_DRAFTS} unpublished drafts are allowed. Please publish or delete an existing draft before saving a new one.`);
        err.code = 'DRAFT_LIMIT_REACHED';
        err.status = 400;
        throw err;
      }
    }

    const now = new Date().toISOString();
    const rawTitle = (data.title || 'Untitled Article').trim();
    const title = stripHtml(rawTitle);
    const excerpt = stripHtml(data.excerpt || '');
    const content = sanitizeHtml(data.content || '');
    const author = stripHtml(data.author || 'Petals Hospitality Editorial');
    const author_role = stripHtml(data.author_role || 'Corporate Stays Desk');
    const category = stripHtml(data.category || 'Business Travel');
    const seo_title = stripHtml(data.seo_title || title);
    const seo_description = stripHtml(data.seo_description || excerpt);

    let slug = (data.slug || title).toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    if (!slug) slug = `article-${Date.now()}`;

    // Ensure slug uniqueness
    slug = this.getUniqueSlug(slug);

    const id = slug;
    const isPublished = status === 'published';
    const publishedAt = isPublished ? (data.published_at || now) : null;
    const displayDate = publishedAt ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(publishedAt)) : 'Draft';
    const tagsArray = Array.isArray(data.tags) ? data.tags.map(t => stripHtml(String(t))) : (typeof data.tags === 'string' ? data.tags.split(',').map(s => stripHtml(s.trim())).filter(Boolean) : []);
    const tagsJson = JSON.stringify(tagsArray);
    const seo_keywords = stripHtml(data.seo_keywords || tagsArray.join(', '));

    // Calculate reading time (~200 wpm)
    const wordCount = content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    const calculatedReadTime = `${Math.max(1, Math.ceil(wordCount / 200))} min read`;

    const blogRecord = {
      id,
      title,
      slug,
      excerpt,
      content,
      featured_image: data.featured_image || '',
      featured_image_alt: stripHtml(data.featured_image_alt || title),
      category_id: data.category_id || null,
      category,
      author,
      author_role,
      status,
      published_at: publishedAt,
      display_date: displayDate,
      read_time: data.read_time || calculatedReadTime,
      tags: tagsJson,
      seo_title,
      seo_description,
      seo_keywords,
      canonical_url: data.canonical_url || `https://petalshotels.com/blogs.html?article=${slug}`,
      views: 0,
      created_at: now,
      updated_at: now
    };

    if (useSqlite) {
      db.prepare(`
        INSERT INTO blogs (
          id, title, slug, excerpt, content, featured_image, featured_image_alt,
          category_id, category, author, author_role, status, published_at, display_date,
          read_time, tags, seo_title, seo_description, seo_keywords,
          canonical_url, views, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?
        )
      `).run(
        blogRecord.id, blogRecord.title, blogRecord.slug, blogRecord.excerpt, blogRecord.content,
        blogRecord.featured_image, blogRecord.featured_image_alt, blogRecord.category_id, blogRecord.category,
        blogRecord.author, blogRecord.author_role, blogRecord.status, blogRecord.published_at, blogRecord.display_date,
        blogRecord.read_time, blogRecord.tags, blogRecord.seo_title, blogRecord.seo_description, blogRecord.seo_keywords,
        blogRecord.canonical_url, blogRecord.views, blogRecord.created_at, blogRecord.updated_at
      );
    } else {
      memoryStore.blogs.push({ ...blogRecord, tags: tagsArray });
      saveJsonStore();
    }

    return this.getBlogByIdOrSlug(id);
  },

  updateBlog(id, data) {
    const existing = this.getBlogByIdOrSlug(id);
    if (!existing) return null;

    // If unpublishing from published to draft, enforce maximum 5 drafts
    if (data.status === 'draft' && existing.status !== 'draft') {
      const MAX_DRAFTS = 5;
      const currentDraftsCount = this.getDraftsCount();
      if (currentDraftsCount >= MAX_DRAFTS) {
        const err = new Error(`Draft limit reached. A maximum of ${MAX_DRAFTS} unpublished drafts are allowed. Please publish or delete an existing draft before unpublishing this one.`);
        err.code = 'DRAFT_LIMIT_REACHED';
        err.status = 400;
        throw err;
      }
    }

    const now = new Date().toISOString();
    const isNowPublished = data.status === 'published';
    const wasPublished = existing.status === 'published';

    let publishedAt = existing.published_at;
    if (isNowPublished && !wasPublished && !data.published_at) {
      publishedAt = now;
    } else if (data.published_at) {
      publishedAt = data.published_at;
    }

    const displayDate = publishedAt ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(publishedAt)) : 'Draft';

    const sanitizedTitle = data.title !== undefined ? stripHtml(data.title) : undefined;
    const sanitizedExcerpt = data.excerpt !== undefined ? stripHtml(data.excerpt) : undefined;
    const sanitizedContent = data.content !== undefined ? sanitizeHtml(data.content) : undefined;
    const sanitizedAuthor = data.author !== undefined ? stripHtml(data.author) : undefined;
    const sanitizedAuthorRole = data.author_role !== undefined ? stripHtml(data.author_role) : undefined;
    const sanitizedCategory = data.category !== undefined ? stripHtml(data.category) : undefined;
    const sanitizedSeoTitle = data.seo_title !== undefined ? stripHtml(data.seo_title) : undefined;
    const sanitizedSeoDesc = data.seo_description !== undefined ? stripHtml(data.seo_description) : undefined;
    const sanitizedImageAlt = data.featured_image_alt !== undefined ? stripHtml(data.featured_image_alt) : undefined;

    let tagsJson = existing.tags ? JSON.stringify(existing.tags) : '[]';
    let tagsArray = existing.tags || [];
    if (data.tags !== undefined) {
      tagsArray = Array.isArray(data.tags) ? data.tags.map(t => stripHtml(String(t))) : (typeof data.tags === 'string' ? data.tags.split(',').map(s => stripHtml(s.trim())).filter(Boolean) : []);
      tagsJson = JSON.stringify(tagsArray);
    }
    const sanitizedSeoKeywords = data.seo_keywords !== undefined ? stripHtml(data.seo_keywords) : (data.tags !== undefined ? tagsArray.join(', ') : undefined);

    // Auto update reading time if content changed
    let readTime = data.read_time || existing.read_time;
    if (sanitizedContent && !data.read_time) {
      const wordCount = sanitizedContent.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
      readTime = `${Math.max(1, Math.ceil(wordCount / 200))} min read`;
    }

    if (useSqlite) {
      db.prepare(`
        UPDATE blogs SET
          title = COALESCE(?, title),
          excerpt = COALESCE(?, excerpt),
          content = COALESCE(?, content),
          featured_image = COALESCE(?, featured_image),
          featured_image_alt = COALESCE(?, featured_image_alt),
          category_id = COALESCE(?, category_id),
          category = COALESCE(?, category),
          author = COALESCE(?, author),
          author_role = COALESCE(?, author_role),
          status = COALESCE(?, status),
          published_at = ?,
          display_date = ?,
          read_time = COALESCE(?, read_time),
          tags = COALESCE(?, tags),
          seo_title = COALESCE(?, seo_title),
          seo_description = COALESCE(?, seo_description),
          seo_keywords = COALESCE(?, seo_keywords),
          canonical_url = COALESCE(?, canonical_url),
          updated_at = ?
        WHERE id = ?
      `).run(
        toDb(sanitizedTitle), toDb(sanitizedExcerpt), toDb(sanitizedContent), toDb(data.featured_image), toDb(sanitizedImageAlt),
        toDb(data.category_id), toDb(sanitizedCategory), toDb(sanitizedAuthor), toDb(sanitizedAuthorRole), toDb(data.status),
        toDb(publishedAt), toDb(displayDate), toDb(readTime), toDb(tagsJson), toDb(sanitizedSeoTitle), toDb(sanitizedSeoDesc),
        toDb(sanitizedSeoKeywords), toDb(data.canonical_url), now, id
      );
    } else {
      const target = memoryStore.blogs.find(b => b.id === id);
      if (!target) return null;
      Object.assign(target, {
        title: sanitizedTitle !== undefined ? sanitizedTitle : target.title,
        excerpt: sanitizedExcerpt !== undefined ? sanitizedExcerpt : target.excerpt,
        content: sanitizedContent !== undefined ? sanitizedContent : target.content,
        featured_image: data.featured_image !== undefined ? data.featured_image : target.featured_image,
        featured_image_alt: sanitizedImageAlt !== undefined ? sanitizedImageAlt : target.featured_image_alt,
        category_id: data.category_id !== undefined ? data.category_id : target.category_id,
        category: sanitizedCategory !== undefined ? sanitizedCategory : target.category,
        author: sanitizedAuthor !== undefined ? sanitizedAuthor : target.author,
        author_role: sanitizedAuthorRole !== undefined ? sanitizedAuthorRole : target.author_role,
        status: data.status !== undefined ? data.status : target.status,
        published_at: publishedAt,
        display_date: displayDate,
        read_time: readTime,
        tags: data.tags !== undefined ? tagsArray : target.tags,
        seo_title: sanitizedSeoTitle !== undefined ? sanitizedSeoTitle : target.seo_title,
        seo_description: sanitizedSeoDesc !== undefined ? sanitizedSeoDesc : target.seo_description,
        seo_keywords: sanitizedSeoKeywords !== undefined ? sanitizedSeoKeywords : target.seo_keywords,
        seo_keywords: data.seo_keywords !== undefined ? data.seo_keywords : target.seo_keywords,
        canonical_url: data.canonical_url !== undefined ? data.canonical_url : target.canonical_url,
        updated_at: now
      });
      saveJsonStore();
    }

    return this.getBlogByIdOrSlug(id);
  },

  duplicateBlog(id) {
    const orig = this.getBlogByIdOrSlug(id);
    if (!orig) return null;

    const copyData = {
      ...orig,
      title: `${orig.title} (Copy)`,
      slug: this.getUniqueSlug(`${orig.slug}-copy`),
      status: 'draft',
      published_at: null,
      views: 0
    };

    return this.createBlog(copyData);
  },

  deleteBlog(id) {
    if (useSqlite) {
      db.prepare('DELETE FROM blogs WHERE id = ?').run(id);
    } else {
      memoryStore.blogs = memoryStore.blogs.filter(b => b.id !== id);
      saveJsonStore();
    }
    return true;
  },

  incrementBlogViews(id) {
    if (useSqlite) {
      db.prepare('UPDATE blogs SET views = views + 1 WHERE id = ? OR slug = ?').run(id, id);
    } else {
      const b = memoryStore.blogs.find(x => x.id === id || x.slug === id);
      if (b) b.views = (b.views || 0) + 1;
    }
  },

  getUniqueSlug(baseSlug, currentId = null) {
    let slug = baseSlug;
    let count = 1;
    while (true) {
      let existing = null;
      if (useSqlite) {
        existing = db.prepare("SELECT id FROM blogs WHERE slug = ? AND id != COALESCE(?, '')").get(slug, currentId || '');
      } else {
        existing = memoryStore.blogs.find(b => b.slug === slug && b.id !== currentId);
      }
      if (!existing) break;
      slug = `${baseSlug}-${count++}`;
    }
    return slug;
  },

  // Helper to format blog object for standard API responses
  formatBlogForOutput(b) {
    let tags = [];
    if (typeof b.tags === 'string') {
      try { tags = JSON.parse(b.tags); } catch (_) { tags = []; }
    } else if (Array.isArray(b.tags)) {
      tags = b.tags;
    }

    return {
      id: b.id,
      slug: b.slug,
      title: b.title,
      category: b.category,
      category_id: b.category_id,
      date: b.published_at ? b.published_at.split('T')[0] : (b.created_at ? b.created_at.split('T')[0] : ''),
      published_at: b.published_at,
      displayDate: b.display_date || (b.published_at ? b.published_at.split('T')[0] : 'Draft'),
      readTime: b.read_time || '5 min read',
      image: b.featured_image || '',
      featured_image: b.featured_image || '',
      featured_image_alt: b.featured_image_alt || b.title,
      author: b.author || 'Petals Hospitality Editorial',
      authorRole: b.author_role || 'Corporate Stays Desk',
      tags,
      excerpt: b.excerpt || '',
      content: b.content || '',
      status: b.status,
      seo_title: b.seo_title || b.title,
      seo_description: b.seo_description || b.excerpt,
      seo_keywords: b.seo_keywords || '',
      canonical_url: b.canonical_url || '',
      views: b.views || 0,
      created_at: b.created_at,
      updated_at: b.updated_at
    };
  },

  // ---- Media Operations ----
  getAllMedia() {
    if (useSqlite) {
      return db.prepare('SELECT * FROM media ORDER BY created_at DESC').all();
    }
    return [...memoryStore.media].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  getMediaCount() {
    if (useSqlite) {
      return db.prepare('SELECT COUNT(*) as count FROM media').get().count;
    }
    return memoryStore.media.length;
  },

  getMediaById(id) {
    if (useSqlite) {
      return db.prepare('SELECT * FROM media WHERE id = ?').get(id);
    }
    return memoryStore.media.find(m => m.id === id) || null;
  },

  createMedia({ filename, original_name, mime_type, size, url, alt_text = '', width = 0, height = 0 }) {
    // Defense-in-depth: Enforce 75-item media library limit to prevent storage & DB exploitation
    if (this.getMediaCount() >= 75) {
      throw new Error('Media library storage limit reached (75/75 photos). Please delete existing photos before uploading new ones.');
    }

    const id = generateToken(16);
    const now = new Date().toISOString();

    if (useSqlite) {
      db.prepare(`
        INSERT INTO media (id, filename, original_name, mime_type, size, url, alt_text, width, height, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, filename, original_name, mime_type, size, url, alt_text, width, height, now);
    } else {
      memoryStore.media.push({ id, filename, original_name, mime_type, size, url, alt_text, width, height, created_at: now });
      saveJsonStore();
    }

    return this.getMediaById(id);
  },

  deleteMedia(id) {
    const media = this.getMediaById(id);
    if (!media) return false;

    // Delete physical file if inside uploads directory
    try {
      const uploadsDir = path.resolve(__dirname, '..', 'images', 'uploads');
      const filePath = path.resolve(__dirname, '..', media.url.replace(/^\//, ''));
      if (filePath.startsWith(uploadsDir) && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.warn('[CMS Database] Warning deleting media file:', err.message);
    }

    if (useSqlite) {
      db.prepare('DELETE FROM media WHERE id = ?').run(id);
    } else {
      memoryStore.media = memoryStore.media.filter(m => m.id !== id);
      saveJsonStore();
    }
    return true;
  },

  // ---- Dashboard Metrics ----
  getDashboardStats() {
    if (useSqlite) {
      const totalBlogs = db.prepare('SELECT COUNT(*) as count FROM blogs').get().count;
      const publishedBlogs = db.prepare("SELECT COUNT(*) as count FROM blogs WHERE status = 'published'").get().count;
      const draftBlogs = db.prepare("SELECT COUNT(*) as count FROM blogs WHERE status = 'draft'").get().count;
      const totalViews = db.prepare('SELECT SUM(views) as total FROM blogs').get().total || 0;
      const totalCategories = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
      const totalMedia = db.prepare('SELECT COUNT(*) as count FROM media').get().count;
      const recentBlogs = db.prepare('SELECT * FROM blogs ORDER BY updated_at DESC LIMIT 5').all().map(this.formatBlogForOutput);

      return {
        totalBlogs,
        publishedBlogs,
        draftBlogs,
        totalViews,
        totalCategories,
        totalMedia,
        recentBlogs
      };
    } else {
      const totalBlogs = memoryStore.blogs.length;
      const publishedBlogs = memoryStore.blogs.filter(b => b.status === 'published').length;
      const draftBlogs = memoryStore.blogs.filter(b => b.status === 'draft').length;
      const totalViews = memoryStore.blogs.reduce((acc, b) => acc + (b.views || 0), 0);
      const totalCategories = memoryStore.categories.length;
      const totalMedia = memoryStore.media.length;
      const recentBlogs = [...memoryStore.blogs]
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
        .slice(0, 5)
        .map(this.formatBlogForOutput);

      return {
        totalBlogs,
        publishedBlogs,
        draftBlogs,
        totalViews,
        totalCategories,
        totalMedia,
        recentBlogs
      };
    }
  },

  // ---- Dev Test Logs & Audit Operations ----
  saveTestLog({ run_id, status, summary, duration_ms, details }) {
    const now = new Date().toISOString();
    const detailsJson = typeof details === 'string' ? details : JSON.stringify(details);

    if (useSqlite) {
      db.prepare(`
        INSERT INTO dev_test_logs (run_id, status, summary, duration_ms, details_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(run_id, status, summary, duration_ms, detailsJson, now);
    } else {
      memoryStore.dev_test_logs = memoryStore.dev_test_logs || [];
      memoryStore.dev_test_logs.unshift({
        id: (memoryStore.dev_test_logs.length || 0) + 1,
        run_id,
        status,
        summary,
        duration_ms,
        details_json: detailsJson,
        created_at: now
      });
      saveJsonStore();
    }
    return this.getTestLogById(run_id);
  },

  getTestLogs(limit = 20) {
    if (useSqlite) {
      const rows = db.prepare('SELECT id, run_id, status, summary, duration_ms, created_at FROM dev_test_logs ORDER BY id DESC LIMIT ?').all(limit);
      return rows;
    } else {
      return (memoryStore.dev_test_logs || []).slice(0, limit).map(({ details_json, ...rest }) => rest);
    }
  },

  getTestLogById(runId) {
    if (useSqlite) {
      const row = db.prepare('SELECT * FROM dev_test_logs WHERE run_id = ? OR id = ?').get(runId, runId);
      if (!row) return null;
      try {
        row.details = JSON.parse(row.details_json);
      } catch (e) {
        row.details = {};
      }
      return row;
    } else {
      const target = (memoryStore.dev_test_logs || []).find(l => l.run_id === runId || l.id === Number(runId));
      if (!target) return null;
      return {
        ...target,
        details: JSON.parse(target.details_json || '{}')
      };
    }
  },

  clearTestLogs() {
    if (useSqlite) {
      db.exec('DELETE FROM dev_test_logs');
    } else {
      memoryStore.dev_test_logs = [];
      saveJsonStore();
    }
    return true;
  },

  // ---- Editorial Activity & Audit Trail (Last 30 Changes, Excluding Dev) ----
  logActivity({ user_id, username, user_name, user_role, action, action_label, blog_id, blog_title, details }) {
    // Strictly exclude any changes made by the developer role
    if (user_role === 'dev') return null;

    const now = new Date().toISOString();

    if (useSqlite) {
      db.prepare(`
        INSERT INTO activity_logs (user_id, username, user_name, user_role, action, action_label, blog_id, blog_title, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        user_id || null,
        username || 'Unknown',
        user_name || 'Team Member',
        user_role || 'marketing',
        action || 'edit',
        action_label || 'Modified Story',
        blog_id || null,
        blog_title || 'Untitled Story',
        details || '',
        now
      );

      // Enforce rolling buffer cap of 30 records
      db.exec(`
        DELETE FROM activity_logs 
        WHERE id NOT IN (
          SELECT id FROM activity_logs ORDER BY id DESC LIMIT 30
        )
      `);
    } else {
      memoryStore.activity_logs = memoryStore.activity_logs || [];
      memoryStore.activity_logs.unshift({
        id: (memoryStore.activity_logs.length || 0) + 1,
        user_id: user_id || null,
        username: username || 'Unknown',
        user_name: user_name || 'Team Member',
        user_role: user_role || 'marketing',
        action: action || 'edit',
        action_label: action_label || 'Modified Story',
        blog_id: blog_id || null,
        blog_title: blog_title || 'Untitled Story',
        details: details || '',
        created_at: now
      });

      if (memoryStore.activity_logs.length > 30) {
        memoryStore.activity_logs = memoryStore.activity_logs.slice(0, 30);
      }
      saveJsonStore();
    }
    return true;
  },

  getActivityLogs(limit = 30) {
    const cappedLimit = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 30);
    if (useSqlite) {
      const rows = db.prepare('SELECT * FROM activity_logs ORDER BY id DESC LIMIT ?').all(cappedLimit);
      return rows;
    } else {
      return (memoryStore.activity_logs || []).slice(0, cappedLimit);
    }
  }
};

function closeDatabase() {
  if (useSqlite && db) {
    try {
      db.exec('PRAGMA wal_checkpoint(PASSIVE);');
      db.close();
      console.log('[CMS Database] SQLite database connection closed cleanly.');
    } catch (err) {
      console.error('[CMS Database] Error closing SQLite database:', err.message);
    }
  }
}

module.exports = {
  DB,
  verifyPassword,
  hashPassword,
  generateToken,
  closeDatabase
};
