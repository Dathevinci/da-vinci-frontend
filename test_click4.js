const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/');
  const text = await page.evaluate(() => document.body.innerText);
  console.log('BODY TEXT:\n', text);
  await browser.close();
})();
