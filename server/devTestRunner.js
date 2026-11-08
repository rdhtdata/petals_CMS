/**
 * Petals CMS - Automated End-to-End Story Lifecycle Test Suite (Dev Role)
 *
 * Executes a full multi-article lifecycle probe:
 *  1. Baseline snapshot & DB integrity check
 *  2. Multi-article creation (3 synthetic stories in Draft phase) & draft quota isolation
 *  3. Multi-article publishing & live website integration (homepage cards, catalog, sitemap)
 *  4. Live content modification (Story #1) & real-time zero-cache update verification
 *  5. Visual verification hold window (delays deletion so operator can inspect live site)
 *  6. Multi-article deletion & public removal verification (prunes feeds & sitemap)
 *  7. Post-flight baseline state restoration check & audit logging
 */

const { DB } = require('./db');
const { buildXmlSitemap, invalidateSitemapCache } = require('./routes/blogs');

async function runFullLifecycleTest(triggeredBy = 'dev', options = {}) {
  const runId = `e2e-run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const startTime = Date.now();
  const testTimestamp = new Date().toISOString();
  const logs = [];
  const steps = [];

  const holdMs = (typeof options.holdMs === 'number' && options.holdMs >= 0) ? options.holdMs : 20000;
  const storyCount = (typeof options.count === 'number' && options.count >= 2 && options.count <= 5) ? options.count : 3;

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

  log('INFO', `Starting Automated Multi-Story Lifecycle E2E Test Suite [Run ID: ${runId}]`, {
    triggeredBy,
    storyCount,
    holdMs
  });

  let allPassed = true;
  const createdTestStories = [];
  const createdTestIds = [];
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

    const initialFeed = DB.getPublicBlogs({ limit: 5 });
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
    // STEP 2: Multi-Article Draft Creation & Isolation Check
    // ------------------------------------------------------------------------
    const step2Start = Date.now();
    log('INFO', `Step 2: Creating ${storyCount} synthetic test stories in draft mode...`);

    const timestampSuffix = Date.now();
    const storyTemplates = [
      {
        code: 'alpha',
        category: 'Business Travel',
        titleSuffix: 'Corporate Suites & Workspaces',
        excerpt: 'Evaluating enterprise ergonomics, high-speed Wi-Fi connectivity, and executive boardroom access at Petals.',
        author: 'Antigravity Test Engine',
        authorRole: 'Enterprise Travel Desk'
      },
      {
        code: 'beta',
        category: 'Luxury Stays',
        titleSuffix: 'Boutique Amenities & Hospitality',
        excerpt: 'Testing bespoke in-suite dining, premium bedding standards, and personalized concierge hospitality touchpoints.',
        author: 'Antigravity Test Engine',
        authorRole: 'Hospitality Critic'
      },
      {
        code: 'gamma',
        category: 'Corporate Guide',
        titleSuffix: 'Long-Term Residency & Logistics',
        excerpt: 'Analyzing extended-stay corporate packages, flexible billing structures, and strategic business park proximity.',
        author: 'Antigravity Test Engine',
        authorRole: 'Corporate Desk'
      }
    ].slice(0, storyCount);

    for (let i = 0; i < storyTemplates.length; i++) {
      const tpl = storyTemplates[i];
      const testSlug = `e2e-probe-${tpl.code}-${timestampSuffix}`;
      const title = `E2E Probe [${tpl.code.toUpperCase()}]: ${tpl.titleSuffix} [${timestampSuffix}]`;
      const content = `<p>Automated diagnostic probe for story <strong>${tpl.code.toUpperCase()}</strong> generated at ${testTimestamp}. Validating database persistence, live web publishing, visual hold verification, and atomic cleanup.</p>`;

      const draft = DB.createBlog({
        title,
        slug: testSlug,
        category: tpl.category,
        excerpt: tpl.excerpt,
        content,
        author: tpl.author,
        author_role: tpl.authorRole,
        status: 'draft',
        skipDraftLimit: true
      });

      createdTestStories.push({
        id: draft.id,
        slug: draft.slug,
        title: draft.title,
        category: draft.category,
        code: tpl.code
      });
      createdTestIds.push(draft.id);

      log('INFO', `Created draft [${i + 1}/${storyCount}]: "${draft.id}" (${draft.category})`);
    }

    // Verify all drafts exist in DB
    const allDraftsInDb = createdTestIds.every(id => {
      const post = DB.getBlogByIdOrSlug(id);
      return post && post.status === 'draft';
    });

    // Verify no drafts leak into public catalog
    const publicFeedDuringDraft = DB.getPublicBlogs({ limit: 100 });
    const anyDraftLeaked = createdTestStories.some(story =>
      publicFeedDuringDraft.some(p => p.id === story.id || p.slug === story.slug)
    );

    // Verify drafts count incremented by storyCount
    const draftsAfterCreate = DB.getDraftsCount();
    const draftCountMatches = draftsAfterCreate === (baselineDraftsCount + storyCount);

    const step2Assertions = [
      { name: `${storyCount} synthetic stories saved to SQLite DB with unique IDs`, passed: createdTestStories.length === storyCount && allDraftsInDb },
      { name: 'All created stories strictly isolated in "draft" status', passed: allDraftsInDb },
      { name: 'Zero draft stories leak into public website catalog', passed: !anyDraftLeaked },
      { name: `Drafts count incremented (+${storyCount})`, passed: draftCountMatches, value: draftsAfterCreate }
    ];

    const step2Passed = step2Assertions.every(a => a.passed);
    if (!step2Passed) allPassed = false;

    addStep('2. Multi-Draft Creation', step2Passed ? 'PASSED' : 'FAILED', Date.now() - step2Start, step2Assertions,
      `Created ${storyCount} synthetic drafts. All drafts strictly isolated from public catalog.`
    );
    log(step2Passed ? 'PASS' : 'FAIL', 'Step 2 complete.', { createdCount: createdTestStories.length, anyDraftLeaked });

    // ------------------------------------------------------------------------
    // STEP 3: Multi-Article Publishing & Public Website Integration
    // ------------------------------------------------------------------------
    const step3Start = Date.now();
    log('INFO', `Step 3: Promoting all ${storyCount} drafts to "published" and testing public website reflection...`);

    const basePubTime = Date.now();
    for (let i = 0; i < createdTestStories.length; i++) {
      const story = createdTestStories[i];
      // Stagger publication timestamps by 1 second so order is deterministic
      const pubTimestamp = new Date(basePubTime + (i * 1000)).toISOString();
      DB.updateBlog(story.id, {
        status: 'published',
        published_at: pubTimestamp
      });
      log('INFO', `Promoted story "${story.id}" to published status.`);
    }

    invalidateSitemapCache();

    // Verify all articles are marked published in DB
    const allPublishedInDb = createdTestIds.every(id => {
      const post = DB.getBlogByIdOrSlug(id);
      return post && post.status === 'published';
    });

    // Verify presence in public blog catalog
    const fullCatalog = DB.getPublicBlogs({ limit: 100 });
    const allExistInCatalog = createdTestStories.every(story =>
      fullCatalog.some(p => p.id === story.id || p.slug === story.slug)
    );

    // Verify at least one test story occupies top spot in homepage spotlight
    const topFeed = DB.getPublicBlogs({ limit: 3 });
    const topSpotlightOccupied = topFeed.length > 0 && createdTestStories.some(s => s.id === topFeed[0].id || s.slug === topFeed[0].slug);

    // Verify XML Sitemap includes all published test stories
    const sitemapXml = buildXmlSitemap();
    const allInSitemap = createdTestStories.every(story =>
      sitemapXml.includes(`blogs.html?article=${encodeURIComponent(story.slug)}`)
    );

    const step3Assertions = [
      { name: `All ${storyCount} stories switched to "published" in DB`, passed: allPublishedInDb },
      { name: `All ${storyCount} stories visible in public blog catalog (blogs.html)`, passed: allExistInCatalog },
      { name: 'Newly published test stories occupy top homepage spotlight', passed: topSpotlightOccupied },
      { name: `XML Sitemap dynamically indexes canonical URLs for all ${storyCount} stories`, passed: allInSitemap }
    ];

    const step3Passed = step3Assertions.every(a => a.passed);
    if (!step3Passed) allPassed = false;

    addStep('3. Batch Publishing & Sitemap', step3Passed ? 'PASSED' : 'FAILED', Date.now() - step3Start, step3Assertions,
      `All ${storyCount} stories published. Verified on public catalog, top homepage spotlight, and dynamic XML sitemap.`
    );
    log(step3Passed ? 'PASS' : 'FAIL', 'Step 3 complete.', { allPublishedInDb, allExistInCatalog, allInSitemap });

    // ------------------------------------------------------------------------
    // STEP 4: Live Content Modification & Zero-Cache Synchronization
    // ------------------------------------------------------------------------
    const step4Start = Date.now();
    log('INFO', 'Step 4: Modifying story #1 (Alpha) and testing real-time zero-cache synchronization...');

    const targetStory = createdTestStories[0];
    const updatedTitle = `E2E Probe [ALPHA] [MODIFIED]: Enterprise Fleet & Mobility [${timestampSuffix}]`;
    const updatedCategory = 'Corporate Guide';
    const updatedExcerpt = 'Updated excerpt verifying zero-cache instant propagation across live website interfaces.';
    const updatedContent = `<p>Updated content probe verified at ${new Date().toISOString()}</p>`;

    DB.updateBlog(targetStory.id, {
      title: updatedTitle,
      category: updatedCategory,
      excerpt: updatedExcerpt,
      content: updatedContent
    });

    invalidateSitemapCache();

    const postAfterUpdate = DB.getBlogByIdOrSlug(targetStory.id);
    const feedAfterUpdate = DB.getPublicBlogs({ limit: 100 });
    const matchingInFeed = feedAfterUpdate.find(b => b.id === targetStory.id || b.slug === targetStory.slug);
    const titleMatchesInFeed = matchingInFeed && matchingInFeed.title === updatedTitle && matchingInFeed.category === updatedCategory;

    const step4Assertions = [
      { name: 'Database record updated with modified title & category', passed: postAfterUpdate && postAfterUpdate.title === updatedTitle && postAfterUpdate.category === updatedCategory },
      { name: 'Live public feed immediately returns updated title without stale cache', passed: !!titleMatchesInFeed, expected: updatedTitle }
    ];

    const step4Passed = step4Assertions.every(a => a.passed);
    if (!step4Passed) allPassed = false;

    addStep('4. Live Modification', step4Passed ? 'PASSED' : 'FAILED', Date.now() - step4Start, step4Assertions,
      `Modified title and category for Story #1 verified in real time on public feeds.`
    );
    log(step4Passed ? 'PASS' : 'FAIL', 'Step 4 complete.', { updatedTitle, titleMatchesInFeed });

    // ------------------------------------------------------------------------
    // STEP 5: Visual Verification Hold Window (Live on Website)
    // ------------------------------------------------------------------------
    const step5Start = Date.now();
    const holdSeconds = Math.round(holdMs / 1000);
    log('INFO', `Step 5: Visual Verification Hold Window — keeping all ${storyCount} test articles live on https://petalshotels.com/blogs.html for ${holdSeconds}s for visual inspection...`);

    if (holdMs > 0) {
      await new Promise(resolve => setTimeout(resolve, holdMs));
    }

    // Verify all stories remained intact and live throughout the hold window
    const catalogAfterHold = DB.getPublicBlogs({ limit: 100 });
    const allRemainedLive = createdTestStories.every(story =>
      catalogAfterHold.some(p => p.id === story.id || p.slug === story.slug)
    );

    const step5Assertions = [
      { name: `Visual verification hold period completed (${holdSeconds}s)`, passed: true, holdSeconds },
      { name: `All ${storyCount} test articles remained live and accessible on public website`, passed: allRemainedLive }
    ];

    const step5Passed = step5Assertions.every(a => a.passed);
    if (!step5Passed) allPassed = false;

    addStep('5. Visual Inspection Hold', step5Passed ? 'PASSED' : 'FAILED', Date.now() - step5Start, step5Assertions,
      `Held ${storyCount} test stories live for ${holdSeconds}s to allow human visual verification on live website.`
    );
    log(step5Passed ? 'PASS' : 'FAIL', 'Step 5 complete.', { holdMs, allRemainedLive });

    // ------------------------------------------------------------------------
    // STEP 6: Multi-Article Deletion & Public Removal Verification
    // ------------------------------------------------------------------------
    const step6Start = Date.now();
    log('INFO', `Step 6: Permanently deleting all ${storyCount} synthetic test stories...`);

    let deleteSuccessAll = true;
    for (const id of createdTestIds) {
      const res = DB.deleteBlog(id);
      if (!res) deleteSuccessAll = false;
      log('INFO', `Deleted test story: "${id}"`);
    }

    invalidateSitemapCache();

    // Verify all deleted from DB
    const allDeletedFromDb = createdTestIds.every(id => DB.getBlogByIdOrSlug(id) === null);

    // Verify none remain in public catalog
    const catalogAfterDelete = DB.getPublicBlogs({ limit: 100 });
    const anyStillInCatalog = createdTestStories.some(story =>
      catalogAfterDelete.some(p => p.id === story.id || p.slug === story.slug)
    );

    // Verify all stripped from XML sitemap
    const sitemapAfterDelete = buildXmlSitemap();
    const anyStillInSitemap = createdTestStories.some(story =>
      sitemapAfterDelete.includes(`blogs.html?article=${encodeURIComponent(story.slug)}`)
    );

    // Verify pre-test baseline articles restored to top spotlight
    const topFeedAfterDelete = DB.getPublicBlogs({ limit: 3 });
    const baselineArticleRestored = baselineTopArticles.length === 0 || (topFeedAfterDelete.length > 0 && topFeedAfterDelete[0].id === baselineTopArticles[0].id);

    const step6Assertions = [
      { name: `All ${storyCount} test articles permanently deleted from SQLite DB`, passed: deleteSuccessAll && allDeletedFromDb },
      { name: 'All test articles completely purged from public blog catalog', passed: !anyStillInCatalog },
      { name: 'All test article URLs stripped from dynamic XML sitemap', passed: !anyStillInSitemap },
      { name: 'Previous articles restored to homepage top spotlight', passed: baselineArticleRestored }
    ];

    const step6Passed = step6Assertions.every(a => a.passed);
    if (!step6Passed) allPassed = false;

    addStep('6. Multi-Article Deletion', step6Passed ? 'PASSED' : 'FAILED', Date.now() - step6Start, step6Assertions,
      `All ${storyCount} synthetic articles safely deleted and completely purged from public feeds and sitemap.`
    );
    log(step6Passed ? 'PASS' : 'FAIL', 'Step 6 complete.', { allDeletedFromDb, anyStillInCatalog, anyStillInSitemap });

    // ------------------------------------------------------------------------
    // STEP 7: Final Baseline Integrity & Metrics
    // ------------------------------------------------------------------------
    const step7Start = Date.now();
    log('INFO', 'Step 7: Verifying final database state matches initial baseline...');

    const finalStats = DB.getDashboardStats();
    const publishedMatches = finalStats.publishedBlogs === baselinePublishedCount;
    const draftsMatch = finalStats.draftBlogs === baselineDraftsCount;

    const step7Assertions = [
      { name: 'Final published count matches initial baseline', passed: publishedMatches, initial: baselinePublishedCount, final: finalStats.publishedBlogs },
      { name: 'Final drafts count matches initial baseline', passed: draftsMatch, initial: baselineDraftsCount, final: finalStats.draftBlogs }
    ];

    const step7Passed = step7Assertions.every(a => a.passed);
    if (!step7Passed) allPassed = false;

    addStep('7. Baseline Restored', step7Passed ? 'PASSED' : 'FAILED', Date.now() - step7Start, step7Assertions,
      `Zero lingering test artifacts. Database state 100% restored to baseline.`
    );
    log(step7Passed ? 'PASS' : 'FAIL', 'Step 7 complete.', { publishedMatches, draftsMatch });

  } catch (err) {
    allPassed = false;
    log('FAIL', `Unhandled exception in test cycle: ${err.message}`, { stack: err.stack });
    addStep('Exception Handler', 'FAILED', 0, [{ name: 'Test execution exception-free', passed: false, error: err.message }]);

    // Safety clean-up if error occurred before deletion
    if (createdTestIds.length > 0) {
      log('WARN', `Executing emergency clean-up for ${createdTestIds.length} synthetic test stories...`);
      for (const id of createdTestIds) {
        try {
          DB.deleteBlog(id);
          log('INFO', `Emergency cleanup deleted: ${id}`);
        } catch (cleanupErr) {
          log('FAIL', `Emergency cleanup failed for ${id}: ${cleanupErr.message}`);
        }
      }
      invalidateSitemapCache();
    }
  }

  const durationMs = Date.now() - startTime;
  const totalAssertions = steps.reduce((sum, s) => sum + s.assertions.length, 0);
  const passedAssertions = steps.reduce((sum, s) => sum + s.assertions.filter(a => a.passed).length, 0);
  const overallStatus = allPassed ? 'PASSED' : 'FAILED';
  const summary = `Executed ${steps.length} test phases (${passedAssertions}/${totalAssertions} assertions passed) in ${durationMs}ms across ${storyCount} test stories.`;

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
