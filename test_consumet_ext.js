const { ANIME } = require('@consumet/extensions');
async function test() {
  const hianime = new ANIME.Hianime();
  try {
    const results = await hianime.search("Hell's Paradise");
    console.log(results.results[0]);
    if (results.results.length > 0) {
      const info = await hianime.fetchAnimeInfo(results.results[0].id);
      console.log(info.episodes[0]);
      if (info.episodes.length > 0) {
        const stream = await hianime.fetchEpisodeSources(info.episodes[0].id);
        console.log(stream);
      }
    }
  } catch (e) {
    console.error(e);
  }
}
test();
