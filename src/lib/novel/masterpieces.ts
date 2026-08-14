export interface MasterpieceEntry {
  id: string;
  title: string;
  cover: string;
  bannerImage?: string;
  author: string;
  status: "Completed" | "Ongoing";
  genres: string[];
  synopsis: string;
  latestChapter: string;
  tag: string;
}

export const OFFICIAL_LIGHT_NOVELS: MasterpieceEntry[] = [
  {
    "id": "fwn:mushoku-tensei-full-version",
    "title": "Mushoku Tensei: Jobless Reincarnation",
    "cover": "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/nx85470-jt6BF9tDWB2X.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/85470-akkFSKH9aacB.jpg",
    "author": "Rifujin na Magonote",
    "status": "Completed",
    "genres": [
      "Isekai",
      "Fantasy",
      "Adventure",
      "Magic",
      "Reincarnation"
    ],
    "synopsis": "A 34-year-old shut-in dies saving strangers and reincarnates into a world of magic as Rudeus Greyrat. Keeping his past memories, he resolves to live his new life to the fullest with no regrets.",
    "latestChapter": "Chapter 277",
    "tag": "Japanese Masterpiece"
  },
  {
    "id": "fwn:classroom-of-the-elite-year-1",
    "title": "Classroom of the Elite (Year 1)",
    "cover": "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx96798-SIQLQqS8HO9h.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/96798-XfoFzYL1xof9.jpg",
    "author": "Shougo Kinugasa",
    "status": "Completed",
    "genres": [
      "Psychological",
      "School",
      "Drama",
      "Mystery"
    ],
    "synopsis": "Kiyotaka Ayanokouji enrolls at the prestigious Advanced Nurturing High School, where only the top students receive supreme treatment. Operating from Class D, he quietly manipulates the school hierarchy.",
    "latestChapter": "Chapter 677",
    "tag": "Psychological Thriller"
  },
  {
    "id": "fwn:classroom-of-the-elite-year-2",
    "title": "Classroom of the Elite (Year 2)",
    "cover": "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx115166-eBK5EqkUTplf.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/96798-XfoFzYL1xof9.jpg",
    "author": "Shougo Kinugasa",
    "status": "Ongoing",
    "genres": [
      "Psychological",
      "School",
      "Drama",
      "Mystery"
    ],
    "synopsis": "The second year begins at Advanced Nurturing High School. With new first-year students arriving, White Room enforcers targeting Ayanokouji, and ruthless special exams, the psychological warfare reaches unprecedented heights.",
    "latestChapter": "Chapter 506",
    "tag": "Psychological Thriller"
  },
  {
    "id": "fwn:overlord-ln-novel",
    "title": "Overlord",
    "cover": "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20832-vUNm5zrYWifc.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/anime/banner/20832-NswCiSYMoI2k.jpg",
    "author": "Kugane Maruyama",
    "status": "Completed",
    "genres": [
      "Dark Fantasy",
      "Isekai",
      "Overpowered",
      "Magic"
    ],
    "synopsis": "When the popular MMORPG Yggdrasil shuts down, veteran player Momonga stays logged in. Transferred into a new realm with the Great Tomb of Nazarick and his loyal NPC guardians, he embraces his role as the supreme Sorcerer King Ainz Ooal Gown.",
    "latestChapter": "Chapter 441",
    "tag": "Dark Fantasy"
  },
  {
    "id": "fwn:rezero-kara-hajimeru-isekai-seikatsu-wn",
    "title": "Re:Zero - Starting Life in Another World",
    "cover": "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx85737-WkWOr5EgwPyo.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/85737-jCG8ine3fTDr.png",
    "author": "Tappei Nagatsuki",
    "status": "Ongoing",
    "genres": [
      "Psychological",
      "Drama",
      "Isekai",
      "Fantasy",
      "Time Travel"
    ],
    "synopsis": "Subaru Natsuki is suddenly summoned to a fantastical world with no special skills except one terrifying ability: 'Return by Death'. To protect the silver-haired girl Emilia and the bonds he forms, he must endure agonizing deaths to rewrite destiny.",
    "latestChapter": "Chapter 542",
    "tag": "Time Loop Epic"
  },
  {
    "id": "fwn:tensei-shitara-slime-datta-ken-novel",
    "title": "That Time I Got Reincarnated as a Slime",
    "cover": "https://media.kitsu.app/manga/poster_images/35483/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/35483/large.jpg",
    "author": "Fuse",
    "status": "Completed",
    "genres": [
      "Isekai",
      "Fantasy",
      "Action",
      "Monster",
      "Magic"
    ],
    "synopsis": "Stabbed on the streets of Tokyo, Satoru Mikami awakens in a fantasy cave as a humble slime. Gifted with the unique skill 'Predator' and the wisdom of 'Great Sage', he befriends the Storm Dragon Veldora and establishes the Monster Nation of Tempest.",
    "latestChapter": "Chapter 417",
    "tag": "Nation Building"
  },
  {
    "id": "fwn:86-eighty-six",
    "title": "86 - Eighty Six",
    "cover": "https://media.kitsu.app/manga/poster_images/40398/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/40398/large.jpg",
    "author": "Asato Asato",
    "status": "Completed",
    "genres": [
      "Sci-Fi",
      "Mecha",
      "Military",
      "Drama",
      "Action"
    ],
    "synopsis": "The Republic of San Magnolia claims to fight a bloodless war against unmanned Legion drones. In reality, the combat is waged by human soldiers stripped of their rights: the Eighty-Six. Captain Shinei Nouzen leads his squadron on the deadly frontline.",
    "latestChapter": "Chapter 34",
    "tag": "Military Sci-Fi"
  },
  {
    "id": "fwn:kumo-desu-ga-nani-ka-novel",
    "title": "So I'm a Spider, So What?",
    "cover": "https://media.kitsu.app/manga/poster_images/37173/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/37173/large.jpg",
    "author": "Okina Baba",
    "status": "Completed",
    "genres": [
      "Action",
      "Fantasy",
      "Isekai",
      "Survival",
      "Monster"
    ],
    "synopsis": "A high school classroom explodes, reincarnating everyone into a fantasy world. Our protagonist wakes up as a small, weak spider monster in the world's most perilous dungeon: the Great Elroe Labyrinth. Through grit and skill evolution, she claws her way to godhood.",
    "latestChapter": "Chapter 604",
    "tag": "Monster Survival"
  },
  {
    "id": "fwn:no-game-no-life",
    "title": "No Game No Life",
    "cover": "https://media.kitsu.app/manga/poster_images/5927/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/5927/large.jpg",
    "author": "Yuu Kamiya",
    "status": "Completed",
    "genres": [
      "Game",
      "Fantasy",
      "Comedy",
      "Ecchi",
      "Isekai"
    ],
    "synopsis": "Genius shut-in gamer siblings Sora and Shiro, known as 'Blank', are summoned by the God of Games to Disboard — a universe where all conflict, borders, and lives are decided solely through high-stakes games.",
    "latestChapter": "Chapter 53",
    "tag": "Mind Games"
  },
  {
    "id": "fwn:tsuki-ga-michibiku-isekai-douchuu",
    "title": "Tsukimichi - Moonlit Fantasy",
    "cover": "https://media.kitsu.app/manga/poster_images/36470/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/34351/original.jpg",
    "author": "Kei Azumi",
    "status": "Ongoing",
    "genres": [
      "Isekai",
      "Action",
      "Fantasy",
      "Comedy"
    ],
    "synopsis": "Makoto Misumi is summoned to an alternate world by the God Tsukuyomi, but the resident Goddess casts him out to the edge of the wasteland for failing her beauty standards. Embracing monstrous races, he builds an unmatched community.",
    "latestChapter": "Chapter 518",
    "tag": "Gods & Monsters"
  },
  {
    "id": "fwn:ascendance-of-a-bookworm",
    "title": "Ascendance of a Bookworm",
    "cover": "https://media.kitsu.app/manga/poster_images/34511/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/34511/large.jpg",
    "author": "Miya Kazuki",
    "status": "Completed",
    "genres": [
      "Slice of Life",
      "Fantasy",
      "Isekai",
      "Historical"
    ],
    "synopsis": "Urano Motosu loves books above all else. Reincarnated into a medieval world as a frail peasant girl named Myne where books are an exclusive luxury of the nobility, she decides: if there are no books, she will just have to make them herself!",
    "latestChapter": "Chapter 216",
    "tag": "Bibliophile Epic"
  },
  {
    "id": "fwn:tondemo-skill-de-isekai-hourou-meshi",
    "title": "Campfire Cooking in Another World",
    "cover": "https://media.kitsu.app/manga/poster_images/39104/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/40964/original.jpg",
    "author": "Ren Eguchi",
    "status": "Ongoing",
    "genres": [
      "Gourmet",
      "Adventure",
      "Isekai",
      "Comedy",
      "Fantasy"
    ],
    "synopsis": "Tsuyoshi Mukouda is accidentally summoned to a fantasy kingdom with the seemingly useless skill 'Online Supermarket'. When he cooks modern delicacies over campfires, legendary beasts including the mythical Fenrir demand to become his familiars.",
    "latestChapter": "Chapter 647",
    "tag": "Culinary Fantasy"
  },
  {
    "id": "fwn:mahouka-koukou-no-rettousei",
    "title": "The Irregular at Magic High School",
    "cover": "https://media.kitsu.app/manga/poster_images/9158/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/9158/large.jpg",
    "author": "Tsutomu Satou",
    "status": "Completed",
    "genres": [
      "Action",
      "Magic",
      "Sci-Fi",
      "School"
    ],
    "synopsis": "Magic has been formalized as modern technology. Tatsuya Shiba enrolls at First High School as an 'irregular' Bloom-defying Weed, hiding godlike tactical combat prowess, engineering genius, and state secret clearance.",
    "latestChapter": "Chapter 280",
    "tag": "Magical Sci-Fi"
  },
  {
    "id": "fwn:arifureta-shokugyou-de-sekai-saikyou-wn",
    "title": "Arifureta: From Commonplace to World's Strongest",
    "cover": "https://media.kitsu.app/manga/poster_images/37711/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/34354/original.jpg",
    "author": "Ryo Shirakome",
    "status": "Completed",
    "genres": [
      "Action",
      "Fantasy",
      "Harem",
      "Isekai",
      "Overpowered"
    ],
    "synopsis": "Betrayed and shoved into the darkest depths of the Great Orcus Labyrinth, Hajime Nagumo survives by eating monster flesh and synthesizing deadly firearms. Meeting the sealed vampire princess Yue, he swears to conquer all labyrinths and return home.",
    "latestChapter": "Chapter 579",
    "tag": "Dungeon Descent"
  },
  {
    "id": "fwn:tate-no-yuusha-no-nariagari-novel",
    "title": "The Rising of the Shield Hero",
    "cover": "https://media.kitsu.app/manga/poster_images/25524/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/25524/large.jpg",
    "author": "Aneko Yusagi",
    "status": "Completed",
    "genres": [
      "Action",
      "Adventure",
      "Drama",
      "Fantasy",
      "Isekai"
    ],
    "synopsis": "Naofumi Iwatani is summoned as the Shield Hero, only to be betrayed and falsely accused. Stripped of honor and resources, he rises from the ashes alongside the demi-human Raphtalia to save the kingdom that abandoned him.",
    "latestChapter": "Chapter 387",
    "tag": "Heroic Retribution"
  },
  {
    "id": "fwn:high-school-dxd",
    "title": "High School DxD",
    "cover": "https://media.kitsu.app/manga/poster_images/18650/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/18650/large.jpg",
    "author": "Ichiei Ishibumi",
    "status": "Completed",
    "genres": [
      "Action",
      "Comedy",
      "Demons",
      "Ecchi",
      "Harem",
      "Romance"
    ],
    "synopsis": "Issei Hyoudou is murdered on his first date by a fallen angel, only to be reincarnated as a devil servant by Crimson-Haired beauty Rias Gremory. Wielding the legendary Red Dragon Emperor's Sacred Gear, he enters the grand mythological war.",
    "latestChapter": "Chapter 266",
    "tag": "Mythological Battles"
  },
  {
    "id": "fwn:toradora",
    "title": "Toradora!",
    "cover": "https://media.kitsu.app/manga/poster_images/14738/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/8537/original.jpg",
    "author": "Yuyuko Takemiya",
    "status": "Completed",
    "genres": [
      "Romance",
      "Comedy",
      "School",
      "Drama",
      "Slice of Life"
    ],
    "synopsis": "Ryuuji Takasu looks like an intimidating delinquent but is gentle and loves cleaning. Taiga Aisaka is tiny and sweet in appearance but known as the fierce 'Palmtop Tiger'. Together, they form an unlikely alliance to help each other confess to their respective crushes.",
    "latestChapter": "Chapter 72",
    "tag": "Romance Classic"
  },
  {
    "id": "fwn:toaru-majutsu-no-index",
    "title": "A Certain Magical Index",
    "cover": "https://media.kitsu.app/manga/poster_images/23343/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/23343/large.jpg",
    "author": "Kazuma Kamachi",
    "status": "Completed",
    "genres": [
      "Action",
      "Sci-Fi",
      "Magic",
      "Supernatural"
    ],
    "synopsis": "In Academy City, a technologically advanced metropolis of espers, Touma Kamijou possesses 'Imagine Breaker' in his right hand. Meeting Index, an English nun with 103,000 forbidden grimoires memorized, he becomes embroiled in the collision of science and magic.",
    "latestChapter": "Chapter 155",
    "tag": "Science vs Magic"
  },
  {
    "id": "fwn:i-want-to-eat-your-pancreas",
    "title": "I Want to Eat Your Pancreas",
    "cover": "https://media.kitsu.app/manga/poster_images/39808/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/39537/original.jpg",
    "author": "Yoru Sumino",
    "status": "Completed",
    "genres": [
      "Drama",
      "Romance",
      "School",
      "Slice of Life",
      "Tragedy"
    ],
    "synopsis": "An aloof high school student discovers the secret diary of his popular classmate, Sakura Yamauchi, revealing she suffers from a terminal pancreatic illness. The two embark on a touching journey that forever alters their perspectives on life.",
    "latestChapter": "Chapter 12",
    "tag": "Emotional Masterpiece"
  },
  {
    "id": "fwn:three-days-of-happiness",
    "title": "Three Days of Happiness",
    "cover": "https://media.kitsu.app/manga/poster_images/40439/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/38959/original.jpg",
    "author": "Sugaru Miaki",
    "status": "Completed",
    "genres": [
      "Drama",
      "Psychological",
      "Romance",
      "Supernatural"
    ],
    "synopsis": "Desperate and impoverished, Kusunoki sells off the remaining 30 years of his lifespan for a meager 300,000 yen, leaving himself with only three months left to live. Accompanied by his observant observer Miyagi, he discovers what truly matters.",
    "latestChapter": "Chapter 16",
    "tag": "Philosophical Romance"
  },
  {
    "id": "fwn:death-march-kara-hajimaru-isekai-kyusoukyoku-novel",
    "title": "Death March to the Parallel World Rhapsody",
    "cover": "https://media.kitsu.app/manga/poster_images/26906/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/34347/original.jpg",
    "author": "Hiro Ainana",
    "status": "Ongoing",
    "genres": [
      "Adventure",
      "Fantasy",
      "Harem",
      "Isekai",
      "Slice of Life"
    ],
    "synopsis": "29-year-old programmer Suzuki Ichirou wakes up inside a fantasy MMORPG world. After using a powerful 'Meteor Shower' spell to wipe out an army of lizardmen, he reaches max level and embarks on a comfortable sightseeing journey.",
    "latestChapter": "Chapter 687",
    "tag": "Fantasy Journey"
  },
  {
    "id": "fwn:seirei-gensouki-konna-sekai-de-deaeta-kimi-ni",
    "title": "Seirei Gensouki: Spirit Chronicles",
    "cover": "https://media.kitsu.app/manga/poster_images/38491/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/38491/large.jpg",
    "author": "Yuri Kitayama",
    "status": "Ongoing",
    "genres": [
      "Action",
      "Drama",
      "Fantasy",
      "Harem",
      "Isekai",
      "Romance"
    ],
    "synopsis": "Slum orphan Rio awakens the memories of Japanese college student Haruto Amakawa alongside massive dormant spirit magic. Saving a kidnapped princess, he enters the royal academy and navigates court intrigue and destiny.",
    "latestChapter": "Chapter 229",
    "tag": "Reincarnated Royalty"
  },
  {
    "id": "fwn:kuma-kuma-kuma-bear",
    "title": "Kuma Kuma Kuma Bear",
    "cover": "https://media.kitsu.app/manga/poster_images/40840/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/40840/large.jpg",
    "author": "Kumanano",
    "status": "Ongoing",
    "genres": [
      "Adventure",
      "Comedy",
      "Fantasy",
      "Isekai",
      "Slice of Life"
    ],
    "synopsis": "Fifteen-year-old Yuna logs into VRMMO game and receives an absurd, overpowered bear suit. Transported into a real fantasy world, she embraces her bear identity to protect towns and explore dungeons.",
    "latestChapter": "Chapter 807",
    "tag": "Cute VRMMO"
  },
  {
    "id": "fwn:skeleton-knight-in-another-world",
    "title": "Skeleton Knight in Another World",
    "cover": "https://media.kitsu.app/manga/39044/poster_image/large-90f1b3590cc58b3d75d252f1794da9f1.jpeg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/34358/original.jpg",
    "author": "Enki Hakari",
    "status": "Completed",
    "genres": [
      "Action",
      "Adventure",
      "Fantasy",
      "Isekai"
    ],
    "synopsis": "Gamer Arc falls asleep while playing and wakes up inside his game avatar — a fully armored knight who is an undead skeleton beneath his helmet! Hiding his true appearance, he travels the world punishing villains.",
    "latestChapter": "Chapter 191",
    "tag": "Heroic Undead"
  },
  {
    "id": "fwn:the-legendary-moonlight-sculptor",
    "title": "The Legendary Moonlight Sculptor",
    "cover": "https://media.kitsu.app/manga/poster_images/35878/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/105398-4UrEhdqZukrg.jpg",
    "author": "Nam Heesung",
    "status": "Completed",
    "genres": [
      "Action",
      "Adventure",
      "Comedy",
      "Fantasy",
      "VRMMO",
      "Game"
    ],
    "synopsis": "Hyun Lee was enslaved by poverty, selling his legendary game avatar for billions before loan sharks seized it. Starting fresh in Royal Road as the Moonlight Sculptor, his relentless thriftiness and craftsmanship shake the continent.",
    "latestChapter": "Chapter 161",
    "tag": "VRMMO Pioneer"
  }
];

