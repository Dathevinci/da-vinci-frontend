async function ping(url) {
  try {
    const res = await fetch(url, {method: 'HEAD'});
    console.log(url, res.status);
  } catch (e) {
    console.log(url, 'Error');
  }
}
async function main() {
  await ping('https://cdn.lnori.com/covers/classroom-of-the-elite/volume-01.jpg');
  await ping('https://cdn.lnori.com/covers/classroom-of-the-elite/1.jpg');
  await ping('https://cdn.lnori.com/covers/Classroom of the Elite - Volume 01.jpg');
  await ping('https://lnori.com/images/classroom-of-the-elite-volume-01.jpg');
}
main();
