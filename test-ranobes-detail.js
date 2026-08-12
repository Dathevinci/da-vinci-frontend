fetch('https://ranobes.top/novels/1207200-.html', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Referer': 'https://ranobes.top/ranking/'
  }
})
.then(r => r.text())
.then(html => {
  console.log("Title match:", html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1].replace(/<[^>]+>/g, "").trim());
});
