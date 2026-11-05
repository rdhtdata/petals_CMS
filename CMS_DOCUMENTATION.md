# Petals Suites & Hotel — Content Management System (CMS)
## Architecture, Hostinger Deployment & Marketing Team Handover Guide

---

## 1. Executive Summary

This Content Management System (CMS) is developed specifically for **Petals Suites & Hotel** (`petalshotels.com`), enabling the marketing team to independently create, edit, preview, publish, and manage hospitality blog articles, upload photography, manage category taxonomy, and optimize SEO metadata without requiring technical assistance or website redeployments.

### Key Highlights
- **Subdomain Deployment:** Configured for `admin.petalshotels.com` (and accessible via `petalshotels.com/admin`).
- **Zero-Redeployment Publishing:** When the marketing team hits **Publish**, content is immediately available through the dynamic backend API (`/api/blogs`), and automatically reflected on `petalshotels.com/blogs.html`, `index.html`, and `petalshotels.com/sitemap.xml`.
- **Zero External Dependencies:** Built with Node.js native embedded SQLite (`node:sqlite`) with WAL mode and cryptographic hashing (`scrypt`), requiring zero external database installations or complex compilation on Hostinger.
- **Brand Consistency:** Designed with Petals' signature luxury visual identity (Deep Obsidian, Champagne Gold `#c5a880`, Marcellus Serif and Plus Jakarta Sans).
- **Role-Based Security:** Separate Administrator and Marketing Editor accounts with brute-force protection and secure HTTP-only session cookies.

---

## 2. Architecture & How It Works

```
                                      +------------------------------------+
                                      |   Marketing Team (Any Browser)     |
                                      +-----------------+------------------+
                                                        |
                                                        v
                                       admin.petalshotels.com (CMS Dashboard)
                                                        |
                                +-----------------------+-----------------------+
                                |                                               |
                                v                                               v
                     [Authenticated Admin API]                        [Rich Editor / Media]
                    /api/admin/blogs, categories,                       Base64 Uploads to
                     media, users, dashboard stats                      images/uploads/
                                |                                               |
                                +-----------------------+-----------------------+
                                                        |
                                                        v
                                      +------------------------------------+
                                      |   Embedded Database (server/data)  |
                                      |   SQLite 3 with WAL Mode           |
                                      +-----------------+------------------+
                                                        |
                                                        v
                                             [Public API Endpoints]
                                          GET /api/blogs, /api/blogs/:id
                                          GET /sitemap.xml
                                                        |
                                                        v
                                      +------------------------------------+
                                      |         Public Petals Website      |
                                      |   petalshotels.com/blogs.html      |
                                      |   petalshotels.com (Recent 3)      |
                                      +------------------------------------+
```

### The Life of an Article
1. **Login:** Team visits `admin.petalshotels.com` and signs in.
2. **Drafting:** Team creates an article with headings, images, tags, category, and SEO metadata.
3. **Draft State:** Saved in the database with `status = 'draft'`. It is completely private and invisible to search engines or website visitors.
4. **Live Preview:** Team clicks "Preview" to verify how the article renders inside the exact Petals website reader view layout before publishing.
5. **Publishing:** Team clicks "Publish Now". The status switches to `published` and the publication timestamp is recorded.
6. **Instant Visibility:** The website (`blogs.html` and `index.html`) fetches live articles dynamically from `/api/blogs`. Visitors see the new article immediately without needing server restarts or static rebuilds!

---

## 3. Hostinger Deployment Guide

The CMS is designed to run seamlessly on Hostinger infrastructure. Hostinger provides two primary environments:

### Option A: Hostinger Cloud / VPS Hosting (Recommended)
1. **Clone or Upload Files:** Upload the project repository to your VPS directory (e.g. `/var/www/petalshotels.com`).
2. **Node.js Process (PM2):**
   ```bash
   cd /var/www/petalshotels.com
   npm install --production
   pm2 start server/server.js --name "petal-suites"
   pm2 save
   pm2 startup
   ```
3. **Nginx Reverse Proxy Configuration:**
   Point both `petalshotels.com` and `admin.petalshotels.com` to the Node.js application port (default `3000`):
   ```nginx
   # Public Website
   server {
       server_name petalshotels.com www.petalshotels.com;
       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }

   # Admin CMS Subdomain
   server {
       server_name admin.petalshotels.com;
       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
4. **DNS Records (Hostinger DNS Zone):**
   - A Record: `@` -> VPS Public IP
   - A Record: `www` -> VPS Public IP
   - A Record: `admin` -> VPS Public IP

### Option B: Hostinger cPanel / hPanel Node.js Application Manager
1. In hPanel, navigate to **Websites** > **Subdomains** > Create `admin.petalshotels.com`.
2. Go to **Advanced** > **Node.js**.
3. Set **Application Root**: `/` (or your project directory).
4. Set **Application Startup File**: `server/server.js`.
5. Select **Node.js Version**: 20+ or 22+ (both include the native SQLite engine).
6. Click **Save** and **Start Application**.

---

## 4. Default Administrator Credentials

On first launch, the CMS automatically provisions the master administrator account:

| Attribute | Value |
|---|---|
| **Portal URL** | `https://admin.petalshotels.com` or `https://petalshotels.com/admin` |
| **Username** | `admin` |
| **Email** | `admin@petalshotels.com` |
| **Default Password** | `PetalsAdmin2026!` |
| **Role** | `Administrator` (Full access to articles, categories, media, and team accounts) |

