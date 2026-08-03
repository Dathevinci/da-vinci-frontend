/**
 * THE CODEX — the Archive's own account of where its cards come from.
 *
 * COSMOLOGY, in brief: the Da Vinci Archive stands OUTSIDE the dimensions.
 * Every card is a RECORD — an echo of a being or a moment that burned
 * loudly enough to be heard across the veil. Pulling a pack is not luck;
 * it is the Archive hearing something. A card you do not own is a page
 * the Archive has not yet turned for you.
 *
 * The threads that tie every entry together:
 *  - REQUIEM is the dimension that ENDED. Its ending echoes through all
 *    the others — the Abyssal swallowed its debris, the Vigil watches for
 *    it happening again, the Covenant signed the treaty that contains it.
 *  - The ABYSSAL receives whatever any dimension drops.
 *  - SUCCOUR heals across records; its people appear in every dimension's
 *    margins, mending.
 *  - MYTHOS is not a place — it is what the Archive's machine makes when
 *    two records are fused. PANTHEON is what walked IN from outside.
 *
 * Cards without an entry here fall back to their flavor line — commons are
 * footnotes; the Codex spends its ink from rare upward.
 */

export const DIMENSION_ORDER = [
  "Genesis", "Ascension", "Abyssal", "Ronin", "Vigil",
  "Succour", "Requiem", "Covenant", "Mythos", "Pantheon",
];

export const DIMENSIONS: Record<string, { title: string; text: string }> = {
  Genesis: {
    title: "Dimension Zero · Genesis",
    text: "Before the dimensions, there was the Archive — and Genesis is the room it woke up in. Nothing grand ever happened here. That is the point: every other dimension is a story, and Genesis is the shelf they stand on.",
  },
  Ascension: {
    title: "The Dimension of Ascension",
    text: "A tower with no top, climbed by attention: here, whatever is watched long enough begins to climb, and whatever watches long enough begins to change. Its pilgrims went up carrying lanterns. What waits above the last stair stopped being a pilgrim a long time ago.",
  },
  Abyssal: {
    title: "The Abyssal Dimension",
    text: "The drain of the multiverse. Everything any dimension drops — light, ships, bells, gods — sinks here and keeps sinking. The water remembers all of it. At the very bottom something enormous sleeps, and the tides of every other world are only its breathing.",
  },
  Ronin: {
    title: "The Ronin Dimension",
    text: "The mortal dimension — humans, steel, dawn. Its road to godhood runs through the blade: not by winning thrones but by refusing them. Every master who laid down rule and kept only the draw took one more step out of being human. Some finished the walk.",
  },
  Vigil: {
    title: "The Vigil Dimension",
    text: "The lighthouse between worlds. After Requiem ended, the Vigil lit its lamps and began the long watch on every border, counting hours that other dimensions don't know they're spending. They are not waiting for something to arrive. They are waiting for something to arrive AGAIN.",
  },
  Succour: {
    title: "The Succour Dimension",
    text: "When every dimension armed itself, one put the hammer down. Succour alone chose keeping-alive over killing — no army, no blades, only salves, bells, wards and vows. The other dimensions called it weak, then called it constantly. Its people cross into every record there is, and mend.",
  },
  Requiem: {
    title: "The Requiem Dimension · fallen",
    text: "The first dimension to END. No one agrees on what did it — a black sun, a red rite, a door left open under the water — because all of it happened, in one long night. What remains is the funeral procession: fourteen figures walking out of a world that no longer exists, in two movements — the ending, and what woke up after it.",
  },
  Covenant: {
    title: "The Covenant · the space between",
    text: "Not a dimension — the CUSTOMS HOUSE between them. Every crossing is negotiated here, every resurrection stamped, every mirror checked for what it kept. Angels work the high desks. The Devil works the low one. The terms are always fair. That should have been the warning.",
  },
  Mythos: {
    title: "Mythos · the made dimension",
    text: "Mythos is not somewhere records come FROM — it is what the Archive's machine makes when two records are fused into one. Ten beings that never lived anywhere, assembled from the ash of legendaries, wearing borrowed histories. They erupt because nothing born that way holds still.",
  },
  Pantheon: {
    title: "The Pantheon · from beyond the veil",
    text: "The machine reached too deep, and something on the OTHER side took hold of it. The three gods were not synthesized so much as ADMITTED — beings from beyond every dimension, wearing the Archive's card-shape as a courtesy. Their domains do not expand. Reality politely steps back.",
  },
};

