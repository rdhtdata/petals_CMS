# Petals Suites & Hotel — CMS Editorial & Marketing Team Handbook
### Official User Guide for Marketing Desk & Content Editors

Welcome to the **Petals Suites & Hotel Content Management System (CMS)**! This guide is designed specifically for the Marketing Desk and Editorial Team to help you create, edit, preview, and publish hospitality stories, manage digital photography in the Media Vault, and optimize search engine visibility (SEO) on [petalshotels.com](https://petalshotels.com).

---

## Table of Contents
1. [Accessing the CMS & Account Roles](#1-accessing-the-cms--account-roles)
2. [The Master Editorial Dashboard](#2-the-master-editorial-dashboard)
3. [The Article Studio: Step-by-Step Writing & Publishing](#3-the-article-studio-step-by-step-writing--publishing)
4. [Live Article Preview Mode](#4-live-article-preview-mode)
5. [The 5-Draft Policy & Quota Management](#5-the-5-draft-policy--quota-management)
6. [The Media Library & 75-Photo Storage Quota](#6-the-media-library--75-photo-storage-quota)
7. [Category Taxonomy & Pillars](#7-category-taxonomy--pillars)
8. [Google SEO & SERP Snippet Optimization](#8-google-seo--serp-snippet-optimization)
9. [Editorial Best Practices & Guidelines](#9-editorial-best-practices--guidelines)
10. [Account Security & Profile Management](#10-account-security--profile-management)

---

## 1. Accessing the CMS & Account Roles

### Logging In
* **Primary URL:** [https://admin.petalshotels.com](https://admin.petalshotels.com)  
  *(Alternative access: `https://petalshotels.com/admin`)*
* Enter your assigned **Username** or **Email** and **Password**.
* Click **Enter Editorial Studio**.
* The system keeps you securely signed in for **7 days** on your device.

```
┌────────────────────────────────────────────────────────┐
│             PETALS SUITES & HOTEL                      │
│            Atelier Editorial Studio                    │
│                                                        │
│  [ Username or Email: marketing@petalshotels.com   ]   │
│  [ Password: •••••••••••••••••                     ]   │
│                                                        │
│             [ Enter Editorial Studio ]                 │
└────────────────────────────────────────────────────────┘
```

### Team Roles & Access Levels
The CMS features dedicated role permissions to keep daily work clear and focused:

1. **Marketing Desk (`marketing`):**
   * Full access to write, edit, preview, publish, unpublish, and delete blog articles.
   * Full access to upload, search, copy URLs, and manage photography in the Media Vault (up to 75 photos).
   * Full access to create and organize blog taxonomy categories.
   * Personal profile management to update your name, email, and password.
2. **Hotel Administrator (`admin`):**
   * Includes all Marketing Desk editorial, media, and publishing capabilities.
   * Full access to inspect team member rosters and monitor the Master Editorial Ledger.
3. **Lead Developer / Technical Administrator (`dev`):**
   * Handles user account provisioning and technical administration.
   * *(Note: To maintain security and prevent unauthorized access, creating new team member accounts and performing administrative password resets are managed centrally by the Lead Developer. If a new team member needs CMS access, please contact the Lead Developer).*

---

## 2. The Master Editorial Dashboard

When you log in, you arrive at the **Master Editorial Dashboard**, giving you an instant executive snapshot of Petals' publication performance:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  TOTAL STORIES    PUBLISHED STORIES    DRAFT SANCTUARIES    TOTAL READS    TAXONOMY    MEDIA │
│        12                10                    2                1,420          5        24   │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Key Dashboard Sections

#### 1. Tabular Metrics Ribbon
* **Total Stories:** Combined count of all live articles and active drafts.
* **Published Stories:** Live articles currently visible to visitors on [petalshotels.com/blogs.html](https://petalshotels.com/blogs.html).
* **Draft Sanctuaries:** Works-in-progress currently being written (maximum 5 allowed).
* **Total Impressions / Reads:** Total accumulated pageviews across all published stories.
* **Taxonomy Pillars:** Number of active topic categories.
* **Media Assets:** Number of photos in the Media Vault (maximum 75 photos).

#### 2. The Quick Draft Scratchpad (Launchpad)
Located in the right-hand panel of the dashboard, this composer lets you capture an article headline instantly while the idea is fresh:
1. Type a working headline into the input pill (e.g., *"Top 5 Executive Dining Spots Near Manyata Tech Park"*).
2. Press **Enter** or click **Draft ➔**.
3. The CMS automatically generates the web-safe URL slug, initializes the draft, and immediately opens the Article Studio with your cursor ready in the body editor.

#### 3. Recent Stories Table & Filter Toolbar
* **Status Filter Tabs:** Switch between **All Stories**, **Published (Live)**, or **Drafts Only**.
* **Real-time Search:** Filter stories instantly by title, author, or topic.
* **Action Menu:**
  * **Edit (Pen Icon):** Opens the article in the Article Studio.
  * **Duplicate (Copy Icon):** Clones an existing article structure into a new draft.
  * **Unpublish (Arrow Icon):** Immediately takes a published article offline back into draft state.
  * **Delete (Trash Icon):** Permanently removes an article from the database.

#### 4. Editorial Activity Ledger
* Located at the bottom of the dashboard.
* Displays a rolling audit log of the last 30 editorial actions: who created, updated, published, or unpublished a story, complete with timestamps.

---

## 3. The Article Studio: Step-by-Step Writing & Publishing

To write a new story, click **+ New Story** in the top navigation bar or left sidebar.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [← Back to Ledger]   ● DRAFT   Saved to local session   [Preview] [Publish]│
├──────────────────────────────────────────────────────┬───────────────────┤
│                                                      │  METADATA PANEL   │
│  Article Title                                       │  Category:        │
│  [ Why North Bangalore is the Executive Choice     ] │  [Business Travel]│
│                                                      │                   │
│  URL Slug (blogs.html?article=...)                   │  Cover Image:     │
│  [ why-north-bangalore-executive-choice            ] │  [ Select Media ] │
│                                                      │                   │
│  Rich Body Editor                                    │  Tags:            │
│  [ H2 | H3 | B | I | U | " " | • List | 🔗 | 🖼️ ]    │  [Corporate] [x]  │
│  Write your article content here...                  │                   │
│                                                      │  SEO Preview      │
└──────────────────────────────────────────────────────┴───────────────────┘
```

### Step 1: Article Headline & URL Slug
* **Article Title:** Write a compelling headline. The CMS will automatically calculate reading time (e.g. `4 min read`).
* **URL Slug:** As you type your title, the system automatically creates a clean, SEO-friendly slug (e.g., `why-north-bangalore-is-the-executive-choice`).
  * If you wish to customize the slug manually, click the **Pen/Lock Icon** next to the slug input, edit the text, and the system will lock your custom URL.

### Step 2: Assign Category & Author
* **Category:** Choose one of Petals' five foundational content pillars:
  * *Business Travel*
  * *Luxury Stays*
  * *Corporate Guide*
  * *Work & Comfort*
  * *Local Guides*
* **Author Name:** Defaults to `Petals Hospitality Editorial`.
* **Author Role:** Defaults to `Corporate Stays Desk` (e.g., can be customized to `Guest Experience Curator` or `North Bangalore Concierge`).

### Step 3: Featured Cover Photography
Every article requires an attractive header image:
* Click **Select from Library** to choose an existing photo from the Media Vault.
* Or click **Upload File** to upload a new high-resolution photo from your computer.
* Enter **Cover Image Alt Text** (e.g., *"Petals Suites Deluxe Suite King Bed and Workstation"*). This helps visually impaired visitors and boosts your Google Images ranking.

### Step 4: Writing in the Rich WYSIWYG Editor
The Article Studio includes an intuitive formatting toolbar:
* **H2 & H3:** Organize your article into structured chapters.
* **Bold (`B`) & Italic (`I`):** Highlight key phrases and hotel amenities.
* **Lists (Bulleted or Numbered):** Great for itineraries, checklists, and room feature lists.
* **Blockquotes (`" "`):** Format guest testimonials or quotes from the concierge.
* **Hyperlinks (Link Icon):** Link to external booking portals or local attraction guides. All external links automatically include `rel="noopener noreferrer"` security tags.
* **Insert Media (Photo Icon):** Open the Media Picker modal and insert photos directly between paragraphs in your article text.

### Step 5: Executive Excerpt
* Enter a 2-to-3 sentence summary in the **Story Excerpt** box.
* This excerpt appears as the introductory preview card on the homepage, the blog catalog page, and in social media link previews.

### Step 6: Topic Tags
* Type a keyword into the tag input (e.g., `Manyata Tech Park`, `Executive Stay`, `Airport Shuttle`) and press **Enter**.
* Tags appear as clickable chips that help visitors find related articles. Click the `×` on any tag to remove it.

### Step 7: Publishing to the Live Website & Zero-Delay Sync
When your article is written and reviewed in Live Preview, you have two options:

1. **Publishing Live:** Click the gold **Publish** button. In real time, the article goes live immediately:
   * **Live Public Catalog:** Visitors on [petalshotels.com/blogs.html](https://petalshotels.com/blogs.html) can read your article right away.
   * **Homepage Spotlight:** The latest published article automatically takes the top spotlight on the main [petalshotels.com](https://petalshotels.com) homepage.
   * **Search Engine Sitemap:** The canonical article URL is added immediately to `https://petalshotels.com/sitemap.xml` for Google discovery.
2. **Saving as Draft:** Click **Save Draft** if you want to keep working privately. Drafts remain strictly confidential within the Editorial Studio and are never visible to hotel visitors.
3. **Instant Live Updates:** If you ever spot a typo or want to update a headline or photo on an already published story, simply open it, make your changes, and click **Publish**. Your corrections appear on the live website immediately without any caching delay.
4. **Unpublishing:** If an article needs to be taken down temporarily (for instance, an expired seasonal offer), click **Unpublish**. It immediately vanishes from the public website and returns safely to your draft sanctuary.

---

## 4. Live Article Preview Mode

Before publishing any story to the public website, always inspect it in **Live Preview Mode**:

1. Click the **Preview** button in the top right corner of the Article Studio.
2. A full-screen preview modal will open, rendering your draft inside the **exact styling, typography (Marcellus Serif), colors, and container widths of the live Petals website**.
3. **What to Check During Preview:**
   * Do headlines and paragraphs have balanced spacing?
   * Are cover photos sharp and properly centered?
   * Are bullet lists and blockquotes rendering clearly?
   * Does the reading time match the article length?
4. When finished reviewing, click **Close Preview** in the top right to return to editing.

---

## 5. The 5-Draft Policy & Quota Management

To maintain high editorial velocity and prevent abandoned drafts from cluttering the database, the CMS enforces a **maximum limit of 5 drafts at any one time**.

```
┌────────────────────────────────────────────────────────┐
│  ⚠️ DRAFT QUOTA NOTICE (5 / 5 Drafts Active)           │
│                                                        │
│  You have reached the maximum limit of 5 active        │
│  drafts. To create a new article, please either:       │
│                                                        │
│  1. Finish and Publish an existing draft, or           │
│  2. Delete an obsolete draft from your workspace.      │
│                                                        │
│  [ Review Active Drafts ]           [ Cancel ]         │
└────────────────────────────────────────────────────────┘
```

### What Happens When You Reach 5 Drafts?
* If you click **+ New Story** or use the **Quick Draft Scratchpad** while 5 drafts exist, the CMS displays the **Draft Limit Management Dialog**.
* This modal lists your 5 current drafts with one-click **Edit** and **Delete** actions.
* Simply publish one of your completed stories or delete an unused draft, and you can immediately begin your new story.

---

## 6. The Media Library & 75-Photo Storage Quota

The **Media Library** (accessible from the sidebar or Launchpad) manages all property photography and editorial graphics.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  MEDIA VAULT                              [ 24 / 75 photos ] [ + Upload ]│
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ 📷  DRAG & DROP PHOTOGRAPHY HERE                                   │  │
│  │     Supports JPG, PNG, WebP up to 10MB (51 slots remaining)        │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  [ Search by filename...             ]                                   │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ [Suite Photo]│  │ [Lobby Photo]│  │ [Corridor]   │  │ [Dining Area]│  │
│  │ suite-1.jpg  │  │ lobby.webp   │  │ hall.jpg     │  │ restaurant.jpg│ │
│  │ 240 KB       │  │ 180 KB       │  │ 310 KB       │  │ 420 KB       │  │
│  │ [Copy][Trash]│  │ [Copy][Trash]│  │ [Copy][Trash]│  │ [Copy][Trash]│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### The 75-Photo Storage Quota
To ensure website images load instantly and server storage remains lean, the library maintains a strict ceiling of **75 photos**:
* **Live Counter Badge:** Displays your current usage (e.g., `24 / 75 photos`).
* **Warning Notice (65+ photos):** Turns amber to alert the team that storage is nearing capacity.
* **Capacity Cap (75 / 75 photos):** When 75 photos are reached, new uploads are paused, and a clear notification prompts the team to delete old or replaced photos before adding new ones.

### Best Practices for Photography:
1. **File Formats:** Use **WebP** or **JPG** for photos. Use **PNG** only for logos or graphics requiring transparency.
2. **File Size:** Keep uploaded photos between **150 KB and 800 KB**. High-resolution photos do not need to be 10 MB to look stunning on mobile and desktop screens.
3. **Copy Image URL:** Clicking the **Copy** button copies the clean, public image URL to your clipboard (e.g., `https://petalshotels.com/images/uploads/deluxe-suite-1793892019482.webp`), ideal for sharing in marketing campaigns or newsletters.

---

## 7. Category Taxonomy & Pillars

Categories help corporate guests and travellers browse articles relevant to their specific journey:

### Managing Categories (`#categories` in sidebar)
* **View Categories:** See all 5 foundational pillars and the number of active articles published under each.
* **Adding a Category:** Enter the category name (e.g., *"Weekend Escapes"*), and description.
* **Automatic Slugs:** The CMS generates web-safe category slugs automatically (e.g. `weekend-escapes`).
* **Catalog Sync:** Any new category instantly appears in the category filter tabs on [petalshotels.com/blogs.html](https://petalshotels.com/blogs.html).

---

## 8. Google SEO & SERP Snippet Optimization

At the bottom of the Article Studio sits the **Google Search Optimization Suite**:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  GOOGLE SEARCH SNIPPET PREVIEW                                           │
│                                                                          │
│  petalshotels.com › blogs › business-stay-bangalore-manyata              │
│  Best Business Stay in Bangalore Near Manyata | Petals Hotel             │
│  Discover why Petals Suites & Hotel is the preferred address for         │
│  executives. Featuring 100+ Mbps Wi-Fi, work desks, and a 2-minute walk. │
└──────────────────────────────────────────────────────────────────────────┘
```

### How to Maximize Organic Google Traffic:
1. **SEO Meta Title (Target: 50–60 characters):**
   * If left blank, defaults to your article title.
   * Customize it to include high-volume search phrases:  
     *Good:* `Best Business Stay in Bangalore Near Manyata | Petals Hotel`
2. **SEO Meta Description (Target: 130–160 characters):**
   * Write an action-oriented summary that convinces searchers to click your link instead of competitor hotels.
   * Mention key USPs: *2-minute walk to Manyata*, *fast Wi-Fi*, *executive suites*, *peaceful ambiance*.
3. **Live SERP Card Preview:**
   * Watch the Google search card update in real-time as you type your SEO title and description.
4. **Target Keywords:**
   * Add 3–5 comma-separated keywords (e.g., `Manyata Tech Park hotel, business stay Bangalore, executive suites`).
5. **XML Sitemap Synchronization:**
   * The moment you click **Publish**, the CMS automatically regenerates `https://petalshotels.com/sitemap.xml`.
   * Google's search crawlers detect the new article URL automatically within hours.

---

## 9. Editorial Best Practices & Guidelines

To maintain the luxury boutique identity of Petals Suites & Hotel, follow these editorial guidelines:

### Tone of Voice
* **Brand Persona:** Warm, refined, understated luxury (*"Quiet Sanctuary in North Bangalore"*).
* **Target Audience:** Corporate executives visiting Manyata Tech Park, consultants, extended-stay business travellers, and leisure visitors looking for peace and comfort.
* **Avoid Generic Cliches:** Avoid over-promising or using generic hotel marketing fluff. Focus on tangible guest benefits:
  * *Instead of:* "We have the most luxurious rooms in the world!"
  * *Write:* "Spacious executive rooms featuring ergonomic workstations, plush orthopaedic bedding, and quiet corridors engineered for uninterrupted rest."

### Recommended Article Structure
1. **Hook (Introductory Paragraph):** Address a real corporate travel dilemma (e.g., Bangalore traffic, tight meeting schedules, needing a dependable workspace).
2. **The Solution:** Introduce how Petals' location (100m from Manyata Tech Park Gate) solves the problem.
3. **Key Amenities (Subheadings & Bullet Points):** Break content into scannable sections (Work desks, High-speed Wi-Fi, In-room dining, Airport connectivity).
4. **Call to Action (CTA):** Conclude with an invitation to book direct:  
   *"Planning an upcoming corporate trip to North Bangalore? Reserve your executive suite at Petals Suites & Hotel for a seamless work-and-rest experience."*

---

## 10. Account Security & Profile Management

### Updating Your Profile & Password
1. Click **Profile & Settings** in the left sidebar (or click your user avatar and name).
2. You can update your **Display Name** and **Email Address**.
3. **Changing Your Own Password:**
   * Enter your current password.
   * Enter your new secure password (minimum 8 characters, recommended combination of letters, numbers, and symbols).
   * Confirm the new password and click **Update Security Credentials**.

### Password Resets & New Team Members
* **Forgotten Passwords:** If you forget your login password, reach out to your **Lead Developer**. The Lead Developer can verify your credentials, review your current password, or assign a secure replacement on demand.
* **New Team Member Onboarding:** To ensure strict editorial security, account creation is managed centrally by the Lead Developer. Administrators and editors should request new user onboarding from the Lead Developer with the member's full name, email, and designated role (`marketing` or `admin`).

### Session Best Practices
* Always click **Sign Out** from the sidebar when finishing your workday or working on shared hotel computers.
* Your session automatically expires after 7 days of inactivity to keep property content secure.

---

*Petals Suites & Hotel Editorial Handbook — Version 1.1 (2026 Edition)*  
*For new account requests or credential assistance, contact your Lead Developer.*
