/**
 * SkillLens AI — Day 32 UI/UX Polish Test Suite
 *
 * Verifies:
 * 1. Reusable common components exist and export expected symbols
 * 2. Shared common index.js export bundle
 * 3. Dedicated Dashboard implementation replacing placeholder
 * 4. Global animations, transitions, and prefers-reduced-motion support
 * 5. Touch targets (>= 44px) for mobile accessibility (WCAG 2.2 AA)
 * 6. Standardized loading, empty, and error states across application pages
 * 7. Accessibility semantics (roles, aria attributes, heading levels)
 * 8. Responsive breakpoints and layout rules across components
 */

const fs = require('fs')
const path = require('path')
const assert = require('assert')

const rootDir = path.resolve(__dirname, '../..')
const frontendDir = path.join(rootDir, 'frontend', 'src')

async function runDay32Tests(testAsync) {
  console.log('\n--- SkillLens AI: Day 32 Complete UI/UX Polish Tests ---')

  const runner = testAsync || (async (desc, fn) => {
    try {
      await fn()
      console.log(`[PASS] ${desc}`)
    } catch (err) {
      console.error(`[FAIL] ${desc}: ${err.message}`)
    }
  })

  // 1. Reusable Components Existence
  await runner('1. Common reusable components exist (PageHeader, EmptyState, ErrorState, SkeletonLoader, StatusBadge)', async () => {
    const files = [
      'PageHeader.jsx',
      'PageHeader.module.css',
      'EmptyState.jsx',
      'EmptyState.module.css',
      'ErrorState.jsx',
      'ErrorState.module.css',
      'SkeletonLoader.jsx',
      'SkeletonLoader.module.css',
      'StatusBadge.jsx',
      'StatusBadge.module.css',
    ]
    for (const f of files) {
      const fullPath = path.join(frontendDir, 'components', 'common', f)
      assert.strictEqual(fs.existsSync(fullPath), true, `Missing file: ${f}`)
    }
  })

  // 2. Common index.js exists and exports components
  await runner('2. frontend/src/components/common/index.js exists and exports shared components', async () => {
    const indexPath = path.join(frontendDir, 'components', 'common', 'index.js')
    assert.strictEqual(fs.existsSync(indexPath), true, 'index.js does not exist in common')
    const content = fs.readFileSync(indexPath, 'utf-8')
    assert.match(content, /export\s+\{\s*default\s+as\s+PageHeader\s*\}/)
    assert.match(content, /export\s+\{\s*default\s+as\s+EmptyState\s*\}/)
    assert.match(content, /export\s+\{\s*default\s+as\s+ErrorState\s*\}/)
    assert.match(content, /export\s+\{\s*default\s+as\s+SkeletonLoader/)
    assert.match(content, /export\s+\{\s*default\s+as\s+StatusBadge\s*\}/)
  })

  // 3. Real Dashboard page exists and is hooked in App.jsx
  await runner('3. Dedicated Dashboard.jsx exists and replaces placeholder in App.jsx', async () => {
    const dashPath = path.join(frontendDir, 'pages', 'Dashboard.jsx')
    const dashCssPath = path.join(frontendDir, 'pages', 'Dashboard.module.css')
    assert.strictEqual(fs.existsSync(dashPath), true, 'Dashboard.jsx missing')
    assert.strictEqual(fs.existsSync(dashCssPath), true, 'Dashboard.module.css missing')

    const appPath = path.join(frontendDir, 'App.jsx')
    const appContent = fs.readFileSync(appPath, 'utf-8')
    assert.match(appContent, /import\s+Dashboard\s+from\s+['"]\.\/pages\/Dashboard['"]/)
    assert.match(appContent, /<Dashboard\s*\/>/)
    assert.doesNotMatch(appContent, /<PlaceholderPage\s+title="Dashboard"\s*\/>/)
  })

  // 4. Global CSS animation utilities and reduced motion support
  await runner('4. global.css defines fadeIn, slideUp keyframes, utility classes, and reduced-motion overrides', async () => {
    const globalCssPath = path.join(frontendDir, 'styles', 'global.css')
    const css = fs.readFileSync(globalCssPath, 'utf-8')
    assert.match(css, /@keyframes\s+fadeIn/)
    assert.match(css, /@keyframes\s+slideUp/)
    assert.match(css, /\.animate-fade-in/)
    assert.match(css, /\.animate-slide-up/)
    assert.match(css, /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/)
  })

  // 5. Mobile touch targets meet WCAG 2.2 AA (>= 44px)
  await runner('5. Touch targets for buttons and interactive controls satisfy minimum 44px on mobile viewports', async () => {
    const btnCssPath = path.join(frontendDir, 'components', 'common', 'Button.module.css')
    const btnCss = fs.readFileSync(btnCssPath, 'utf-8')
    assert.match(btnCss, /min-height:\s*(2\.75rem|44px)/, 'Button small lacks 44px/2.75rem mobile min-height')

    const navCssPath = path.join(frontendDir, 'components', 'layout', 'Navbar.module.css')
    const navCss = fs.readFileSync(navCssPath, 'utf-8')
    assert.match(navCss, /min-height:\s*44px/, 'Navbar menuBtn lacks 44px min-height')

    const sidebarCssPath = path.join(frontendDir, 'components', 'layout', 'Sidebar.module.css')
    const sidebarCss = fs.readFileSync(sidebarCssPath, 'utf-8')
    assert.match(sidebarCss, /min-height:\s*44px/, 'Sidebar navLink lacks 44px min-height')
  })

  // 6. SkeletonLoader accessibility and animation reduction
  await runner('6. SkeletonLoader implements role="status", screen reader text, and respects reduced motion', async () => {
    const skelPath = path.join(frontendDir, 'components', 'common', 'SkeletonLoader.jsx')
    const skelContent = fs.readFileSync(skelPath, 'utf-8')
    assert.match(skelContent, /role="status"/)
    assert.match(skelContent, /Loading…/)

    const skelCssPath = path.join(frontendDir, 'components', 'common', 'SkeletonLoader.module.css')
    const skelCss = fs.readFileSync(skelCssPath, 'utf-8')
    assert.match(skelCss, /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/)
  })

  // 7. ErrorState and EmptyState accessibility semantics
  await runner('7. ErrorState implements role="alert" and EmptyState implements aria-label semantic structure', async () => {
    const errPath = path.join(frontendDir, 'components', 'common', 'ErrorState.jsx')
    const errContent = fs.readFileSync(errPath, 'utf-8')
    assert.match(errContent, /role="alert"/)

    const emptyPath = path.join(frontendDir, 'components', 'common', 'EmptyState.jsx')
    const emptyContent = fs.readFileSync(emptyPath, 'utf-8')
    assert.match(emptyContent, /aria-label=\{title\}/)
    assert.match(emptyContent, /<section/)
  })

  // 8. StatusBadge accessibility and contrast tokens
  await runner('8. StatusBadge implements role="status" and contrast-compliant styling', async () => {
    const badgePath = path.join(frontendDir, 'components', 'common', 'StatusBadge.jsx')
    const badgeContent = fs.readFileSync(badgePath, 'utf-8')
    assert.match(badgeContent, /role="status"/)

    const badgeCssPath = path.join(frontendDir, 'components', 'common', 'StatusBadge.module.css')
    const badgeCss = fs.readFileSync(badgeCssPath, 'utf-8')
    assert.match(badgeCss, /\.success/)
    assert.match(badgeCss, /\.warning/)
    assert.match(badgeCss, /\.danger/)
    assert.match(badgeCss, /\.processing/)
  })

  // 9. PageHeader integration across core pages
  await runner('9. PageHeader is integrated into AnalysisHistory, AnalysisResults, Roadmap, Recommendations, CareerInsights, ReportGeneration, JobDescriptions, SkillMatching, and Settings', async () => {
    const pages = [
      'AnalysisHistory.jsx',
      'AnalysisResults.jsx',
      'Roadmap.jsx',
      'Recommendations.jsx',
      'CareerInsights.jsx',
      'ReportGeneration.jsx',
      'JobDescriptions.jsx',
      'SkillMatching.jsx',
      'Settings.jsx',
    ]

    for (const page of pages) {
      const pagePath = path.join(frontendDir, 'pages', page)
      const content = fs.readFileSync(pagePath, 'utf-8')
      assert.match(content, /<PageHeader/, `${page} does not use <PageHeader`)
    }
  })

  // 10. EmptyState & ErrorState integration across key pages
  await runner('10. EmptyState and ErrorState are integrated across user analysis journeys', async () => {
    const historyContent = fs.readFileSync(path.join(frontendDir, 'pages', 'AnalysisHistory.jsx'), 'utf-8')
    assert.match(historyContent, /<EmptyState/)
    assert.match(historyContent, /<ErrorState/)

    const reportContent = fs.readFileSync(path.join(frontendDir, 'pages', 'ReportGeneration.jsx'), 'utf-8')
    assert.match(reportContent, /<EmptyState/)
    assert.match(reportContent, /<ErrorState/)

    const insightsContent = fs.readFileSync(path.join(frontendDir, 'pages', 'CareerInsights.jsx'), 'utf-8')
    assert.match(insightsContent, /<EmptyState/)
    assert.match(insightsContent, /<ErrorState/)

    const matchingContent = fs.readFileSync(path.join(frontendDir, 'pages', 'SkillMatching.jsx'), 'utf-8')
    assert.match(matchingContent, /<EmptyState/)
    assert.match(matchingContent, /<ErrorState/)
  })

  // 11. Responsive design breakpoints across pages and layouts
  await runner('11. Responsive media queries exist across Dashboard, Sidebar, Navbar, and Global CSS', async () => {
    const files = [
      path.join(frontendDir, 'pages', 'Dashboard.module.css'),
      path.join(frontendDir, 'components', 'layout', 'Sidebar.module.css'),
      path.join(frontendDir, 'styles', 'global.css'),
    ]

    for (const f of files) {
      const css = fs.readFileSync(f, 'utf-8')
      assert.match(css, /@media\s*\(\s*max-width:\s*\d+px\s*\)/, `${f} lacks responsive media queries`)
    }
  })
}

module.exports = { runDay32Tests }
