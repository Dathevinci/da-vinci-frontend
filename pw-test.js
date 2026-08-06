const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Intercept all requests to see if there's an API
  page.on('request', request => {
    if (request.url().includes('api') || request.url().includes('json')) {
      console.log('>>', request.method(), request.url());
    }
  });
  
  page.on('response', async response => {
    if (response.url().includes('api') || response.url().includes('json')) {
      console.log('<<', response.status(), response.url());
      try {
        // console.log(await response.text());
      } catch (e) {}
    }
  });

  console.log('Navigating to lnori.com...');
  await page.goto('https://lnori.com/');
  await page.waitForTimeout(3000); // wait for CF challenge if any
  console.log('Title:', await page.title());
  
  // Search for slime
  await page.goto('https://lnori.com/classroom-of-the-elite');
  await page.waitForTimeout(3000);
  
  // Find images
  const imgs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img')).map(img => img.src);
  });
  console.log('Images:', imgs);
  
  await browser.close();
})();