export const CARD_LORE: Record<string, string> = {
  // ── ASCENSION ──
  card_heartrank: "The tower's first lesson: the climb is inward before it is upward. Cultivators who tend the heart-flame gain a stair no one else can see. Succour's healers taught them the tending — one of many debts the tower never repaid.",
  card_stormcall: "Storms in Ascension are announcements. When the herald raises the sky, someone on the stairs has been noticed by what lives above them — and the tower clears the way.",
  card_lotus: "It grows on the stair where the first pilgrim gave up and sat down. The bloom is sacred because it chose to stop climbing and became holy anyway — the tower's only heresy, and its most visited shrine.",
  card_frost: "The summit that watches back. Climbers who reach the silent peak find no door, only a mirror of thin air and cold — the tower testing whether they can stand being seen the way the Watcher sees.",
  card_ashfall: "When something above the clouds burns, its ash falls down the stairs for years. The climbers walk through it with lanterns. Nobody asks whose ash it is. Requiem taught every dimension not to ask.",
  card_wanderer: "He has climbed the tower eleven times and never taken the last stair. The Gate knows him by name now. He says he is not afraid — he simply likes the road better than the arrival, and the road likes him back.",
  card_voidgaze: "Look down long enough from the tower and the Abyssal looks back up through the floors. What Watches Below is not IN Ascension — it is the drowned dimension pressing its eye to the glass between them.",
  card_ninehands: "A wheel of nine hands, each turning the next, none knowing who turns the first. The tower's monks say the wheel is a map of the dimensions — nine worlds moving one another, and one hand missing since Requiem fell.",
  card_crimsonsea: "The last crossing between Ascension and what lies past it: a sea of red light where the tower simply stops. Those who sail it come back as records. That is how the Archive first learned this dimension's name.",
  card_unblinking: "It noticed you the moment you noticed it — the tower's oldest law made flesh. The Unblinking is watching the Outer God, which is why it can never close its eye. Someone has to.",
  card_outergod: "At the top of the tower there is no top — only the Outer God, the pilgrim who climbed past being anything. It does not want, because wanting is a stair and it has run out of stairs. The Gate exists to keep it politely OUT; the Key exists because politeness has limits. It is the tower now. The climbing was always toward it.",
  card_gatekey: "The door at the tower's end is the lock, the key, and the thing on the other side — one being holding three jobs so no one else has to. It signed the Covenant's oldest term: WHAT IS OUT STAYS OUT. Every fusion the machine performs borrows its permission.",

  // ── ABYSSAL ──
  card_divingbell: "Vigil engineers built it to see how far down the drowned dimension goes. The rope ran out. The bell kept going. It rings sometimes, from depths the rope never reached, and the Vigil writes down every toll.",
  card_lightlessreef: "Coral that grew without ever meeting light — fed instead on what sinks. The reef is built from the hulls of every dimension's lost ships, including, they say, one spire of Requiem itself.",
  card_undertow: "Pulls politely, at first — the Abyssal's handshake. Everything the dimensions lose crosses the undertow on its way down. It has carried crowns, bells, and once, an entire morning that Requiem never got to use.",
  card_blackreach: "The deepest named place before naming stops working. Pressure does the arguing here, and it always wins. The Trench Maw hunts above it; even the Maw does not go in.",
  card_fallenstar: "A star that fell from Requiem's last night and never stopped falling — it just changed what it was falling through. It still burns down there, a heresy of light in the lightless, and half the deep worships it while the other half waits for it to go out.",
  card_trenchmaw: "The charts call it a depth; the sailors call it a mouth. They are both right. It was the first thing to taste Requiem's debris, and it has been restless ever since — some endings are seasoning.",
  card_leviathan: "The floor of the drowned dimension is not stone. It is the Sleeping Leviathan, older than the drain it sleeps in, and every tide in every world is its breath. The Vigil's true nightmare is simple arithmetic: Requiem's ending was loud, and the Leviathan has been sleeping more lightly since.",
  card_hollowtide: "Once an age, the sea exhales instead of inhaling — and a coastline somewhere stops existing. The Hollow Tide is not a wave; it is the Leviathan turning over. The Covenant keeps a standing clause about it that no one has ever managed to enforce.",

  // ── RONIN ──
  card_duskduel: "Godhood's road has tollgates, and they look like this: two masters, one dusk, no audience. The winner takes one step past being human. The loser takes the field's respect. Both leave lighter.",
  card_templebell: "Struck once when a master refuses a throne. It has rung eight hundred times. The bell's note travels between dimensions — the Vigil logs each toll, and the Covenant stamps each refusal as a valid step toward godhood.",
  card_nightcomet: "A comet crossed the pass the night the first ronin finished the walk to godhood. The mortal dimension keeps the comet's schedule like scripture: it returns when someone is close.",
  card_thousandcut: "A style with no decisive blow — a thousand small ones, all counted. Its founder reasoned that godhood taken in one cut would break a human; taken in a thousand, it seeps in gently. The Wheel in Requiem is said to have learned adaptation from watching her fight.",
  card_onimask: "He wore one mask to frighten bandits. The other ninety-nine came on their own — one for each step of the road he refused to finish. The masks are the faces of the god he declined to become, all of them still waiting.",
  card_lastretainer: "His house fell, his lord died, his gate leads nowhere — and he stands it anyway. The dimensions argue about whether loyalty without an object is madness or the purest step toward godhood ever taken. The gate has started to glow. Nobody has told him.",
  card_lastronin: "No lord remains to serve, and still the blade is drawn at dawn — the final human on the god-road, walking it alone because everyone else arrived or gave up. His ascension keeps almost happening. He keeps declining, one more dawn at a time. The road has begun to worship HIM.",
  card_swordsaint: "He drew once, at dawn, and the duel had ended by breakfast — the first human to finish the road. What crossed into godhood kept the shape of a swordsman out of courtesy. The Temple Bell cracked announcing him. The Pantheon's Unohana is said to have smiled, once, hearing his name.",

  // ── VIGIL ──
  card_sleeplessone: "It volunteered to never sleep so the border-watch would have one pair of eyes with no gap in it. Blinks on a schedule of its own choosing — once a year, on the anniversary of Requiem's ending, out of respect.",
  card_coldvigil: "The high station, above the weather of every dimension at once. Waiting, at altitude, without complaint — the Vigil's entire creed in one posture. From up there you can see the hole where Requiem used to be.",
  card_lampofhours: "It burns down exactly as fast as it is needed — hours, years, ages. The Vigil trimmed it once to Requiem's length, and it has refused to be trimmed since. Lamps learn.",
  card_longmorrow: "The thing the whole Vigil dimension is FOR. It arrives; it has always been going to arrive — the next ending, the one after Requiem's, already on the road. The Long Morrow is not a threat. It is a date. The lamps exist so that this time, someone will be awake for it.",

  // ── SUCCOUR ──
  card_deepsalve: "Closes what the field salve only quiets. Brewed from water carried up OUT of the Abyssal — the only export the drowned dimension ever allowed, and only to Succour, because even the deep respects the ones who chose mending.",
  card_bulwark: "A door is only a wall that changed its mind. Succour builds no weapons, so its masons learned to make walls that decide — the same craft the Covenant borrowed for its own doors between worlds.",
  card_warcry: "Succour's one loud thing: not a plan, a promise, shouted. The dimension that refused killing still knows how to make its people stand up straighter — and lends the cry to any record that fights for something worth keeping alive.",
  card_tidecall: "The water remembers everyone who stood in it — a Succour rite borrowed from the Abyssal's memory. The healers call the tide, and the tide returns a little of what everyone has lost.",
  card_communion: "Everyone stands a little straighter, and nobody says why. The quiet communion is Succour's answer to every war council in every dimension: no orders, no banners — just the certainty of being tended.",
  card_ironvow: "Spoken once, and the next blow simply declines to land. The vow is iron because a Succour smith forged exactly one thing in the dimension's whole history — a promise — and then put the hammer down forever.",
  card_gravebloom: "It only grows where something ended. Succour planted it across Requiem's grave, and the bloom learned resurrection from the soil. Every revival any record performs traces back to seeds from that one terrible garden.",
  card_secondwind: "The dead are only the resting, if you argue well enough — and Second Wind is Succour's best argument. The Covenant certified it reluctantly; Arise studied it jealously. It remains the gentlest power in the Archive: not a command to the dead, an invitation.",

  // ── REQUIEM · the first movement ──
  card_blacksun: "It rose black over the cathedral on the last morning, and what it shed was not light. The Sun That Bleeds was Requiem's own star, wounded by something no record survived to name. Its eclipse is the first bar of the requiem.",
  card_crowfeast: "They circle nothing, and they are very patient about it. The crows are the dimension's memory scavengers — every secret Requiem's dead took with them, the crows keep. The Archive has tried to buy from them. They do not sell.",
  card_redmoon: "The steps are bone because everyone who climbed them stayed. The Rite of the Red Moon was Requiem's last attempt to bargain its way out of ending — a bleeding of the whole moon. It bought one extra night. Some say that night is the one What Woke Up woke in.",
  card_palepilgrim: "Winter follows him at a respectful distance, in chains he forged himself. He was walking OUT of Requiem when it ended, and so became the only pilgrim whose destination died behind him. He walks the other dimensions now, and the cold walks after.",
  card_monarch: "Every hand that ever held it is still holding it. The Sword That Remembers is Requiem's royalty — not the kings, the BLADE they all swore on. When it fights, the dead grip tightens. The Ronin dimension reveres it; their whole god-road is an apology to swords like this one.",
  card_grin: "You do not find it. It notices you. The Grin was in Requiem before the ending, and the uncomfortable consensus is that it is the only resident who enjoyed the show. It terrorizes the living not from malice but from habit — applause, of a kind.",
  card_drownedgate: "The shrine went under mid-prayer, and the water finished it. The Drowned Gate is where Requiem's flood met the Abyssal's hunger — a door standing open at the bottom of both dimensions at once. The Sunken Door of Mythos was forged deliberately in its image.",

  // ── REQUIEM · the second movement ──
  card_awakening: "The lightning did not strike him. It answered. What Woke Up is the first thing to open its eyes AFTER the ending — proof that Requiem's night, somehow, had a morning. The Vigil finds this more frightening than the ending itself.",
  card_shattered: "Every promise breaks the same way: all at once. The Shattered Oath is the treaty that was supposed to prevent the ending, wearing the shape of the knight who broke it. He shatters protections now because he cannot stop rehearsing.",
  card_unchained: "They measured the shackles for someone who agreed to wear them — Requiem's willing prisoner, bound so the ending would have one being it could not touch. It worked. He walked out of the ruins unmarked, dragging the broken links, and no chain has held anything near him since.",
  card_vessel: "It knocked. He answered. Neither will say who invited whom. The Willing Vessel carried something OUT of Requiem as it fell — and whatever rides in him pays rent in power. The Covenant has an open file on the arrangement, and it stays open.",
  card_wheel: "Whatever you bring, bring it once. It learns. The Turning Wheel was Requiem's engine of seasons; with no seasons left to turn, it turned to adaptation. It is the only piece of the dead dimension still doing its job — just with a new definition of the job.",
  card_ashgarden: "The shrine burned for three days, and he tended nothing else. The Ash Garden is grief made into groundskeeping — a keeper burning what remains so that what remains stays warm. Succour's gravebloom grows at the garden's edge. He waters it.",
  card_floodwalker: "The tide came in red, and did not go out again. He Who Walks the Flood strode out of Requiem's last water carrying it with him, ankle-deep in an ending. Where he walks, the flood remembers being a weapon.",

  // ── COVENANT ──
  card_ophanim: "The wheel of eyes at the highest desk of the crossing-house. Divine judgment, in the Covenant, is clerical: every blow struck through its jurisdiction is weighed, and the exact change is returned. It audited Requiem's ending. The report is sealed.",
  card_seraphim: "Six wings, and every one of them a mercy. The Seraphim signs the healing-clauses — the treaty right that lets Succour's people work across every border. Its blessing is not kindness; it is POLICY, enforced at 50% of everything you have lost.",
  card_deviltrade: "The low desk. The long line. The terms are always fair — half of what you are, for more than you were — and the fine print is legible, which is the cruelest part. Every synthesis the machine performs routes one signature through his office. He initials them all personally.",
  card_rockscissors: "The oldest game in the customs house, played when two crossings claim the same door. Stone hands cannot be cut; the waiting hand decides. The angels find it undignified. The Devil finds it hilarious. The rules find it binding.",
  card_mirror: "Every border crossing walks past the Mirror, and the Mirror keeps a percentage. It gives back everything you offer, plus interest, minus a little of yourself. Nobody knows which desk it reports to. The uncomfortable answer is: neither desk knows either.",
  card_arise: "The word stamped on every resurrection permit — and the being that IS the word. When the dead cross back into any dimension, they cross through Arise. It learned generosity from Second Wind and scale from Requiem: why raise one, it asked, when everyone is entitled to return?",

  // ── MYTHOS ──
  myth_lockedblade: "First fusion: the Gate's refusal welded to the Ronin's drawn steel. The Locked Blade is a sword that is also a door that is also a NO — it cuts what cannot be opened because, being both, it never had to choose. Nothing stays sheathed around it, including itself.",
  myth_seagate: "The Gate & The Key drowned in the Leviathan's patience. The Sunken Door stands open at the bottom of everything, built deliberately in the Drowned Gate's image — the machine flattering Requiem's ruin. Nothing passes through, because nothing dares. The water holds its breath.",
  myth_hourdoor: "A door hinged on the Long Morrow's schedule. Knock once: it opens on the day you cannot avoid. The Vigil filed a formal protest at its creation — appointments with the inevitable were supposed to be THEIRS to keep.",
  myth_doordream: "The Outer God's indifference poured through the Gate's shape. The Door That Dreams does not lead anywhere; it imagines where you arrive, and reality — embarrassed — agrees. The fallen return through it because it dreams them unfallen.",
  myth_leviathansaint: "The Sword Saint's finished godhood sunk into the deep's oldest vow. The Saint Below took its oath at the bottom of the drowned dimension, and the deep keeps vows. Its judgment fells the weakest, without a roll, because the deep has never once needed to argue.",
  myth_endronin: "The Last Ronin fused with the Long Morrow — the man who refuses arrival, welded to the arrival itself. The Ronin at the End of Time draws his blade at every dawn that will ever come, simultaneously. His ascension is no longer pending. It is PERPETUAL.",
  myth_bladebeyond: "The Blade Beyond is what happens when the Outer God's vastness is given the Last Ronin's discipline. Drawn somewhere outside the sky, the cut arrives before the sword — every enemy at once, because from out there, they are all standing in the same place.",
  myth_tideofages: "The Leviathan's breath fused with the Morrow's patience. The Tide of Ages comes in once an era and takes the era with it — the ONLY power in the Archive that drinks health from everything at once. The Vigil marks its schedule in a book they keep chained.",
  myth_drownedgod: "The Outer God, drowned. Or the deep, ascended. The machine will not say which way the fusion ran, and the Drowned God wears the water like the answer doesn't matter. What lands on it comes back wet and regretful — the abyss returning to sender.",
  myth_lasttomorrow: "The Outer God's indifference given the Morrow's calendar. After the Last Tomorrow, the schedule simply stops arguing. It is the machine's most feared record — the Vigil believes it is a REHEARSAL, wearing a card's shape, for the ending they keep watch against.",

  // ── PANTHEON ──
  myth_gojo: "He was not synthesized. The machine reached across the veil for material and he took hold of it from the other side, curious. Throughout heaven and earth — his heaven, his earth, wherever those were — he alone was the honored one, and the title crossed with him. Infinity Void is not a domain; it is his patience, given walls. The flooded mind that cannot act is simply what standing near him costs.",
  myth_sukuna: "The machine's second overreach. Something with four arms and an appetite noticed the door and used it. The King of Curses does not grant domains — he grants ENDINGS, and Malevolent Shrine needs no walls because a butcher's block doesn't either. The Covenant's file on him is one page: containment impractical. Courtesy advised.",
  myth_unohana: "The third crossing came voluntarily — the first Kenpachi, the oldest killer of her world, who put down slaughter to learn mending and mastered both. Requiem's dead call Minazuki the kindest blade that ever drank a battlefield: every fallen ally stands, because she has decided the fight is not finished being interesting. Succour reveres her. Succour is also, sensibly, terrified of her.",
};
