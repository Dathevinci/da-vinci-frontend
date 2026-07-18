const { chromium } = require('playwright');
(async () => {
  console.log('Starting browser...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message, err.stack));
  
  console.log('Navigating to home...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  
  await page.waitForTimeout(1000);
  console.log('Hovering over first anime to reveal Like button...');
  const firstCard = page.locator('button[aria-label^="View"]').first();
  // We can't hover on touch devices, but we can evaluate a script to click the Like button!
  
  console.log('Going to profile...');
  await page.goto('http://localhost:3000/profile', { waitUntil: 'networkidle' });
  
  await page.waitForTimeout(1000);
  console.log('Clicking Liked tab...');
  // The tab has text "Liked"
  await page.click('button:has-text("Liked")');
  
  await page.waitForTimeout(2000);
  console.log('Done!');
  await browser.close();
})();
