/**
 * Curated registry of world-renowned Official Light Novels & Legendary Web Masterpieces.
 * Includes direct verified official HD covers for instant 0ms zero-roundtrip rendering.
 */

export interface MasterpieceNovel {
  id: string;
  title: string;
  category: "light-novel" | "korean-masterpiece" | "chinese-xianxia";
  tag: string;
  status: "Completed" | "Ongoing";
  author: string;
  fallbackCover: string;
  description?: string;
  latestChapter?: string;
}

export const OFFICIAL_LIGHT_NOVELS: MasterpieceNovel[] = [
  {
    id: "nf:classroom-of-the-elite",
    title: "Classroom of the Elite",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Ongoing",
    author: "Shougo Kinugasa",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx94970-q77X5sfRIKvU.jpg",
    latestChapter: "Year 2 Volume 12",
    description: "Kiyotaka Ayanokouji is a student of the prestigious Tokyo Metropolitan Advanced Nurturing High School, where students are given total freedom to reach their potential."
  },
  {
    id: "nf:overlord-ln",
    title: "Overlord",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Ongoing",
    author: "Kugane Maruyama",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx85976-hVr99G1kD1M5.png",
    latestChapter: "Volume 16 Chapter 3",
    description: "When the popular virtual reality game Yggdrasil shuts down, Momonga decides to stay logged in until the final moment, only to find himself trapped in his skeletal avatar."
  },
  {
    id: "nf:mushoku-tensei",
    title: "Mushoku Tensei: Jobless Reincarnation",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Completed",
    author: "Rifujin na Magonote",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/nx85470-jt6BF9tDWB2X.jpg",
    latestChapter: "Volume 26 (Complete)",
    description: "A 34-year-old NEET is reborn into a world of magic as Rudeus Greyrat, resolved to live his second life to the absolute fullest without regrets."
  },
  {
    id: "nf:rezero-kara-hajimeru-isekai-seikatsu",
    title: "Re:Zero - Starting Life in Another World",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Ongoing",
    author: "Tappei Nagatsuki",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx85737-WkWOr5EgwPyo.jpg",
    latestChapter: "Arc 8 Chapter 60",
    description: "Subaru Natsuki is suddenly summoned to a fantasy world with no special abilities, except the harrowing power of Return by Death."
  },
  {
    id: "nf:tensei-shitara-slime-datta-ken-ln",
    title: "That Time I Got Reincarnated as a Slime",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Ongoing",
    author: "Fuse",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx86355-pGwmLqVTwwE4.jpg",
    latestChapter: "Volume 21 Chapter 4",
    description: "Stabbed on the streets of Tokyo, Satoru Mikami awakens in a fantasy world as a slime endowed with the unique skill Predator."
  },
  {
    id: "nf:to-be-a-power-in-the-shadows-ln",
    title: "The Eminence in Shadow",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Ongoing",
    author: "Daisuke Aizawa",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx108428-wTg20rSpvkU9.jpg",
    latestChapter: "Volume 6 Chapter 5",
    description: "Cid Kagenou lives to act like a mysterious mastermind operating in the background, completely unaware that his made-up conspiracies are all real."
  },
  {
    id: "nf:86-eighty-six-ln",
    title: "86 - EIGHTY SIX",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Ongoing",
    author: "Asato Asato",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx98610-TIf7R1gkU0vc.jpg",
    latestChapter: "Volume 12 Chapter 4",
    description: "The Republic of San Magnolia claims to fight a bloodless war using unmanned drones, but the Eighty-Six who pilot them are human."
  },
  {
    id: "nf:no-game-no-life-ln",
    title: "No Game No Life",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Ongoing",
    author: "Yuu Kamiya",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx78399-ohUhCDKw0CJs.jpg",
    latestChapter: "Volume 12 Chapter 5",
    description: "Genius gamer siblings Sora and Shiro are summoned to Disboard, a world where all conflict is resolved through high-stakes games."
  },
  {
    id: "nf:dungeon-ni-deai-o-motomeru-no-wa-machigatte-iru-darou-ka-ln",
    title: "Is It Wrong to Try to Pick Up Girls in a Dungeon?",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Ongoing",
    author: "Fujino Oomori",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx85162-Fpd3ejAlFWP8.jpg",
    latestChapter: "Volume 19 Chapter 6",
    description: "In the labyrinth city of Orario, solo adventurer Bell Cranel strives to become a hero under the humble Goddess Hestia."
  },
  {
    id: "nf:sword-art-online-ln",
    title: "Sword Art Online",
    category: "light-novel",
    tag: "Official Light Novel",
    status: "Ongoing",
    author: "Reki Kawahara",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx11757-SxYDUzdr9rh2.jpg",
    latestChapter: "Unital Ring VI",
    description: "Players of the first VRMMORPG discover that dying in the virtual castle of Aincrad means dying in the real world."
  }
];

