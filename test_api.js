const { searchAnime, enhanceWithAniListImages } = require('./src/lib/jikan.ts');
// need to run with ts-node or something. Instead just fetch directly:

async function test() {
  const JIKAN_API = "https://api.jikan.moe/v4";
  let url = `/anime?limit=20&page=1&status=upcoming`;
  console.log('Fetching', JIKAN_API + url);
  const res = await fetch(JIKAN_API + url);
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Data count:', data.data?.length);
  
  // also let's fetch airing
  const res2 = await fetch(JIKAN_API + '/top/anime?filter=airing&limit=12');
  console.log('Status 2:', res2.status);
  const data2 = await res2.json();
  console.log('Data 2 count:', data2.data?.length);
}

test();
