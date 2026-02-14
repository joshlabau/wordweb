import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5178'

test.describe('Graph interaction', () => {
  test('root node is visible on game start', async ({ page }) => {
    await page.goto(BASE)
    // Click Play button
    await page.click('button.btn-primary:has-text("Play")')
    // Wait for the game screen to load
    await page.waitForSelector('.game-screen', { timeout: 5000 })
    // Check SVG exists
    const svg = page.locator('.graph-canvas__svg')
    await expect(svg).toBeVisible()
    // Check there's at least one node group
    const nodes = page.locator('g.graph-node')
    await expect(nodes).toHaveCount(1, { timeout: 3000 })
    // Check the node has a circle and text
    const circle = page.locator('g.graph-node circle')
    await expect(circle).toHaveCount(1)
    const label = page.locator('g.graph-node text')
    await expect(label).toHaveCount(1)
    const text = await label.textContent()
    console.log('Root node word:', text)
    expect(text).toBeTruthy()
  })

  test('clicking root node expands it with candidates', async ({ page }) => {
    await page.goto(BASE)
    await page.click('button.btn-primary:has-text("Play")')
    await page.waitForSelector('.game-screen', { timeout: 5000 })

    // Wait for the root node to appear
    const rootNode = page.locator('g.graph-node').first()
    await expect(rootNode).toBeVisible({ timeout: 3000 })

    // Click the root node
    await rootNode.click()

    // After clicking, we should be in RANKING phase with candidates
    // Wait for more nodes to appear (root + candidates)
    const allNodes = page.locator('g.graph-node')
    await expect(allNodes).not.toHaveCount(1, { timeout: 3000 })

    const count = await allNodes.count()
    console.log('Nodes after expand:', count)
    expect(count).toBeGreaterThan(1)

    // Check that candidate nodes exist
    const candidates = page.locator('g.graph-node--candidate')
    const candCount = await candidates.count()
    console.log('Candidate nodes:', candCount)
    expect(candCount).toBeGreaterThan(0)

    // Check that edges exist
    const edges = page.locator('line.graph-edge')
    const edgeCount = await edges.count()
    console.log('Edges:', edgeCount)
    expect(edgeCount).toBeGreaterThan(0)

    // Check the controls bar shows ranking hint
    const hint = page.locator('.game-screen__controls-hint')
    await expect(hint).toBeVisible()
  })

  test('clicking a candidate node toggles its rank', async ({ page }) => {
    await page.goto(BASE)
    await page.click('button.btn-primary:has-text("Play")')
    await page.waitForSelector('.game-screen', { timeout: 5000 })

    // Expand root
    const rootNode = page.locator('g.graph-node').first()
    await rootNode.click()

    // Wait for candidates
    const candidates = page.locator('g.graph-node--candidate')
    await expect(candidates.first()).toBeVisible({ timeout: 3000 })

    // Count nodes before clicking candidate
    const nodeCountBefore = await page.locator('g.graph-node').count()
    console.log('Nodes before rank toggle:', nodeCountBefore)

    // Click first candidate
    await candidates.first().click()

    // Wait a moment for state update
    await page.waitForTimeout(500)

    // Count nodes after - should be the same (no nodes removed)
    const nodeCountAfter = await page.locator('g.graph-node').count()
    console.log('Nodes after rank toggle:', nodeCountAfter)
    expect(nodeCountAfter).toBe(nodeCountBefore)

    // Check that a ranked badge appeared
    const ranked = page.locator('g.graph-node--ranked')
    const rankedCount = await ranked.count()
    console.log('Ranked nodes:', rankedCount)
    expect(rankedCount).toBeGreaterThanOrEqual(1)

    // Check edges still exist
    const edgeCount = await page.locator('line.graph-edge').count()
    console.log('Edges after rank toggle:', edgeCount)
    expect(edgeCount).toBeGreaterThan(0)
  })

  test('full flow: expand → rank → submit → continue → correct nodes stay, wrong disappear', async ({ page }) => {
    await page.goto(BASE)
    await page.click('button.btn-primary:has-text("Play")')
    await page.waitForSelector('.game-screen', { timeout: 5000 })

    // 1. Expand root node
    const rootNode = page.locator('g.graph-node').first()
    await rootNode.click()
    const candidates = page.locator('g.graph-node--candidate')
    await expect(candidates.first()).toBeVisible({ timeout: 3000 })
    const candCount = await candidates.count()
    console.log('Candidates after expand:', candCount)

    // 2. Rank all candidates by clicking each one
    for (let i = 0; i < candCount; i++) {
      await candidates.nth(i).click()
      await page.waitForTimeout(200)
    }
    const ranked = page.locator('g.graph-node--ranked')
    const rankedCount = await ranked.count()
    console.log('Ranked:', rankedCount)
    expect(rankedCount).toBe(candCount)

    // 3. Submit ranking
    const submitBtn = page.locator('button.btn-primary:has-text("Submit")')
    await expect(submitBtn).toBeEnabled()
    await submitBtn.click()

    // 4. Wait for evaluation overlay — check score display
    const evalOverlay = page.locator('.evaluation-overlay')
    await expect(evalOverlay).toBeVisible({ timeout: 3000 })
    const gradeText = await page.locator('.evaluation-overlay__grade').textContent()
    console.log('Score:', gradeText)

    // Click Continue
    const continueBtn = page.locator('.evaluation-overlay button.btn-primary:has-text("Continue")')
    await continueBtn.click()

    // 5. Should return to IDLE
    const prompt = page.locator('.game-screen__prompt')
    await expect(prompt).toBeVisible({ timeout: 3000 })
    console.log('Phase after continue: IDLE')

    // No candidate nodes should remain (all converted or removed)
    const remainingCandidates = page.locator('g.graph-node--candidate')
    const remainingCount = await remainingCandidates.count()
    expect(remainingCount).toBe(0)

    // Total nodes = 1 root + however many were correctly ranked
    const totalNodes = await page.locator('g.graph-node').count()
    console.log('Total nodes after evaluation:', totalNodes)
    expect(totalNodes).toBeGreaterThanOrEqual(1) // at minimum the root
    expect(totalNodes).toBeLessThanOrEqual(1 + candCount) // at most root + all candidates

    // If any unexpanded nodes exist, try expanding one
    const unexpanded = page.locator('g.graph-node--unexpanded')
    const unexpandedCount = await unexpanded.count()
    console.log('Unexpanded nodes:', unexpandedCount)

    if (unexpandedCount > 0) {
      await unexpanded.first().click()
      await page.waitForTimeout(500)

      const newCandidates = page.locator('g.graph-node--candidate')
      const newCandCount = await newCandidates.count()
      console.log('New candidates after expanding a node:', newCandCount)
      expect(newCandCount).toBeGreaterThan(0)

      const newHint = page.locator('.game-screen__controls-hint')
      await expect(newHint).toBeVisible()
    }

    console.log('Full flow test passed!')
  })
})