export const KOREAN_GLOBAL_MASTERPIECES: MasterpieceEntry[] = [
  {
    "id": "fwn:shadow-slave",
    "title": "Shadow Slave",
    "cover": "https://media.kitsu.app/manga/75529/poster_image/large-2df49f981edd9ebf1a040696808c2ea9.jpeg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/105398-4UrEhdqZukrg.jpg",
    "author": "Guiltythree",
    "status": "Ongoing",
    "genres": [
      "Dark Fantasy",
      "Action",
      "Adventure",
      "System",
      "Mystery"
    ],
    "synopsis": "Growing up in the poverty-stricken outskirts, Sunny is infected by the Nightmare Spell. Transported into the brutal Dream Realm as a treachery-laden shadow aspect, he navigates vicious nightmare trials, god-kings, and outer terrors.",
    "latestChapter": "Chapter 3157",
    "tag": "Top Rated Dark Fantasy"
  },
  {
    "id": "fwn:only-i-level-up-wn",
    "title": "Solo Leveling (Only I Level Up)",
    "cover": "https://media.kitsu.app/manga/poster_images/54114/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/54114/cover_image/large-5ced5f4969b4e15202e7f08188ba093f.jpeg",
    "author": "Chugong",
    "status": "Completed",
    "genres": [
      "Action",
      "Fantasy",
      "System",
      "Overpowered",
      "Hunters"
    ],
    "synopsis": "Known as the 'Weakest Hunter of All Mankind', Sung Jin-Woo is left for dead inside a deadly dual dungeon. Awakening with the exclusive ability to see a quest log and level up infinitely, he transforms into the Shadow Monarch.",
    "latestChapter": "Chapter 270",
    "tag": "Global Phenomenon"
  },
  {
    "id": "fwn:omniscient-readers-viewpoint-novel",
    "title": "Omniscient Reader's Viewpoint",
    "cover": "https://media.kitsu.app/manga/poster_images/55196/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/43831/original.jpg",
    "author": "Sing Shong",
    "status": "Completed",
    "genres": [
      "Action",
      "Apocalypse",
      "Psychological",
      "Constellations",
      "System"
    ],
    "synopsis": "Kim Dokja was the sole reader of an obscure webnovel with over 3,000 chapters. When the final chapter is published, his reality transforms into the apocalyptic scenarios of the novel, and only he knows the ending.",
    "latestChapter": "Chapter 552",
    "tag": "Meta-Narrative Masterpiece"
  },
  {
    "id": "fwn:the-beginning-after-the-end-novel",
    "title": "The Beginning After the End",
    "cover": "https://media.kitsu.app/anime/poster_images/43690/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/42491/original.jpg",
    "author": "TurtleMe",
    "status": "Ongoing",
    "genres": [
      "Action",
      "Adventure",
      "Fantasy",
      "Magic",
      "Reincarnation"
    ],
    "synopsis": "King Grey possessed unrivaled strength, wealth, and prestige in a martial world. Reincarnated into the magical continent of Dicathen as Arthur Leywin, he masters mana and aether to safeguard those he loves from continent-spanning destruction.",
    "latestChapter": "Chapter 532",
    "tag": "Reincarnated Sovereign"
  },
  {
    "id": "fwn:trash-of-the-counts-family",
    "title": "Trash of the Count's Family",
    "cover": "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx123573-LKoCKwRouEMW.png",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/123573-1a2b3c4d5e6f.jpg",
    "author": "Yoo Ryeo Han",
    "status": "Ongoing",
    "genres": [
      "Action",
      "Adventure",
      "Comedy",
      "Fantasy",
      "Transmigration"
    ],
    "synopsis": "Kim Roksoo awakens as Cale Henituse, the notorious trash son of a count in the fantasy novel 'The Birth of a Hero'. Desiring nothing more than a lazy, peaceful slacker life, his strategic maneuvers accidentally save empires.",
    "latestChapter": "Chapter 1288",
    "tag": "Strategic Mastermind"
  },
  {
    "id": "fwn:the-novels-extra",
    "title": "The Novel's Extra",
    "cover": "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx152128-hk1Dq8zlEPVn.png",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/105398-4UrEhdqZukrg.jpg",
    "author": "Jee Gab Song",
    "status": "Completed",
    "genres": [
      "Action",
      "Academy",
      "Mystery",
      "Romance",
      "System"
    ],
    "synopsis": "Kim Hajin wakes up in his own unfinished novel as Chundong — an extra cadet with no importance who wields an ineffective firearm in a world of supreme swords and magic. Using his insider knowledge and customized gifted traits, he rewrites reality.",
    "latestChapter": "Chapter 481",
    "tag": "Author Inside Story"
  },
  {
    "id": "fwn:the-authors-pov",
    "title": "The Author's POV",
    "cover": "https://media.kitsu.app/manga/75920/poster_image/large-ceb6ed9d2a279a8b00be4026c588e0a5.jpeg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/119257-2V3a1l8b9k4m.jpg",
    "author": "Entrail_Ji",
    "status": "Completed",
    "genres": [
      "Action",
      "Academy",
      "Fantasy",
      "Psychological",
      "Transmigration"
    ],
    "synopsis": "Ren Dover transmigrates as an insignificant side character into the world of his own creation. Surviving against terrifying demonic incursions and treacherous political plots, he calculates every step to outmaneuver fate.",
    "latestChapter": "Chapter 862",
    "tag": "Cold Calculation"
  },
  {
    "id": "fwn:second-life-ranker-novel",
    "title": "Second Life Ranker",
    "cover": "https://media.kitsu.app/manga/poster_images/54690/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/42490/original.jpg",
    "author": "Sadoyeon",
    "status": "Completed",
    "genres": [
      "Action",
      "Adventure",
      "Fantasy",
      "Revenge",
      "Tower"
    ],
    "synopsis": "Cha Yeon-woo discovers his missing twin brother was betrayed and murdered while climbing the Sun God's Obelisk. Wielding his brother's pocket watch and dragon-heart inheritance, he enters the Tower to execute merciless vengeance.",
    "latestChapter": "Chapter 863",
    "tag": "Tower of Vengeance"
  },
  {
    "id": "fwn:sssclass-suicide-hunter",
    "title": "SSS-Class Suicide Hunter",
    "cover": "https://media.kitsu.app/manga/poster_images/58485/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/44470/original.jpg",
    "author": "Shin Noah",
    "status": "Completed",
    "genres": [
      "Action",
      "Comedy",
      "Drama",
      "Psychological",
      "Tower",
      "Regression"
    ],
    "synopsis": "Gong-ja is an F-rank hunter whose envy gives him an S-rank skill: whenever he dies, he copies one of his killer's skills and rewinds time by 24 hours. Committing suicide over 4,000 times, he climbs the Tower with absolute resolve.",
    "latestChapter": "Chapter 405",
    "tag": "Philosophical Regression"
  },
  {
    "id": "fwn:nano-machine-retranslated-version-novel",
    "title": "Nano Machine",
    "cover": "https://media.kitsu.app/manga/poster_images/57618/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/43834/original.jpg",
    "author": "Jeolmu Hyeon",
    "status": "Completed",
    "genres": [
      "Action",
      "Martial Arts",
      "Sci-Fi",
      "Murim",
      "Overpowered"
    ],
    "synopsis": "Cheon Yeo-woon, an illegitimate prince of the Demonic Cult marked for death, is injected with futuristic nanomachine technology by a descendant from the future. The AI transforms his body into the ultimate martial arts weapon.",
    "latestChapter": "Chapter 484",
    "tag": "Sci-Fi Murim"
  },
  {
    "id": "fwn:damn-reincarnation",
    "title": "Damn Reincarnation",
    "cover": "https://media.kitsu.app/manga/63710/poster_image/large-c54a38644f84c80b7e43073829c81f62.jpeg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/105398-4UrEhdqZukrg.jpg",
    "author": "Mogma",
    "status": "Ongoing",
    "genres": [
      "Action",
      "Adventure",
      "Fantasy",
      "Magic",
      "Reincarnation"
    ],
    "synopsis": "Hamel died right before defeating the Demon Kings alongside his companion, the Great Vermouth. Reincarnated 300 years later as Eugene Lionheart, a descendant of Vermouth, he discovers the world's history is a lie.",
    "latestChapter": "Chapter 678",
    "tag": "Vengeance of the Mercenary"
  },
  {
    "id": "fwn:the-world-after-the-fall",
    "title": "The World After the Fall",
    "cover": "https://media.kitsu.app/manga/poster_images/59455/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/119257-2V3a1l8b9k4m.jpg",
    "author": "Sing Shong",
    "status": "Completed",
    "genres": [
      "Action",
      "Fantasy",
      "Psychological",
      "Tower",
      "Survival"
    ],
    "synopsis": "When the Tower of Nightmares brought apocalyptic destruction, 'Return Stones' allowed hunters to regress into past timelines. Jaehwan refused to return, persistently stabbing through the fabric of illusion to reach the true universe.",
    "latestChapter": "Chapter 247",
    "tag": "Post-Apocalyptic Will"
  },
  {
    "id": "fwn:pick-me-up",
    "title": "Pick Me Up! Infinite Gacha",
    "cover": "https://media.kitsu.app/manga/65728/poster_image/large-c5f9b3bd3f82fb8df55b68843bfa2464.jpeg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/45755/original.jpg",
    "author": "Hermod",
    "status": "Completed",
    "genres": [
      "Action",
      "Fantasy",
      "Gacha",
      "Game",
      "Survival",
      "Strategy"
    ],
    "synopsis": "Lokis, the world's top-ranked master of the impossible mobile game 'Pick Me Up', loses consciousness and wakes up as a 1-star expendable unit inside the game's brutal meat grinder dungeon.",
    "latestChapter": "Chapter 638",
    "tag": "Brutal Gacha Survival"
  },
  {
    "id": "fwn:regressor-instruction-manual",
    "title": "Regressor Instruction Manual",
    "cover": "https://media.kitsu.app/manga/61570/poster_image/large-a2cca59f103c01a0201fa1947eff6983.jpeg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/105398-4UrEhdqZukrg.jpg",
    "author": "Wooden Spoon",
    "status": "Ongoing",
    "genres": [
      "Action",
      "Comedy",
      "Fantasy",
      "Harem",
      "Psychological",
      "Strategy"
    ],
    "synopsis": "Lee Kiyoung is summoned into a brutal survival game with pathetic stats, but has a unique trait: the ability to view the status windows and mental states of others. Discovering a genuine regressor hero, he schemes to become his indispensable soulmate.",
    "latestChapter": "Chapter 1627",
    "tag": "Deceptive Schemer"
  },
  {
    "id": "fwn:ending-maker",
    "title": "Ending Maker",
    "cover": "https://media.kitsu.app/manga/63562/poster_image/large-f62ae50d9ebd22276c86b262cbbff02f.jpeg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/119257-2V3a1l8b9k4m.jpg",
    "author": "Chwiryong",
    "status": "Completed",
    "genres": [
      "Action",
      "Adventure",
      "Comedy",
      "Fantasy",
      "Romance",
      "Gaming"
    ],
    "synopsis": "Rank 1 gamer Kang Jin-ho and Rank 2 gamer Hong Yoo-hee are reincarnated as the playable protagonists Jude and Cordelia inside their favorite RPG world right before the realm falls into ruin.",
    "latestChapter": "Chapter 634",
    "tag": "Co-op Romance Gaming"
  },
  {
    "id": "fwn:leveling-with-the-gods",
    "title": "Leveling with the Gods",
    "cover": "https://media.kitsu.app/manga/poster_images/60832/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/60832/cover_image/large-bdd7a97cd89fff138fef1783989d77c4.jpeg",
    "author": "Black Lotus",
    "status": "Ongoing",
    "genres": [
      "Action",
      "Adventure",
      "Fantasy",
      "Mythology",
      "Regression",
      "Tower"
    ],
    "synopsis": "Outer Gods invaded the Tower, slaughtering the greatest mythological pantheons. With their dying breath, Chronos sends Kim YuWon back through time to master Olympus, Asgard, and Heaven's power to rewrite the catastrophe.",
    "latestChapter": "Chapter 635",
    "tag": "Chronos Regression"
  },
  {
    "id": "fwn:return-of-the-mount-hua-sect-novel",
    "title": "Return of the Mount Hua Sect",
    "cover": "https://media.kitsu.app/manga/poster_images/59455/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/44469/original.jpg",
    "author": "Biga",
    "status": "Ongoing",
    "genres": [
      "Action",
      "Comedy",
      "Martial Arts",
      "Murim",
      "Reincarnation"
    ],
    "synopsis": "Chung Myung, the 13th disciple of the Great Mount Hua Sect and the Plum Blossom Sword Saint, slew the Heavenly Demon and died atop the 100,000 Mountains. Reincarnating a century later as a beggar child, he finds Mount Hua fallen into ruin.",
    "latestChapter": "Chapter 1351",
    "tag": "Legendary Plum Blossom"
  },
  {
    "id": "fwn:overgeared-novel",
    "title": "Overgeared",
    "cover": "https://media.kitsu.app/manga/poster_images/56166/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/43832/original.jpg",
    "author": "Park Saenal",
    "status": "Ongoing",
    "genres": [
      "Action",
      "Adventure",
      "Comedy",
      "Fantasy",
      "VRMMO",
      "Overpowered"
    ],
    "synopsis": "Shin Youngwoo, known as Grid, was an unlucky VRMMO player burdened with debt. Finding 'Pagma's Rare Book', he becomes a Legendary Blacksmith capable of forging god-tier equipment that reshapes kingdoms.",
    "latestChapter": "Chapter 2060",
    "tag": "God-Grid Blacksmith"
  },
  {
    "id": "fwn:tomb-raider-king",
    "title": "Tomb Raider King",
    "cover": "https://media.kitsu.app/manga/poster_images/54877/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/105398-4UrEhdqZukrg.jpg",
    "author": "SANJIKGAK",
    "status": "Completed",
    "genres": [
      "Action",
      "Adventure",
      "Fantasy",
      "Relics",
      "Regression"
    ],
    "synopsis": "God-like relics appeared worldwide, granting supernatural powers to tomb raiders. Betrayed and left to die in a relic tomb, Seo Joo-heon regresses 15 years into the past to monopolize every single relic on Earth.",
    "latestChapter": "Chapter 416",
    "tag": "Relic Monopoly"
  },
  {
    "id": "fwn:kill-the-hero",
    "title": "Kill the Hero",
    "cover": "https://media.kitsu.app/manga/poster_images/56114/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/105398-4UrEhdqZukrg.jpg",
    "author": "D-Dart",
    "status": "Completed",
    "genres": [
      "Action",
      "Dark Fantasy",
      "Hunters",
      "Revenge",
      "System"
    ],
    "synopsis": "After conquering the final dungeon with the Messiah Guild to save humanity, Woojin is betrayed and killed by the Guild Master Lee Se-jun. Returning to the past, he vows to become the hound who hunts down the false messiah.",
    "latestChapter": "Chapter 276",
    "tag": "Dark Hunter Betrayal"
  },
  {
    "id": "fwn:doctors-rebirth",
    "title": "Doctor's Rebirth",
    "cover": "https://media.kitsu.app/manga/poster_images/59179/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/105398-4UrEhdqZukrg.jpg",
    "author": "Tae Sun",
    "status": "Ongoing",
    "genres": [
      "Drama",
      "Historical",
      "Martial Arts",
      "Medical",
      "Murim",
      "Reincarnation"
    ],
    "synopsis": "A modern doctor deployed abroad is killed in a war zone, only to reincarnate into the brutal world of Murim. Combining surgical modern medical knowledge with legendary acupuncture and qi, he becomes the divine physician.",
    "latestChapter": "Chapter 276",
    "tag": "Medical Murim"
  },
  {
    "id": "fwn:chronicles-of-the-heavenly-demon",
    "title": "Chronicles of the Heavenly Demon",
    "cover": "https://media.kitsu.app/manga/poster_images/54562/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/105398-4UrEhdqZukrg.jpg",
    "author": "Il-hwang",
    "status": "Completed",
    "genres": [
      "Action",
      "Martial Arts",
      "Murim",
      "Reincarnation",
      "Revenge"
    ],
    "synopsis": "Hyuk Woon-seong and his master were falsely accused of practicing forbidden demonic arts and executed by orthodox hypocrites. Reincarnated as a low-level disciple in the Demonic Cult, he masters the spear to crush the righteous factions.",
    "latestChapter": "Chapter 208",
    "tag": "Spear Divine Legacy"
  },
  {
    "id": "fwn:warlock-of-the-magus-world",
    "title": "Warlock of the Magus World",
    "cover": "https://media.kitsu.app/manga/poster_images/40407/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/125291-3X9k1b2m5n8t.jpg",
    "author": "The Plagiarist",
    "status": "Completed",
    "genres": [
      "Action",
      "Dark Fantasy",
      "Magic",
      "Transmigration",
      "Overpowered"
    ],
    "synopsis": "Leylin Farlier transmigrates into a dark, ruthless Magus world with the A.I. Chip integrated into his soul. Cold, calculating, and driven by self-interest, he unlocks bloodlines to ascend the ranks of ancient warlocks.",
    "latestChapter": "Chapter 1200",
    "tag": "Ruthless AI Chip"
  },
  {
    "id": "fwn:player-who-returned-10000-years-later",
    "title": "Player Who Returned 10,000 Years Later",
    "cover": "https://media.kitsu.app/manga/63977/poster_image/large-bcc7100bc646f56fab6f90304b7bc24d.jpeg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/45757/original.jpg",
    "author": "Butterfly Valley",
    "status": "Ongoing",
    "genres": [
      "Action",
      "Comedy",
      "Demons",
      "Fantasy",
      "Overpowered"
    ],
    "synopsis": "Kang Ohjin fell into the bottom of Hell and spent 10,000 years devouring demon monarchs until he conquered the infernal planes. Returning to modern Earth, he discovers monster gates and hunters, enjoying life as an apex predator.",
    "latestChapter": "Chapter 762",
    "tag": "Demonic Monarch"
  },
  {
    "id": "fwn:the-heavenly-demon-cant-live-a-normal-life-novel",
    "title": "The Heavenly Demon Can't Live a Normal Life",
    "cover": "https://media.kitsu.app/manga/59974/poster_image/large-6e8e6bf92e444747410a9c2f06ec5132.jpeg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/59974/large.jpg",
    "author": "San Cheon",
    "status": "Ongoing",
    "genres": [
      "Action",
      "Fantasy",
      "Martial Arts",
      "Reincarnation",
      "Overpowered"
    ],
    "synopsis": "Baek Joong-hyuk, the supreme Heavenly Demon who unified Murim, reincarnates as Roman Dimitri — the useless eldest son of a frontier baron. Bringing the absolute law of the fist to Western medieval warfare, he crushes all opposition.",
    "latestChapter": "Chapter 276",
    "tag": "Martial Sovereign"
  },
  {
    "id": "fwn:academys-undercover-professor",
    "title": "Academy's Undercover Professor",
    "cover": "https://media.kitsu.app/manga/63644/poster_image/large-16adc3d279da53b55a5ff3c4b11975d3.jpeg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/105398-4UrEhdqZukrg.jpg",
    "author": "Sayren",
    "status": "Ongoing",
    "genres": [
      "Action",
      "Academy",
      "Fantasy",
      "Mystery",
      "Magic"
    ],
    "synopsis": "A master spy with dozens of aliases boards a train to assume a new life, only for the train to be attacked by terrorists. Forced to adopt the identity of the mysterious fallen professor Victor Weismann, he must teach elite students while hiding his deadly past.",
    "latestChapter": "Chapter 826",
    "tag": "Master of False Identities"
  },
  {
    "id": "fwn:the-reincarnated-assassin-is-a-genius-swordsman",
    "title": "The Reincarnated Assassin is a Genius Swordsman",
    "cover": "https://media.kitsu.app/manga/68985/poster_image/large-605314d8b4154e841a07c172b3050052.jpeg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/105398-4UrEhdqZukrg.jpg",
    "author": "Geul Jengi S",
    "status": "Ongoing",
    "genres": [
      "Action",
      "Fantasy",
      "Reincarnation",
      "Sword",
      "Revenge"
    ],
    "synopsis": "Raon Zieghart lived as a dog of the shadow assassins, his leash held by a collar of agony. Reincarnating as a direct descendant of the greatest swordsmanship clan, he embraces the flame and sword to forge his own destiny.",
    "latestChapter": "Chapter 709",
    "tag": "Swordsman Rebirth"
  }
];

