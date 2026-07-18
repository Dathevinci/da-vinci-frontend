async function test() {
  try {
    const res = await fetch("https://anikototvapi.vercel.app/api/search?keyword=地獄楽");
    const data = await res.json();
    console.log(JSON.stringify(data.results.data, null, 2));
  } catch (e) {
    console.error(e);
  }
}
test();
