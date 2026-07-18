const cheerio = require('cheerio');

async function test() {
  try {
    const url = "https://gogoanime3.co/search.html?keyword=hell's+paradise";
    let res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }});
    let html = await res.text();
    
    // Check for JS redirect
    const match = html.match(/window\.location\.replace\('([^']+)'\)/);
    if (match) {
      console.log("Bypassing JS redirect:", match[1]);
      res = await fetch(match[1], { headers: { "User-Agent": "Mozilla/5.0" }});
      html = await res.text();
    }

    const $ = cheerio.load(html);
    const results = [];
    $('.items li').each((i, el) => {
      const link = $(el).find('.name a').attr('href');
      const title = $(el).find('.name a').text();
      results.push({ link, title });
    });
    console.log("Found items:", results.length);
    if (results.length > 0) {
      console.log(results[0]);
    } else {
      console.log(html.substring(0, 500));
    }
  } catch (e) {
    console.error(e);
  }
}
test();
