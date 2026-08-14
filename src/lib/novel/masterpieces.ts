import type { NovelResult, NovelInfo } from "./types";

export interface MasterpieceEntry {
  id: string;
  title: string;
  category: "light-novel" | "korean-masterpiece" | "chinese-xianxia";
  tag: string;
  status: "Completed" | "Ongoing";
  author: string;
  cover: string;
  bannerImage?: string;
  latestChapter: string;
  genres: string[];
  synopsis: string;
}

export const OFFICIAL_LIGHT_NOVELS: MasterpieceEntry[] = [
  {
    id: "rnb:novels/667603-mushoku-tensei-v812312",
    title: "Mushoku Tensei: Jobless Reincarnation",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Completed",
    author: "Rifujin na Magonote",
    cover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/nx85470-jt6BF9tDWB2X.jpg",
    bannerImage: "https://s4.anilist.co/file/anilistcdn/media/manga/banner/85470-akkFSKH9aacB.jpg",
    latestChapter: "Volume 26 (Complete)",
    genres: ["Adventure", "Drama", "Fantasy", "Isekai"],
    synopsis: "A 34-year-old NEET is reborn into a world of swords and magic as Rudeus Greyrat, resolved to live his second life to the absolute fullest without regrets."
  },
  {
    id: "rnb:novels/718239-youjitsu-v812312",
    title: "Classroom of the Elite",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Ongoing",
    author: "Shougo Kinugasa",
    cover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx94970-q77X5sfRIKvU.jpg",
    bannerImage: "https://s4.anilist.co/file/anilistcdn/media/manga/banner/94970-9PvpnfpcaaDc.jpg",
    latestChapter: "Year 2 Volume 12",
    genres: ["Drama", "Psychological", "School Life"],
    synopsis: "Kiyotaka Ayanokouji is a student of the prestigious Tokyo Metropolitan Advanced Nurturing High School, where students are given total freedom to reach their potential."
  },
  {
    id: "fwn:overlord-the-multiverse",
    title: "Overlord",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Ongoing",
    author: "Kugane Maruyama",
    cover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx85976-hVr99G1kD1M5.png",
    bannerImage: "https://s4.anilist.co/file/anilistcdn/media/manga/banner/85976-IqnF67g41gXU.jpg",
    latestChapter: "Volume 16 (The Half-Elf God-kin)",
    genres: ["Action", "Adventure", "Fantasy", "Overpowered"],
    synopsis: "When the popular virtual reality game Yggdrasil shuts down, Momonga decides to stay logged in until the final moment, only to find himself trapped in his skeletal avatar as supreme ruler of the Great Tomb of Nazarick."
  },
  {
    id: "fwn:rezero-kara-hajimeru-isekai-seikatsu-wn",
    title: "Re:Zero - Starting Life in Another World",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Ongoing",
    author: "Tappei Nagatsuki",
    cover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx85737-WkWOr5EgwPyo.jpg",
    bannerImage: "https://s4.anilist.co/file/anilistcdn/media/manga/banner/85737-jCG8ine3fTDr.png",
    latestChapter: "Arc 8 Chapter 60+",
    genres: ["Action", "Adventure", "Drama", "Psychological"],
    synopsis: "Subaru Natsuki is suddenly summoned to a fantasy world with no special abilities, except the harrowing power of Return by Death."
  },
  {
    id: "rnb:novels/59150-regarding-reincarnating-as-slime-v812312",
    title: "That Time I Got Reincarnated as a Slime",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Ongoing",
    author: "Fuse",
    cover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx86355-pGwmLqVTwwE4.jpg",
    bannerImage: "https://s4.anilist.co/file/anilistcdn/media/manga/banner/86355-f0kILfzr9zZA.jpg",
    latestChapter: "Volume 21 Chapter 4",
    genres: ["Adventure", "Comedy", "Fantasy", "Kingdom Building"],
    synopsis: "Stabbed on the streets of Tokyo, Satoru Mikami awakens in a fantasy world as a slime endowed with the unique skill Predator, founding the Jura Tempest Federation."
  },
  {
    id: "rnb:novels/593616-to-be-a-power-in-the-shadows-v812312",
    title: "The Eminence in Shadow",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Ongoing",
    author: "Daisuke Aizawa",
    cover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx108428-wTg20rSpvkU9.jpg",
    bannerImage: "https://s4.anilist.co/file/anilistcdn/media/manga/banner/108428-Zm90nTeodNMI.jpg",
    latestChapter: "Volume 6 Chapter 5",
    genres: ["Action", "Comedy", "Fantasy", "Parody"],
    synopsis: "Cid Kagenou lives to act like a mysterious mastermind operating in the background, completely unaware that his made-up conspiracies against the Cult of Diablos are all real."
  }
];

