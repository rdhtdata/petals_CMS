/**
 * Petals CMS - Security & Input Sanitization Utilities
 * Provides XSS prevention, HTML content filtering, SVG hardening, and path sanitization
 */

/**
 * Strip all HTML tags, returning plain clean text
 * @param {string} str
 * @returns {string}
 */
function stripHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Sanitize rich article HTML
 * Strips active scripts, styles, dangerous tags, inline event handlers (on*),
 * and malicious javascript: / vbscript: pseudo-protocols while preserving
 * semantic formatting tags for articles.
 *
 * @param {string} dirtyHtml
 * @returns {string}
 */
function sanitizeHtml(dirtyHtml) {
  if (typeof dirtyHtml !== 'string') return '';

  let clean = dirtyHtml;

  // 1. Remove HTML comments
  clean = clean.replace(/<!--[\s\S]*?-->/g, '');

  // 2. Remove executable and active script containers completely (tags + their inner contents)
  const dangerousContainers = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
    /<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi,
    /<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi
  ];

  for (const regex of dangerousContainers) {
    clean = clean.replace(regex, '');
  }

  // 3. Remove standalone structural or form elements that don't belong in article bodies
  const disallowedTags = [
    /<\/?(meta|link|base|form|input|button|textarea|select|option|frame|frameset)\b[^>]*>/gi
  ];

  for (const regex of disallowedTags) {
    clean = clean.replace(regex, '');
  }

  // 4. Strip all inline DOM event handlers (e.g., onload, onerror, onclick, onmouseover)
  clean = clean.replace(/\s+on[a-zA-Z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

  // 5. Neutralize dangerous pseudo-protocols in href and src attributes (javascript:, vbscript:, data:text/html)
  clean = clean.replace(/(href|src|xlink:href)\s*=\s*(['"]?)\s*(?:javascript|vbscript|data\s*:\s*text\/html):/gi, '$1=$2about:blank#');

  // 6. Ensure external links in articles include rel="noopener noreferrer"
  clean = clean.replace(/<a\b([^>]*?)target\s*=\s*['"]_blank['"]([^>]*?)>/gi, (match, p1, p2) => {
    let full = p1 + p2;
    if (!/rel\s*=\s*['"][^'"]*['"]/i.test(full)) {
      return `<a ${p1} target="_blank" rel="noopener noreferrer"${p2}>`;
    }
    return match.replace(/rel\s*=\s*['"]([^'"]*)['"]/i, (m, relVal) => {
      let r = relVal;
      if (!r.includes('noopener')) r += ' noopener';
      if (!r.includes('noreferrer')) r += ' noreferrer';
      return `rel="${r.trim()}"`;
    });
  });

  return clean.trim();
}

/**
 * Validate and sanitize SVG contents to prevent Stored SVG XSS
 * Throws an Error if hostile scripting constructs are discovered.
 *
 * @param {string|Buffer} svgInput
 * @returns {string} Sanitized SVG string
 */
function sanitizeSvg(svgInput) {
  const content = typeof svgInput === 'string' ? svgInput : svgInput.toString('utf8');

  // Check for malicious active script indicators
  const hostilePatterns = [
    /<script\b/i,
    /<foreignObject\b/i,
    /<iframe\b/i,
    /<object\b/i,
    /<embed\b/i,
    /\bon[a-zA-Z]+\s*=/i, // inline event handlers like onload, onerror
    /href\s*=\s*['"]?\s*javascript:/i,
    /xlink:href\s*=\s*['"]?\s*javascript:/i,
    /data\s*:\s*text\/html/i
  ];

  for (const pattern of hostilePatterns) {
    if (pattern.test(content)) {
      throw new Error('SVG rejected: contains potentially dangerous active scripts or event handlers.');
    }
  }

  // Verify it contains valid svg root tags
  if (!/<svg\b[^>]*>/i.test(content) || !/<\/svg>/i.test(content)) {
    throw new Error('Invalid SVG markup format.');
  }

  return content;
}

/**
 * Sanitize filename to prevent directory traversal
 * @param {string} filename
 * @returns {string}
 */
function sanitizeFilename(filename) {
  if (typeof filename !== 'string') return `file-${Date.now()}`;
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/\.{2,}/g, '.') // Disallow '..' path traversal
    .replace(/(^-|-$)/g, '');
}

module.exports = {
  stripHtml,
  sanitizeHtml,
  sanitizeSvg,
  sanitizeFilename
};
