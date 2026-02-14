import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5178'

test('debug: check for errors and DOM state', async ({ page }) => {
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
    console.log(`[${msg.type()}]`, msg.text())
  })
  page.on('pageerror', err => {
    errors.push(err.message)
    console.log('[PAGE ERROR]', err.message)
  })

  await page.goto(BASE)
  await page.waitForTimeout(1000)

  // Click Play
  const playBtn = page.locator('button.btn-primary:has-text("Play")')
  if (await playBtn.isVisible()) {
    await playBtn.click()
    await page.waitForTimeout(2000)
  }

  // Dump the SVG contents
  const svgHtml = await page.evaluate(() => {
    const svg = document.querySelector('.graph-canvas__svg')
    return svg ? svg.innerHTML.substring(0, 2000) : 'NO SVG FOUND'
  })
  console.log('SVG innerHTML:', svgHtml)

  // Check for g.graph-container
  const containerCount = await page.locator('g.graph-container').count()
  console.log('graph-container count:', containerCount)

  // Check all g elements inside svg
  const gElements = await page.evaluate(() => {
    const svg = document.querySelector('.graph-canvas__svg')
    if (!svg) return 'NO SVG'
    const gs = svg.querySelectorAll('g')
    return Array.from(gs).map(g => ({
      class: g.getAttribute('class'),
      childCount: g.children.length,
      transform: g.getAttribute('transform'),
    }))
  })
  console.log('All g elements:', JSON.stringify(gElements, null, 2))

  if (errors.length > 0) {
    console.log('ERRORS:', errors)
  }

  // Check what game phase we're in
  const phaseText = await page.evaluate(() => {
    const prompt = document.querySelector('.game-screen__prompt')
    const controls = document.querySelector('.game-screen__controls-hint')
    return {
      prompt: prompt?.textContent || null,
      controls: controls?.textContent || null,
    }
  })
  console.log('Phase text:', phaseText)
})
