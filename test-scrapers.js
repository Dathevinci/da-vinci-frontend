const tsNode = require("ts-node");
tsNode.register({
  compilerOptions: { module: "commonjs", moduleResolution: "node" },
  transpileOnly: true
});

const Ranobes = require("./src/lib/novel/Ranobes");
const WuxiaWorld = require("./src/lib/novel/WuxiaWorldSite");

async function test() {
  console.log("Testing Ranobes...");
  try {
    const r = await Ranobes.browseNovels(1, "rating");
    console.log("Ranobes count:", r.results.length);
    if (r.results.length > 0) console.log("Ranobes sample:", r.results[0]);
  } catch (e) {
    console.error("Ranobes error:", e);
  }

  console.log("\nTesting WuxiaWorld...");
  try {
    const w = await WuxiaWorld.browseNovels(1, "trending");
    console.log("WuxiaWorld count:", w.results.length);
    if (w.results.length > 0) console.log("WuxiaWorld sample:", w.results[0]);
  } catch (e) {
    console.error("WuxiaWorld error:", e);
  }
}

test();
