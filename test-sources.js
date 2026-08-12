const tsconfigPaths = require("tsconfig-paths");
const tsNode = require("ts-node");
tsNode.register({
  compilerOptions: { module: "commonjs" },
  transpileOnly: true
});
tsconfigPaths.register({
  baseUrl: "./",
  paths: { "@/*": ["src/*"] }
});

const WWS = require("./src/lib/novel/WuxiaWorldSite");
const RNF = require("./src/lib/novel/ReadNovelFull");

async function run() {
  console.log("Fetching WWS...");
  try {
    const wws = await WWS.browseNovels(1, "trending");
    console.log("WWS count:", wws.results.length);
    console.log("WWS items:", wws.results.slice(0, 3));
  } catch(e) { console.error("WWS Error:", e); }

  console.log("Fetching RNF...");
  try {
    const rnf = await RNF.browseNovels(1, "most-popular-novel");
    console.log("RNF count:", rnf.results.length);
    console.log("RNF items:", rnf.results.slice(0, 3));
  } catch(e) { console.error("RNF Error:", e); }
}

run();
