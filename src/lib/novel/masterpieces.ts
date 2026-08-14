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
    id: "rnb:667603-mushoku-tensei-v812312",
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
    id: "rnb:718239-youjitsu-v812312",
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
    id: "rnb:59150-regarding-reincarnating-as-slime-v812312",
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
    id: "rnb:593616-to-be-a-power-in-the-shadows-v812312",
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
    id: "fwn:86-eighty-six-novel",
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
    id: "fwn:sword-art-online-novel",
    title: "Sword Art Online",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Ongoing",
    author: "Reki Kawahara",
    cover: "https://media.kitsu.app/manga/poster_images/11071/original.png",
    bannerImage: "https://media.kitsu.app/manga/cover_images/11071/original.jpg",
    latestChapter: "Volume 28 (Unital Ring VII)",
    genres: ["Action", "Adventure", "Fantasy", "Sci-Fi", "Romance"],
    synopsis: "Ten thousand players are trapped in the virtual reality MMORPG Sword Art Online, where game over means death in the real world."
  },
  {
    id: "fwn:no-game-no-life-novel",
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
    id: "fwn:is-it-wrong-to-try-to-pick-up-girls-in-a-dungeon-novel",
    title: "DanMachi: Is It Wrong to Try to Pick Up Girls in a Dungeon?",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Ongoing",
    author: "Fujino Oomori",
    cover: "https://media.kitsu.app/manga/poster_images/16462/original.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/16462/original.jpg",
    latestChapter: "Volume 19",
    genres: ["Action", "Adventure", "Comedy", "Fantasy"],
    synopsis: "In the labyrinth city of Orario, novice adventurer Bell Cranel strives to become a hero under the guidance of the goddess Hestia."
  },
  {
    id: "fwn:ascendance-of-a-bookworm-novel",
    title: "Ascendance of a Bookworm",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Completed",
    author: "Miya Kazuki",
    cover: "https://media.kitsu.app/manga/poster_images/34511/original.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/34511/original.jpg",
    latestChapter: "Part 5 Volume 12 (Complete)",
    genres: ["Fantasy", "Slice of Life", "Drama"],
    synopsis: "Reincarnated as a frail girl in a medieval world where books are only for the nobility, Urano decides to create books herself using ancient crafts and modern chemistry."
  },
  {
    id: "fwn:konosuba-gods-blessing-on-this-wonderful-world-novel",
    title: "KonoSuba: God's Blessing on this Wonderful World!",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Completed",
    author: "Natsume Akatsuki",
    cover: "https://media.kitsu.app/manga/poster_images/26844/original.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/26844/original.jpg",
    latestChapter: "Volume 17 (Complete)",
    genres: ["Adventure", "Comedy", "Fantasy", "Parody"],
    synopsis: "Kazuma Satou dies an embarrassing death and drags the useless goddess Aqua with him into a fantasy world, forming an eccentric party of misfits."
  },
  {
    id: "fwn:the-angel-next-door-spoils-me-rotten-novel",
    title: "The Angel Next Door Spoils Me Rotten",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Ongoing",
    author: "Saekisan",
    cover: "https://media.kitsu.app/manga/62641/poster_image/0cf23d7f8981faf5dad528ced9dd4460.png",
    latestChapter: "Volume 9",
    genres: ["Romance", "School Life", "Slice of Life"],
    synopsis: "Amane Fujimiya lives next door to the school's most beautiful girl, Mahiru Shiina. After lending her his umbrella on a rainy day, she begins taking care of his untidy lifestyle."
  },
  {
    id: "fwn:the-irregular-at-magic-high-school-novel",
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
    id: "fwn:arifureta-from-commonplace-to-worlds-strongest-novel",
    title: "Arifureta: From Commonplace to World's Strongest",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Completed",
    author: "Ryo Shirakome",
    cover: "https://media.kitsu.app/manga/poster_images/37711/original.jpg",
    bannerImage: "https://media.kitsu.app/manga/cover_images/37711/original.jpg",
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
    bannerImage: "https://media.kitsu.app/manga/cover_images/54114/original.jpg",
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
    id: "fwn:the-novels-extra-novel",
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
    id: "fwn:sss-class-suicide-hunter-novel",
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
    id: "fwn:nano-machine-novel",
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
    id: "fwn:damn-reincarnation-novel",
    title: "Damn Reincarnation",
    category: "korean-masterpiece",
    tag: "Korean Epic",
    status: "Completed",
    author: "Mok-ma",
    cover: "https://media.kitsu.app/manga/63710/poster_image/17a92a99f93e0bfbdaa625714f4e2061.png",
    latestChapter: "Chapter 625 (Complete)",
    genres: ["Action", "Adventure", "Fantasy", "Reincarnation"],
    synopsis: "Hamel sacrificed himself fighting the Demon Kings. Reincarnated 300 years later as Eugene Lionheart, descendant of his rival Vermouth, he aims to finish the war."
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
    id: "fwn:reverend-insanity-novel",
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
    id: "fwn:renegade-immortal-novel",
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
    id: "fwn:i-shall-seal-the-heavens-novel",
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
    id: "fwn:a-will-eternal-novel",
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
    id: "fwn:the-kings-avatar-novel",
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
    id: "fwn:release-that-witch-novel",
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
    id: "fwn:library-of-heavens-path-novel",
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
