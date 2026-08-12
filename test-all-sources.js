const tsconfigPaths = require("tsconfig-paths");
const tsNode = require("ts-node");
tsNode.register({
  compilerOptions: { module: "commonjs", moduleResolution: "node" },
  transpileOnly: true
});
tsconfigPaths.register({
  baseUrl: "./",
  paths: { "@/*": ["src/*"] }
});

const NovelFull = require("./src/lib/novel/NovelFull");
const ReadNovelFull = require("./src/lib/novel/ReadNovelFull");
const Ranobes = require("./src/lib/novel/Ranobes");
const WuxiaWorld = require("./src/lib/novel/WuxiaWorldSite");

async function testAll() {
  console.log("1. ReadNovelFull trending...");
  try {
    const r = await ReadNovelFull.browseNovels(1, "most-popular-novel");
    console.log("   RNF trending count:", r.results.length);
  } catch(e) { console.error("   RNF error:", e.message); }

  console.log("2. NovelFull latest...");
  try {
    const r = await NovelFull.browseNovels(1, "latest");
    console.log("   NF latest count:", r.results.length);
  } catch(e) { console.error("   NF error:", e.message); }

  console.log("3. ReadNovelFull completed...");
  try {
    const r = await ReadNovelFull.browseNovels(1, "completed-novel");
    console.log("   RNF completed count:", r.results.length);
  } catch(e) { console.error("   RNF completed error:", e.message); }

  console.log("4. Ranobes rating...");
  try {
    const r = await Ranobes.browseNovels(1, "rating");
    console.log("   Ranobes count:", r.results.length);
  } catch(e) { console.error("   Ranobes error:", e.message); }

  console.log("5. WuxiaWorldSite trending...");
  try {
    const r = await WuxiaWorld.browseNovels(1, "trending");
    console.log("   WWS count:", r.results.length);
  } catch(e) { console.error("   WWS error:", e.message); }
}

testAll();
