import fs from 'fs';

async function main() {
  const res = await fetch('https://api.jikan.moe/v4/top/anime?limit=1');
  const json = await res.json();
  console.log(JSON.stringify(json.data[0], null, 2));
}

main();