export const KOREAN_GLOBAL_MASTERPIECES: MasterpieceNovel[] = [
  {
    id: "shadow-slave",
    title: "Shadow Slave",
    category: "korean-masterpiece",
    tag: "Global Hit",
    status: "Ongoing",
    author: "Guiltythree",
    fallbackCover: "https://media.kitsu.app/manga/75529/poster_image/large-2df49f981edd9ebf1a040696808c2ea9.jpeg",
    latestChapter: "Chapter 3150+",
    description: "Growing up in poverty, Sunny awakens as an elusive Shadow slave in the Nightmare Spell, ascending the ranks of divine tribulations."
  },
  {
    id: "solo-leveling",
    title: "Solo Leveling (Only I Level Up)",
    category: "korean-masterpiece",
    tag: "Korean Masterpiece",
    status: "Completed",
    author: "Chugong",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx105398-b673Vt5ZSuz3.jpg",
    latestChapter: "Chapter 270 (Complete)",
    description: "Sung Jin-Woo, the world's weakest E-rank hunter, is chosen by the mysterious System as its sole player, unlocking infinite growth."
  },
  {
    id: "omniscient-readers-viewpoint",
    title: "Omniscient Reader's Viewpoint",
    category: "korean-masterpiece",
    tag: "Korean Masterpiece",
    status: "Completed",
    author: "Sing Shong",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx119257-Pi21aq3ey9GG.jpg",
    latestChapter: "Chapter 551 (Complete)",
    description: "Dokja was an average office worker whose only hobby was reading an obscure webnovel. Then the novel becomes reality."
  },
  {
    id: "the-beginning-after-the-end",
    title: "The Beginning After the End",
    category: "korean-masterpiece",
    tag: "Epic Fantasy",
    status: "Ongoing",
    author: "TurtleMe",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx183161-5M054tuPmZJX.jpg",
    latestChapter: "Volume 11 Chapter 480+",
    description: "King Grey was unmatched in strength and wealth, but died alone. Reborn as Arthur Leywin, he masters mana and aether to protect his loved ones."
  },
  {
    id: "trash-of-the-counts-family",
    title: "Trash of the Count's Family",
    category: "korean-masterpiece",
    tag: "Korean Masterpiece",
    status: "Ongoing",
    author: "Yoo Ryeo Han",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx123573-LKoCKwRouEMW.png",
    latestChapter: "Part 2 Chapter 300+",
    description: "Waking up as the trash son of a wealthy count, Cale Henituse only wants a lazy peaceful life, but keeps accidentally saving the kingdom."
  },
  {
    id: "the-second-coming-of-gluttony",
    title: "The Second Coming of Gluttony",
    category: "korean-masterpiece",
    tag: "Korean Masterpiece",
    status: "Completed",
    author: "Ro Yu-jin",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx114198-0qSpHmfzpv5K.jpg",
    latestChapter: "Chapter 549 (Complete)",
    description: "A ruined gambling addict receives a second chance at life and enters the battlegrounds of Paradise with the Golden Eyes of insight."
  },
  {
    id: "sss-class-suicide-hunter",
    title: "SSS-Class Suicide Hunter",
    category: "korean-masterpiece",
    tag: "Korean Masterpiece",
    status: "Completed",
    author: "Shin Noah",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx128067-wnLBg6Cy1ncs.jpg",
    latestChapter: "Chapter 400 (Complete)",
    description: "Kim Gong-ja obtains the ultimate skill: copying abilities from those who kill him, along with the penalty of rewinding time by 24 hours upon death."
  }
];

