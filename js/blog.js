/**
 * Petals Suites & Hotel — Blog & Editorial System Controller
 * Handles article rendering, search, category filters, reading progress, and deep-linking
 */

(function () {
  'use strict';

  function getArticles() {
    if (typeof window !== 'undefined' && Array.isArray(window.BLOGS_DATA) && window.BLOGS_DATA.length > 0) {
      return [...window.BLOGS_DATA];
    }
    if (typeof BLOGS_DATA !== 'undefined' && Array.isArray(BLOGS_DATA) && BLOGS_DATA.length > 0) {
      return [...BLOGS_DATA];
    }
    return [];
  }

  // Application State
  const state = {
    articles: getArticles(),
    currentCategory: 'all',
    searchQuery: '',
    sortOrder: 'latest',
    activeArticleId: null
  };

  // DOM Elements
  const DOM = {
    // Hub view elements
    hubContainer: document.getElementById('blog-hub-container'),
    featuredCardWrap: document.getElementById('featured-blog-wrap'),
    gridDivider: document.getElementById('grid-section-divider'),
    cardsGrid: document.getElementById('blog-cards-grid'),
    emptyState: document.getElementById('blog-empty-state'),
    resultsCounter: document.getElementById('blog-results-counter'),
    searchInput: document.getElementById('blog-search-input'),
    searchClearBtn: document.getElementById('blog-search-clear'),
    sortSelect: document.getElementById('blog-sort-select'),
    categoryPills: document.querySelectorAll('.blog-cat-pill'),

    // Reader view elements
    readerContainer: document.getElementById('article-reader-container'),
    readingProgressBar: document.getElementById('reading-progress-bar'),
    articleBackBtn: document.getElementById('article-back-btn'),
    articleHeroBanner: document.getElementById('reader-hero-img'),
    articleTopicPill: document.getElementById('reader-topic-pill'),
    articleTitle: document.getElementById('reader-title'),
    articleAuthorName: document.getElementById('reader-author-name'),
    articleAuthorRole: document.getElementById('reader-author-role'),
    articleDate: document.getElementById('reader-date'),
    articleReadTime: document.getElementById('reader-read-time'),
    articleBody: document.getElementById('reader-rich-body'),
    articleTagsWrap: document.getElementById('reader-tags-wrap'),
    articleBreadcrumbTitle: document.getElementById('reader-breadcrumb-title'),
    nextRecCard: document.getElementById('reader-next-rec-card'),
    nextRecTitle: document.getElementById('reader-next-rec-title')
  };

  /* ==========================================================================
     1. Initialization
     ========================================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    if (!state.articles.length) {
      state.articles = getArticles();
    }

    initReadingProgress();
    initFilterEvents();
    initMobileNav();
    initHeaderScroll();

    // Check if URL has a deep link parameter (?article=... or #...)
    const urlParams = new URLSearchParams(window.location.search);
    const articleSlug = urlParams.get('article') || window.location.hash.replace('#', '');

    if (articleSlug && findArticleById(articleSlug)) {
      openArticle(articleSlug, false);
    } else {
      renderBlogHub();
    }

    // Listen for browser back / forward navigation
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.articleId) {
        openArticle(e.state.articleId, false);
      } else {
        const params = new URLSearchParams(window.location.search);
        const slug = params.get('article') || window.location.hash.replace('#', '');
        if (slug && findArticleById(slug)) {
          openArticle(slug, false);
        } else {
          closeArticle(false);
        }
      }
    });

    // Support hashchange fallback
    window.addEventListener('hashchange', () => {
      const hashSlug = window.location.hash.replace('#', '');
      if (hashSlug && findArticleById(hashSlug)) {
        openArticle(hashSlug, false);
      } else if (!hashSlug && state.activeArticleId) {
        closeArticle(false);
      }
    });
  });

  /* ==========================================================================
     2. Blog Hub & Card Rendering
     ========================================================================== */
  function renderBlogHub() {
    if (!state.articles.length) return;

    // Filter & Sort
    let filtered = state.articles.filter(article => {
      const matchesCategory = state.currentCategory === 'all' || 
        article.category.toLowerCase() === state.currentCategory.toLowerCase();

      if (!matchesCategory) return false;

      if (!state.searchQuery.trim()) return true;

      const q = state.searchQuery.toLowerCase();
      const matchTitle = article.title.toLowerCase().includes(q);
      const matchExcerpt = article.excerpt.toLowerCase().includes(q);
      const matchTags = (article.tags || []).some(t => t.toLowerCase().includes(q));
      const matchCategory = article.category.toLowerCase().includes(q);

      return matchTitle || matchExcerpt || matchTags || matchCategory;
    });

    // Sorting
    if (state.sortOrder === 'latest') {
      filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (state.sortOrder === 'oldest') {
      filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (state.sortOrder === 'readtime') {
      filtered.sort((a, b) => parseInt(a.readTime, 10) - parseInt(b.readTime, 10));
    }

    // Update Counter
    if (DOM.resultsCounter) {
      DOM.resultsCounter.textContent = `${filtered.length} guide${filtered.length === 1 ? '' : 's'}`;
    }

    // Render Featured Article (Only if no active search or category filter)
    if (DOM.featuredCardWrap) {
      if (state.currentCategory === 'all' && !state.searchQuery && filtered.length > 0) {
        const lead = filtered[0];
        DOM.featuredCardWrap.style.display = 'block';
        if (DOM.gridDivider) DOM.gridDivider.style.display = 'flex';
        DOM.featuredCardWrap.innerHTML = `
          <a href="blogs.html?article=${encodeURIComponent(lead.id)}" class="featured-blog-card" data-article-id="${lead.id}" aria-label="Read featured guide: ${escapeHtml(lead.title)}">
            <div class="featured-media-wrap">
              <img src="${lead.image}" alt="${escapeHtml(lead.title)}" class="featured-img" loading="eager">
              <span class="featured-badge"><i class="fa-solid fa-crown"></i> Featured Story</span>
            </div>
            <div class="featured-content-wrap">
              <div class="featured-meta-row">
                <span class="featured-category-tag">${escapeHtml(lead.category)}</span>
                <span>•</span>
                <span>${escapeHtml(lead.displayDate)}</span>
                <span>•</span>
                <span><i class="fa-regular fa-clock"></i> ${escapeHtml(lead.readTime)}</span>
              </div>
              <h2 class="featured-title">${escapeHtml(lead.title)}</h2>
              <p class="featured-excerpt">${escapeHtml(lead.excerpt)}</p>
              <div class="featured-author-cta-row">
                <div class="featured-author-box">
                  <div class="author-avatar-badge"><i class="fa-solid fa-hotel"></i></div>
                  <div class="author-text-info">
                    <strong>${escapeHtml(lead.author)}</strong>
                    <span>${escapeHtml(lead.authorRole)}</span>
                  </div>
                </div>
                <span class="featured-read-btn">
                  Read Full Guide <i class="fa-solid fa-arrow-right"></i>
                </span>
              </div>
            </div>
          </a>
        `;
      } else {
        DOM.featuredCardWrap.style.display = 'none';
        if (DOM.gridDivider) DOM.gridDivider.style.display = 'none';
      }
    }

    // Render Grid Cards
    if (DOM.cardsGrid) {
      if (filtered.length === 0) {
        DOM.cardsGrid.innerHTML = '';
        if (DOM.emptyState) DOM.emptyState.style.display = 'block';
        return;
      }

      if (DOM.emptyState) DOM.emptyState.style.display = 'none';

      // If featured card is shown, we can show all or omit lead
      const gridItems = (state.currentCategory === 'all' && !state.searchQuery) ? filtered.slice(1) : filtered;

      DOM.cardsGrid.innerHTML = gridItems.map(article => `
        <a href="blogs.html?article=${encodeURIComponent(article.id)}" class="blog-card" data-article-id="${article.id}" aria-label="Read full guide: ${escapeHtml(article.title)}">
          <div class="blog-card-media">
            <img src="${article.image}" alt="${escapeHtml(article.title)}" class="blog-card-img" loading="lazy">
            <span class="blog-card-cat-badge">${escapeHtml(article.category)}</span>
          </div>
          <div class="blog-card-body">
            <div class="blog-card-meta">
              <span><i class="fa-regular fa-calendar"></i> ${escapeHtml(article.displayDate)}</span>
              <span>•</span>
              <span><i class="fa-regular fa-clock"></i> ${escapeHtml(article.readTime)}</span>
            </div>
            <h3 class="blog-card-title">${escapeHtml(article.title)}</h3>
            <p class="blog-card-excerpt">${escapeHtml(article.excerpt)}</p>
            <div class="blog-card-tags">
              ${(article.tags || []).slice(0, 3).map(tag => `<span class="blog-card-tag">#${escapeHtml(tag)}</span>`).join('')}
            </div>
            <div class="blog-card-footer">
              <span class="blog-read-link">
                Read Guide <i class="fa-solid fa-arrow-right"></i>
              </span>
            </div>
          </div>
        </a>
      `).join('');
    }
  }

  /* ==========================================================================
     3. Article Reader Mode & Deep Linking
     ========================================================================== */
  function openArticle(articleId, updateHistory = true) {
    const article = findArticleById(articleId);
    if (!article) return;

    state.activeArticleId = article.id;

    // Hide hub, show reader
    if (DOM.hubContainer) DOM.hubContainer.style.display = 'none';
    if (DOM.readerContainer) {
      DOM.readerContainer.style.display = 'block';
      requestAnimationFrame(() => {
        DOM.readerContainer.classList.add('active');
      });
    }

    // Populate Reader Fields
    if (DOM.articleHeroBanner) {
      DOM.articleHeroBanner.src = article.image;
      DOM.articleHeroBanner.alt = article.title;
    }
    if (DOM.articleTopicPill) DOM.articleTopicPill.textContent = article.category;
    if (DOM.articleTitle) DOM.articleTitle.textContent = article.title;
    if (DOM.articleAuthorName) DOM.articleAuthorName.textContent = article.author;
    if (DOM.articleAuthorRole) DOM.articleAuthorRole.textContent = article.authorRole;
    if (DOM.articleDate) DOM.articleDate.textContent = article.displayDate;
    if (DOM.articleReadTime) DOM.articleReadTime.textContent = article.readTime;
    if (DOM.articleBreadcrumbTitle) DOM.articleBreadcrumbTitle.textContent = article.title;

    // Body content with in-article booking widget
    if (DOM.articleBody) {
      DOM.articleBody.innerHTML = `
        ${article.content}
        
        <!-- Luxury In-Article Booking Box -->
        <div class="article-in-post-booking-card">
          <div class="in-post-booking-info">
            <h4>Visiting Manyata Tech Park, Bangalore?</h4>
            <p>Stay directly opposite the tech park main gate (2-minute walk). Reserve executive rooms with 100 Mbps Wi-Fi, work desks, and luxury orthopaedic comfort.</p>
          </div>
          <div class="in-post-booking-actions">
            <a href="https://letsbook.me/booking/petalssuitesandhotel?checkin=2026-10-15&checkout=2026-10-16&adults=2&children=0" class="in-post-btn-primary" target="_blank" rel="noopener">
              <span>Book Online</span>
              <i class="fa-solid fa-arrow-right"></i>
            </a>
            <a href="https://wa.me/918123798844?text=Hi%20Petals%20Hotel,%20I'd%20like%20to%20inquire%20about%20booking%20a%20stay." class="in-post-btn-whatsapp" target="_blank" rel="noopener">
              <i class="fa-brands fa-whatsapp"></i>
              <span>+91 8123798844</span>
            </a>
          </div>
        </div>
      `;
    }

    // Tags
    if (DOM.articleTagsWrap) {
      DOM.articleTagsWrap.innerHTML = (article.tags || []).map(t => `
        <span class="article-tag-item">#${escapeHtml(t)}</span>
      `).join('');
    }

    // Next recommended article
    const remainingArticles = state.articles.filter(a => a.id !== article.id);
    if (remainingArticles.length && DOM.nextRecCard) {
      const nextArticle = remainingArticles[0];
      DOM.nextRecCard.style.display = 'flex';
      DOM.nextRecCard.href = `blogs.html?article=${encodeURIComponent(nextArticle.id)}`;
      DOM.nextRecCard.setAttribute('data-article-id', nextArticle.id);
      DOM.nextRecCard.setAttribute('aria-label', `Read next guide: ${nextArticle.title}`);
      if (DOM.nextRecTitle) DOM.nextRecTitle.textContent = nextArticle.title;
    } else if (DOM.nextRecCard) {
      DOM.nextRecCard.style.display = 'none';
      DOM.nextRecCard.removeAttribute('data-article-id');
    }

    // Update document title for SEO & UX
    document.title = `${article.title} | Petals Suites & Hotel, Bangalore`;

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Update Browser URL & History safely
    if (updateHistory) {
      try {
        const newUrl = `${window.location.pathname}?article=${encodeURIComponent(article.id)}`;
        window.history.pushState({ articleId: article.id }, document.title, newUrl);
      } catch (err) {
        console.warn('History pushState restricted, falling back to hash:', err);
        try {
          window.location.hash = article.id;
        } catch (_) {}
      }
    }
  }

  function closeArticle(updateHistory = true) {
    state.activeArticleId = null;

    if (DOM.readerContainer) {
      DOM.readerContainer.classList.remove('active');
      DOM.readerContainer.style.display = 'none';
    }
    if (DOM.hubContainer) DOM.hubContainer.style.display = 'block';

    if (DOM.readingProgressBar) {
      DOM.readingProgressBar.style.width = '0%';
    }

    // Restore page title
    document.title = 'Blog & Travel Insights | Petals Suites & Hotel, Bangalore';

    // Scroll back to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (updateHistory) {
      try {
        window.history.pushState(null, document.title, window.location.pathname);
      } catch (err) {
        try {
          window.location.hash = '';
        } catch (_) {}
      }
    }

    renderBlogHub();
  }

  /* ==========================================================================
     4. Interactive Search, Filters, Category Pills & Delegated Events
     ========================================================================== */
  function initFilterEvents() {
    // Delegated card click handler for Hub cards
    const handleCardClick = (e) => {
      const card = e.target.closest('[data-article-id]');
      if (!card) return;

      // Allow Cmd/Ctrl/Shift + Click or middle mouse button to open in a new tab naturally
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;

      e.preventDefault();
      const articleId = card.getAttribute('data-article-id');
      if (articleId) {
        openArticle(articleId, true);
      }
    };

    if (DOM.featuredCardWrap) {
      DOM.featuredCardWrap.addEventListener('click', handleCardClick);
    }

    if (DOM.cardsGrid) {
      DOM.cardsGrid.addEventListener('click', handleCardClick);
    }

    // Delegated click for Next Recommended Article
    if (DOM.nextRecCard) {
      DOM.nextRecCard.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
        e.preventDefault();
        const articleId = DOM.nextRecCard.getAttribute('data-article-id');
        if (articleId) {
          openArticle(articleId, true);
        }
      });
    }

    // Breadcrumb Blog link
    const breadcrumbBlogLink = document.getElementById('reader-breadcrumb-blog-link');
    if (breadcrumbBlogLink) {
      breadcrumbBlogLink.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
        e.preventDefault();
        closeArticle(true);
      });
    }

    // Back to hub button
    if (DOM.articleBackBtn) {
      DOM.articleBackBtn.addEventListener('click', (e) => {
        e.preventDefault();
        closeArticle(true);
      });
    }

    // ESC key closes reader mode
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.activeArticleId) {
        closeArticle(true);
      }
    });

    // Search input
    if (DOM.searchInput) {
      DOM.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        if (DOM.searchClearBtn) {
          DOM.searchClearBtn.style.display = state.searchQuery ? 'block' : 'none';
        }
        renderBlogHub();
      });
    }

    // Clear Search button
    if (DOM.searchClearBtn) {
      DOM.searchClearBtn.addEventListener('click', () => {
        state.searchQuery = '';
        if (DOM.searchInput) DOM.searchInput.value = '';
        DOM.searchClearBtn.style.display = 'none';
        renderBlogHub();
      });
    }

    // Category pills
    if (DOM.categoryPills) {
      DOM.categoryPills.forEach(pill => {
        pill.addEventListener('click', () => {
          DOM.categoryPills.forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          state.currentCategory = pill.getAttribute('data-category') || 'all';
          renderBlogHub();
        });
      });
    }

    // Sort selector
    if (DOM.sortSelect) {
      DOM.sortSelect.addEventListener('change', (e) => {
        state.sortOrder = e.target.value;
        renderBlogHub();
      });
    }
  }

  /* ==========================================================================
     5. Reading Progress Bar
     ========================================================================== */
  function initReadingProgress() {
    window.addEventListener('scroll', () => {
      if (!DOM.readerContainer || !DOM.readerContainer.classList.contains('active')) {
        if (DOM.readingProgressBar) DOM.readingProgressBar.style.width = '0%';
        return;
      }

      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight <= 0) return;

      const progress = (window.scrollY / totalHeight) * 100;
      if (DOM.readingProgressBar) {
        DOM.readingProgressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
      }
    });
  }

  /* ==========================================================================
     6. Social Share Helpers
     ========================================================================== */
  function shareArticle(platform) {
    const currentUrl = window.location.href;
    const title = DOM.articleTitle ? DOM.articleTitle.textContent : document.title;

    if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(title + ' - ' + currentUrl)}`, '_blank');
    } else if (platform === 'linkedin') {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(currentUrl)}`, '_blank');
    } else if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(currentUrl)}`, '_blank');
    } else if (platform === 'copy') {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(currentUrl).then(() => {
          alert('Article link copied to clipboard!');
        }).catch(() => {
          prompt('Copy this link:', currentUrl);
        });
      } else {
        prompt('Copy this link:', currentUrl);
      }
    }
  }

  /* ==========================================================================
     7. Mobile Navigation & Utility Helpers
     ========================================================================== */
  function initMobileNav() {
    const toggleBtn = document.querySelector('.mobile-menu-toggle');
    const closeBtn = document.querySelector('.mobile-menu-close');
    const overlay = document.getElementById('mobile-menu-overlay');

    if (toggleBtn && overlay) {
      toggleBtn.addEventListener('click', () => {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
      });
    }

    if (closeBtn && overlay) {
      closeBtn.addEventListener('click', () => {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
      });
    }
  }

  function initHeaderScroll() {
    const header = document.getElementById('header') || document.querySelector('.main-header');
    if (!header) return;

    const onScroll = () => {
      if (window.scrollY > 30) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function findArticleById(id) {
    return state.articles.find(a => a.id === id);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Global namespace for inline triggers
  window.PetalsBlog = {
    open: openArticle,
    close: closeArticle,
    share: shareArticle,
    resetFilters: () => {
      state.searchQuery = '';
      state.currentCategory = 'all';
      if (DOM.searchInput) DOM.searchInput.value = '';
      if (DOM.searchClearBtn) DOM.searchClearBtn.style.display = 'none';
      if (DOM.categoryPills) {
        DOM.categoryPills.forEach(p => {
          p.classList.toggle('active', p.getAttribute('data-category') === 'all');
        });
      }
      renderBlogHub();
    }
  };

})();
