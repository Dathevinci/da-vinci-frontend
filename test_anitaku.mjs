import { AnitakuScraper } from 'anitaku-scraper';
const scraper = new AnitakuScraper();
scraper.searchAnime("Hell's Paradise").then(data => console.log(JSON.stringify(data, null, 2))).catch(console.error);
