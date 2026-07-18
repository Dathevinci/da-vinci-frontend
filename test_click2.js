const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message, err.stack));
  
  console.log('Navigating to home...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  
  console.log('Clicking Airing Now link...');
  await page.click('text=Airing Now');
  await page.waitForTimeout(3000);
  
  console.log('Clicking first anime card...');
  await page.click('button[aria-label^="View"]');
  await page.waitForTimeout(3000);
  
  console.log('Done!');
  await browser.close();
})();
