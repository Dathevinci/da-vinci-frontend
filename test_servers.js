import { getNovelInfo } from './src/lib/novel/sources.js';
getNovelInfo("fmtl:omniscient-reader-s-viewpoint").then(res => {
  console.log("Alternative Servers:", res.alternativeServers);
}).catch(console.error);
