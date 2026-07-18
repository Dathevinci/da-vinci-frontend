setTimeout(() => {
  fetch('https://api.jikan.moe/v4/anime?q=' + encodeURIComponent("Hell's Paradise"))
    .then(r=>r.json())
    .then(d=>{
       if(d.data) console.log(d.data.slice(0,3).map(a=>({ mal_id: a.mal_id, t: a.title, te: a.title_english })));
       else console.log(d);
    });
}, 1000);
