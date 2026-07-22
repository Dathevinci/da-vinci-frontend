import { homeShelves } from './src/lib/novel/sources.js';
homeShelves().then(res => {
  console.log("Korean Shelf Length:", res.korean.length);
  if (res.korean.length > 0) console.log("First Korean Novel:", res.korean[0].title);
}).catch(console.error);
