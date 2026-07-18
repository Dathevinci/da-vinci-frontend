async function test() {
  try {
    const res = await fetch("https://gogoanime3.co/search.html?keyword=hell's+paradise", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    });
    console.log("Status:", res.status);
    const text = await res.text();
    console.log(text.substring(0, 200));
  } catch (e) {
    console.error(e);
  }
}
test();
