fetch("https://anikototvapi.vercel.app/api/search?keyword=Chainsaw Man The Movie Reze Arc")
.then(r=>r.json())
.then(d=>console.log(JSON.stringify(d, null, 2)))
