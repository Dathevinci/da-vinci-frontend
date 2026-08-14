/**
 * Curated registry of world-renowned Official Light Novels & Legendary Web Masterpieces.
 * Includes direct verified official HD covers for instant 0ms zero-roundtrip rendering.
 */

export interface MasterpieceNovel {
  id: string;
  title: string;
  category: "light-novel" | "korean-masterpiece" | "cultivation-epic";
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
    id: "lord-of-the-mysteries-v1",
    title: "Lord of the Mysteries",
    category: "korean-masterpiece",
    tag: "Victorian Fantasy",
    status: "Completed",
    author: "Cuttlefish That Loves Diving",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/b125291-5UbQcPd0JwiV.png",
    latestChapter: "Chapter 1432 (Complete)",
    description: "In a world of steam engines, tarot clubs, and cosmic horrors, Klein Moretti unravels the potion sequences of godhood."
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

export const CULTIVATION_CLASSICS: MasterpieceNovel[] = [
  {
    id: "coiling-dragon-an-unconventional-transcendence",
    title: "Coiling Dragon",
    category: "cultivation-epic",
    tag: "Cultivation Classic",
    status: "Completed",
    author: "I Eat Tomatoes",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/nx86486-lJjo26or9gSk.jpg",
    latestChapter: "Book 21 Chapter 44 (Complete)",
    description: "Linley Baruch discovers a mysterious ring that awakens the heritage of the legendary Dragonblood Warriors."
  },
  {
    id: "reverend-insanity",
    title: "Reverend Insanity",
    category: "cultivation-epic",
    tag: "Cultivation Epic",
    status: "Completed",
    author: "Gu Zhen Ren",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/b108050-ZGWnOokjiHG7.jpg",
    latestChapter: "Chapter 2334",
    description: "Fang Yuan uses the Spring Autumn Cicada to travel 500 years into the past, pursuing true immortality with ruthless cunning."
  },
  {
    id: "a-will-eternal",
    title: "A Will Eternal",
    category: "cultivation-epic",
    tag: "Cultivation Classic",
    status: "Completed",
    author: "Er Gen",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx153936-msfOD3UBIDiB.png",
    latestChapter: "Chapter 1314 (Complete)",
    description: "Bai Xiaochun is terrified of dying and will do anything to achieve eternal life, causing hilarious chaos across the immortal sects."
  },
  {
    id: "i-shall-seal-the-heavens-novel",
    title: "I Shall Seal the Heavens",
    category: "cultivation-epic",
    tag: "Cultivation Classic",
    status: "Completed",
    author: "Er Gen",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/nx105953-NSdVLOZFOptt.jpg",
    latestChapter: "Chapter 1614 (Complete)",
    description: "Meng Hao, a failed scholar, is kidnapped into the Reliance Sect and ascends the nine mountains and eight seas."
  },
  {
    id: "martial-world",
    title: "Martial World",
    category: "cultivation-epic",
    tag: "Cultivation Classic",
    status: "Completed",
    author: "Cocooned Cow",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx145699-uIthlAtq5lEp.png",
    latestChapter: "Chapter 2255 (Complete)",
    description: "Lin Ming obtains the mysterious Magic Cube from the divine realm, beginning his legendary ascent across the cosmos."
  },
  {
    id: "renegade-immortal",
    title: "Renegade Immortal",
    category: "cultivation-epic",
    tag: "Cultivation Classic",
    status: "Completed",
    author: "Er Gen",
    fallbackCover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx137653-1wHbCVvABGOr.png",
    latestChapter: "Chapter 2088 (Complete)",
    description: "Wang Lin possesses mediocre talent, but with unyielding determination and the Heaven Defying Bead, he slays gods to protect his loved ones."
  }
];

export const ALL_MASTERPIECES: MasterpieceNovel[] = [
  ...OFFICIAL_LIGHT_NOVELS,
  ...KOREAN_GLOBAL_MASTERPIECES,
  ...CULTIVATION_CLASSICS,
];
