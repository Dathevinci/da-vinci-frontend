fetch('https://wuxiaworld.site/page/1/?s=&post_type=wp-manga&m_orderby=trending')
  .then(r => r.text())
  .then(html => {
    const re = /<div class="[^"]*(?:c-tabs-item__content|page-item-detail)[^"]*">[\s\S]*?<a href="https:\/\/wuxiaworld\.site\/novel\/([^/]+)\/"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?<h3[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/gi;
    let count = 0;
    while (re.exec(html)) count++;
    console.log('Matches:', count);
  });
