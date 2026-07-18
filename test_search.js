const jikan = require('./src/lib/jikan.ts'); // Wait, can't require TS
const fs = require('fs');
const http = require('http');

fetch('https://api.jikan.moe/v4/anime?limit=20&page=1&q=violet%20evergarden')
  .then(res => res.json())
  .then(data => {
    console.log("Jikan search results:", data.data ? data.data.length : 0);
  });
