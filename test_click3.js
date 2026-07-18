const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message, err.stack));
  
  console.log('Navigating to home...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  
  // Try clicking an anime card
  console.log('Clicking anime card...');
  const cards = await page.$$('a[href^="/anime/"]');
  if (cards.length > 0) {
    await cards[0].click();
    await page.waitForTimeout(3000);
  } else {
    console.log('No anime cards found.');
  }

  await browser.close();
})();