export const KOREAN_GLOBAL_MASTERPIECES: MasterpieceEntry[] = [
  {
    id: "fwn:shadow-slave",
    title: "Shadow Slave",
    category: "korean-masterpiece",
    tag: "Global Hit",
    status: "Ongoing",
    author: "Guiltythree",
    cover: "https://media.kitsu.app/manga/75529/poster_image/large-2df49f981edd9ebf1a040696808c2ea9.jpeg",
    latestChapter: "Chapter 3150+",
    genres: ["Action", "Adventure", "Fantasy", "Mystery"],
    synopsis: "Growing up in poverty, Sunny awakens as an elusive Shadow slave in the Nightmare Spell, ascending the ranks of divine tribulations across broken realms."
  },
  {
    id: "fwn:omniscient-readers-viewpoint-novel",
    title: "Omniscient Reader's Viewpoint",
    category: "korean-masterpiece",
    tag: "Korean Masterpiece",
    status: "Completed",
    author: "Sing Shong",
    cover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx119257-Pi21aq3ey9GG.jpg",
    bannerImage: "https://s4.anilist.co/file/anilistcdn/media/manga/banner/119257-RtxJMRCunHXc.jpg",
    latestChapter: "Chapter 551 (Complete)",
    genres: ["Action", "Adventure", "Apocalypse", "Supernatural"],
    synopsis: "Dokja was an average office worker whose only hobby was reading an obscure webnovel. When the novel suddenly becomes apocalyptic reality, he is the only one who knows the ending."
  },
  {
    id: "fwn:the-beginning-after-the-end-novel",
    title: "The Beginning After the End",
    category: "korean-masterpiece",
    tag: "Epic Fantasy",
    status: "Ongoing",
    author: "TurtleMe",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx183161-5M054tuPmZJX.jpg",
    latestChapter: "Volume 11 Chapter 480+",
    genres: ["Action", "Adventure", "Magic", "Reincarnation"],
    synopsis: "King Grey was unmatched in strength and wealth, but died alone. Reborn as Arthur Leywin, he masters mana and aether to protect his loved ones from the deities of Epheotus."
  },
  {
    id: "fwn:trash-of-the-counts-family",
    title: "Trash of the Count's Family",
    category: "korean-masterpiece",
    tag: "Korean Masterpiece",
    status: "Ongoing",
    author: "Yoo Ryeo Han",
    cover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx123573-LKoCKwRouEMW.png",
    bannerImage: "https://s4.anilist.co/file/anilistcdn/media/manga/banner/123573-mUJqgpAkIWrX.jpg",
    latestChapter: "Part 2 Chapter 300+",
    genres: ["Action", "Adventure", "Comedy", "Fantasy"],
    synopsis: "Waking up as the trash son of a wealthy count, Cale Henituse only wants a lazy peaceful life, but keeps accidentally saving the kingdom alongside dragons and heroes."
  }
];

export const CHINESE_XIANXIA_MASTERPIECES: MasterpieceEntry[] = [
  {
    id: "fwn:lord-of-the-mysteries",
    title: "Lord of the Mysteries",
    category: "chinese-xianxia",
    tag: "Victorian Xianxia",
    status: "Completed",
    author: "Cuttlefish That Loves Diving",
    cover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/b125291-5UbQcPd0JwiV.png",
    latestChapter: "Chapter 1432 (Complete)",
    genres: ["Mystery", "Psychological", "Supernatural", "Steampunk"],
    synopsis: "In a world of steam engines, tarot clubs, and cosmic horrors, Klein Moretti unravels the 22 potion sequences of godhood as The Fool."
  },
  {
    id: "fwn:coiling-dragon",
    title: "Coiling Dragon",
    category: "chinese-xianxia",
    tag: "Cultivation Classic",
    status: "Completed",
    author: "I Eat Tomatoes",
    cover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/nx86486-lJjo26or9gSk.jpg",
    bannerImage: "https://s4.anilist.co/file/anilistcdn/media/manga/banner/n86486-0HfwcSr6l5bt.jpg",
    latestChapter: "Book 21 Chapter 44 (Complete)",
    genres: ["Action", "Adventure", "Cultivation", "Xianxia"],
    synopsis: "Linley Baruch discovers a mysterious ring that awakens the heritage of the legendary Dragonblood Warriors, ascending through the divine planes of the universe."
  }
];

export const ALL_MASTERPIECES: MasterpieceEntry[] = [
  ...OFFICIAL_LIGHT_NOVELS,
  ...KOREAN_GLOBAL_MASTERPIECES,
  ...CHINESE_XIANXIA_MASTERPIECES,
];
