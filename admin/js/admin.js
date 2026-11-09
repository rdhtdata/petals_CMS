/**
 * Petals Suites & Hotel - CMS Admin Dashboard Application Controller
 * Handles SPA routing, authentication, blog authoring, rich-text editor, media library, and SEO
 */

(function () {
  'use strict';

  // Application State
  const App = {
    user: null,
    token: null,
    currentView: 'dashboard',
    blogs: [],
    categories: [],
    media: [],
    users: [],
    activeEditingBlogId: null,
    isDirty: false,
    mediaPickerCallback: null,
    statusFilter: 'all',
    categoryFilter: 'all',
    searchQuery: '',
    rawHtmlMode: false,
    tagsList: []
  };

  // Helper for API fetch with token and credentials
  async function apiFetch(endpoint, options = {}) {
    const headers = options.headers || {};
    if (App.token) {
      headers['Authorization'] = `Bearer ${App.token}`;
    }
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const res = await fetch(endpoint, {
        ...options,
        headers,
        credentials: 'same-origin'
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        // Unauthorized
        handleLogout(false);
        showToast('Session expired. Please sign in again.', 'error');
        return { success: false, error: 'Unauthorized' };
      }

      return data;
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      return { success: false, error: 'Network error or server unreachable' };
    }
  }

  /* ==========================================================================
     1. Toast Notifications & Utilities
     ========================================================================== */
  function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `
      <i class="fa-solid ${icon} toast-icon"></i>
      <div class="toast-content">${escapeHtml(message)}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
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

  function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function formatDate(isoStr) {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (_) {
      return isoStr;
    }
  }

  /* ==========================================================================
     2. Authentication & Initial Session Check
     ========================================================================== */
  async function checkAuthSession() {
    // Check saved token in localStorage
    App.token = localStorage.getItem('petals_cms_token');

    const res = await apiFetch('/api/admin/auth/me');
    if (res.success && res.user) {
      App.user = res.user;
      initAuthenticatedApp();
    } else {
      showLoginOverlay();
    }
  }

  function showLoginOverlay() {
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
  }

  function hideLoginOverlay() {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const remember = document.getElementById('login-remember').checked;
    const errorEl = document.getElementById('login-error-msg');
    const submitBtn = document.getElementById('login-submit-btn');

    errorEl.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';

    const res = await apiFetch('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span class="btn-text">Sign In to Dashboard</span> <i class="fa-solid fa-arrow-right"></i>';

    if (res.success && res.user) {
      App.user = res.user;
      App.token = res.token;
      if (remember) {
        localStorage.setItem('petals_cms_token', res.token);
      } else {
        sessionStorage.setItem('petals_cms_token', res.token);
      }
      showToast(`Welcome back, ${res.user.full_name}!`, 'success');
      initAuthenticatedApp();
    } else {
      errorEl.textContent = res.error || 'Invalid credentials. Please try again.';
      errorEl.style.display = 'flex';
    }
  }

  async function handleLogout(callApi = true) {
    if (callApi) {
      await apiFetch('/api/admin/auth/logout', { method: 'POST' });
    }
    App.user = null;
    App.token = null;
    localStorage.removeItem('petals_cms_token');
    sessionStorage.removeItem('petals_cms_token');
    showLoginOverlay();
    showToast('You have been signed out.', 'info');
  }

  function initAuthenticatedApp() {
    hideLoginOverlay();

    const role = App.user.role || 'marketing';
    const roleLabels = {
      dev: 'Lead Developer',
      admin: 'Administrator',
      marketing: 'Marketing Desk'
    };

    // Update user info in sidebar
    document.getElementById('sidebar-user-name').textContent = App.user.full_name;
    document.getElementById('sidebar-user-role').textContent = roleLabels[role] || 'Team Member';
    document.getElementById('sidebar-avatar').textContent = (App.user.full_name || 'U').charAt(0).toUpperCase();

    // Section visibility
    // Admin section: visible to dev and admin only
    const adminSections = document.querySelectorAll('.admin-only-section');
    adminSections.forEach(el => {
      el.style.display = (role === 'dev' || role === 'admin') ? '' : 'none';
    });

    // Developer section: visible to dev only
    const devSections = document.querySelectorAll('.dev-only-section');
    devSections.forEach(el => {
      el.style.display = (role === 'dev') ? '' : 'none';
    });

    // Populate profile form
    document.getElementById('profile-name').value = App.user.full_name;
    document.getElementById('profile-email').value = App.user.email;
    document.getElementById('profile-username').value = App.user.username;
    document.getElementById('profile-role').value = roleLabels[role] || role;

    // Load initial data
    loadCategories();
    loadDashboard();
    handleHashNavigation();
  }

  /* ==========================================================================
     3. Navigation & View Routing
     ========================================================================== */
  function switchView(viewName) {
    const role = App.user ? App.user.role : 'marketing';

    // Role security guards
    if (viewName === 'users' && role === 'marketing') {
      showToast('Access restricted: Team accounts are only accessible to Administrators and Developers.', 'error');
      window.location.hash = 'dashboard';
      return;
    }

    if (viewName === 'dev-console' && role !== 'dev') {
      showToast('Access restricted: Developer console and system tools are only accessible to Lead Developer.', 'error');
      window.location.hash = 'dashboard';
      return;
    }

    // Unsaved changes check
    if (App.isDirty && App.currentView === 'editor' && viewName !== 'editor') {
      if (!confirm('You have unsaved changes in this article. Are you sure you want to leave?')) {
        return;
      }
      App.isDirty = false;
    }

    App.currentView = viewName;

    // Update view sections
    document.querySelectorAll('.cms-view').forEach(view => {
      view.classList.toggle('active', view.id === `view-${viewName}`);
    });

    // Update sidebar nav items
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      const dataView = item.getAttribute('data-view');
      item.classList.toggle('active', dataView === viewName);
    });

    // Update breadcrumb
    const breadcrumbNames = {
      dashboard: 'Dashboard Overview',
      blogs: 'Blog Articles',
      editor: App.activeEditingBlogId ? 'Edit Article' : 'Write New Article',
      categories: 'Categories',
      media: 'Media Library',
      users: 'Team Accounts & Permissions',
      'dev-console': 'System Diagnostics & Dev Tools',
      profile: 'My Profile & Security'
    };
    document.getElementById('crumb-current').textContent = breadcrumbNames[viewName] || viewName;

    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');

    // Trigger view-specific loads
    if (viewName === 'dashboard') loadDashboard();
    if (viewName === 'blogs') loadBlogsList();
    if (viewName === 'categories') loadCategories();
    if (viewName === 'media') loadMediaLibrary();
    if (viewName === 'users' && (role === 'dev' || role === 'admin')) loadUsersList();
    if (viewName === 'dev-console' && role === 'dev') loadDevConsole();
  }

  function handleHashNavigation() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    const parts = hash.split('/');
    const mainView = parts[0];

    if (mainView === 'editor') {
      const blogId = parts[1] || null;
      openEditor(blogId);
    } else {
      switchView(mainView);
    }
  }

  window.addEventListener('hashchange', handleHashNavigation);

  /* ==========================================================================
     4. Dashboard View Logic
     ========================================================================== */
  async function loadDashboard() {
    const res = await apiFetch('/api/admin/dashboard/stats');
    if (!res.success || !res.data) return;

    const stats = res.data;
    document.getElementById('stat-total-blogs').textContent = stats.totalBlogs;
    document.getElementById('stat-published-blogs').textContent = stats.publishedBlogs;
    document.getElementById('stat-draft-blogs').textContent = stats.draftBlogs;
    document.getElementById('stat-total-views').textContent = stats.totalViews.toLocaleString();
    document.getElementById('stat-total-categories').textContent = stats.totalCategories;
    document.getElementById('stat-total-media').textContent = stats.totalMedia;
    document.getElementById('nav-blogs-counter').textContent = stats.totalBlogs;

    // Render recent articles table
    const tbody = document.getElementById('dashboard-recent-tbody');
    if (!stats.recentBlogs || !stats.recentBlogs.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No articles found. Write your first article!</td></tr>';
      return;
    }

    tbody.innerHTML = stats.recentBlogs.map(b => `
      <tr>
        <td>
          <div class="table-title-cell">
            <strong>${escapeHtml(b.title)}</strong>
            <span>${escapeHtml(b.slug)}</span>
          </div>
        </td>
        <td><span class="cat-token">${escapeHtml(b.category)}</span></td>
        <td>
          <span class="status-indicator ${b.status === 'published' ? 'published' : 'draft'}">
            <span class="status-indicator-dot"></span>
            <span>${b.status === 'published' ? 'Live' : 'Draft'}</span>
          </span>
        </td>
        <td class="tabular-nums">${formatDate(b.updated_at || b.published_at)}</td>
        <td class="text-right">
          <div class="table-actions">
            <a href="#editor/${b.id}" class="btn btn-outline btn-xs" title="Edit Article"><i class="fa-solid fa-pen"></i> Edit</a>
            <button type="button" class="action-icon-btn danger dashboard-blog-delete-btn" data-id="${b.id}" data-title="${escapeHtml(b.title)}" title="Delete Story"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.dashboard-blog-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        promptDeleteBlog(btn.getAttribute('data-id'), btn.getAttribute('data-title'));
      });
    });

    // Load rolling editorial activity logs (last 30 changes)
    await loadActivityLogs();
  }

  async function loadActivityLogs() {
    const tbody = document.getElementById('activity-logs-tbody');
    const countEl = document.getElementById('activity-log-count');
    if (!tbody) return;

    const res = await apiFetch('/api/admin/activity-logs');
    if (!res.success || !res.data || res.data.length === 0) {
      if (countEl) countEl.textContent = '0';
      tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No editorial changes recorded yet (developer actions are excluded).</td></tr>';
      return;
    }

    const logs = res.data;
    if (countEl) countEl.textContent = logs.length;

    const actionBadgeMap = {
      create: { class: 'badge-act-create', icon: 'fa-plus' },
      publish: { class: 'badge-act-publish', icon: 'fa-paper-plane' },
      update: { class: 'badge-act-update', icon: 'fa-pen-to-square' },
      rename: { class: 'badge-act-update', icon: 'fa-pen-clip' },
      unpublish: { class: 'badge-act-unpublish', icon: 'fa-arrow-rotate-left' },
      duplicate: { class: 'badge-act-duplicate', icon: 'fa-copy' },
      delete: { class: 'badge-act-delete', icon: 'fa-trash' }
    };

    tbody.innerHTML = logs.map(l => {
      const badgeConfig = actionBadgeMap[l.action] || { class: 'badge-act-update', icon: 'fa-pen' };
      const roleName = l.user_role === 'admin' ? 'Administrator' : 'Marketing Desk';
      const roleColor = l.user_role === 'admin' ? '#38bdf8' : '#c084fc';
      const isDeleted = l.action === 'delete';
      const titleHtml = (!isDeleted && l.blog_id)
        ? `<a href="#editor/${escapeHtml(l.blog_id)}" class="activity-article-link" title="${escapeHtml(l.blog_title)}">${escapeHtml(l.blog_title)}</a>`
        : `<span class="activity-article-deleted" title="${escapeHtml(l.blog_title)}">${escapeHtml(l.blog_title)}</span>`;

      return `
        <tr>
          <td class="tabular-nums th-timestamp-cell">
            <div class="activity-time-text">${new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
            <span class="activity-date-text">${formatDate(l.created_at)}</span>
          </td>
          <td>
            <div class="table-title-cell">
              <strong>${escapeHtml(l.user_name)}</strong>
              <span class="activity-user-handle">
                <span>@${escapeHtml(l.username)}</span>
                <span style="font-size: 10px; color: ${roleColor}; font-weight: 500;">(${roleName})</span>
              </span>
            </div>
          </td>
          <td>
            <span class="badge ${badgeConfig.class}">
              <i class="fa-solid ${badgeConfig.icon}" style="font-size: 9.5px; margin-right: 3px;"></i>
              ${escapeHtml(l.action_label || l.action)}
            </span>
          </td>
          <td class="td-article-cell">
            ${titleHtml}
          </td>
          <td class="td-summary-cell">
            <div class="activity-summary-text">${escapeHtml(l.details || 'No details provided')}</div>
          </td>
        </tr>
      `;
    }).join('');
  }

  /* ==========================================================================
     5. Blog Articles Listing View
     ========================================================================== */
  async function loadBlogsList() {
    const params = new URLSearchParams();
    if (App.statusFilter !== 'all') params.append('status', App.statusFilter);
    if (App.categoryFilter !== 'all') params.append('category', App.categoryFilter);
    if (App.searchQuery.trim()) params.append('search', App.searchQuery.trim());

    const res = await apiFetch(`/api/admin/blogs?${params.toString()}`);
    if (!res.success) return;

    App.blogs = res.data || [];

    // Update tab counts
    const totalCount = App.blogs.length;
    const pubCount = App.blogs.filter(b => b.status === 'published').length;
    const draftCount = App.blogs.filter(b => b.status === 'draft').length;

    document.getElementById('tab-count-all').textContent = totalCount;
    document.getElementById('tab-count-pub').textContent = pubCount;
    document.getElementById('tab-count-draft').textContent = draftCount;

    renderBlogsTable();
  }

  function renderBlogsTable() {
    const tbody = document.getElementById('blogs-list-tbody');
    const emptyState = document.getElementById('blogs-empty-state');

    let filtered = App.blogs;
    if (App.statusFilter !== 'all') {
      filtered = filtered.filter(b => b.status === App.statusFilter);
    }
    if (App.categoryFilter !== 'all') {
      filtered = filtered.filter(b => b.category.toLowerCase() === App.categoryFilter.toLowerCase());
    }

    if (!filtered.length) {
      tbody.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    tbody.innerHTML = filtered.map(b => {
      const thumb = b.featured_image || '/images/brand icon.jpeg';
      const isPub = b.status === 'published';

      return `
        <tr data-blog-id="${b.id}">
          <td>
            <img src="${thumb}" alt="" class="table-media-thumb" loading="lazy">
          </td>
          <td>
            <div class="table-title-cell">
              <strong>${escapeHtml(b.title)}</strong>
              <span>${escapeHtml(b.slug)}</span>
            </div>
          </td>
          <td><span class="cat-token">${escapeHtml(b.category)}</span></td>
          <td>${escapeHtml(b.author)}</td>
          <td>
            <button type="button" class="status-indicator ${isPub ? 'published' : 'draft'} blog-toggle-status-btn"
              data-id="${b.id}" data-status="${b.status}" title="Toggle status" style="background: transparent; border: none; cursor: pointer;">
              <span class="status-indicator-dot"></span>
              <span>${isPub ? 'Live' : 'Draft'}</span>
            </button>
          </td>
          <td class="tabular-nums">${b.views || 0}</td>
          <td class="tabular-nums">${formatDate(b.published_at || b.updated_at || b.date)}</td>
          <td class="text-right">
            <div class="table-actions">
              <a href="#editor/${b.id}" class="btn btn-outline btn-xs" title="Edit Article"><i class="fa-solid fa-pen"></i> Edit</a>
              <button type="button" class="action-icon-btn blog-preview-btn" data-id="${b.id}" title="Preview Article"><i class="fa-solid fa-eye"></i></button>
              <button type="button" class="action-icon-btn blog-duplicate-btn" data-id="${b.id}" title="Duplicate"><i class="fa-regular fa-copy"></i></button>
              <button type="button" class="action-icon-btn danger blog-delete-btn" data-id="${b.id}" data-title="${escapeHtml(b.title)}" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach event listeners to table action buttons
    tbody.querySelectorAll('.blog-toggle-status-btn').forEach(btn => {
      btn.addEventListener('click', () => toggleBlogStatus(btn.getAttribute('data-id'), btn.getAttribute('data-status')));
    });

    tbody.querySelectorAll('.blog-preview-btn').forEach(btn => {
      btn.addEventListener('click', () => previewBlogById(btn.getAttribute('data-id')));
    });

    tbody.querySelectorAll('.blog-duplicate-btn').forEach(btn => {
      btn.addEventListener('click', () => duplicateBlog(btn.getAttribute('data-id')));
    });

    tbody.querySelectorAll('.blog-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteBlog(btn.getAttribute('data-id'), btn.getAttribute('data-title')));
    });
  }

  async function toggleBlogStatus(id, currentStatus) {
    const newStatus = currentStatus === 'published' ? 'draft' : 'published';
    const res = await apiFetch(`/api/admin/blogs/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus })
    });

    if (res.success) {
      showToast(`Article status changed to ${newStatus}.`, 'success');
      loadBlogsList();
      loadDashboard();
    } else {
      showToast(res.error || 'Failed to update status', 'error');
    }
  }

  /* ==========================================================================
     Draft Limit (Max 5 Drafts) Management Modal
     ========================================================================== */
  async function openDraftLimitModal(providedDrafts = null) {
    const modal = document.getElementById('draft-limit-modal');
    if (!modal) return;

    let drafts = providedDrafts;
    if (!drafts || !Array.isArray(drafts)) {
      const res = await apiFetch('/api/admin/blogs/drafts');
      drafts = (res && res.data) ? res.data : App.blogs.filter(b => b.status === 'draft');
    }

    const listEl = document.getElementById('draft-limit-list');
    if (!drafts || drafts.length === 0) {
      listEl.innerHTML = '<p class="text-muted" style="font-size: 12px; text-align: center; padding: 12px;">No active drafts found.</p>';
    } else {
      listEl.innerHTML = drafts.map(d => `
        <div class="draft-limit-item">
          <div class="draft-limit-item-info">
            <span class="draft-limit-item-title">${escapeHtml(d.title)}</span>
            <span class="draft-limit-item-meta">Updated: ${formatDate(d.updated_at || d.created_at)} • ${escapeHtml(d.category || 'Business Travel')}</span>
          </div>
          <div class="draft-limit-item-actions">
            <a href="#editor/${d.id}" class="btn btn-outline btn-xs draft-open-btn"><i class="fa-solid fa-pen"></i> Edit</a>
            <button type="button" class="btn btn-danger btn-xs draft-delete-btn" data-id="${d.id}" data-title="${escapeHtml(d.title)}"><i class="fa-solid fa-trash"></i> Delete</button>
          </div>
        </div>
      `).join('');

      // Wire delete buttons inside prompt modal
      listEl.querySelectorAll('.draft-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const title = btn.getAttribute('data-title');
          if (confirm(`Delete draft "${title}" to free up space?`)) {
            const delRes = await apiFetch(`/api/admin/blogs/${id}`, { method: 'DELETE' });
            if (delRes.success) {
              showToast('Draft deleted. You now have capacity to save a new draft.', 'success');
              const item = btn.closest('.draft-limit-item');
              if (item) item.remove();
              await loadBlogsList();
              await loadDashboard();

              const remaining = listEl.querySelectorAll('.draft-limit-item');
              if (remaining.length < 5) {
                setTimeout(() => {
                  modal.style.display = 'none';
                }, 500);
              }
            } else {
              showToast(delRes.error || 'Failed to delete draft', 'error');
            }
          }
        });
      });

      // Wire open buttons inside prompt modal
      listEl.querySelectorAll('.draft-open-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          modal.style.display = 'none';
        });
      });
    }

    modal.style.display = 'flex';
  }

  async function duplicateBlog(id) {
    const draftCount = App.blogs.filter(b => b.status === 'draft').length;
    if (draftCount >= 5) {
      openDraftLimitModal();
      return;
    }

    const res = await apiFetch(`/api/admin/blogs/${id}/duplicate`, { method: 'POST' });
    if (res.success && res.data) {
      showToast('Article duplicated as draft.', 'success');
      loadBlogsList();
      loadDashboard();
      window.location.hash = `editor/${res.data.id}`;
    } else {
      if (res.code === 'DRAFT_LIMIT_REACHED') {
        openDraftLimitModal(res.drafts);
      } else {
        showToast(res.error || 'Failed to duplicate article', 'error');
      }
    }
  }

  let pendingDelete = null;

  function promptDeleteBlog(id, title, onSuccess = null) {
    const modal = document.getElementById('delete-confirm-modal');
    if (!modal) {
      if (confirm(`Are you sure you want to permanently delete "${title}"? This cannot be undone.`)) {
        executeDeleteBlog(id, onSuccess);
      }
      return;
    }

    pendingDelete = { id, title, onSuccess };
    const titleEl = document.getElementById('delete-modal-article-title');
    if (titleEl) titleEl.textContent = title || 'Untitled Article';
    modal.style.display = 'flex';
  }

  async function executeDeleteBlog(id, onSuccess = null) {
    const res = await apiFetch(`/api/admin/blogs/${id}`, { method: 'DELETE' });
    if (res.success) {
      showToast('Article permanently removed from CMS & live website.', 'success');
      await loadBlogsList();
      await loadDashboard();
      if (typeof onSuccess === 'function') {
        onSuccess();
      }
    } else {
      showToast(res.error || 'Failed to delete article', 'error');
    }
  }

  function deleteBlog(id, title, onSuccess = null) {
    promptDeleteBlog(id, title, onSuccess);
  }

  /* ==========================================================================
     6. Blog Article Editor (Create / Edit)
     ========================================================================== */
  async function openEditor(blogId = null) {
    switchView('editor');
    App.activeEditingBlogId = blogId;
    App.isDirty = false;
    App.rawHtmlMode = false;

    // Show or hide the Delete Story button in the editor header
    const editorDeleteBtn = document.getElementById('editor-delete-btn');
    if (editorDeleteBtn) {
      editorDeleteBtn.style.display = blogId ? 'inline-flex' : 'none';
    }

    // Reset Form Elements
    document.getElementById('editor-article-id').value = '';
    document.getElementById('editor-title').value = '';
    document.getElementById('editor-slug').value = '';
    document.getElementById('editor-excerpt').value = '';
    document.getElementById('editor-body-rich').innerHTML = '';
    document.getElementById('editor-body-raw').value = '';
    document.getElementById('editor-body-raw').style.display = 'none';
    document.getElementById('editor-body-rich').style.display = 'block';
    document.getElementById('editor-featured-image-url').value = '';
    document.getElementById('editor-featured-alt').value = '';
    document.getElementById('featured-img-preview-wrap').style.display = 'none';
    document.getElementById('featured-upload-dropzone').style.display = 'block';
    document.getElementById('editor-status-select').value = 'draft';
    document.getElementById('editor-pub-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('editor-author').value = App.user ? App.user.full_name : 'Petals Hospitality Editorial';
    document.getElementById('editor-author-role').value = 'Corporate Stays Desk';
    document.getElementById('editor-seo-title').value = '';
    document.getElementById('editor-seo-desc').value = '';
    document.getElementById('editor-seo-keywords').value = '';
    App.tagsList = [];
    renderTagChips();

    updateSaveState(false);
    updateEditorStatusPill('draft');

    if (blogId) {
      // Editing existing blog
      const res = await apiFetch(`/api/admin/blogs/${blogId}`);
      if (!res.success || !res.data) {
        showToast('Article not found', 'error');
        window.location.hash = 'blogs';
        return;
      }

      const b = res.data;
      document.getElementById('editor-article-id').value = b.id;
      document.getElementById('editor-title').value = b.title;
      document.getElementById('editor-slug').value = b.slug;
      document.getElementById('editor-category').value = b.category;
      document.getElementById('editor-excerpt').value = b.excerpt || '';
      document.getElementById('editor-body-rich').innerHTML = b.content || '';
      document.getElementById('editor-body-raw').value = b.content || '';
      document.getElementById('editor-status-select').value = b.status || 'draft';
      document.getElementById('editor-pub-date').value = b.published_at ? b.published_at.split('T')[0] : (b.date || '');
      document.getElementById('editor-author').value = b.author || '';
      document.getElementById('editor-author-role').value = b.authorRole || '';
      document.getElementById('editor-seo-title').value = b.seo_title || b.title;
      document.getElementById('editor-seo-desc').value = b.seo_description || b.excerpt || '';
      document.getElementById('editor-seo-keywords').value = b.seo_keywords || '';

      if (b.featured_image) {
        setFeaturedImage(b.featured_image, b.featured_image_alt || b.title);
      }

      App.tagsList = Array.isArray(b.tags) ? [...b.tags] : [];
      renderTagChips();

      updateEditorStatusPill(b.status);
    } else {
      // New article defaults
      const firstCat = App.categories[0] ? App.categories[0].name : 'Business Travel';
      document.getElementById('editor-category').value = firstCat;
    }

    updateWordCountAndReadingTime();
    updateSerpPreview();
    updateCharCounters();
  }

  function updateEditorStatusPill(status) {
    const pill = document.getElementById('editor-status-indicator');
    const isPub = status === 'published';
    pill.classList.toggle('published', isPub);
    pill.querySelector('.status-text').textContent = isPub ? 'Published' : 'Draft';

    const publishBtn = document.getElementById('editor-publish-btn');
    if (publishBtn) {
      publishBtn.innerHTML = isPub
        ? '<i class="fa-solid fa-cloud-arrow-up"></i> Update Published'
        : '<i class="fa-solid fa-paper-plane"></i> Publish Now';
    }
  }

  function updateSaveState(isDirty) {
    App.isDirty = isDirty;
    const el = document.getElementById('editor-save-state');
    if (el) {
      el.textContent = isDirty ? '● Unsaved changes' : 'All changes saved';
      el.style.color = isDirty ? 'var(--status-draft)' : 'var(--text-muted)';
    }
  }

  function generateSlug(text) {
    return text.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  // WYSIWYG commands
  function execEditorCmd(cmd, value = null) {
    document.getElementById('editor-body-rich').focus();
    document.execCommand(cmd, false, value);
    updateWordCountAndReadingTime();
    updateSaveState(true);
  }

  function toggleRawHtmlMode() {
    const richEl = document.getElementById('editor-body-rich');
    const rawEl = document.getElementById('editor-body-raw');
    const btn = document.getElementById('toolbar-source-btn');

    App.rawHtmlMode = !App.rawHtmlMode;
    btn.classList.toggle('active', App.rawHtmlMode);

    if (App.rawHtmlMode) {
      rawEl.value = richEl.innerHTML;
      richEl.style.display = 'none';
      rawEl.style.display = 'block';
      rawEl.focus();
    } else {
      richEl.innerHTML = rawEl.value;
      rawEl.style.display = 'none';
      richEl.style.display = 'block';
      richEl.focus();
      updateWordCountAndReadingTime();
    }
    updateSaveState(true);
  }

  function updateWordCountAndReadingTime() {
    const richEl = document.getElementById('editor-body-rich');
    const text = (richEl.innerText || '').trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const mins = Math.max(1, Math.ceil(words / 200));

    document.getElementById('editor-word-count').textContent = `${words} word${words === 1 ? '' : 's'}`;
    document.getElementById('editor-calc-readtime').textContent = `${mins} min read`;
  }

  function updateCharCounters() {
    const excerpt = document.getElementById('editor-excerpt').value;
    const seoTitle = document.getElementById('editor-seo-title').value;
    const seoDesc = document.getElementById('editor-seo-desc').value;

    const excerptCounter = document.getElementById('excerpt-char-count');
    excerptCounter.textContent = `${excerpt.length} / 250`;
    excerptCounter.className = `char-counter ${excerpt.length > 250 ? 'danger' : ''}`;

    const seoTitleCounter = document.getElementById('seo-title-count');
    seoTitleCounter.textContent = `${seoTitle.length} / 60`;
    seoTitleCounter.className = `char-counter ${seoTitle.length > 60 ? 'warning' : ''}`;

    const seoDescCounter = document.getElementById('seo-desc-count');
    seoDescCounter.textContent = `${seoDesc.length} / 160`;
    seoDescCounter.className = `char-counter ${seoDesc.length > 160 ? 'warning' : ''}`;
  }

  function updateSerpPreview() {
    const title = document.getElementById('editor-title').value.trim() || 'Article Title';
    const seoTitle = document.getElementById('editor-seo-title').value.trim() || title;
    const slug = document.getElementById('editor-slug').value.trim() || 'article-slug';
    const desc = document.getElementById('editor-seo-desc').value.trim() || document.getElementById('editor-excerpt').value.trim() || 'Article excerpt will appear here as the Google snippet...';

    document.getElementById('serp-title-preview').textContent = `${seoTitle} | Petals Suites & Hotel, Bangalore`;
    document.getElementById('serp-slug-preview').textContent = slug;
    document.getElementById('serp-desc-preview').textContent = desc;
  }

  // Tags Chips handling
  function renderTagChips() {
    const container = document.getElementById('tags-container');
    const input = document.getElementById('tag-text-input');

    // Remove old chips
    container.querySelectorAll('.tag-chip').forEach(c => c.remove());

    App.tagsList.forEach((tag, idx) => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `
        <span>#${escapeHtml(tag)}</span>
        <i class="fa-solid fa-xmark tag-chip-remove" data-idx="${idx}"></i>
      `;
      container.insertBefore(chip, input);
    });

    container.querySelectorAll('.tag-chip-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = Number(btn.getAttribute('data-idx'));
        App.tagsList.splice(idx, 1);
        renderTagChips();
        updateSaveState(true);
      });
    });
  }

  function setFeaturedImage(url, alt = '') {
    document.getElementById('editor-featured-image-url').value = url;
    document.getElementById('featured-img-preview').src = url.startsWith('http') || url.startsWith('data:') ? url : `/${url.replace(/^\//, '')}`;
    document.getElementById('featured-img-preview-wrap').style.display = 'block';
    document.getElementById('featured-upload-dropzone').style.display = 'none';
    if (alt) {
      document.getElementById('editor-featured-alt').value = alt;
    }
    updateSaveState(true);
  }

  function removeFeaturedImage() {
    document.getElementById('editor-featured-image-url').value = '';
    document.getElementById('featured-img-preview').src = '';
    document.getElementById('featured-img-preview-wrap').style.display = 'none';
    document.getElementById('featured-upload-dropzone').style.display = 'block';
    updateSaveState(true);
  }

  async function saveArticle(forceStatus = null) {
    const title = document.getElementById('editor-title').value.trim();
    if (!title) {
      showToast('Article title is required.', 'error');
      document.getElementById('editor-title').focus();
      return;
    }

    if (App.rawHtmlMode) {
      document.getElementById('editor-body-rich').innerHTML = document.getElementById('editor-body-raw').value;
    }

    const content = document.getElementById('editor-body-rich').innerHTML.trim();
    if (!content) {
      showToast('Article body cannot be empty.', 'error');
      return;
    }

    const id = document.getElementById('editor-article-id').value;
    const slug = document.getElementById('editor-slug').value.trim() || generateSlug(title);
    const category = document.getElementById('editor-category').value;
    const excerpt = document.getElementById('editor-excerpt').value.trim();
    const featured_image = document.getElementById('editor-featured-image-url').value;
    const featured_image_alt = document.getElementById('editor-featured-alt').value.trim() || title;
    const author = document.getElementById('editor-author').value.trim() || 'Petals Hospitality Editorial';
    const author_role = document.getElementById('editor-author-role').value.trim() || 'Corporate Stays Desk';
    const status = forceStatus || document.getElementById('editor-status-select').value;
    const published_at = document.getElementById('editor-pub-date').value;
    const seo_title = document.getElementById('editor-seo-title').value.trim() || title;
    const seo_description = document.getElementById('editor-seo-desc').value.trim() || excerpt;
    const seo_keywords = document.getElementById('editor-seo-keywords').value.trim();

    // Check draft quota if creating a new draft or switching from published to draft
    const draftCount = App.blogs.filter(b => b.status === 'draft').length;
    if (status === 'draft' && !id && draftCount >= 5) {
      openDraftLimitModal();
      return;
    }

    const payload = {
      title,
      slug,
      category,
      excerpt,
      content,
      featured_image,
      featured_image_alt,
      author,
      author_role,
      status,
      published_at,
      tags: App.tagsList,
      seo_title,
      seo_description,
      seo_keywords
    };

    let res = null;
    if (id) {
      // Update existing
      res = await apiFetch(`/api/admin/blogs/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      // Create new
      res = await apiFetch('/api/admin/blogs', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }

    if (res.success && res.data) {
      App.isDirty = false;
      document.getElementById('editor-article-id').value = res.data.id;
      document.getElementById('editor-slug').value = res.data.slug;
      document.getElementById('editor-status-select').value = res.data.status;
      updateEditorStatusPill(res.data.status);
      updateSaveState(false);

      if (res.data.status === 'published') {
        showToast('Article published. Changes are live on petalshotels.com.', 'success', 4000);
      } else {
        showToast('Article draft saved.', 'success');
      }

      // Update URL hash without retriggering full load
      if (!id) {
        history.replaceState(null, '', `#editor/${res.data.id}`);
      }

      loadDashboard();
    } else {
      if (res.code === 'DRAFT_LIMIT_REACHED') {
        openDraftLimitModal(res.drafts);
      } else {
        showToast(res.error || 'Failed to save article', 'error');
      }
    }
  }

  /* ==========================================================================
     7. Live Website Preview Modal
     ========================================================================== */
  function openLivePreview() {
    const title = document.getElementById('editor-title').value.trim() || 'Untitled Article';
    const category = document.getElementById('editor-category').value || 'Business Travel';
    const author = document.getElementById('editor-author').value || 'Petals Hospitality Editorial';
    const date = document.getElementById('editor-pub-date').value || new Date().toISOString().split('T')[0];
    const imgUrl = document.getElementById('editor-featured-image-url').value;
    const status = document.getElementById('editor-status-select').value;

    let content = App.rawHtmlMode ? document.getElementById('editor-body-raw').value : document.getElementById('editor-body-rich').innerHTML;

    document.getElementById('sim-topic-badge').textContent = category.toUpperCase();
    document.getElementById('sim-title-text').textContent = title;
    document.getElementById('sim-author-name').textContent = author;
    document.getElementById('sim-date-text').textContent = formatDate(date);
    document.getElementById('sim-readtime-text').textContent = document.getElementById('editor-calc-readtime').textContent;
    document.getElementById('sim-body-content').innerHTML = content;

    const bannerWrap = document.getElementById('sim-banner-wrap');
    const bannerImg = document.getElementById('sim-banner-img');
    if (imgUrl) {
      bannerImg.src = imgUrl.startsWith('http') || imgUrl.startsWith('data:') ? imgUrl : `/${imgUrl.replace(/^\//, '')}`;
      bannerWrap.style.display = 'block';
    } else {
      bannerWrap.style.display = 'none';
    }

    const tagsContainer = document.getElementById('sim-tags-container');
    tagsContainer.innerHTML = App.tagsList.map(t => `<span class="sim-tag-item">#${escapeHtml(t)}</span>`).join('');

    document.getElementById('modal-preview-status-pill').textContent = status === 'published' ? 'Live Published' : 'Draft Preview';
    document.getElementById('preview-modal').style.display = 'flex';
  }

  function previewBlogById(id) {
    const blog = App.blogs.find(b => b.id === id);
    if (!blog) return;

    document.getElementById('sim-topic-badge').textContent = (blog.category || 'Business Travel').toUpperCase();
    document.getElementById('sim-title-text').textContent = blog.title;
    document.getElementById('sim-author-name').textContent = blog.author;
    document.getElementById('sim-date-text').textContent = formatDate(blog.published_at || blog.date);
    document.getElementById('sim-readtime-text').textContent = blog.readTime || '5 min read';
    document.getElementById('sim-body-content').innerHTML = blog.content;

    const bannerWrap = document.getElementById('sim-banner-wrap');
    const bannerImg = document.getElementById('sim-banner-img');
    if (blog.featured_image) {
      bannerImg.src = blog.featured_image.startsWith('http') || blog.featured_image.startsWith('data:') ? blog.featured_image : `/${blog.featured_image.replace(/^\//, '')}`;
      bannerWrap.style.display = 'block';
    } else {
      bannerWrap.style.display = 'none';
    }

    const tagsContainer = document.getElementById('sim-tags-container');
    tagsContainer.innerHTML = (blog.tags || []).map(t => `<span class="sim-tag-item">#${escapeHtml(t)}</span>`).join('');

    document.getElementById('modal-preview-status-pill').textContent = blog.status === 'published' ? 'Live Published' : 'Draft Preview';
    document.getElementById('preview-modal').style.display = 'flex';
  }

  /* ==========================================================================
     8. Category Management View
     ========================================================================== */
  async function loadCategories() {
    const res = await apiFetch('/api/admin/categories');
    if (!res.success) return;

    App.categories = res.data || [];

    // Populate category dropdowns
    const editorCatSelect = document.getElementById('editor-category');
    const filterCatSelect = document.getElementById('blogs-category-filter');

    if (editorCatSelect) {
      editorCatSelect.innerHTML = App.categories.map(c => `
        <option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>
      `).join('');
    }

    if (filterCatSelect) {
      filterCatSelect.innerHTML = `
        <option value="all">All Categories</option>
        ${App.categories.map(c => `
          <option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>
        `).join('')}
      `;
    }

    renderCategoriesTable();
  }

  function renderCategoriesTable() {
    const tbody = document.getElementById('categories-table-tbody');
    if (!tbody) return;

    if (!App.categories.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No categories created yet.</td></tr>';
      return;
    }

    tbody.innerHTML = App.categories.map(c => `
      <tr>
        <td><strong>${escapeHtml(c.name)}</strong></td>
        <td><code>${escapeHtml(c.slug)}</code></td>
        <td><span class="badge badge-cat">${c.blog_count || 0} articles</span></td>
        <td>${c.display_order || 0}</td>
        <td class="text-right">
          <div class="table-actions">
            <button type="button" class="action-icon-btn edit-cat-btn" data-id="${c.id}" title="Edit Category"><i class="fa-solid fa-pen"></i></button>
            <button type="button" class="action-icon-btn danger delete-cat-btn" data-id="${c.id}" data-name="${escapeHtml(c.name)}" title="Delete Category"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.edit-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => editCategory(btn.getAttribute('data-id')));
    });

    tbody.querySelectorAll('.delete-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteCategory(btn.getAttribute('data-id'), btn.getAttribute('data-name')));
    });
  }

  function editCategory(id) {
    const cat = App.categories.find(c => c.id === Number(id));
    if (!cat) return;

    document.getElementById('cat-id').value = cat.id;
    document.getElementById('cat-name').value = cat.name;
    document.getElementById('cat-slug').value = cat.slug;
    document.getElementById('cat-desc').value = cat.description || '';
    document.getElementById('cat-order').value = cat.display_order || 0;

    document.getElementById('cat-form-title').textContent = 'Edit Category';
    document.getElementById('cat-submit-btn').textContent = 'Update Category';
    document.getElementById('cat-cancel-edit-btn').style.display = 'inline-flex';
    document.getElementById('cat-name').focus();
  }

  function resetCategoryForm() {
    document.getElementById('cat-id').value = '';
    document.getElementById('cat-name').value = '';
    document.getElementById('cat-slug').value = '';
    document.getElementById('cat-desc').value = '';
    document.getElementById('cat-order').value = 0;

    document.getElementById('cat-form-title').textContent = 'Add New Category';
    document.getElementById('cat-submit-btn').textContent = 'Save Category';
    document.getElementById('cat-cancel-edit-btn').style.display = 'none';
  }

  async function handleCategorySubmit(e) {
    e.preventDefault();
    const id = document.getElementById('cat-id').value;
    const name = document.getElementById('cat-name').value.trim();
    const slug = document.getElementById('cat-slug').value.trim();
    const description = document.getElementById('cat-desc').value.trim();
    const display_order = parseInt(document.getElementById('cat-order').value, 10) || 0;

    if (!name) {
      showToast('Category name is required', 'error');
      return;
    }

    let res = null;
    if (id) {
      res = await apiFetch(`/api/admin/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, slug, description, display_order })
      });
    } else {
      res = await apiFetch('/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify({ name, slug, description, display_order })
      });
    }

    if (res.success) {
      showToast(`Category ${id ? 'updated' : 'created'} successfully`, 'success');
      resetCategoryForm();
      loadCategories();
    } else {
      showToast(res.error || 'Failed to save category', 'error');
    }
  }

  async function deleteCategory(id, name) {
    if (!confirm(`Are you sure you want to delete category "${name}"?`)) return;

    const res = await apiFetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
    if (res.success) {
      showToast('Category deleted', 'success');
      loadCategories();
    } else {
      showToast(res.error || 'Failed to delete category', 'error');
    }
  }

  /* ==========================================================================
     9. Media Library View & Upload Handler
     ========================================================================== */
  const MAX_MEDIA_QUOTA = 75;

  async function loadMediaLibrary() {
    const res = await apiFetch('/api/admin/media');
    if (!res.success) return;

    App.media = res.data || [];
    updateMediaQuotaUi();
    renderMediaGrid();
  }

  function updateMediaQuotaUi() {
    const count = App.media.length;
    const badge = document.getElementById('media-count-badge');
    const banner = document.getElementById('media-limit-banner');
    const dropzone = document.getElementById('media-page-dropzone');
    const dropTitle = document.getElementById('media-dropzone-title');
    const dropDesc = document.getElementById('media-dropzone-desc');

    if (badge) {
      if (count >= MAX_MEDIA_QUOTA) {
        badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="margin-right: 4px;"></i> ${count} / ${MAX_MEDIA_QUOTA} photos (Full)`;
        badge.style.background = 'rgba(239, 68, 68, 0.16)';
        badge.style.color = '#ef4444';
        badge.style.borderColor = 'rgba(239, 68, 68, 0.35)';
      } else if (count >= 65) {
        badge.innerHTML = `<i class="fa-solid fa-circle-exclamation" style="margin-right: 4px;"></i> ${count} / ${MAX_MEDIA_QUOTA} photos`;
        badge.style.background = 'rgba(245, 158, 11, 0.16)';
        badge.style.color = '#f59e0b';
        badge.style.borderColor = 'rgba(245, 158, 11, 0.35)';
      } else {
        badge.innerHTML = `<i class="fa-regular fa-image" style="margin-right: 4px;"></i> ${count} / ${MAX_MEDIA_QUOTA} photos`;
        badge.style.background = 'var(--bg-panel)';
        badge.style.color = 'var(--text-secondary)';
        badge.style.borderColor = 'var(--border-hairline)';
      }
    }

    if (banner) {
      banner.style.display = count >= MAX_MEDIA_QUOTA ? 'flex' : 'none';
    }

    if (dropzone && dropTitle && dropDesc) {
      if (count >= MAX_MEDIA_QUOTA) {
        dropzone.style.opacity = '0.6';
        dropTitle.textContent = 'Storage Quota Limit Reached';
        dropDesc.textContent = `Library contains maximum allowed photos (${MAX_MEDIA_QUOTA}/${MAX_MEDIA_QUOTA}). Delete existing photos to upload more.`;
      } else {
        dropzone.style.opacity = '1';
        dropTitle.textContent = 'Drag & Drop Photography Here';
        dropDesc.textContent = `Supports high-resolution JPG, PNG, WebP up to 10MB per file (${MAX_MEDIA_QUOTA - count} slots remaining)`;
      }
    }
  }

  function renderMediaGrid() {
    const grid = document.getElementById('media-library-grid');
    const emptyState = document.getElementById('media-empty-state');
    const q = (document.getElementById('media-search-input').value || '').toLowerCase();

    let filtered = App.media;
    if (q) {
      filtered = filtered.filter(m => m.filename.toLowerCase().includes(q) || (m.alt_text && m.alt_text.toLowerCase().includes(q)));
    }

    if (!filtered.length) {
      grid.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    grid.innerHTML = filtered.map(m => `
      <div class="media-card" data-id="${m.id}" data-url="${m.url}">
        <div class="media-thumb-wrap">
          <img src="/${m.url.replace(/^\//, '')}" alt="${escapeHtml(m.alt_text || m.filename)}" class="media-thumb-img" loading="lazy">
        </div>
        <div class="media-card-info">
          <span class="media-card-name" title="${escapeHtml(m.original_name || m.filename)}">${escapeHtml(m.original_name || m.filename)}</span>
          <div class="media-card-meta">
            <span>${formatBytes(m.size)}</span>
            <span>${formatDate(m.created_at)}</span>
          </div>
          <div class="media-card-actions">
            <button type="button" class="btn btn-outline btn-xs media-copy-btn" data-url="${m.url}" title="Copy URL"><i class="fa-regular fa-copy"></i> Copy</button>
            <button type="button" class="btn btn-danger btn-xs media-delete-btn" data-id="${m.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.media-copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = btn.getAttribute('data-url');
        const fullUrl = `${window.location.origin}/${url.replace(/^\//, '')}`;
        navigator.clipboard.writeText(fullUrl).then(() => {
          showToast('Image URL copied to clipboard!', 'info');
        }).catch(() => {
          prompt('Copy image URL:', fullUrl);
        });
      });
    });

    grid.querySelectorAll('.media-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteMediaItem(btn.getAttribute('data-id'));
      });
    });
  }

  async function uploadFileAsBase64(file, altText = '') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result;
        const res = await apiFetch('/api/admin/media/upload', {
          method: 'POST',
          body: JSON.stringify({
            filename: file.name,
            base64Data,
            altText
          })
        });
        resolve(res);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  async function handleMediaUploadFiles(files) {
    if (!files || !files.length) return;

    const currentCount = App.media.length;
    if (currentCount >= MAX_MEDIA_QUOTA) {
      showToast(`Media library storage limit reached (${MAX_MEDIA_QUOTA}/${MAX_MEDIA_QUOTA} photos). Please delete existing photos to upload more.`, 'error');
      return;
    }

    const availableSlots = MAX_MEDIA_QUOTA - currentCount;
    const fileArray = Array.from(files);
    const filesToUpload = fileArray.slice(0, availableSlots);

    if (fileArray.length > availableSlots) {
      showToast(`Only ${availableSlots} more photo${availableSlots === 1 ? '' : 's'} can be added before reaching the ${MAX_MEDIA_QUOTA}-photo limit. Excess files were skipped.`, 'warning');
    }

    showToast(`Uploading ${filesToUpload.length} image${filesToUpload.length === 1 ? '' : 's'}...`, 'info');

    let uploaded = 0;
    for (const file of filesToUpload) {
      if (!file.type.startsWith('image/')) {
        showToast(`Skipped non-image file: ${file.name}`, 'error');
        continue;
      }
      try {
        const res = await uploadFileAsBase64(file);
        if (res.success) {
          uploaded++;
        } else {
          showToast(res.error || `Failed to upload ${file.name}`, 'error');
          if (res.error && res.error.includes('limit reached')) {
            break;
          }
        }
      } catch (err) {
        showToast(`Error uploading ${file.name}`, 'error');
      }
    }

    if (uploaded > 0) {
      showToast(`Successfully uploaded ${uploaded} image${uploaded === 1 ? '' : 's'}!`, 'success');
      loadMediaLibrary();
      loadDashboard();
    }
  }

  async function deleteMediaItem(id) {
    if (!confirm('Are you sure you want to delete this media file?')) return;

    const res = await apiFetch(`/api/admin/media/${id}`, { method: 'DELETE' });
    if (res.success) {
      showToast('Media file deleted', 'success');
      loadMediaLibrary();
      loadDashboard();
    } else {
      showToast(res.error || 'Failed to delete media', 'error');
    }
  }

  // Media Picker Modal (when selecting image for editor)
  async function openMediaPicker(callback) {
    App.mediaPickerCallback = callback;
    const modal = document.getElementById('media-picker-modal');
    const grid = document.getElementById('media-picker-grid');

    if (!App.media.length) {
      await loadMediaLibrary();
    }

    if (!App.media.length) {
      grid.innerHTML = '<p class="text-center py-4 text-muted">No media in library yet. Please upload images in the Media Library.</p>';
    } else {
      grid.innerHTML = App.media.map(m => `
        <div class="media-picker-item" data-url="${m.url}" data-alt="${escapeHtml(m.alt_text || m.filename)}">
          <img src="/${m.url.replace(/^\//, '')}" alt="${escapeHtml(m.alt_text || '')}" loading="lazy">
        </div>
      `).join('');

      grid.querySelectorAll('.media-picker-item').forEach(item => {
        item.addEventListener('click', () => {
          const url = item.getAttribute('data-url');
          const alt = item.getAttribute('data-alt');
          modal.style.display = 'none';
          if (typeof App.mediaPickerCallback === 'function') {
            App.mediaPickerCallback(url, alt);
          }
        });
      });
    }

    modal.style.display = 'flex';
  }

  /* ==========================================================================
     10. Users & Team Accounts (Dev & Admin only)
     ========================================================================== */
  async function loadUsersList() {
    const res = await apiFetch('/api/admin/users');
    if (!res.success) return;

    App.users = res.data || [];
    const tbody = document.getElementById('users-table-tbody');
    if (!tbody) return;

    tbody.innerHTML = App.users.map(u => {
      let roleBadgeHtml = '';
      if (u.role === 'dev') {
        roleBadgeHtml = '<span class="badge" style="background: rgba(212, 163, 115, 0.16); color: var(--accent-gold); border: 1px solid rgba(212, 163, 115, 0.35); font-weight: 600;"><i class="fa-solid fa-code" style="font-size: 10px; margin-right: 4px;"></i> Lead Developer</span>';
      } else if (u.role === 'admin') {
        roleBadgeHtml = '<span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3);"><i class="fa-solid fa-shield-halved" style="font-size: 10px; margin-right: 4px;"></i> Administrator</span>';
      } else {
        roleBadgeHtml = '<span class="badge" style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3);"><i class="fa-solid fa-bullhorn" style="font-size: 10px; margin-right: 4px;"></i> Marketing Desk</span>';
      }

      let actionHtml = '';
      if (u.id === App.user.id) {
        actionHtml = '<span class="text-muted text-xs">Current User</span>';
      } else if (u.role === 'dev' && App.user.role !== 'dev') {
        actionHtml = '<span class="text-muted text-xs">Protected (Dev)</span>';
      } else {
        actionHtml = `
          <div class="table-actions">
            <button type="button" class="action-icon-btn danger delete-user-btn" data-id="${u.id}" data-name="${escapeHtml(u.full_name)}" title="Remove User"><i class="fa-solid fa-trash"></i></button>
          </div>
        `;
      }

      return `
        <tr>
          <td>
            <div class="table-title-cell">
              <strong>${escapeHtml(u.full_name)}</strong>
              <span>@${escapeHtml(u.username)}</span>
            </div>
          </td>
          <td>${escapeHtml(u.email)}</td>
          <td>${roleBadgeHtml}</td>
          <td>
            <span class="badge ${u.active ? 'badge-published' : 'badge-draft'}">
              ${u.active ? 'Active' : 'Inactive'}
            </span>
          </td>
          <td>${formatDate(u.created_at)}</td>
          <td class="text-right">
            ${actionHtml}
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.delete-user-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteUser(btn.getAttribute('data-id'), btn.getAttribute('data-name')));
    });
  }

  /* ==========================================================================
     Developer Console & Diagnostics Logic (Dev Only)
     ========================================================================== */
  async function loadDevConsole() {
    if (App.user.role !== 'dev') return;

    const res = await apiFetch('/api/admin/dev/system-stats');
    if (res.success && res.data) {
      const d = res.data;
      const nodeEl = document.getElementById('dev-node-ver');
      if (nodeEl) nodeEl.textContent = d.nodeVersion;

      const platEl = document.getElementById('dev-platform');
      if (platEl) platEl.textContent = `${d.platform} (${d.arch})`;

      const uptimeEl = document.getElementById('dev-uptime');
      if (uptimeEl) uptimeEl.textContent = d.uptime;

      const pidEl = document.getElementById('dev-pid');
      if (pidEl) pidEl.textContent = d.pid;

      const memEl = document.getElementById('dev-memory');
      if (memEl) memEl.textContent = `${d.memory.heapUsedMb} MB / ${d.memory.heapTotalMb} MB (RSS: ${d.memory.rssMb} MB)`;

      const envEl = document.getElementById('dev-env');
      if (envEl) envEl.textContent = d.environment;

      const dbSizeEl = document.getElementById('dev-db-size');
      if (dbSizeEl) dbSizeEl.textContent = `${d.database.sizeKb} KB (${d.database.sizeBytes.toLocaleString()} bytes)`;
    }

    await loadE2eHistory();
  }

  async function loadE2eHistory() {
    const res = await apiFetch('/api/admin/dev/test-logs');
    const tbody = document.getElementById('e2e-history-table-tbody');
    if (!tbody) return;

    if (!res.success || !res.data || res.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-3 text-muted">No test runs recorded yet. Press "Run Full Lifecycle Test" above.</td></tr>';
      return;
    }

    tbody.innerHTML = res.data.map(r => {
      const isPass = r.status === 'PASSED';
      const badgeStyle = isPass
        ? 'background: rgba(74, 222, 128, 0.15); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.3);'
        : 'background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3);';

      return `
        <tr>
          <td><code style="font-size: 11px; color: var(--accent-gold);">${escapeHtml(r.run_id)}</code></td>
          <td><span class="badge" style="${badgeStyle}">${r.status}</span></td>
          <td style="color: var(--text-secondary); max-width: 320px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${escapeHtml(r.summary)}</td>
          <td class="tabular-nums">${r.duration_ms}ms</td>
          <td class="tabular-nums" style="font-size: 11.5px;">${formatDate(r.created_at)} ${new Date(r.created_at).toLocaleTimeString()}</td>
          <td class="text-right">
            <button type="button" class="btn btn-outline btn-xs e2e-view-log-btn" data-runid="${escapeHtml(r.run_id)}">
              <i class="fa-solid fa-file-lines"></i> View Log
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.e2e-view-log-btn').forEach(btn => {
      btn.addEventListener('click', () => loadE2eRunDetails(btn.getAttribute('data-runid')));
    });
  }

  async function loadE2eRunDetails(runId) {
    const res = await apiFetch(`/api/admin/dev/test-logs/${runId}`);
    if (res.success && res.data && res.data.details) {
      renderE2eReport(res.data.details);
      showToast(`Loaded test log: ${runId}`, 'info');
    } else {
      showToast('Failed to load test run details', 'error');
    }
  }

  function renderE2eReport(report) {
    App.currentE2eReport = report;

    // Overall Status Badge
    const statusBadge = document.getElementById('e2e-overall-status-badge');
    if (statusBadge) {
      const isPass = report.status === 'PASSED';
      statusBadge.textContent = isPass ? 'PASSED' : 'FAILED';
      statusBadge.style.background = isPass ? 'rgba(74, 222, 128, 0.15)' : 'rgba(239, 68, 68, 0.15)';
      statusBadge.style.color = isPass ? '#4ade80' : '#ef4444';
      statusBadge.style.borderColor = isPass ? 'rgba(74, 222, 128, 0.3)' : 'rgba(239, 68, 68, 0.3)';
    }

    // Run ID
    const runIdEl = document.getElementById('e2e-current-run-id');
    if (runIdEl) runIdEl.textContent = `[${report.runId}] (${report.durationMs}ms)`;

    // Render Steps Cards
    if (report.steps && Array.isArray(report.steps)) {
      report.steps.forEach((step, idx) => {
        const stepNum = idx + 1;
        const card = document.getElementById(`e2e-card-step-${stepNum}`);
        const timeEl = document.getElementById(`e2e-time-step-${stepNum}`);
        const listEl = document.getElementById(`e2e-assertions-step-${stepNum}`);

        if (card) {
          card.classList.remove('status-running', 'status-passed', 'status-failed');
          card.classList.add(step.status === 'PASSED' ? 'status-passed' : 'status-failed');
        }

        if (timeEl) {
          timeEl.textContent = `${step.durationMs}ms`;
        }

        if (listEl && step.assertions) {
          listEl.innerHTML = step.assertions.map(a => {
            let valHtml = '';
            if (a.value !== undefined) {
              const valStr = String(a.value);
              valHtml = ` <code class="e2e-assertion-val" title="${escapeHtml(valStr)}">${escapeHtml(valStr)}</code>`;
            }
            return `
              <li class="e2e-assertion-item ${a.passed ? 'passed' : 'failed'}">
                <i class="fa-solid ${a.passed ? 'fa-check' : 'fa-xmark'}"></i>
                <div class="e2e-assertion-text">
                  <span class="e2e-assertion-name">${escapeHtml(a.name)}</span>${valHtml}
                </div>
              </li>
            `;
          }).join('');
        }
      });
    }

    // Render Terminal Log Output
    const terminalEl = document.getElementById('e2e-terminal-log-output');
    if (terminalEl && report.logs && Array.isArray(report.logs)) {
      terminalEl.innerHTML = report.logs.map(l => {
        const timeStr = l.time ? new Date(l.time).toLocaleTimeString() : '--:--:--';
        const tagClass = (l.level || 'info').toLowerCase();
        return `
          <div class="e2e-log-line">
            <span class="e2e-log-time">${timeStr}</span>
            <span class="e2e-log-tag ${tagClass}">${l.level}</span>
            <span class="e2e-log-msg">${escapeHtml(l.message)}</span>
          </div>
        `;
      }).join('');
      terminalEl.scrollTop = terminalEl.scrollHeight;
    }
  }

  async function runE2eLifecycleTest() {
    const btn = document.getElementById('dev-run-e2e-btn');
    const statusBadge = document.getElementById('e2e-overall-status-badge');
    const terminalEl = document.getElementById('e2e-terminal-log-output');

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Running Full Test Cycle...';
    }

    if (statusBadge) {
      statusBadge.textContent = 'RUNNING PROBE...';
      statusBadge.style.background = 'rgba(212, 163, 115, 0.15)';
      statusBadge.style.color = 'var(--accent-gold)';
      statusBadge.style.borderColor = 'rgba(212, 163, 115, 0.3)';
    }

    document.querySelectorAll('.e2e-step-card').forEach(card => {
      card.classList.remove('status-passed', 'status-failed');
      card.classList.add('status-running');
    });
    document.querySelectorAll('.e2e-step-time').forEach(el => el.textContent = '--');
    document.querySelectorAll('.e2e-assertion-list').forEach(el => {
      el.innerHTML = '<li class="e2e-assertion-item"><i class="fa-regular fa-circle"></i> Waiting to execute...</li>';
    });

    if (terminalEl) {
      terminalEl.innerHTML = `
        <div class="e2e-log-line">
          <span class="e2e-log-time">${new Date().toLocaleTimeString()}</span>
          <span class="e2e-log-tag info">START</span>
          <span class="e2e-log-msg">Initiating autonomous end-to-end story lifecycle diagnostic test...</span>
        </div>
      `;
    }

    try {
      const holdSelect = document.getElementById('dev-e2e-hold-select');
      const holdMs = holdSelect ? parseInt(holdSelect.value, 10) : 30000;
      const res = await apiFetch('/api/admin/dev/run-e2e-test', {
        method: 'POST',
        body: JSON.stringify({ holdMs })
      });
      if (res.success && res.report) {
        renderE2eReport(res.report);
        await loadE2eHistory();
        await loadDashboard();
        if (res.report.status === 'PASSED') {
          showToast(`E2E Test Cycle PASSED (${res.report.passedAssertions}/${res.report.totalAssertions} assertions in ${res.report.durationMs}ms)`, 'success');
        } else {
          showToast('E2E Test Cycle completed with failures. Inspect log for details.', 'error');
        }
      } else {
        showToast(res.error || 'E2E Test failed to execute', 'error');
        if (terminalEl) {
          terminalEl.innerHTML += `
            <div class="e2e-log-line">
              <span class="e2e-log-time">${new Date().toLocaleTimeString()}</span>
              <span class="e2e-log-tag fail">FATAL</span>
              <span class="e2e-log-msg">${escapeHtml(res.error || 'Server error')}</span>
            </div>
          `;
        }
      }
    } catch (err) {
      showToast('Network error during test execution: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Run Full Lifecycle Test';
      }
    }
  }

  function copyE2eLog() {
    if (!App.currentE2eReport || !App.currentE2eReport.logs) {
      showToast('No active test run log to copy', 'info');
      return;
    }

    const lines = [
      `=== PETALS CMS - STORY LIFECYCLE E2E TEST REPORT ===`,
      `Run ID: ${App.currentE2eReport.runId}`,
      `Timestamp: ${App.currentE2eReport.timestamp}`,
      `Overall Status: ${App.currentE2eReport.status}`,
      `Duration: ${App.currentE2eReport.durationMs}ms`,
      `Summary: ${App.currentE2eReport.summary}`,
      ``,
      `--- STEPS BREAKDOWN ---`
    ];

    if (App.currentE2eReport.steps) {
      App.currentE2eReport.steps.forEach(s => {
        lines.push(`[${s.status}] ${s.name} (${s.durationMs}ms)`);
        if (s.assertions) {
          s.assertions.forEach(a => {
            lines.push(`  ${a.passed ? '✓' : '✗'} ${a.name}`);
          });
        }
      });
    }

    lines.push(``, `--- CHRONOLOGICAL EXECUTION LOGS ---`);
    App.currentE2eReport.logs.forEach(l => {
      lines.push(`[${l.time}] [${(l.level || '').padEnd(5)}] ${l.message}`);
    });

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      showToast('Test report & debug logs copied to clipboard!', 'success');
    }).catch(() => {
      showToast('Failed to copy to clipboard', 'error');
    });
  }

  function downloadE2eLogJson() {
    if (!App.currentE2eReport) {
      showToast('No active test run log to download', 'info');
      return;
    }

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(App.currentE2eReport, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `petal-cms-e2e-report-${App.currentE2eReport.runId}.json`);
    dlAnchorElem.click();
    showToast('JSON report downloaded successfully', 'success');
  }

  async function clearE2eHistory() {
    if (!confirm('Are you sure you want to clear all historical E2E test run records from the database?')) return;
    const res = await apiFetch('/api/admin/dev/test-logs', { method: 'DELETE' });
    if (res.success) {
      showToast('Historical test run records cleared.', 'success');
      loadE2eHistory();
    } else {
      showToast(res.error || 'Failed to clear logs', 'error');
    }
  }

  async function deleteUser(id, name) {
    if (!confirm(`Are you sure you want to remove team member "${name}"?`)) return;

    const res = await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    if (res.success) {
      showToast('Team member removed', 'success');
      loadUsersList();
    } else {
      showToast(res.error || 'Failed to remove user', 'error');
    }
  }

  /* ==========================================================================
     11. Event Listeners & Binding
     ========================================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    // Check initial authentication
    checkAuthSession();

    // Login Form
    document.getElementById('login-form').addEventListener('submit', handleLoginSubmit);
    document.getElementById('login-pwd-toggle').addEventListener('click', () => {
      const pwdInput = document.getElementById('login-password');
      const icon = document.querySelector('#login-pwd-toggle i');
      if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        icon.className = 'fa-regular fa-eye-slash';
      } else {
        pwdInput.type = 'password';
        icon.className = 'fa-regular fa-eye';
      }
    });

    // Sidebar Mobile Toggle
    document.getElementById('mobile-sidebar-toggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.add('open');
    });
    document.getElementById('sidebar-close-btn').addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('open');
    });

    // Sidebar Logout
    document.getElementById('sidebar-logout-btn').addEventListener('click', () => handleLogout(true));

    // Blogs Toolbar Tabs & Filters
    document.getElementById('blogs-status-tabs').querySelectorAll('.status-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#blogs-status-tabs .status-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        App.statusFilter = tab.getAttribute('data-status');
        renderBlogsTable();
      });
    });

    document.getElementById('blogs-category-filter').addEventListener('change', (e) => {
      App.categoryFilter = e.target.value;
      renderBlogsTable();
    });

    const searchInput = document.getElementById('blogs-search-input');
    const clearSearch = document.getElementById('blogs-clear-search');
    searchInput.addEventListener('input', () => {
      App.searchQuery = searchInput.value;
      clearSearch.style.display = searchInput.value ? 'block' : 'none';
      renderBlogsTable();
    });
    clearSearch.addEventListener('click', () => {
      searchInput.value = '';
      App.searchQuery = '';
      clearSearch.style.display = 'none';
      renderBlogsTable();
    });

    // Editor Title & Auto Slug
    const titleInput = document.getElementById('editor-title');
    const slugInput = document.getElementById('editor-slug');
    let manualSlugEdited = false;

    titleInput.addEventListener('input', () => {
      if (!manualSlugEdited && !App.activeEditingBlogId) {
        slugInput.value = generateSlug(titleInput.value);
      }
      updateSerpPreview();
      updateSaveState(true);
    });

    document.getElementById('editor-slug-unlock').addEventListener('click', () => {
      slugInput.readOnly = !slugInput.readOnly;
      if (!slugInput.readOnly) {
        slugInput.focus();
        manualSlugEdited = true;
      }
    });

    slugInput.addEventListener('input', () => {
      manualSlugEdited = true;
      updateSerpPreview();
      updateSaveState(true);
    });

    // Editor Inputs change listeners
    document.getElementById('editor-excerpt').addEventListener('input', () => {
      updateCharCounters();
      updateSerpPreview();
      updateSaveState(true);
    });
    document.getElementById('editor-seo-title').addEventListener('input', () => {
      updateCharCounters();
      updateSerpPreview();
      updateSaveState(true);
    });
    document.getElementById('editor-seo-desc').addEventListener('input', () => {
      updateCharCounters();
      updateSerpPreview();
      updateSaveState(true);
    });
    document.getElementById('editor-status-select').addEventListener('change', (e) => {
      updateEditorStatusPill(e.target.value);
      updateSaveState(true);
    });

    // WYSIWYG Content Editable Listener
    const richEditor = document.getElementById('editor-body-rich');
    richEditor.addEventListener('input', () => {
      updateWordCountAndReadingTime();
      updateSaveState(true);
    });

    // WYSIWYG Toolbar button clicks
    document.querySelectorAll('.wysiwyg-toolbar .t-btn[data-cmd]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-cmd');
        const val = btn.getAttribute('data-val') || null;
        execEditorCmd(cmd, val);
      });
    });

    document.getElementById('toolbar-source-btn').addEventListener('click', toggleRawHtmlMode);

    // Insert Link Toolbar Button
    document.getElementById('toolbar-link-btn').addEventListener('click', () => {
      const url = prompt('Enter the destination hyperlink URL (e.g. https://petalshotels.com):');
      if (url) {
        execEditorCmd('createLink', url);
      }
    });

    // Insert Image Toolbar Button
    document.getElementById('toolbar-image-btn').addEventListener('click', () => {
      openMediaPicker((url, alt) => {
        const fullSrc = url.startsWith('http') ? url : url;
        execEditorCmd('insertHTML', `<img src="${fullSrc}" alt="${escapeHtml(alt || 'Petals Hotel')}" class="article-embed-img" />`);
      });
    });

    // Featured Image Picker & Upload
    document.getElementById('featured-select-media-btn').addEventListener('click', () => {
      openMediaPicker((url, alt) => {
        setFeaturedImage(url, alt);
      });
    });

    document.getElementById('remove-featured-img-btn').addEventListener('click', removeFeaturedImage);

    const featuredFileInput = document.getElementById('featured-file-input');
    featuredFileInput.addEventListener('change', async () => {
      const file = featuredFileInput.files[0];
      if (!file) return;

      if (App.media.length >= MAX_MEDIA_QUOTA) {
        showToast(`Media library storage limit reached (${MAX_MEDIA_QUOTA}/${MAX_MEDIA_QUOTA} photos). Please select an existing photo or delete unused photos in the Media Library.`, 'error');
        featuredFileInput.value = '';
        return;
      }

      showToast('Uploading featured image...', 'info');
      try {
        const res = await uploadFileAsBase64(file);
        if (res.success && res.data) {
          setFeaturedImage(res.data.url, res.data.alt_text);
          showToast('Featured image uploaded!', 'success');
          loadMediaLibrary();
        } else {
          showToast(res.error || 'Failed to upload image', 'error');
        }
      } catch (err) {
        showToast('Error uploading image', 'error');
      }
      featuredFileInput.value = '';
    });

    // Featured Image Drag & Drop
    const featuredDropzone = document.getElementById('featured-upload-dropzone');
    featuredDropzone.addEventListener('dragover', (e) => { e.preventDefault(); featuredDropzone.style.borderColor = 'var(--accent-gold)'; });
    featuredDropzone.addEventListener('dragleave', () => { featuredDropzone.style.borderColor = ''; });
    featuredDropzone.addEventListener('drop', async (e) => {
      e.preventDefault();
      featuredDropzone.style.borderColor = '';
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        if (App.media.length >= MAX_MEDIA_QUOTA) {
          showToast(`Media library storage limit reached (${MAX_MEDIA_QUOTA}/${MAX_MEDIA_QUOTA} photos). Please select an existing photo or delete unused photos in the Media Library.`, 'error');
          return;
        }
        showToast('Uploading dropped image...', 'info');
        const res = await uploadFileAsBase64(file);
        if (res.success && res.data) {
          setFeaturedImage(res.data.url, res.data.alt_text);
          showToast('Featured image uploaded!', 'success');
          loadMediaLibrary();
        } else {
          showToast(res.error || 'Failed to upload image', 'error');
        }
      }
    });

    // Tag text input (chips)
    const tagTextInput = document.getElementById('tag-text-input');
    tagTextInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = tagTextInput.value.trim().replace(/^#/, '');
        if (val && !App.tagsList.includes(val)) {
          App.tagsList.push(val);
          renderTagChips();
          updateSaveState(true);
        }
        tagTextInput.value = '';
      }
    });

    // Editor Action Buttons
    document.getElementById('editor-save-draft-btn').addEventListener('click', () => saveArticle('draft'));
    document.getElementById('editor-publish-btn').addEventListener('click', () => saveArticle('published'));
    document.getElementById('editor-preview-btn').addEventListener('click', openLivePreview);

    // Preview Modal Close
    document.getElementById('close-preview-modal-btn').addEventListener('click', () => {
      document.getElementById('preview-modal').style.display = 'none';
    });

    // Media Picker Modal Close
    document.getElementById('close-media-picker-btn').addEventListener('click', () => {
      document.getElementById('media-picker-modal').style.display = 'none';
    });

    // Quick Add Category from editor
    document.getElementById('editor-quick-add-cat').addEventListener('click', () => {
      const name = prompt('Enter new category name:');
      if (name && name.trim()) {
        apiFetch('/api/admin/categories', {
          method: 'POST',
          body: JSON.stringify({ name: name.trim() })
        }).then(res => {
          if (res.success) {
            showToast('Category created!', 'success');
            loadCategories().then(() => {
              document.getElementById('editor-category').value = name.trim();
            });
          } else {
            showToast(res.error || 'Failed to create category', 'error');
          }
        });
      }
    });

    // Category Form
    document.getElementById('category-form').addEventListener('submit', handleCategorySubmit);
    document.getElementById('cat-cancel-edit-btn').addEventListener('click', resetCategoryForm);

    // Media Bulk Upload
    const mediaBulkInput = document.getElementById('media-bulk-file-input');
    mediaBulkInput.addEventListener('change', () => {
      handleMediaUploadFiles(mediaBulkInput.files);
    });

    const mediaDropzone = document.getElementById('media-page-dropzone');
    mediaDropzone.addEventListener('dragover', (e) => { e.preventDefault(); mediaDropzone.classList.add('dragover'); });
    mediaDropzone.addEventListener('dragleave', () => { mediaDropzone.classList.remove('dragover'); });
    mediaDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      mediaDropzone.classList.remove('dragover');
      handleMediaUploadFiles(e.dataTransfer.files);
    });

    document.getElementById('media-search-input').addEventListener('input', renderMediaGrid);

    // User Management Modal
    const userModal = document.getElementById('user-modal');
    document.getElementById('open-add-user-modal').addEventListener('click', () => {
      document.getElementById('manage-user-id').value = '';
      document.getElementById('manage-user-fullname').value = '';
      document.getElementById('manage-user-username').value = '';
      document.getElementById('manage-user-email').value = '';
      document.getElementById('manage-user-password').value = '';

      const roleSelect = document.getElementById('manage-user-role');
      if (roleSelect) {
        const devOpt = roleSelect.querySelector('option[value="dev"]');
        if (devOpt) devOpt.style.display = App.user.role === 'dev' ? '' : 'none';
        roleSelect.value = 'marketing';
      }

      userModal.style.display = 'flex';
    });

    document.getElementById('close-user-modal-btn').addEventListener('click', () => {
      userModal.style.display = 'none';
    });

    document.getElementById('user-create-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const full_name = document.getElementById('manage-user-fullname').value.trim();
      const username = document.getElementById('manage-user-username').value.trim();
      const email = document.getElementById('manage-user-email').value.trim();
      const password = document.getElementById('manage-user-password').value;
      const role = document.getElementById('manage-user-role').value;

      const res = await apiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ full_name, username, email, password, role })
      });

      if (res.success) {
        showToast('Team member account created successfully!', 'success');
        userModal.style.display = 'none';
        loadUsersList();
      } else {
        showToast(res.error || 'Failed to create user', 'error');
      }
    });

    // Profile & Password Forms
    document.getElementById('profile-info-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const full_name = document.getElementById('profile-name').value.trim();
      const email = document.getElementById('profile-email').value.trim();

      const res = await apiFetch('/api/admin/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ full_name, email })
      });

      if (res.success) {
        App.user.full_name = full_name;
        App.user.email = email;
        document.getElementById('sidebar-user-name').textContent = full_name;
        showToast('Profile updated successfully', 'success');
      } else {
        showToast(res.error || 'Failed to update profile', 'error');
      }
    });

    document.getElementById('change-pwd-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPassword = document.getElementById('current-pwd').value;
      const newPassword = document.getElementById('new-pwd').value;
      const confirmNew = document.getElementById('confirm-new-pwd').value;

      if (newPassword !== confirmNew) {
        showToast('New passwords do not match', 'error');
        return;
      }

      const res = await apiFetch('/api/admin/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });

      if (res.success) {
        showToast('Password changed successfully.', 'success');
        document.getElementById('change-pwd-form').reset();
      } else {
        showToast(res.error || 'Failed to change password', 'error');
      }
    });

    // Launchpad Quick Draft Scratchpad
    const quickDraftForm = document.getElementById('quick-draft-form');
    if (quickDraftForm) {
      quickDraftForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const titleInput = document.getElementById('quick-draft-title');
        const titleVal = titleInput.value.trim();
        if (titleVal) {
          const draftCount = App.blogs.filter(b => b.status === 'draft').length;
          if (draftCount >= 5) {
            openDraftLimitModal();
            return;
          }
          window.location.hash = 'editor';
          setTimeout(() => {
            document.getElementById('editor-title').value = titleVal;
            document.getElementById('editor-slug').value = generateSlug(titleVal);
            document.getElementById('editor-body-rich').focus();
            updateSerpPreview();
            updateSaveState(true);
          }, 120);
          titleInput.value = '';
        }
      });
    }

    // Launchpad Quick Photo Upload
    const launchpadQuickUpload = document.getElementById('launchpad-quick-upload');
    if (launchpadQuickUpload) {
      launchpadQuickUpload.addEventListener('change', () => {
        handleMediaUploadFiles(launchpadQuickUpload.files);
      });
    }

    // Draft limit modal buttons
    const closeDraftLimitBtn = document.getElementById('close-draft-limit-btn');
    if (closeDraftLimitBtn) {
      closeDraftLimitBtn.addEventListener('click', () => {
        document.getElementById('draft-limit-modal').style.display = 'none';
      });
    }

    const draftLimitCloseActionBtn = document.getElementById('draft-limit-close-action-btn');
    if (draftLimitCloseActionBtn) {
      draftLimitCloseActionBtn.addEventListener('click', () => {
        document.getElementById('draft-limit-modal').style.display = 'none';
      });
    }

    const draftLimitViewAllBtn = document.getElementById('draft-limit-view-all-btn');
    if (draftLimitViewAllBtn) {
      draftLimitViewAllBtn.addEventListener('click', () => {
        document.getElementById('draft-limit-modal').style.display = 'none';
        App.statusFilter = 'draft';
        const draftTab = document.querySelector('#blogs-status-tabs [data-status="draft"]');
        if (draftTab) {
          document.querySelectorAll('#blogs-status-tabs .status-tab').forEach(t => t.classList.remove('active'));
          draftTab.classList.add('active');
        }
        loadBlogsList();
      });
    }

    // Editor Header Delete Story Button
    const editorDeleteBtn = document.getElementById('editor-delete-btn');
    if (editorDeleteBtn) {
      editorDeleteBtn.addEventListener('click', () => {
        if (!App.activeEditingBlogId) return;
        const currentTitle = document.getElementById('editor-title').value.trim() || 'this story';
        promptDeleteBlog(App.activeEditingBlogId, currentTitle, () => {
          App.isDirty = false;
          window.location.hash = 'blogs';
        });
      });
    }

    // Delete Confirmation Modal Controls
    const deleteModal = document.getElementById('delete-confirm-modal');
    const dismissDeleteModal = () => {
      if (deleteModal) deleteModal.style.display = 'none';
      pendingDelete = null;
    };

    const closeDeleteBtn = document.getElementById('close-delete-modal-btn');
    if (closeDeleteBtn) closeDeleteBtn.addEventListener('click', dismissDeleteModal);

    const cancelDeleteBtn = document.getElementById('cancel-delete-modal-btn');
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', dismissDeleteModal);

    const confirmDeleteBtn = document.getElementById('confirm-delete-action-btn');
    if (confirmDeleteBtn) {
      confirmDeleteBtn.addEventListener('click', async () => {
        if (!pendingDelete) return;
        const { id, onSuccess } = pendingDelete;
        dismissDeleteModal();
        await executeDeleteBlog(id, onSuccess);
      });
    }

    // Developer Console Controls
    const devRefreshBtn = document.getElementById('dev-refresh-stats-btn');
    if (devRefreshBtn) {
      devRefreshBtn.addEventListener('click', async () => {
        await loadDevConsole();
        showToast('System telemetry refreshed.', 'success');
      });
    }

    const devFlushBtn = document.getElementById('dev-flush-cache-btn');
    if (devFlushBtn) {
      devFlushBtn.addEventListener('click', async () => {
        const res = await apiFetch('/api/admin/dev/cache-clear', { method: 'POST' });
        if (res.success) {
          showToast(res.message, 'success');
          const out = document.getElementById('dev-console-output');
          if (out) out.innerHTML = `<span style="color: #4ade80;">[CACHE PURGED]</span> ${new Date().toLocaleTimeString()} - All server memory caches cleared.`;
        }
      });
    }

    document.querySelectorAll('.dev-test-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const target = btn.getAttribute('data-target');
        const out = document.getElementById('dev-console-output');
        if (out) out.innerHTML = `<span style="color: var(--accent-gold);">[TEST RUNNING]</span> Probing diagnostic target: ${target}...`;

        const res = await apiFetch('/api/admin/dev/test-endpoint', {
          method: 'POST',
          body: JSON.stringify({ target })
        });

        if (res.success) {
          if (out) {
            out.innerHTML = `<span style="color: #4ade80;">[PASS ${res.status}]</span> ${new Date().toLocaleTimeString()} - Target: <strong>${target}</strong> | Latency: <strong>${res.latencyMs}ms</strong><br><span style="color: var(--text-primary); margin-top: 4px; display: block;">${escapeHtml(res.result)}</span>`;
          }
          showToast(`Diagnostic probe for "${target}" succeeded in ${res.latencyMs}ms`, 'success');
        } else {
          if (out) {
            out.innerHTML = `<span style="color: var(--status-danger);">[FAIL]</span> ${new Date().toLocaleTimeString()} - ${escapeHtml(res.error || 'Test failed')}`;
          }
          showToast(res.error || 'Diagnostic test failed', 'error');
        }
      });
    });

    // E2E Lifecycle Test Runner Controls
    const e2eRunBtn = document.getElementById('dev-run-e2e-btn');
    if (e2eRunBtn) {
      e2eRunBtn.addEventListener('click', runE2eLifecycleTest);
    }

    const copyLogBtn = document.getElementById('copy-e2e-log-btn');
    if (copyLogBtn) {
      copyLogBtn.addEventListener('click', copyE2eLog);
    }

    const downloadLogBtn = document.getElementById('download-e2e-log-btn');
    if (downloadLogBtn) {
      downloadLogBtn.addEventListener('click', downloadE2eLogJson);
    }

    const clearHistoryBtn = document.getElementById('dev-clear-test-logs-btn');
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', clearE2eHistory);
    }

    // Editorial Activity Log Refresh Button
    const refreshActivityBtn = document.getElementById('refresh-activity-log-btn');
    if (refreshActivityBtn) {
      refreshActivityBtn.addEventListener('click', async () => {
        await loadActivityLogs();
        showToast('Editorial activity log refreshed.', 'info');
      });
    }
  });

})();
