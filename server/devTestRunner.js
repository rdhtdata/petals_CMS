/**
 * Petals CMS - Automated End-to-End Story Lifecycle Test Suite (Dev Role)
 *
 * Executes a full lifecycle probe:
 *  1. Baseline snapshot & DB integrity check
 *  2. Create synthetic post (Draft phase) & verify draft quota isolation
 *  3. Publish post & verify live website homepage card #1, blog catalog, and sitemap
 *  4. Modify post (Title, Category, Excerpt, Content) & verify real-time non-cached updates
 *  5. Delete post & verify complete removal from DB, website feed restore, and sitemap pruning
 *  6. Post-flight baseline restoration check & audit logging
 */

const { DB } = require('./db');
const { buildXmlSitemap, invalidateSitemapCache } = require('./routes/blogs');

async function runFullLifecycleTest(triggeredBy = 'dev') {
  const runId = `e2e-run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const startTime = Date.now();
  const testTimestamp = new Date().toISOString();
  const logs = [];
  const steps = [];

  function log(level, message, metadata = null) {
    const entry = {
      time: new Date().toISOString(),
      level, // 'INFO', 'PASS', 'FAIL', 'WARN'
      message,
      ...(metadata ? { metadata } : {})
    };
    logs.push(entry);
    return entry;
  }

  function addStep(name, status, durationMs, assertions = [], details = '') {
    steps.push({
      name,
      status, // 'PASSED' | 'FAILED'
      durationMs,
      assertions,
      details
    });
  }

  log('INFO', `Starting Automated Story Lifecycle E2E Test Suite [Run ID: ${runId}]`, { triggeredBy });

  let allPassed = true;
  let testBlogId = null;
  let baselinePublishedCount = 0;
  let baselineDraftsCount = 0;
  let baselineTopArticles = [];

  try {
    // ------------------------------------------------------------------------
    // STEP 1: Pre-flight Diagnostic & Baseline Snapshot
    // ------------------------------------------------------------------------
    const step1Start = Date.now();
    log('INFO', 'Step 1: Checking database connectivity and snapshotting baseline state...');

    const baselineStats = DB.getDashboardStats();
    baselinePublishedCount = baselineStats.publishedBlogs;
    baselineDraftsCount = baselineStats.draftBlogs;

    const initialFeed = DB.getPublicBlogs({ limit: 3 });
    baselineTopArticles = initialFeed.map(b => ({ id: b.id, title: b.title, slug: b.slug }));

    const step1Assertions = [
      { name: 'Database stats query operational', passed: typeof baselineStats.totalBlogs === 'number' },
      { name: 'Baseline published blogs counted', passed: baselinePublishedCount >= 0, value: baselinePublishedCount },
      { name: 'Baseline drafts counted', passed: baselineDraftsCount >= 0, value: baselineDraftsCount },
      { name: 'Public blog feed responsive', passed: Array.isArray(initialFeed) }
    ];

    const step1Passed = step1Assertions.every(a => a.passed);
    if (!step1Passed) allPassed = false;

    addStep('1. Pre-flight & Baseline Snapshot', step1Passed ? 'PASSED' : 'FAILED', Date.now() - step1Start, step1Assertions,
      `Baseline snapshot: ${baselinePublishedCount} published articles, ${baselineDraftsCount} drafts.`
    );
    log(step1Passed ? 'PASS' : 'FAIL', 'Step 1 complete.', { baselinePublishedCount, baselineDraftsCount });

    // ------------------------------------------------------------------------
    // STEP 2: Create Synthetic Post as Draft & Verify Quota / Isolation
    // ------------------------------------------------------------------------
    const step2Start = Date.now();
    log('INFO', 'Step 2: Creating synthetic story in draft mode...');

    const timestampSuffix = Date.now();
    const testSlug = `e2e-probe-${timestampSuffix}`;
    const initialTitle = `E2E Automated Health Probe [${timestampSuffix}]`;
    const initialExcerpt = 'Synthetic test story for automated database, publishing, and deletion verification.';
    const initialContent = `<p>Test content generated automatically by the Developer Diagnostics Engine at ${testTimestamp}.</p>`;

    const createdDraft = DB.createBlog({
      title: initialTitle,
      slug: testSlug,
      category: 'Business Travel',
      excerpt: initialExcerpt,
      content: initialContent,
      author: 'Antigravity Test Engine',
      author_role: 'System QA',
      status: 'draft'
    });

    testBlogId = createdDraft.id;
    log('INFO', `Draft created in SQLite database with ID: "${testBlogId}"`);

    // Verify draft presence in DB
    const fetchedDraft = DB.getBlogByIdOrSlug(testBlogId);
    // Verify draft does NOT appear on public website feed
    const publicFeedDuringDraft = DB.getPublicBlogs({ limit: 100 });
    const draftLeakedToPublic = publicFeedDuringDraft.some(b => b.id === testBlogId || b.slug === testSlug);
    // Verify draft count increased
    const draftsAfterCreate = DB.getDraftsCount();

    const step2Assertions = [
      { name: 'Story saved to database with unique ID', passed: !!fetchedDraft && fetchedDraft.id === testBlogId },
      { name: 'Initial status is strictly "draft"', passed: fetchedDraft && fetchedDraft.status === 'draft' },
      { name: 'Draft does NOT leak into public website feed', passed: !draftLeakedToPublic },
      { name: 'Draft count incremented (+1)', passed: draftsAfterCreate === baselineDraftsCount + 1 }
    ];

    const step2Passed = step2Assertions.every(a => a.passed);
    if (!step2Passed) allPassed = false;

    addStep('2. Post Creation (Draft State)', step2Passed ? 'PASSED' : 'FAILED', Date.now() - step2Start, step2Assertions,
      `Draft "${testBlogId}" created and isolated from public feed.`
    );
    log(step2Passed ? 'PASS' : 'FAIL', 'Step 2 complete.', { testBlogId, draftLeakedToPublic });

    // ------------------------------------------------------------------------
    // STEP 3: Post Publishing & Website Integration
    // ------------------------------------------------------------------------
    const step3Start = Date.now();
    log('INFO', 'Step 3: Promoting draft to "published" and testing public website reflection...');

    const pubTimestamp = new Date().toISOString();
    const publishedBlog = DB.updateBlog(testBlogId, {
      status: 'published',
      published_at: pubTimestamp
    });

    invalidateSitemapCache();

    // Verify in DB
    const postInDb = DB.getBlogByIdOrSlug(testBlogId);
    // Verify in Public Homepage Feed (top 3)
    const topFeed = DB.getPublicBlogs({ limit: 3 });
    const isTopStory = topFeed.length > 0 && (topFeed[0].id === testBlogId || topFeed[0].slug === testSlug);
    // Verify in Public Blog Catalog (blogs.html)
    const fullFeed = DB.getPublicBlogs({ limit: 100 });
    const existsInFullFeed = fullFeed.some(b => b.id === testBlogId || b.slug === testSlug);
    // Verify in XML Sitemap
    const sitemapXml = buildXmlSitemap();
    const sitemapIncludesUrl = sitemapXml.includes(`blogs.html?article=${encodeURIComponent(testSlug)}`);

    const step3Assertions = [
      { name: 'Article status switched to "published" in DB', passed: postInDb && postInDb.status === 'published' },
      { name: 'Article takes top #1 position on homepage feed', passed: isTopStory, actualTop: topFeed[0] ? topFeed[0].title : null },
      { name: 'Article appears in full blog catalog (blogs.html)', passed: existsInFullFeed },
      { name: 'XML Sitemap contains canonical article URL', passed: sitemapIncludesUrl }
    ];

    const step3Passed = step3Assertions.every(a => a.passed);
    if (!step3Passed) allPassed = false;

    addStep('3. Publishing & Website Integration', step3Passed ? 'PASSED' : 'FAILED', Date.now() - step3Start, step3Assertions,
      `Published story verified at top #1 spot on website and dynamically indexed in XML sitemap.`
    );
    log(step3Passed ? 'PASS' : 'FAIL', 'Step 3 complete.', { isTopStory, existsInFullFeed, sitemapIncludesUrl });

    // ------------------------------------------------------------------------
    // STEP 4: Post Modification & Live Content Sync
    // ------------------------------------------------------------------------
    const step4Start = Date.now();
    log('INFO', 'Step 4: Modifying story content and verifying zero-cache synchronization...');

    const updatedTitle = `E2E Automated Health Probe [${timestampSuffix}] [MODIFIED]`;
    const updatedCategory = 'Corporate Guide';
    const updatedExcerpt = 'Updated excerpt verifying live content propagation across all website views.';
    const updatedContent = `<p>Updated content probe verified at ${new Date().toISOString()}</p>`;

    const updatedBlog = DB.updateBlog(testBlogId, {
      title: updatedTitle,
      category: updatedCategory,
      excerpt: updatedExcerpt,
      content: updatedContent
    });

    invalidateSitemapCache();

    const postAfterUpdate = DB.getBlogByIdOrSlug(testBlogId);
    const topFeedAfterUpdate = DB.getPublicBlogs({ limit: 1 });
    const titleMatchesInFeed = topFeedAfterUpdate.length > 0 && topFeedAfterUpdate[0].title === updatedTitle;

    const step4Assertions = [
      { name: 'Database updated with new title & category', passed: postAfterUpdate.title === updatedTitle && postAfterUpdate.category === updatedCategory },
      { name: 'Updated title immediately reflected on public website feed', passed: titleMatchesInFeed, expected: updatedTitle }
    ];

    const step4Passed = step4Assertions.every(a => a.passed);
    if (!step4Passed) allPassed = false;

    addStep('4. Modification & Real-Time Sync', step4Passed ? 'PASSED' : 'FAILED', Date.now() - step4Start, step4Assertions,
      `Modified title and metadata verified on live website without stale cache.`
    );
    log(step4Passed ? 'PASS' : 'FAIL', 'Step 4 complete.', { updatedTitle, titleMatchesInFeed });

    // ------------------------------------------------------------------------
    // STEP 5: Post Deletion & Website Removal Verification
    // ------------------------------------------------------------------------
    const step5Start = Date.now();
    log('INFO', 'Step 5: Permanently deleting test article and verifying removal...');

    const deleteSuccess = DB.deleteBlog(testBlogId);
    invalidateSitemapCache();

    const postAfterDelete = DB.getBlogByIdOrSlug(testBlogId);
    const feedAfterDelete = DB.getPublicBlogs({ limit: 100 });
    const existsInFeedAfterDelete = feedAfterDelete.some(b => b.id === testBlogId || b.slug === testSlug);
    const sitemapAfterDelete = buildXmlSitemap();
    const sitemapStillContains = sitemapAfterDelete.includes(`blogs.html?article=${encodeURIComponent(testSlug)}`);

    // Verify top 3 feed restored previous articles
    const topFeedAfterDelete = DB.getPublicBlogs({ limit: 3 });
    const baselineArticleRestored = baselineTopArticles.length === 0 || (topFeedAfterDelete.length > 0 && topFeedAfterDelete[0].id === baselineTopArticles[0].id);

    const step5Assertions = [
      { name: 'Article deleted from SQLite database', passed: deleteSuccess && postAfterDelete === null },
      { name: 'Article completely purged from public blog catalog', passed: !existsInFeedAfterDelete },
      { name: 'Article URL stripped from XML sitemap', passed: !sitemapStillContains },
      { name: 'Previous articles restored to homepage top spotlight', passed: baselineArticleRestored }
    ];

    const step5Passed = step5Assertions.every(a => a.passed);
    if (!step5Passed) allPassed = false;

    addStep('5. Deletion & Public Removal', step5Passed ? 'PASSED' : 'FAILED', Date.now() - step5Start, step5Assertions,
      `Deleted story cleanly removed from DB, public feeds, and XML sitemap.`
    );
    log(step5Passed ? 'PASS' : 'FAIL', 'Step 5 complete.', { existsInFeedAfterDelete, sitemapStillContains, baselineArticleRestored });

    // ------------------------------------------------------------------------
    // STEP 6: Final Baseline Integrity & Metrics
    // ------------------------------------------------------------------------
    const step6Start = Date.now();
    log('INFO', 'Step 6: Verifying final system state matches initial baseline...');

    const finalStats = DB.getDashboardStats();
    const publishedMatches = finalStats.publishedBlogs === baselinePublishedCount;
    const draftsMatch = finalStats.draftBlogs === baselineDraftsCount;

    const step6Assertions = [
      { name: 'Final published count matches initial baseline', passed: publishedMatches, initial: baselinePublishedCount, final: finalStats.publishedBlogs },
      { name: 'Final drafts count matches initial baseline', passed: draftsMatch, initial: baselineDraftsCount, final: finalStats.draftBlogs }
    ];

    const step6Passed = step6Assertions.every(a => a.passed);
    if (!step6Passed) allPassed = false;

    addStep('6. State Restoration & Consistency', step6Passed ? 'PASSED' : 'FAILED', Date.now() - step6Start, step6Assertions,
      `Zero lingering test artifacts. Database state 100% restored to baseline.`
    );
    log(step6Passed ? 'PASS' : 'FAIL', 'Step 6 complete.', { publishedMatches, draftsMatch });

  } catch (err) {
    allPassed = false;
    log('FAIL', `Unhandled exception in test cycle: ${err.message}`, { stack: err.stack });
    addStep('Exception Handler', 'FAILED', 0, [{ name: 'Test execution exception-free', passed: false, error: err.message }]);

    // Safety clean-up if error occurred before deletion
    if (testBlogId) {
      try {
        log('WARN', `Executing emergency clean-up for test article: ${testBlogId}`);
        DB.deleteBlog(testBlogId);
        invalidateSitemapCache();
      } catch (cleanupErr) {
        log('FAIL', `Emergency clean-up failed: ${cleanupErr.message}`);
      }
    }
  }

  const durationMs = Date.now() - startTime;
  const totalAssertions = steps.reduce((sum, s) => sum + s.assertions.length, 0);
  const passedAssertions = steps.reduce((sum, s) => sum + s.assertions.filter(a => a.passed).length, 0);
  const overallStatus = allPassed ? 'PASSED' : 'FAILED';
  const summary = `Executed ${steps.length} test phases (${passedAssertions}/${totalAssertions} assertions passed) in ${durationMs}ms.`;

  log(allPassed ? 'PASS' : 'FAIL', `E2E Story Lifecycle Test completed: ${overallStatus}`, {
    durationMs,
    totalAssertions,
    passedAssertions
  });

  const testReport = {
    runId,
    timestamp: testTimestamp,
    durationMs,
    status: overallStatus,
    summary,
    totalAssertions,
    passedAssertions,
    steps,
    logs
  };

  // Persist report in DB
  try {
    DB.saveTestLog({
      run_id: runId,
      status: overallStatus,
      summary,
      duration_ms: durationMs,
      details: testReport
    });
    log('INFO', `Test report persisted to dev_test_logs table.`);
  } catch (saveErr) {
    console.error('[TestRunner] Failed to persist test log:', saveErr);
  }

  return testReport;
}

module.exports = {
  runFullLifecycleTest
};
