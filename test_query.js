fetch("https://graphql.anilist.co", { 
  method: "POST", 
  headers: {"Content-Type": "application/json"}, 
  body: JSON.stringify({ query: `{ Media(search: "Chainsaw Man Reze", type: ANIME) { status title { english romaji } format } }` }) 
}).then(r=>r.json()).then(d=>console.log(JSON.stringify(d, null, 2)))
