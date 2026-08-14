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
    id: "fwn:mushoku-tensei-full-version",
    title: "Mushoku Tensei: Jobless Reincarnation",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Completed",
    author: "Rifujin na Magonote",
    cover: "https://media.kitsu.app/manga/poster_images/25541/original.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/25541/original.jpg",
    latestChapter: "Volume 26 (Complete)",
    genres: ["Adventure", "Drama", "Fantasy", "Isekai"],
    synopsis: "A 34-year-old NEET is reborn into a world of swords and magic as Rudeus Greyrat, resolved to live his second life to the absolute fullest without regrets."
  },
  {
    id: "fwn:youkoso-jitsuryoku-shijou-shugi-no-kyoushitsu-e",
    title: "Classroom of the Elite",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Ongoing",
    author: "Shougo Kinugasa",
    cover: "https://media.kitsu.app/manga/poster_images/36430/original.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/36430/original.jpg",
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
    cover: "https://media.kitsu.app/manga/poster_images/26852/original.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/26852/original.jpg",
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
    cover: "https://media.kitsu.app/manga/poster_images/26776/original.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/26776/original.jpg",
    latestChapter: "Arc 8 Chapter 60+",
    genres: ["Action", "Adventure", "Drama", "Psychological"],
    synopsis: "Subaru Natsuki is suddenly summoned to a fantasy world with no special abilities, except the harrowing power of Return by Death."
  },
  {
    id: "fwn:tensei-shitara-slime-datta-ken-novel",
    title: "That Time I Got Reincarnated as a Slime",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Ongoing",
    author: "Fuse",
    cover: "https://media.kitsu.app/manga/poster_images/35483/original.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/35483/original.jpg",
    latestChapter: "Volume 21 Chapter 4",
    genres: ["Adventure", "Comedy", "Fantasy", "Kingdom Building"],
    synopsis: "Stabbed on the streets of Tokyo, Satoru Mikami awakens in a fantasy world as a slime endowed with the unique skill Predator, founding the Jura Tempest Federation."
  },
  {
    id: "fwn:to-be-a-power-in-the-shadows",
    title: "The Eminence in Shadow",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Ongoing",
    author: "Daisuke Aizawa",
    cover: "https://media.kitsu.app/manga/poster_images/54238/original.png",
    bannerImage: "https://media.kitsu.app/manga/cover_images/54238/original.jpg",
    latestChapter: "Volume 6 Chapter 5",
    genres: ["Action", "Comedy", "Fantasy", "Parody"],
    synopsis: "Cid Kagenou lives to act like a mysterious mastermind operating in the background, completely unaware that his made-up conspiracies against the Cult of Diablos are all real."
  },
  {
    id: "fwn:86-eighty-six",
    title: "86 - Eighty Six",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Ongoing",
    author: "Asato Asato",
    cover: "https://media.kitsu.app/manga/poster_images/52396/original.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/52396/original.jpg",
    latestChapter: "Volume 12 (Holy Blue Bullet)",
    genres: ["Action", "Drama", "Mecha", "Military", "Sci-Fi"],
    synopsis: "The Republic of San Magnolia boasts of a bloodless war fought by autonomous drones, hiding the fact that the 86th Sector's discarded citizens are the pilots sent to die."
  },
  {
    id: "fwn:kumo-desu-ga-nani-ka-novel",
    title: "So I'm a Spider, So What?",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Completed",
    author: "Okina Baba",
    cover: "https://media.kitsu.app/manga/poster_images/37173/original.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/37173/original.jpg",
    latestChapter: "Volume 16 (Complete)",
    genres: ["Action", "Adventure", "Comedy", "Fantasy", "Isekai"],
    synopsis: "An ordinary high school girl wakes up reincarnated as a weak dungeon spider in the Elroe Great Labyrinth, battling monsters to survive and evolve."
  },
  {
    id: "fwn:no-game-no-life",
    title: "No Game No Life",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Ongoing",
    author: "Yuu Kamiya",
    cover: "https://media.kitsu.app/manga/poster_images/5927/original.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/5927/original.jpg",
    latestChapter: "Volume 12",
    genres: ["Adventure", "Comedy", "Ecchi", "Fantasy", "Game"],
    synopsis: "Genius shut-in gamer siblings Sora and Shiro, known as Blank, are summoned to Disboard, a fantasy world where every conflict is resolved through games."
  },
  {
    id: "fwn:tsuki-ga-michibiku-isekai-douchuu",
    title: "Tsukimichi - Moonlit Fantasy",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Ongoing",
    author: "Kei Azumi",
    cover: "https://media.kitsu.app/manga/poster_images/36470/original.jpg",
    latestChapter: "Chapter 518+",
    genres: ["Action", "Adventure", "Comedy", "Fantasy", "Isekai"],
    synopsis: "Makoto Misumi is summoned to an alternate world by the Goddess, only to be deemed hideous and cast away to the furthest wasteland, building a nation of non-human monsters."
  },
  {
    id: "fwn:ascendance-of-a-bookworm",
    title: "Ascendance of a Bookworm",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Completed",
    author: "Miya Kazuki",
    cover: "https://media.kitsu.app/manga/poster_images/34511/original.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/34511/original.png",
    latestChapter: "Part 5 Volume 12 (Complete)",
    genres: ["Fantasy", "Slice of Life", "Drama"],
    synopsis: "Reincarnated as a frail girl in a medieval world where books are only for the nobility, Urano decides to create books herself using ancient crafts and modern chemistry."
  },
  {
    id: "fwn:tondemo-skill-de-isekai-hourou-meshi",
    title: "Campfire Cooking in Another World",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Ongoing",
    author: "Ren Eguchi",
    cover: "https://media.kitsu.app/manga/poster_images/39104/original.jpg",
    latestChapter: "Chapter 647+",
    genres: ["Adventure", "Comedy", "Fantasy", "Gourmet", "Isekai"],
    synopsis: "Tsuyoshi Mukouda is caught in a hero summoning and given the useless skill 'Online Supermarket', cooking modern earthly dishes that enslave legendary divine beasts."
  },
  {
    id: "fwn:mahouka-koukou-no-rettousei",
    title: "The Irregular at Magic High School",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Completed",
    author: "Tsutomu Satou",
    cover: "https://media.kitsu.app/manga/poster_images/9158/original.jpeg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/9158/original.jpg",
    latestChapter: "Volume 32 (Complete)",
    genres: ["Action", "Magic", "Romance", "Sci-Fi"],
    synopsis: "Siblings Tatsuya and Miyuki Shiba enroll in First High School, where magic is taught as a technical science. Tatsuya hides unparalleled tactical abilities as a Course 2 Weed."
  },
  {
    id: "fwn:arifureta-shokugyou-de-sekai-saikyou-wn",
    title: "Arifureta: From Commonplace to World's Strongest",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Completed",
    author: "Ryo Shirakome",
    cover: "https://media.kitsu.app/manga/poster_images/37711/original.jpg",
    latestChapter: "Volume 13 (Complete)",
    genres: ["Action", "Adventure", "Fantasy", "Harem", "Isekai"],
    synopsis: "Betrayed and pushed to the abyss of the Orcus Labyrinth, Hajime Nagumo consumes monster meat, forges modern firearms with transmutation, and rises as an apex predator."
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
    cover: "https://media.kitsu.app/manga/75529/poster_image/56a77605eab409280a163198d5e1d483.webp",
    latestChapter: "Chapter 3157+",
    genres: ["Action", "Adventure", "Fantasy", "Mystery"],
    synopsis: "Growing up in poverty, Sunny awakens as an elusive Shadow slave in the Nightmare Spell, ascending the ranks of divine tribulations across broken realms."
  },
  {
    id: "fwn:solo-leveling-digispirit",
    title: "Solo Leveling (Only I Level Up)",
    category: "korean-masterpiece",
    tag: "Korean Legend",
    status: "Completed",
    author: "Chugong",
    cover: "https://media.kitsu.app/manga/poster_images/54114/original.jpg",
    bannerImage: "https://media.kitsu.app/manga/54114/cover_image/50f5b4b656a64e8fe560fad557830dcd.png",
    latestChapter: "Chapter 270 (Complete)",
    genres: ["Action", "Adventure", "Fantasy", "System"],
    synopsis: "Sung Jinwoo, the World's Weakest E-Rank Hunter, discovers a dual dungeon that awakens a unique Player System, transforming him into the Shadow Monarch."
  },
  {
    id: "fwn:omniscient-readers-viewpoint-novel",
    title: "Omniscient Reader's Viewpoint",
    category: "korean-masterpiece",
    tag: "Korean Masterpiece",
    status: "Completed",
    author: "Sing Shong",
    cover: "https://media.kitsu.app/manga/56452/poster_image/991b12432f29a1f5abc9a925837962c0.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/56452/original.jpg",
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
    cover: "https://media.kitsu.app/manga/54597/poster_image/543b6857c9ef3086fea523105a8edaa0.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/54597/original.jpg",
    latestChapter: "Volume 11 Chapter 532+",
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
    cover: "https://media.kitsu.app/manga/poster_images/57693/original.jpeg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/57693/original.jpg",
    latestChapter: "Part 2 Chapter 1288+",
    genres: ["Action", "Adventure", "Comedy", "Fantasy"],
    synopsis: "Waking up as the trash son of a wealthy count, Cale Henituse only wants a lazy peaceful life, but keeps accidentally saving the kingdom alongside dragons and heroes."
  },
  {
    id: "fwn:the-novels-extra",
    title: "The Novel's Extra",
    category: "korean-masterpiece",
    tag: "Korean Masterpiece",
    status: "Completed",
    author: "Jee Gab Song",
    cover: "https://media.kitsu.app/manga/63926/poster_image/410974b5d1b888b1f212534bfabdd3f9.png",
    latestChapter: "Chapter 379 (Complete)",
    genres: ["Action", "Adventure", "School Life", "Supernatural"],
    synopsis: "Kim Hajin wakes up in his own unfinished novel as Kim Chundong, an unimportant extra without magic, relying solely on his marksmanship and weapon mastery."
  },
  {
    id: "fwn:second-life-ranker-novel",
    title: "Second Life Ranker",
    category: "korean-masterpiece",
    tag: "Korean Hit",
    status: "Completed",
    author: "Sadoyeon",
    cover: "https://media.kitsu.app/manga/poster_images/54690/original.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/54690/original.jpg",
    latestChapter: "Chapter 800 (Complete)",
    genres: ["Action", "Adventure", "Fantasy", "Revenge"],
    synopsis: "After receiving the pocket watch of his deceased twin brother, Yeon-woo enters the Obelisk Tower of the Sun God to hunt down the traitors."
  },
  {
    id: "fwn:sssclass-suicide-hunter",
    title: "SSS-Class Suicide Hunter",
    category: "korean-masterpiece",
    tag: "Korean Masterpiece",
    status: "Completed",
    author: "Shin Noah",
    cover: "https://media.kitsu.app/manga/poster_images/58485/original.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/58485/original.jpg",
    latestChapter: "Chapter 400 (Complete)",
    genres: ["Action", "Comedy", "Drama", "Fantasy", "Psychological"],
    synopsis: "Gong-ja copies the skills of those who kill him and rewinds time upon death by 24 hours, vowing to climb Babylon Tower with undying empathy for all."
  },
  {
    id: "fwn:nano-machine-retranslated-version-novel",
    title: "Nano Machine",
    category: "korean-masterpiece",
    tag: "Murim Sci-Fi",
    status: "Completed",
    author: "Han-Joong-Wueol-Ya",
    cover: "https://media.kitsu.app/manga/poster_images/57618/original.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/57618/original.jpg",
    latestChapter: "Chapter 483 (Complete)",
    genres: ["Action", "Martial Arts", "Murim", "Sci-Fi"],
    synopsis: "An illegitimate prince of the Demonic Cult is injected with future nanomachines by a time-traveling descendant, mastering supreme martial arts."
  },
  {
    id: "fwn:damn-reincarnation",
    title: "Damn Reincarnation",
    category: "korean-masterpiece",
    tag: "Korean Epic",
    status: "Completed",
    author: "Mok-ma",
    cover: "https://media.kitsu.app/manga/63710/poster_image/17a92a99f93e0bfbdaa625714f4e2061.png",
    latestChapter: "Chapter 625 (Complete)",
    genres: ["Action", "Adventure", "Fantasy", "Reincarnation"],
    synopsis: "Hamel sacrificed himself fighting the Demon Kings. Reincarnated 300 years later as Eugene Lionheart, descendant of his rival Vermouth, he aims to finish the war."
  },
  {
    id: "fwn:the-reincarnated-assassin-is-a-genius-swordsman",
    title: "The Reincarnated Assassin is a Genius Swordsman",
    category: "korean-masterpiece",
    tag: "Korean Hit",
    status: "Ongoing",
    author: "Geul-jin-a",
    cover: "https://media.kitsu.app/manga/68985/poster_image/c23225536fdafc9a3d084290fd9fe1b5.png",
    latestChapter: "Chapter 709+",
    genres: ["Action", "Adventure", "Fantasy", "Revenge"],
    synopsis: "Raon Zieghart lived as an assassin tool, enslaved by an explosive curse. Reborn into the legendary swordsman family Zieghart, he carves his own destiny with the Wrath fire."
  },
  {
    id: "rnb:143263-reincarnation-of-the-strongest-sword-god-v812312",
    title: "Reincarnation of the Strongest Sword God",
    category: "korean-masterpiece",
    tag: "MMORPG Classic",
    status: "Ongoing",
    author: "Lucky Old Cat",
    cover: "https://media.kitsu.app/manga/poster_images/37605/original.jpg",
    latestChapter: "Chapter 3800+",
    genres: ["Action", "Adventure", "Game", "Reincarnation", "Virtual Reality"],
    synopsis: "Shi Feng, a top-tier guild leader in the world-dominating virtual reality game God's Domain, is betrayed and thrown back ten years in time to the game's launch day."
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
    cover: "https://media.kitsu.app/manga/poster_images/59428/original.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/59428/original.jpg",
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
    cover: "https://media.kitsu.app/manga/poster_images/35024/original.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/35024/original.jpg",
    latestChapter: "Book 21 Chapter 44 (Complete)",
    genres: ["Action", "Adventure", "Cultivation", "Xianxia"],
    synopsis: "Linley Baruch discovers a mysterious ring that awakens the heritage of the legendary Dragonblood Warriors, ascending through the divine planes of the universe."
  },
  {
    id: "fwn:reverend-insanity",
    title: "Reverend Insanity (Gu Daoist Master)",
    category: "chinese-xianxia",
    tag: "Cultivation Masterpiece",
    status: "Ongoing",
    author: "Gu Zhen Ren",
    cover: "https://media.kitsu.app/manga/poster_images/54478/original.png",
    bannerImage: "https://media.kitsu.app/manga/cover_images/54478/original.jpg",
    latestChapter: "Chapter 2334+",
    genres: ["Action", "Adventure", "Fantasy", "Psychological", "Xianxia"],
    synopsis: "Fang Yuan uses the Spring Autumn Cicada to travel 500 years into the past, walking the ruthless demonic path of self-cultivation with pure pragmatism."
  },
  {
    id: "fwn:martial-world-novel",
    title: "Martial World",
    category: "chinese-xianxia",
    tag: "Cultivation Epic",
    status: "Completed",
    author: "Cocooned Cow",
    cover: "https://media.kitsu.app/manga/poster_images/37605/original.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/37605/original.jpg",
    latestChapter: "Chapter 2255 (Complete)",
    genres: ["Action", "Adventure", "Cultivation", "Martial Arts"],
    synopsis: "Lin Ming obtains the Magic Cube from the Divine Realm, embarking on the path of martial mastery across the thirty-three skies."
  },
  {
    id: "fwn:renegade-immortal",
    title: "Renegade Immortal (Xian Ni)",
    category: "chinese-xianxia",
    tag: "Cultivation Classic",
    status: "Completed",
    author: "Er Gen",
    cover: "https://media.kitsu.app/manga/poster_images/38816/original.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/38816/original.jpg",
    latestChapter: "Chapter 2088 (Complete)",
    genres: ["Action", "Adventure", "Cultivation", "Tragedy", "Xianxia"],
    synopsis: "Wang Lin, an ordinary youth without talent, defies heavenly fate and slaughters through mortal and immortal realms to resurrect his beloved."
  },
  {
    id: "fwn:i-shall-seal-the-heavens",
    title: "I Shall Seal the Heavens (ISSTH)",
    category: "chinese-xianxia",
    tag: "Cultivation Classic",
    status: "Completed",
    author: "Er Gen",
    cover: "https://media.kitsu.app/manga/poster_images/40544/original.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/40544/original.jpg",
    latestChapter: "Chapter 1614 (Complete)",
    genres: ["Action", "Adventure", "Comedy", "Cultivation", "Xianxia"],
    synopsis: "Meng Hao is abducted into the Reliance Sect, learning the Copper Mirror's duplication miracles and rising as the Ninth Generation Demon Sealer."
  },
  {
    id: "fwn:a-will-eternal",
    title: "A Will Eternal",
    category: "chinese-xianxia",
    tag: "Comedy Xianxia",
    status: "Completed",
    author: "Er Gen",
    cover: "https://media.kitsu.app/manga/poster_images/469/original.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/469/original.jpg",
    latestChapter: "Chapter 1314 (Complete)",
    genres: ["Action", "Comedy", "Cultivation", "Fantasy"],
    synopsis: "Terrified of death, Bai Xiaochun lights incense to join the Spirit Stream Sect, unintentionally wreaking havoc wherever he goes in search of immortality."
  },
  {
    id: "fwn:against-the-gods-novel",
    title: "Against the Gods",
    category: "chinese-xianxia",
    tag: "Cultivation Epic",
    status: "Ongoing",
    author: "Mars Gravity",
    cover: "https://media.kitsu.app/manga/poster_images/54416/original.jpg",
    latestChapter: "Chapter 2193+",
    genres: ["Action", "Adventure", "Cultivation", "Fantasy", "Harem", "Xianxia"],
    synopsis: "Yun Che is hunted for holding the Sky Poison Pearl, jumping off the Cloud's End Cliff and waking up in the body of a crippled youth in the Azure Cloud Continent."
  },
  {
    id: "fwn:martial-peak",
    title: "Martial Peak",
    category: "chinese-xianxia",
    tag: "Cultivation Legend",
    status: "Completed",
    author: "Momo",
    cover: "https://media.kitsu.app/manga/poster_images/40987/original.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/40987/original.jpg",
    latestChapter: "Chapter 6108 (Complete)",
    genres: ["Action", "Adventure", "Cultivation", "Martial Arts", "Xianxia"],
    synopsis: "The journey to the martial peak is a lonely, solitary and long one. Yang Kai, a lowly sweeper disciple at High Heaven Pavilion, obtains a wordless Black Book."
  },
  {
    id: "fwn:the-desolate-era-novel",
    title: "The Desolate Era",
    category: "chinese-xianxia",
    tag: "Cultivation Masterpiece",
    status: "Completed",
    author: "I Eat Tomatoes",
    cover: "https://media.kitsu.app/manga/poster_images/40082/original.jpg",
    latestChapter: "Book 45 Chapter 40 (Complete)",
    genres: ["Action", "Adventure", "Cultivation", "Reincarnation", "Xianxia"],
    synopsis: "Ji Ning reincarnates with exceptional karmic merit into the primordial Grand Xia world, cultivating divine swordsmanship to reach the Dao of the Chaosverse."
  },
  {
    id: "fwn:battle-through-the-heavens-novel",
    title: "Battle Through the Heavens",
    category: "chinese-xianxia",
    tag: "Cultivation Legend",
    status: "Completed",
    author: "Heavenly Silkworm Potato",
    cover: "https://media.kitsu.app/manga/poster_images/32621/original.jpg",
    latestChapter: "Chapter 1648 (Complete)",
    genres: ["Action", "Adventure", "Alchemy", "Cultivation", "Xianxia"],
    synopsis: "Xiao Yan was a genius who lost all his Dou Qi power due to the ring left by his mother. Inside resides Yao Lao, embarking on a quest for the Heavenly Flames."
  },
  {
    id: "fwn:perfect-world",
    title: "Perfect World (Wanmei Shijie)",
    category: "chinese-xianxia",
    tag: "Cultivation Epic",
    status: "Completed",
    author: "Chen Dong",
    cover: "https://media.kitsu.app/manga/poster_images/26938/original.jpg",
    latestChapter: "Chapter 2018 (Complete)",
    genres: ["Action", "Adventure", "Cultivation", "Mythology", "Xianxia"],
    synopsis: "Born in a unique world where village totems guard mankind against archaic beasts, Shi Hao is stripped of his Supreme Bone, rising through desolate lands to protect all existence."
  },
  {
    id: "fwn:ancient-godly-monarch",
    title: "Ancient Godly Monarch",
    category: "chinese-xianxia",
    tag: "Cultivation Classic",
    status: "Completed",
    author: "Jing Wu Hen",
    cover: "https://media.kitsu.app/manga/poster_images/40427/original.jpg",
    latestChapter: "Chapter 2053 (Complete)",
    genres: ["Action", "Adventure", "Cultivation", "Martial Arts", "Xianxia"],
    synopsis: "Qin Wentian awakens the Astral Soul from the 9 Heavenly Layers, forming astral conduits to shatter tyrannical clans and establish divine supremacy."
  },
  {
    id: "fwn:tales-of-demons-and-gods",
    title: "Tales of Demons and Gods",
    category: "chinese-xianxia",
    tag: "Cultivation Classic",
    status: "Ongoing",
    author: "Mad Snail",
    cover: "https://media.kitsu.app/manga/poster_images/37605/original.jpg",
    latestChapter: "Chapter 507+",
    genres: ["Action", "Adventure", "Cultivation", "Demons", "Reincarnation"],
    synopsis: "Killed by the Sage Emperor, Nie Li wakes up in his thirteen-year-old body with the vast knowledge of the Temporal Demon Spirit Book to safeguard Glory City."
  },
  {
    id: "fwn:the-kings-avatar",
    title: "The King's Avatar (Quan Zhi Gao Shou)",
    category: "chinese-xianxia",
    tag: "Esports Classic",
    status: "Completed",
    author: "Butterfly Blue",
    cover: "https://media.kitsu.app/manga/poster_images/39180/original.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/39180/original.jpg",
    latestChapter: "Chapter 1728 (Complete)",
    genres: ["Action", "Comedy", "Game"],
    synopsis: "Top-tier pro player Ye Xiu is forced out of his team. Working as an internet cafe manager, he starts afresh in the tenth server of Glory with an unspecialized avatar."
  },
  {
    id: "fwn:release-that-witch",
    title: "Release That Witch",
    category: "chinese-xianxia",
    tag: "Kingdom Building",
    status: "Completed",
    author: "Er Mu",
    cover: "https://media.kitsu.app/manga/poster_images/54522/original.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/54522/original.jpg",
    latestChapter: "Chapter 1498 (Complete)",
    genres: ["Action", "Adventure", "Fantasy", "Kingdom Building"],
    synopsis: "Mechanical engineer Cheng Yan is reincarnated as Prince Roland Wimbledon, harnessing the magical powers of persecuted witches to trigger an industrial revolution."
  },
  {
    id: "fwn:library-of-heavens-path",
    title: "Library of Heaven's Path",
    category: "chinese-xianxia",
    tag: "Comedy Cultivation",
    status: "Completed",
    author: "Heng Sao Tian Ya",
    cover: "https://media.kitsu.app/manga/poster_images/40355/original.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/40355/original.jpg",
    latestChapter: "Chapter 2268 (Complete)",
    genres: ["Action", "Comedy", "Cultivation", "Martial Arts"],
    synopsis: "Zhang Xuan traverses to another world as an incompetent teacher, awakening the Library of Heaven's Path which instantly reveals the flaws of everything in creation."
  }
];

export const ALL_MASTERPIECES: MasterpieceEntry[] = [
  ...OFFICIAL_LIGHT_NOVELS,
  ...KOREAN_GLOBAL_MASTERPIECES,
  ...CHINESE_XIANXIA_MASTERPIECES,
];