export const CHINESE_XIANXIA_MASTERPIECES: MasterpieceEntry[] = [
  {
    "id": "fwn:to-be-a-power-in-the-shadows",
    "title": "The Eminence in Shadow",
    "cover": "https://media.kitsu.app/manga/poster_images/54238/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/106758-IWiib0G2AJdg.jpg",
    "author": "Daisuke Aizawa",
    "status": "Completed",
    "genres": [
      "Action",
      "Comedy",
      "Fantasy",
      "Isekai",
      "Overpowered"
    ],
    "synopsis": "Cid Kagenou strives to become neither a protagonist nor a final boss, but a mastermind pulling strings from the shadows. Reincarnated into a magical world, his fictional roleplay organization 'Shadow Garden' turns out to be fighting a very real ancient cult.",
    "latestChapter": "Chapter 204",
    "tag": "Dark Comedy"
  },
  {
    "id": "fwn:utsuro-no-hako-to-zero-no-maria",
    "title": "The Empty Box and Zeroth Maria",
    "cover": "https://media.kitsu.app/manga/poster_images/14109/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/14109/large.jpg",
    "author": "Eiji Mikage",
    "status": "Completed",
    "genres": [
      "Mystery",
      "Psychological",
      "Supernatural",
      "Romance"
    ],
    "synopsis": "Kazuki Hoshino cherishes his everyday high school life until transfer student Maria Otonashi appears and announces her declaration of war against him. Trapped inside mysterious, wish-granting 'Boxes', they must solve supernatural psychological traps.",
    "latestChapter": "Chapter 7",
    "tag": "Psychological Mystery"
  },
  {
    "id": "fwn:isekai-nonbiri-nouka",
    "title": "Farming Life in Another World",
    "cover": "https://media.kitsu.app/manga/40268/poster_image/large-4ab9677b9566e6361f0df16c533de7e2.jpeg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/40961/original.jpg",
    "author": "Kinosuke Naito",
    "status": "Ongoing",
    "genres": [
      "Slice of Life",
      "Fantasy",
      "Harem",
      "Isekai"
    ],
    "synopsis": "Given a healthy new body and the omnipotent farming tool by God, Hiraku cultivates land in a deep forest. Before long, beautiful elves, vampires, angels, and beastfolk gather to form a peaceful village under his care.",
    "latestChapter": "Chapter 969",
    "tag": "Relaxing Countryside"
  },
  {
    "id": "fwn:the-world-of-otome-games-is-tough-for-mobs",
    "title": "Trapped in a Dating Sim: Otome Games",
    "cover": "https://media.kitsu.app/manga/poster_images/54705/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/42550/original.jpg",
    "author": "Yomu Mishima",
    "status": "Completed",
    "genres": [
      "Action",
      "Comedy",
      "Fantasy",
      "Harem",
      "Isekai",
      "Mecha",
      "Romance"
    ],
    "synopsis": "Leon reincarnates into a matriarchal otome game world as a mere background mob character. Armed with his comprehensive memories of beating the game, he retrieves lost superweapons to smash the corrupt social order.",
    "latestChapter": "Chapter 241",
    "tag": "Mecha Anti-Hero"
  },
  {
    "id": "fwn:gimai-seikatsu-days-with-my-step-sister",
    "title": "Days with My Stepsister (Gimai Seikatsu)",
    "cover": "https://media.kitsu.app/manga/poster_images/60504/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/45220/original.jpg",
    "author": "Ghost Mikawa",
    "status": "Completed",
    "genres": [
      "Drama",
      "Romance",
      "School",
      "Slice of Life"
    ],
    "synopsis": "Following their parents' remarriage, high schooler Yuuta Asamura begins living under the same roof with the class beauty, Saki Ayase. Keeping a respectful distance, their relationship steadily deepens through everyday life.",
    "latestChapter": "Chapter 126",
    "tag": "Realistic Romance"
  },
  {
    "id": "fwn:lord-of-the-mysteries",
    "title": "Lord of the Mysteries",
    "cover": "https://media.kitsu.app/manga/poster_images/59428/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/125291-3X9k1b2m5n8t.jpg",
    "author": "Cuttlefish That Loves Diving",
    "status": "Completed",
    "genres": [
      "Mystery",
      "Supernatural",
      "Historical",
      "Steampunk",
      "Lovecraftian"
    ],
    "synopsis": "Klein Moretti wakes up in a Victorian steampunk world filled with steam machinery, ancient deities, tarot rituals, and potions of godhood. Concealing himself behind the persona of 'The Fool', he convenes the legendary Tarot Club.",
    "latestChapter": "Chapter 1432",
    "tag": "Victorian Steampunk Lovecraftian"
  },
  {
    "id": "fwn:reverend-insanity",
    "title": "Reverend Insanity (Gu Daoist Master)",
    "cover": "https://media.kitsu.app/manga/poster_images/54478/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/108050-P8m2b5x7q1v.jpg",
    "author": "Gu Zhen Ren",
    "status": "Completed",
    "genres": [
      "Dark Fantasy",
      "Cultivation",
      "Xianxia",
      "Psychological",
      "Action"
    ],
    "synopsis": "Fang Yuan lived 500 years as a demonic overlord before using the Spring Autumn Cicada to rebirth into his teenage body. Driven by an uncompromising pursuit of eternal life, he utilizes Gu insects and ruthless schemes without hesitation.",
    "latestChapter": "Chapter 2334",
    "tag": "Demonic Cultivation Masterpiece"
  },
  {
    "id": "fwn:martial-peak",
    "title": "Martial Peak",
    "cover": "https://media.kitsu.app/manga/poster_images/40987/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/40987/large.jpg",
    "author": "Momo",
    "status": "Ongoing",
    "genres": [
      "Action",
      "Martial Arts",
      "Cultivation",
      "Harem",
      "Xianxia"
    ],
    "synopsis": "Yang Kai is a sweeper disciple at High Heaven Pavilion who cannot cultivate until he discovers the mysterious Black Book. Unlocking the Golden Skeleton, his fiery journey carries him from small worlds to the supreme peak of the martial cosmos.",
    "latestChapter": "Chapter 6108",
    "tag": "6000+ Chapter Cultivation"
  },
  {
    "id": "fwn:coiling-dragon",
    "title": "Coiling Dragon",
    "cover": "https://media.kitsu.app/manga/poster_images/35024/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/35024/large.jpg",
    "author": "I Eat Tomatoes",
    "status": "Completed",
    "genres": [
      "Action",
      "Adventure",
      "Fantasy",
      "Cultivation",
      "Magic"
    ],
    "synopsis": "Linley Baruch finds a mystical ring known as the Coiling Dragon Ring. Awakening the dormant Dragonblood Warrior bloodline, he trains in Earth and Wind elemental laws to restore his clan and challenge the sovereign deities.",
    "latestChapter": "Chapter 808",
    "tag": "Western Fantasy Cultivation"
  },
  {
    "id": "fwn:martial-world-novel",
    "title": "Martial World",
    "cover": "https://media.kitsu.app/manga/poster_images/37605/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/104494-3H7rwoNkGgBe.jpg",
    "author": "Cocooned Cow",
    "status": "Completed",
    "genres": [
      "Action",
      "Cultivation",
      "Martial Arts",
      "Xianxia",
      "Harem"
    ],
    "synopsis": "Lin Ming is an ordinary youth who dreams of entering the martial holy lands. Finding the mysterious Magic Cube containing supreme primordial memories, he practices the Heretical God Force and ascends to the pinnacle of creation.",
    "latestChapter": "Chapter 2276",
    "tag": "Cosmic Cultivation"
  },
  {
    "id": "fwn:renegade-immortal",
    "title": "Renegade Immortal (Xian Ni)",
    "cover": "https://media.kitsu.app/manga/poster_images/38816/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/125291-3X9k1b2m5n8t.jpg",
    "author": "Er Gen",
    "status": "Completed",
    "genres": [
      "Action",
      "Cultivation",
      "Tragedy",
      "Xianxia",
      "Dark Fantasy"
    ],
    "synopsis": "Wang Lin was a kind mortal boy whose sect and family were ruthlessly massacred. Finding the mysterious Heavenly Defying Bead, he abandons softness to embrace the brutal, bloody reality of cultivation to revive his beloved.",
    "latestChapter": "Chapter 2090",
    "tag": "Tragic Godhood"
  },
  {
    "id": "fwn:i-shall-seal-the-heavens",
    "title": "I Shall Seal the Heavens (ISSTH)",
    "cover": "https://media.kitsu.app/manga/poster_images/40544/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/108050-P8m2b5x7q1v.jpg",
    "author": "Er Gen",
    "status": "Completed",
    "genres": [
      "Action",
      "Cultivation",
      "Comedy",
      "Xianxia",
      "Adventure"
    ],
    "synopsis": "Meng Hao was an impoverished scholar who failed the imperial exams before being abducted into the Reliance Sect. Armed with a copper mirror that duplicates treasure and an unyielding will, he becomes the Ninth Generation Demon Sealer.",
    "latestChapter": "Chapter 1616",
    "tag": "Demon Sealing Legacy"
  },
  {
    "id": "fwn:a-will-eternal",
    "title": "A Will Eternal",
    "cover": "https://media.kitsu.app/manga/469/poster_image/large-c8f4a9ee0b9d6d552d9caa51d12cccec.jpeg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/125291-3X9k1b2m5n8t.jpg",
    "author": "Er Gen",
    "status": "Completed",
    "genres": [
      "Comedy",
      "Cultivation",
      "Action",
      "Xianxia",
      "Fantasy"
    ],
    "synopsis": "Bai Xiaochun is terrified of dying and seeks nothing other than eternal life. His hilarious, chaotic methods of staying safe inadvertently trigger heaven-shaking catastrophes across the cultivation world.",
    "latestChapter": "Chapter 1317",
    "tag": "Comedic Immortality"
  },
  {
    "id": "fwn:against-the-gods-novel",
    "title": "Against the Gods",
    "cover": "https://media.kitsu.app/manga/poster_images/54416/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/104494-3H7rwoNkGgBe.jpg",
    "author": "Mars Gravity",
    "status": "Ongoing",
    "genres": [
      "Action",
      "Harem",
      "Cultivation",
      "Reincarnation",
      "Xianxia"
    ],
    "synopsis": "Yun Che is reincarnated into the Blue Pole Star after swallowing the Sky Poison Pearl. Possessing the veins of the Primordial Evil God, his wrath topples kingdoms as he defies divine laws.",
    "latestChapter": "Chapter 2193",
    "tag": "Evil God Veins"
  },
  {
    "id": "fwn:the-desolate-era-novel",
    "title": "The Desolate Era",
    "cover": "https://media.kitsu.app/manga/poster_images/40082/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/86707-3H7rwoNkGgBe.jpg",
    "author": "I Eat Tomatoes",
    "status": "Completed",
    "genres": [
      "Action",
      "Cultivation",
      "Reincarnation",
      "Xianxia",
      "Dao"
    ],
    "synopsis": "Ji Ning dies on Earth having spent his fortune on good deeds and is rewarded with reincarnation into a primordial realm. Mastering the sword and divine body cultivation, he comprehends the profound Grand Dao.",
    "latestChapter": "Chapter 1451",
    "tag": "Primordial Dao"
  },
  {
    "id": "fwn:battle-through-the-heavens-novel",
    "title": "Battle Through the Heavens",
    "cover": "https://media.kitsu.app/manga/poster_images/32621/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/86707-3H7rwoNkGgBe.jpg",
    "author": "Heavenly Silkworm Potato",
    "status": "Completed",
    "genres": [
      "Action",
      "Alchemy",
      "Cultivation",
      "Martial Arts",
      "Xuanhuan"
    ],
    "synopsis": "Xiao Yan was a child prodigy whose powers vanished after his mother's ring began absorbing his Dou Qi. When his fiancée's sect humiliates his family, he trains under the ghost alchemist Yao Lao to master the 23 Heavenly Flames.",
    "latestChapter": "Chapter 1648",
    "tag": "Heavenly Flames"
  },
  {
    "id": "fwn:perfect-world",
    "title": "Perfect World (Wanmei Shijie)",
    "cover": "https://media.kitsu.app/manga/poster_images/26938/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/86707-3H7rwoNkGgBe.jpg",
    "author": "Chen Dong",
    "status": "Completed",
    "genres": [
      "Action",
      "Cultivation",
      "Mythology",
      "Xuanhuan",
      "Gods"
    ],
    "synopsis": "Born with a Divine Supreme Bone, Shi Hao was stripped of his gift by envious relatives and left for dead in a remote wasteland. Nurtured by the Willow Deity, he rises as a peerless sovereign shaking the myriad heavens.",
    "latestChapter": "Chapter 2018",
    "tag": "Supreme Bone Sovereign"
  },
  {
    "id": "fwn:ancient-godly-monarch",
    "title": "Ancient Godly Monarch",
    "cover": "https://media.kitsu.app/manga/poster_images/40427/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/86707-3H7rwoNkGgBe.jpg",
    "author": "Jing Wu Hen",
    "status": "Completed",
    "genres": [
      "Action",
      "Cultivation",
      "Martial Arts",
      "Xuanhuan",
      "Harem"
    ],
    "synopsis": "Qin Wentian was crippled in his youth and unable to form Astral Souls. Breaking through his crippled meridians, he forms bonds with the highest celestial stellar rivers to become an Ancient Godly Monarch.",
    "latestChapter": "Chapter 2053",
    "tag": "Astral Constellations"
  },
  {
    "id": "fwn:tales-of-demons-and-gods",
    "title": "Tales of Demons and Gods",
    "cover": "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx86707-QD3UyAOHUEaT.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/86707-3H7rwoNkGgBe.jpg",
    "author": "Mad Snail",
    "status": "Ongoing",
    "genres": [
      "Action",
      "Cultivation",
      "Demons",
      "Fantasy",
      "Reincarnation"
    ],
    "synopsis": "Nie Li was the strongest Demon Spiritualist before falling in battle against the Sage Emperor. Reborn as his 13-year-old self in Glory City, he utilizes comprehensive cultivation manuals and spirit demon integration to protect his homeland.",
    "latestChapter": "Chapter 507",
    "tag": "Temporal Demon Spirit"
  },
  {
    "id": "fwn:a-record-of-a-mortals-journey-to-immortality-novel",
    "title": "A Record of a Mortal's Journey to Immortality",
    "cover": "https://media.kitsu.app/manga/65008/poster_image/large-cdbf598f8aea1409ad78f78e12e6f610.jpeg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/125291-3X9k1b2m5n8t.jpg",
    "author": "Wang Yu",
    "status": "Completed",
    "genres": [
      "Action",
      "Cultivation",
      "Adventure",
      "Xianxia",
      "Patience"
    ],
    "synopsis": "Han Li is an ordinary, poor peasant boy who joins a small sect to support his family. Stumbling upon a mysterious green bottle that accelerates plant growth, he navigates treacherous sects through extreme caution and patience.",
    "latestChapter": "Chapter 2455",
    "tag": "Classic Xianxia Progenitor"
  },
  {
    "id": "fwn:ze-tian-ji",
    "title": "Way of Choices (Ze Tian Ji)",
    "cover": "https://media.kitsu.app/manga/poster_images/55551/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/86707-3H7rwoNkGgBe.jpg",
    "author": "Mao Ni",
    "status": "Completed",
    "genres": [
      "Action",
      "Drama",
      "Cultivation",
      "Historical",
      "Philosophy"
    ],
    "synopsis": "Chen Changsheng is cursed to die before the age of twenty due to defective meridians. Leaving his mountain temple with an engagement certificate, he travels to the imperial capital to defy the stars and alter his fate.",
    "latestChapter": "Chapter 1185",
    "tag": "Destiny Defier"
  },
  {
    "id": "fwn:lord-xue-ying",
    "title": "Lord Xue Ying",
    "cover": "https://media.kitsu.app/manga/poster_images/40930/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/86707-3H7rwoNkGgBe.jpg",
    "author": "I Eat Tomatoes",
    "status": "Completed",
    "genres": [
      "Action",
      "Adventure",
      "Cultivation",
      "Martial Arts",
      "Xuanhuan"
    ],
    "synopsis": "To rescue his captured parents, Dongbo Xue Ying trains relentlessly with his spear atop Snow Eagle Territory. Awakening his primordial bloodline, he fights abyssal demons to protect the mortal realms.",
    "latestChapter": "Chapter 1388",
    "tag": "Spear Cultivation"
  },
  {
    "id": "fwn:stellar-transformations",
    "title": "Stellar Transformations",
    "cover": "https://media.kitsu.app/manga/poster_images/38910/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/86707-3H7rwoNkGgBe.jpg",
    "author": "I Eat Tomatoes",
    "status": "Completed",
    "genres": [
      "Action",
      "Adventure",
      "Cultivation",
      "Sci-Fi",
      "Xuanhuan"
    ],
    "synopsis": "Qin Yu cannot cultivate internal martial arts, earning pity from his royal family. Discovering the Meteoric Tear, he forges his own external cultivation path and transforms his dantian into cosmic galaxies.",
    "latestChapter": "Chapter 680",
    "tag": "Meteoric Cultivation"
  },
  {
    "id": "fwn:swallowed-star",
    "title": "Swallowed Star",
    "cover": "https://media.kitsu.app/manga/poster_images/40665/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/86707-3H7rwoNkGgBe.jpg",
    "author": "I Eat Tomatoes",
    "status": "Completed",
    "genres": [
      "Action",
      "Sci-Fi",
      "Cultivation",
      "Post-Apocalyptic",
      "Mecha"
    ],
    "synopsis": "Earth was ravaged by the RR virus, mutating beasts into apocalyptic monsters. Luo Feng unlocks spirit reader powers, defending Earth before journeying into the vast cosmic universe to become a stellar deity.",
    "latestChapter": "Chapter 1486",
    "tag": "Cosmic Sci-Fi Cultivation"
  },
  {
    "id": "fwn:nine-star-hegemon-body-arts",
    "title": "Nine Star Hegemon Body Arts",
    "cover": "https://media.kitsu.app/manga/poster_images/54895/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/104494-3H7rwoNkGgBe.jpg",
    "author": "Ordinary Magician",
    "status": "Ongoing",
    "genres": [
      "Action",
      "Alchemy",
      "Comedy",
      "Cultivation",
      "Harem"
    ],
    "synopsis": "Long Chen had his Spirit Root stolen and lived as a cripple. Unlocking the ancient memory of the Sovereign Pill God and the Nine Star Hegemon Body Art, he controls divine pills and cosmic stars to crush his foes.",
    "latestChapter": "Chapter 7183",
    "tag": "Tyrant of Nine Stars"
  },
  {
    "id": "fwn:dragon-prince-yuan",
    "title": "Dragon Prince Yuan (Yuan Zun)",
    "cover": "https://media.kitsu.app/manga/poster_images/40809/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/40809/large.jpg",
    "author": "Heavenly Silkworm Potato",
    "status": "Completed",
    "genres": [
      "Action",
      "Adventure",
      "Cultivation",
      "Fantasy",
      "Xuanhuan"
    ],
    "synopsis": "Zhou Yuan was born with the Sacred Dragon blessing, but enemy kingdoms seized his fate and blocked his eight meridian channels. Guided by Master Cang Yuan and Yaoyao, he unlocks the dragon within.",
    "latestChapter": "Chapter 1503",
    "tag": "Eight Ancestral Dragon"
  },
  {
    "id": "fwn:the-great-ruler",
    "title": "The Great Ruler (Da Zhu Zai)",
    "cover": "https://media.kitsu.app/manga/poster_images/38798/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/86707-3H7rwoNkGgBe.jpg",
    "author": "Heavenly Silkworm Potato",
    "status": "Completed",
    "genres": [
      "Action",
      "Adventure",
      "Cultivation",
      "Fantasy",
      "Xuanhuan"
    ],
    "synopsis": "The Great Thousand World is the convergence of myriad realms. Mu Chen rides the Nine Netherbird and masters the Great Solar Undying Body to become a Great Ruler alongside Xiao Yan and Lin Dong.",
    "latestChapter": "Chapter 1567",
    "tag": "Great Thousand World"
  },
  {
    "id": "fwn:martial-universe",
    "title": "Martial Universe (Wu Dong Qian Kun)",
    "cover": "https://media.kitsu.app/manga/poster_images/38743/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/86707-3H7rwoNkGgBe.jpg",
    "author": "Heavenly Silkworm Potato",
    "status": "Completed",
    "genres": [
      "Action",
      "Adventure",
      "Cultivation",
      "Martial Arts",
      "Xuanhuan"
    ],
    "synopsis": "Lin Dong finds a mysterious stone talisman in a cave. Cultivating body and soul, he masters Ancestral Symbols to fight demonic invaders across the continent.",
    "latestChapter": "Chapter 1317",
    "tag": "Ancestral Stone"
  },
  {
    "id": "fwn:emperors-domination",
    "title": "Emperor's Domination",
    "cover": "https://media.kitsu.app/manga/63018/poster_image/large-8f5a0875f65aadfc9c73322ea03ca3e1.jpeg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/104494-3H7rwoNkGgBe.jpg",
    "author": "Yan Bi Xiao Sheng",
    "status": "Ongoing",
    "genres": [
      "Action",
      "Cultivation",
      "Overpowered",
      "Harem",
      "Xuanhuan"
    ],
    "synopsis": "Li Qiye was trapped inside the body of a Dark Crow for millions of years, guiding ancient emperors and training immortal paragons. Reclaiming his mortal body, he embarks on an unstoppable path to rule the heavens.",
    "latestChapter": "Chapter 7205",
    "tag": "Millennia Overlord"
  },
  {
    "id": "fwn:cultivation-chat-group",
    "title": "Cultivation Chat Group",
    "cover": "https://media.kitsu.app/manga/poster_images/54536/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/125291-3X9k1b2m5n8t.jpg",
    "author": "Legend of the Paladin",
    "status": "Completed",
    "genres": [
      "Comedy",
      "Cultivation",
      "Modern",
      "Slice of Life",
      "Urban"
    ],
    "synopsis": "Song Shuhang is mistakenly added to a chat group where members roleplay as ancient cultivators. When he tries an alchemy recipe using an electric rice cooker, he realizes every member is a genuine immortal.",
    "latestChapter": "Chapter 3165",
    "tag": "Modern Comedic Cultivation"
  },
  {
    "id": "fwn:my-house-of-horrors",
    "title": "My House of Horrors",
    "cover": "https://media.kitsu.app/manga/poster_images/54202/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/125291-3X9k1b2m5n8t.jpg",
    "author": "I Fix Air Conditioners",
    "status": "Completed",
    "genres": [
      "Horror",
      "Mystery",
      "Psychological",
      "Supernatural",
      "System"
    ],
    "synopsis": "Chen Ge inherits his parents' failing haunted house attraction alongside a mysterious black phone. By completing terrifying supernatural missions in urban haunted sites, he expands his house of horrors with real specters.",
    "latestChapter": "Chapter 1215",
    "tag": "Supernatural Thriller"
  },
  {
    "id": "fwn:the-charm-of-soul-pets",
    "title": "The Charm of Soul Pets",
    "cover": "https://media.kitsu.app/manga/62537/poster_image/large-b1cfda54e6727e75d125d085c9a708ae.jpeg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/86707-3H7rwoNkGgBe.jpg",
    "author": "Fish's Sky",
    "status": "Completed",
    "genres": [
      "Action",
      "Adventure",
      "Fantasy",
      "Monsters",
      "Pets"
    ],
    "synopsis": "Chu Mu survives the brutal Nightmare Island with his soul pet, the Moonlight Fox Mo Xie. Through endless battles and continuous mutational evolutions, he rises to the summit of soul pet masters.",
    "latestChapter": "Chapter 1816",
    "tag": "Monster Taming Epic"
  },
  {
    "id": "fwn:world-of-cultivation",
    "title": "World of Cultivation",
    "cover": "https://media.kitsu.app/manga/poster_images/54550/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/54550/large.jpg",
    "author": "Fang Xiang",
    "status": "Completed",
    "genres": [
      "Action",
      "Adventure",
      "Comedy",
      "Cultivation",
      "Strategy"
    ],
    "synopsis": "Zuo Mo is a zombie-faced outer disciple with amnesia who loves nothing more than spiritual farming and making money. When ancient war engulfs the sects, his mastery of formation ling-arts turns him into an accidental sect leader.",
    "latestChapter": "Chapter 915",
    "tag": "Farming & Formations"
  },
  {
    "id": "fwn:absolute-resonance",
    "title": "Absolute Resonance",
    "cover": "https://media.kitsu.app/manga/66715/poster_image/large-8d9ad6bcae2dc720d87a0a44312b621b.jpeg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/86707-3H7rwoNkGgBe.jpg",
    "author": "Heavenly Silkworm Potato",
    "status": "Ongoing",
    "genres": [
      "Action",
      "Adventure",
      "Cultivation",
      "Fantasy",
      "School"
    ],
    "synopsis": "Li Luo was born with a rare blank resonance, preventing him from practicing resonance arts. Finding his parents' legacy, he unlocks the supreme Three Resonance cultivation secret to rescue his house.",
    "latestChapter": "Chapter 1837",
    "tag": "Dual Resonance Prodigy"
  },
  {
    "id": "fwn:martial-god-asura-novel",
    "title": "Martial God Asura",
    "cover": "https://media.kitsu.app/manga/poster_images/58479/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/34352/original.jpg",
    "author": "Kindhearted Bee",
    "status": "Ongoing",
    "genres": [
      "Action",
      "Cultivation",
      "Harem",
      "Martial Arts",
      "Overpowered"
    ],
    "synopsis": "Chu Feng was viewed as trash in the Chu family until he unlocked nine divine thunder beasts within his dantian. Wielding Asura World spirits, he dominates the Nine Provinces and the Outer Holy Realms.",
    "latestChapter": "Chapter 6683",
    "tag": "Thunder Emperor"
  },
  {
    "id": "fwn:super-gene",
    "title": "Super Gene",
    "cover": "https://media.kitsu.app/manga/63627/poster_image/large-f856cfddfb38d8e5ef40c9faf2ab6bf1.jpeg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/105398-4UrEhdqZukrg.jpg",
    "author": "Twelve Winged Dark Seraphim",
    "status": "Completed",
    "genres": [
      "Action",
      "Adventure",
      "Fantasy",
      "Sci-Fi",
      "System"
    ],
    "synopsis": "Humanity entered God's Sanctuary to evolve by consuming monster flesh for gene points. Han Sen, nicknamed 'Crazy Asses', finds a mysterious black beetle and evolves super gene beast souls.",
    "latestChapter": "Chapter 3462",
    "tag": "Sanctuary Gene Hunt"
  },
  {
    "id": "fwn:monster-paradise",
    "title": "Monster Paradise",
    "cover": "https://media.kitsu.app/manga/66671/poster_image/large-84e93d46839136421b1f1a5bec9560aa.jpeg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/105398-4UrEhdqZukrg.jpg",
    "author": "Nuclear Warhead Cooked Tea",
    "status": "Completed",
    "genres": [
      "Action",
      "Adventure",
      "Fantasy",
      "Monsters",
      "System"
    ],
    "synopsis": "Lin Huang transmigrates into a monster-infested world with only three months left to live. Obtaining the Gold Monster Card System, he tames mythical monsters and levels up card spirits to defeat dimensional calamities.",
    "latestChapter": "Chapter 1935",
    "tag": "Monster Card Summoner"
  },
  {
    "id": "fwn:way-of-the-devil",
    "title": "Way of the Devil",
    "cover": "https://media.kitsu.app/manga/poster_images/15448/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/15448/large.jpg",
    "author": "Get Lost",
    "status": "Completed",
    "genres": [
      "Action",
      "Dark Fantasy",
      "Horror",
      "Martial Arts",
      "Transmigration"
    ],
    "synopsis": "Lu Sheng transmigrates into an eerie world infested by supernatural ghosts and Noble families with bloodline divinity. Using the Deep Blue modification frame, he forces mortal martial arts beyond human limits into titanic demonic muscle.",
    "latestChapter": "Chapter 773",
    "tag": "Muscle Overmind Horror"
  },
  {
    "id": "fwn:let-me-game-in-peace",
    "title": "Let Me Game in Peace",
    "cover": "https://media.kitsu.app/manga/66417/poster_image/large-2a8f73dff6f6468e9be1f1a1a55ffbde.jpeg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/105398-4UrEhdqZukrg.jpg",
    "author": "Twelve Winged Dark Seraphim",
    "status": "Completed",
    "genres": [
      "Action",
      "Adventure",
      "Fantasy",
      "Game",
      "Urban"
    ],
    "synopsis": "Zhou Wen finds an ancient mysterious smartphone with an avatar game bound to dimensional zones. While others risk their lives in deadly dimensional domains, he clears them comfortably on his phone and reaps real-world drops.",
    "latestChapter": "Chapter 1905",
    "tag": "Dimensional Game Drops"
  },
  {
    "id": "fwn:top-tier-providence-secretly-cultivate-for-a-thousand-years",
    "title": "Top Tier Providence, Secretly Cultivate for a Thousand Years",
    "cover": "https://media.kitsu.app/manga/65005/poster_image/large-1c084daedefef267f258aafc6a26c1e8.jpeg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/125291-3X9k1b2m5n8t.jpg",
    "author": "Let Me Laugh",
    "status": "Completed",
    "genres": [
      "Action",
      "Comedy",
      "Cultivation",
      "Parody",
      "Transmigration"
    ],
    "synopsis": "Han Jue transmigrates with a video-game reroll interface, rolling supreme providence luck and immortal cultivation talent. Staying inside his secluded cave for centuries to avoid karmic disasters, he quietly becomes a supreme Dao ancestor.",
    "latestChapter": "Chapter 1192",
    "tag": "Secluded Immortal"
  },
  {
    "id": "fwn:the-kings-avatar",
    "title": "The King's Avatar (Quan Zhi Gao Shou)",
    "cover": "https://media.kitsu.app/manga/poster_images/39180/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/39180/large.jpg",
    "author": "Butterfly Blue",
    "status": "Completed",
    "genres": [
      "Action",
      "Comedy",
      "Esports",
      "Game",
      "Gaming"
    ],
    "synopsis": "Ye Xiu, the supreme 'Battle God' of the online game Glory, is forced out of his professional esports team. Working as a night-shift manager at an internet café, he launches his new character 'Lord Grim' on the tenth server with his custom Thousand Chance Umbrella.",
    "latestChapter": "Chapter 1735",
    "tag": "Glory Esports Legend"
  },
  {
    "id": "fwn:release-that-witch",
    "title": "Release That Witch",
    "cover": "https://media.kitsu.app/manga/poster_images/54522/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/108050-P8m2b5x7q1v.jpg",
    "author": "Er Mu",
    "status": "Completed",
    "genres": [
      "Action",
      "Adventure",
      "Fantasy",
      "Kingdom Building",
      "Magic",
      "Sci-Fi"
    ],
    "synopsis": "Mechanical engineer Cheng Yan transmigrates as Prince Roland Wimbledon in a medieval fantasy world. Rescuing persecuted witches from the Church, he harnesses their magical abilities alongside modern physics and steam engines to build an industrial empire.",
    "latestChapter": "Chapter 1501",
    "tag": "Industrial Revolution Witchcraft"
  },
  {
    "id": "fwn:library-of-heavens-path",
    "title": "Library of Heaven's Path",
    "cover": "https://media.kitsu.app/manga/poster_images/40355/large.jpg",
    "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/manga/banner/104494-3H7rwoNkGgBe.jpg",
    "author": "Heng Sao Tian Ya",
    "status": "Completed",
    "genres": [
      "Action",
      "Comedy",
      "Cultivation",
      "Overpowered",
      "Transmigration"
    ],
    "synopsis": "Zhang Xuan transmigrates as a disgraced academy teacher in a cultivation world. Unlocking the Library of Heaven's Path in his mind, whenever he sees a person or technique, a book detailing all its flaws is instantly compiled.",
    "latestChapter": "Chapter 2271",
    "tag": "Heavenly Flaw Finder"
  },
  {
    "id": "fwn:versatile-mage",
    "title": "Versatile Mage (Quanzhi Fashi)",
    "cover": "https://media.kitsu.app/manga/poster_images/54093/large.jpg",
    "bannerImage": "https://media.kitsu.app/manga/cover_images/54093/large.jpg",
    "author": "Chaos",
    "status": "Completed",
    "genres": [
      "Action",
      "Academy",
      "Fantasy",
      "Magic",
      "Supernatural",
      "Urban"
    ],
    "synopsis": "Mo Fan wakes up in a familiar city that now teaches magic instead of science. While other mages can only awaken one element, his unique talent allows him to awaken two elements at every rank — starting with Fire and Lightning.",
    "latestChapter": "Chapter 3169",
    "tag": "Elemental Magic Emperor"
  }
];

export const ALL_MASTERPIECES: MasterpieceEntry[] = [
  ...OFFICIAL_LIGHT_NOVELS,
  ...KOREAN_GLOBAL_MASTERPIECES,
  ...CHINESE_XIANXIA_MASTERPIECES
];
