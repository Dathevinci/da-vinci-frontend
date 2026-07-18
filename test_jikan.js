async function go() {
  for (let i=0; i<5; i++) {
    const r = await fetch('https://api.jikan.moe/v4/anime?q=' + encodeURIComponent("Hell's Paradise"));
    if (r.status === 429) { await new Promise(res=>setTimeout(res, 2000)); continue; }
    const d = await r.json();
    console.log(d.data.slice(0,3).map(a=>({ mal_id: a.mal_id, t: a.title, te: a.title_english })));
    return;
  }
}
go();