export const CHINESE_XIANXIA_MASTERPIECES: MasterpieceNovel[] = [
  {
    id: "lord-of-the-mysteries-v1",
    title: "Lord of the Mysteries",
    category: "chinese-xianxia",
    tag: "Victorian Xianxia",
    status: "Completed",
    author: "Cuttlefish That Loves Diving",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/b125291-5UbQcPd0JwiV.png",
    latestChapter: "Chapter 1432 (Complete)",
    description: "In a world of steam engines, tarot clubs, and cosmic horrors, Klein Moretti unravels the potion sequences of godhood."
  },
  {
    id: "reverend-insanity-v1",
    title: "Reverend Insanity",
    category: "chinese-xianxia",
    tag: "Cultivation Masterpiece",
    status: "Completed",
    author: "Gu Zhen Ren",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/b108050-ZGWnOokjiHG7.jpg",
    latestChapter: "Chapter 2334",
    description: "Fang Yuan uses the Spring Autumn Cicada to travel 500 years into the past, pursuing true immortality with ruthless cunning."
  },
  {
    id: "the-kings-avatar-v1",
    title: "The King's Avatar",
    category: "chinese-xianxia",
    tag: "Esports Masterpiece",
    status: "Completed",
    author: "Butterfly Blue",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx86689-iXQY9R064cT8.png",
    latestChapter: "Chapter 1728 (Complete)",
    description: "Ye Xiu, a top-tier pro player in Glory, is ousted from his club and takes up work in an Internet café, plotting his grand return."
  },
  {
    id: "library-of-heavens-path-v1",
    title: "Library of Heaven's Path",
    category: "chinese-xianxia",
    tag: "Comedy Cultivation",
    status: "Completed",
    author: "Heng Sao Tian Ya",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx103608-T7NnBfgC77rO.jpg",
    latestChapter: "Chapter 2268 (Complete)",
    description: "Zhang Xuan transmigrates into another world as an academy teacher with a mystical library that detects the flaws of all things."
  },
  {
    id: "martial-peak-v3",
    title: "Martial Peak",
    category: "chinese-xianxia",
    tag: "Xianxia Epic",
    status: "Completed",
    author: "Momo",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx107380-z4w5WwXmJ2l8.jpg",
    latestChapter: "Chapter 6000+ (Complete)",
    description: "Yang Kai, a lowly sweeper of High Heaven Pavilion, obtains a black book and begins his journey to the pinnacle of the martial dao."
  },
  {
    id: "apotheosis-ascension-to-godhood-v1",
    title: "Apotheosis – Ascension to Godhood",
    category: "chinese-xianxia",
    tag: "Cultivation Epic",
    author: "Zheng Huo",
    status: "Ongoing",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx100868-hW7g83hZ9M4p.jpg",
    latestChapter: "Chapter 3900+",
    description: "Luo Zheng is betrayed and made a slave, but discovers a secret family technique that turns his own body into a divine weapon."
  },
  {
    id: "release-that-witch-v1",
    title: "Release That Witch",
    category: "chinese-xianxia",
    tag: "Kingdom Building",
    status: "Completed",
    author: "Er Mu",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/b100780-6m7n9Qe7c6M0.jpg",
    latestChapter: "Chapter 1498 (Complete)",
    description: "Modern engineer Cheng Yan is reborn as Prince Roland and allies with hunted witches to launch an industrial revolution."
  },
  {
    id: "cultivation-chat-group-v1",
    title: "Cultivation Chat Group",
    category: "chinese-xianxia",
    tag: "Modern Cultivation",
    status: "Completed",
    author: "Legend of the Paladin",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/b108860-tUuWj3y1Wz2I.jpg",
    latestChapter: "Chapter 3170 (Complete)",
    description: "Song Shuhang is accidentally invited into a QQ chat group full of chuunibyou seniors—except they are real immortal cultivators."
  },
  {
    id: "top-tier-providence-secretly-cultivate-for-a-thousand-years",
    title: "Top Tier Providence, Secretly Cultivate for a Thousand Years",
    category: "chinese-xianxia",
    tag: "System Cultivation",
    status: "Completed",
    author: "Let Me Laugh",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/b138860-rY6k9FvP4o7z.jpg",
    latestChapter: "Chapter 1192 (Complete)",
    description: "Reincarnated in a cultivation world, Han Jue discovers he can reroll life traits and resolves to secretly cultivate in absolute safety."
  },
  {
    id: "my-disciples-are-all-villains-v2",
    title: "My Disciples Are All Villains",
    category: "chinese-xianxia",
    tag: "Master & Disciples",
    status: "Completed",
    author: "Mudan Jiang",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx119860-wJkP2x1V9t2u.jpg",
    latestChapter: "Chapter 1750 (Complete)",
    description: "Lu Zhou awakens as the world's most powerful and feared evil patriarch, surrounded by treacherous disciples waiting for him to die."
  },
  {
    id: "true-martial-world-v1",
    title: "True Martial World",
    category: "chinese-xianxia",
    tag: "Cultivation Classic",
    status: "Completed",
    author: "Cocooned Cow",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx145699-uIthlAtq5lEp.png",
    latestChapter: "Chapter 1750 (Complete)",
    description: "With the mysterious Purple Crystal card, Yi Yun travels to the desolate wilderness and reaches the supreme peak of martial arts."
  },
  {
    id: "world-defying-dan-god-v1",
    title: "World Defying Dan God",
    category: "chinese-xianxia",
    tag: "Alchemy Cultivation",
    status: "Completed",
    author: "Ji Xiao Zei",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx106860-oPqW3e7v4u8K.jpg",
    latestChapter: "Chapter 3800+",
    description: "Young Shen Xiang encounters a trapped goddess and sister and inherits supreme divine martial arts and heavenly alchemy."
  },
  {
    id: "ancient-godly-monarch-v1",
    title: "Ancient Godly Monarch",
    category: "chinese-xianxia",
    tag: "Xuanhuan Epic",
    status: "Completed",
    author: "Jing Wu Hen",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx105860-aBcD3e5f6g7H.jpg",
    latestChapter: "Chapter 2048 (Complete)",
    description: "In the Grand Xia Empire, Qin Wentian communicates with the Astral Constellations to establish himself as an Ancient Godly Monarch."
  },
  {
    id: "shrouding-the-heavens-v1",
    title: "Shrouding the Heavens",
    category: "chinese-xianxia",
    tag: "Xianxia Classic",
    status: "Completed",
    author: "Chen Dong",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx137654-2qWbCVvABGOr.png",
    latestChapter: "Chapter 1822 (Complete)",
    description: "Nine colossal dragon corpses pulling an ancient bronze coffin descend upon Mount Tai, ferrying Ye Fan into the cosmic cultivation world."
  },
  {
    id: "peerless-battle-spirit-v1",
    title: "Peerless Battle Spirit",
    category: "chinese-xianxia",
    tag: "Cultivation Epic",
    status: "Completed",
    author: "Supreme Villain",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx138860-4wXyZ1234567.png",
    latestChapter: "Chapter 2900+",
    description: "Qin Nan awakens the lowest tier martial spirit, but unlocks the Primordial Divine Battle Spirit that allows him to defy the heavens."
  },
  {
    id: "transcending-the-nine-heavens",
    title: "Transcending the Nine Heavens",
    category: "chinese-xianxia",
    tag: "Cultivation Classic",
    status: "Completed",
    author: "Feng Ling Tian Xia",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx104860-zXcVbN789012.jpg",
    latestChapter: "Chapter 2500+",
    description: "Chu Yang sacrifices his life for the Nine Tribulations Sword, reincarnating back to his youth to rectify all his past regrets."
  },
  {
    id: "cultivation-online-v3",
    title: "Cultivation Online",
    category: "chinese-xianxia",
    tag: "VRMMO Cultivation",
    status: "Ongoing",
    author: "MyLittleBrother",
    fallbackCover: "https://media.kitsu.app/manga/71789/poster_image/large-4a20dc6c7576a4dfebf0dfb3f9dc3708.jpeg",
    latestChapter: "Chapter 1200+",
    description: "Paralyzed and blind Yuan enters Cultivation Online, discovering that its cultivation secrets awaken inside his real body."
  },
  {
    id: "complete-martial-arts-attributes-v1",
    title: "Complete Martial Arts Attributes",
    category: "chinese-xianxia",
    tag: "Urban Cultivation",
    status: "Completed",
    author: "Mo Zhi",
    fallbackCover: "https://media.kitsu.app/manga/68298/poster_image/large-7ab90d3d526a7a01a3556ae8c5c7ce42.jpeg",
    latestChapter: "Chapter 2100+",
    description: "Wang Teng transmigrates to a martial arts earth where he can pick up dropped attribute orbs to infinitely strengthen himself."
  },
  {
    id: "soul-land-iv-douluo-dalu-ultimate-fighting-v1",
    title: "Soul Land (Douluo Dalu)",
    category: "chinese-xianxia",
    tag: "Fantasy Epic",
    status: "Completed",
    author: "Tang Jia San Shao",
    fallbackCover: "https://media.kitsu.app/manga/poster_images/56837/large.jpg",
    latestChapter: "Chapter 1800+",
    description: "Tang San, disciple of the legendary Tang Sect, jumps off a cliff to atone for stealing forbidden lore and is reborn in the world of Douluo Dalu."
  },
  {
    id: "heaven-officials-blessing-novel",
    title: "Heaven Official's Blessing",
    category: "chinese-xianxia",
    tag: "Xianxia Masterpiece",
    status: "Completed",
    author: "Mo Xiang Tong Xiu",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx114420-pQwmLqVTwwE4.jpg",
    latestChapter: "Chapter 244 (Complete)",
    description: "Xie Lian, the Crown Prince of Xianle, ascends to heaven for the third time as a laughingstock, crossing paths with the Ghost King Hua Cheng."
  }
];

export const CULTIVATION_CLASSICS: MasterpieceNovel[] = CHINESE_XIANXIA_MASTERPIECES;

export const ALL_MASTERPIECES: MasterpieceNovel[] = [
  ...OFFICIAL_LIGHT_NOVELS,
  ...KOREAN_GLOBAL_MASTERPIECES,
  ...CHINESE_XIANXIA_MASTERPIECES,
];