> **Important Security Step:** After logging in for the first time, navigate to **My Profile & Security** (`#profile`) and change the default password to a strong, confidential password.

---

## 5. Marketing Team User Guide

### 5.1 Writing and Publishing a Blog
1. Navigate to **Write Article** in the sidebar.
2. **Article Title:** Type your catchy title (e.g. *5 Reasons to Choose Petals Suites for Your Business Stay*). The system will automatically generate a clean URL slug.
3. **Category:** Choose a content pillar (Business Travel, Luxury Stays, Corporate Guide, etc.) or click **+ Add New** to create one instantly.
4. **Excerpt:** Add a short 1-2 sentence teaser. A counter indicates optimal character length (~140-160 characters).
5. **Rich-Text Editor:**
   - Format headings (`H2`, `H3`, `H4`) for clean structure.
   - Use bulleted and numbered lists for readability.
   - Highlight key takeaways using bold or blockquotes.
   - Click the **Link** icon to insert hyperlinks.
   - Click the **Image** icon to insert photos directly into the text.
6. **Featured Image:**
   - Drag and drop a high-resolution photo or select from the Media Library.
   - Enter descriptive **Image Alt Text** for Google Image search ranking.
7. **Tags:** Type keywords (e.g. `Manyata Tech Park`, `Executive Suites`) and press **Enter**.
8. **SEO Management & Google SERP Preview:**
   - Enter your **SEO Meta Title** (target 50-60 characters).
   - Enter your **SEO Meta Description** (target 130-160 characters).
   - Review the **Google Search Snippet Preview** to verify how your blog will appear on desktop and mobile search results.
9. **Previewing:**
   - Click **Preview** in the top action bar to review the article inside the Petals luxury reader template.
10. **Publishing:**
    - Click **Publish Now** to go live immediately.
    - Or click **Save Draft** to save your work privately.

### 5.2 Managing Existing Blogs
- In the **Articles** tab, filter articles by **All**, **Published**, or **Drafts**.
- **Quick Status Toggle:** Click the "Published" or "Draft" badge in the table to toggle its status with a single click.
- **Duplicate:** Click the copy icon to clone an existing article as a draft for quick templating.
- **Delete:** Click the trash icon to delete an article (with confirmation).

### 5.3 Media Library
- Navigate to **Media Library** in the sidebar.
- Drag and drop images (JPG, PNG, WebP) up to 10MB each.
- Click **Copy URL** to grab any image's public path for re-use.
- When writing an article, click **From Library** to pick from previously uploaded photos.

### 5.4 Categories
- Navigate to **Categories** to create new topic pillars or edit existing ones.
- Categories automatically appear as interactive filter pills on the website blog hub (`blogs.html`).

### 5.5 Team Management (Admin Only)
- Administrators can invite team members by clicking **Add Team Member**.
- Assign either **Administrator** (full settings) or **Editor** (content publishing only).

---

## 6. Technical Specifications

### Database Schema
- **Database File:** `server/data/petals_cms.db` (SQLite 3 with Write-Ahead Logging `WAL` mode).
- **Tables:**
  - `blogs`: `id`, `slug`, `title`, `excerpt`, `content`, `featured_image`, `featured_image_alt`, `category`, `author`, `author_role`, `status`, `published_at`, `display_date`, `read_time`, `tags`, `seo_title`, `seo_description`, `seo_keywords`, `canonical_url`, `views`, `created_at`, `updated_at`.
  - `categories`: `id`, `name`, `slug`, `description`, `display_order`, `created_at`.
  - `media`: `id`, `filename`, `original_name`, `mime_type`, `size`, `url`, `alt_text`, `width`, `height`, `created_at`.
  - `users`: `id`, `username`, `email`, `password_hash`, `salt`, `full_name`, `role`, `active`, `created_at`, `updated_at`.
  - `sessions`: `token`, `user_id`, `role`, `expires_at`, `created_at`.

### Public API Endpoints
- `GET /api/blogs`: Returns list of published articles with pagination, sorting (`latest`, `oldest`, `readtime`), category, and search query filters.
- `GET /api/blogs/:id`: Returns detailed article by ID or slug.
- `GET /api/categories`: Returns categories with blog count.
- `GET /sitemap.xml`: Generates a dynamic XML sitemap conforming to sitemaps.org standards, auto-updating when blogs are published or deleted.

---

## 7. Future Expandability

The database schema and admin architecture are built modularly so additional website content sections can be added without redevelopment:
- **Homepage Banners & Announcements:** Can be added as a `banners` table and dashboard tab.
- **Room & Suite Catalog:** Room amenities, rates, and high-res photo gallery management.
- **Hotel Facilities:** Managing descriptions for dining (Thalassery Cafe, Kuttanad Restaurant), gym, and corporate conference areas.
- **Offers & Packages:** Seasonal discounts and Manyata corporate tie-up packages.
