fetch('https://anikototvapi.vercel.app/api/search?keyword=' + encodeURIComponent("Jigokuraku"))
  .then(r=>r.json())
  .then(d=>console.log(d.results.data.slice(0,3).map(i=>({id: i.animeId, title:i.title}))));