# Guild Raid Boss — Design Spec v1 (2026-08-10)

An asynchronous co-op world boss for the Arise Cards system. One boss per week, per guild.
Everyone's damage counts. The enemy is the game, not another player.
(Styled read: the published artifact "Guild Raid Boss — Design Spec".)

## 1 · Pillars
1. **Positive-sum.** Duels are zero-sum; a raid has no losing player. Weak collections still contribute; failure ("escaped at 91%") is a story, not a humiliation.
2. **The platform feeds the game.** Attacks are the daily faucet; the third attack costs AP, which comes from watching/reading.
3. **Collection depth matters.** Weekly affinities + card fatigue mean the right answer changes weekly and no 3 cards carry a week.
4. **Assembly, not invention.** Rides DGN_STATS, injury flags, guild coins/XP, shards, the gems ISO-week rollover, limited-drop cosmetics. No new currency, no cron, no realtime.

## 2 · Core loop
- **Daily (~3 min):** 2 free attacks; squad of 3 healthy, unfatigued cards; server resolves; battle report. 3rd attack = **Rally**, 150 AP.
- **Weekly (Mon 00:00 UTC):** boss dies → guild loot + ranks; survives → **escapes**, consolation scales with closeness. New boss + gimmick.
- **Season (8 weeks):** clear ≥7 → guild banner cosmetic + limited **Worldbreaker** title (members with ≥5 gated weeks). Reset.

## 3 · The boss
- **Lazy spawn, no cron:** first `GET /api/raid` of a new ISO week creates the week's `RaidBoss` (unique on `week`, race-safe) and each guild's `RaidEncounter` on first look. REUSE the gems `weekKey()` Thursday-rule math.
- **Identity:** themed on a catalog series; defined in `src/data/raidBosses.ts` `{slug, name, series, art, gimmick, flavor}` — shop-catalog pattern. Boss art owner-supplied (flag signatures per the art-provenance rule); `public/raid/`.
- **Season 1 gimmicks (one per week):**
  1. Opening Ceremony — none (calibrates D_avg)
  2. Underdog's Hour — SR-and-below ×1.6
  3. Mirror Match — affinity doubled (×2.0)
  4. Iron Hide — all damage ×0.7, kill rewards +50%
  5. Glass Cannon — damage ×1.4, injury chance doubled
  6. Collector's Pride — +4% per distinct series used this week (cap +40%)
  7. Twilight of Legends — Legendary & Mythos ×1.5
  8. The Finale — HP +25%, all rewards doubled
- **HP sizing (participation, never level):**
  `HP = ceil(M_active × 14 × D_avg × 0.85)`
  - `M_active` = members who attacked ≥1× LAST week, clamped [5, 40]
  - `14` = free attacks/member/week; Rallies are surplus (excluded on purpose)
  - `D_avg` = guild's median attack damage last week (cold start 900)
  - `0.85` = ~15% margin for equal effort; target 55–65% clear rate across guilds; retune after 2 live weeks.
  - Guild **level scales loot (+5%/level, cap +100%), never HP**.

## 4 · Attacks & damage
Rules: 2 free/UTC-day (+1 Rally, 150 AP server-priced, max 1/day; hard cap 3/day, 21/week). Squad = exactly 3 owned cards, not `dgnInjured`/`dgnDead`. **Fatigue:** a card appears in max 1 attack per UTC day (3 attacks/day needs 9 healthy cards).

```
damage = Σ over 3 cards:
  Base(card)        = DGN_STATS atk + hp/10          [VERIFY exact field names]
  × RarityMult      = C 1.0 · R 1.2 · SR 1.5 · SSR 2.0 · Legendary 3.0 · Mythos 4.5
  × ConditionMult   = Fresh Build 1.15 · Factory 1.0 · Rusted 0.90
  × AffinityMult    = 1.5 if card.series == boss.series
  × GimmickMult     = per week
× Variance          = 0.92–1.08 seeded from attack id (deterministic, auditable, no reroll-by-retry)
```
Worked example (Mirror Match, boss=Solo Leveling): Igris Legendary Fresh SL 220×3.0×1.15×2.0=1,518; SSR SL 150×2.0×2.0=600; off-series SSR 160×2.0=320 → 2,438 × 1.03 ≈ **2,511**.
Sanity: cold-start 20-active guild ≈ 214k HP vs 20×14×900 ≈ 252k free-attack output.

**Battle report** (the response IS the fun): per-card multiplier lines, HP before/after, injuries rolled, projected clear day. Screenshot-friendly.

## 5 · Injuries & fatigue
- 7% injury/card/attack (4% Fresh Build; doubled on Glass Cannon week). Sets the existing `dgnInjured` — blocks raids AND dungeon dispatch. Healing = existing revive-scaling rules [VERIFY dungeon heal endpoint; reuse verbatim].
- Raids never set `dgnDead` (death remains a dungeon/PMD∞ decision).
- Expected: ~4–5 injuries/week for a fully active member → bench-depth pressure (the honest pull-a-pack motive).

## 6 · Rewards & economy
**Gate:** weekly rewards need ≥3 attacks in that guild that week.
| Outcome | Who | Reward |
|---|---|---|
| Kill | every gated member | 400 AP + 25 shards |
| Kill | ≥15 attacks | +150 AP consistency bonus |
| Kill | top 3 damage | +40/25/15 shards + week-long "Raid MVP · W##" profile chip |
| Kill | guild | 1,500 guild coins + guild XP [VERIFY teammate's guild schema] |
| Escape ≥90% | gated members | 40% payouts + rank chips |
| Escape <90% | gated members | 25% payouts |
| Season ≥7/8 | guild + ≥5-gated-week members | banner cosmetic + limited title via limited-drop machinery |

Flow audit (per active member/week): faucet ≈330 AP (weighted), Rally sink ≈450 if used daily, shards +20–40 (feeds forge), injury→pulls = healthy unbounded sink. Net AP-neutral-to-negative for engaged players.

## 7 · Abuse & edge cases
- **Hard JWT** on attack/rally (changeUsername treatment — these mint value). Client sends card IDs + nonce ONLY; everything else server-derived.
- **Idempotency:** unique `nonce`; replays return the original report.
- **Atomic HP:** transaction, floor 0, `killedAt` set once; post-death attacks 409 politely.
- **Guild-hop:** attacks bind to guild-at-attack-time; gate is per-guild-per-week; season needs ≥5 gated weeks in the SAME guild.
- **Alts** raise next week's M_active HP — self-defeating; invite gate covers the rest.
- **Rollover races:** UTC boundaries (gems-consistent); straddling attacks resolve against the encounter in their transaction.
- **Sold cards:** fatigue/injury live on UserCard and travel; [VERIFY] whether raid fatigue needs marketplace escrow (recommend: no — expires daily).
- **Guildless:** join-a-guild CTA (no mercenary mode in v1).

## 8 · Data model (additive only — safe for `db push`)
```prisma
model RaidSeason { id String @id @default(uuid()); index Int @unique; startWeek String; titleName String; bosses RaidBoss[] }
model RaidBoss   { id String @id @default(uuid()); week String @unique; slug String; seasonId String;
                   season RaidSeason @relation(fields:[seasonId], references:[id]); encounters RaidEncounter[] }
model RaidEncounter { id String @id @default(uuid()); bossId String; guildId String /* [VERIFY] Guild @id type */;
                   hpMax Int; hpLeft Int; killedAt DateTime?; rewarded Boolean @default(false);
                   boss RaidBoss @relation(fields:[bossId], references:[id]); attacks RaidAttack[];
                   @@unique([bossId, guildId]) }
model RaidAttack { id String @id @default(uuid()); encounterId String; userId String; day String;
                   squad Json; damage Int; isRally Boolean @default(false); nonce String @unique;
                   createdAt DateTime @default(now());
                   encounter RaidEncounter @relation(fields:[encounterId], references:[id]);
                   @@index([encounterId, userId, day]); @@index([userId, day]) }
```
Fatigue needs no table: scan the user's ≤3 daily attack rows' `squad` JSON.

## 9 · API (`/api/raid`)
- `GET /api/raid` (soft auth) — lazy spawn + boss/gimmick, HP, my attacks today, eligibility summary, guild ranking, pace. **Also settles last week's unrewarded encounters** (lazy, cron-free, `rewarded=true` transactionally).
- `POST /api/raid/attack` (**hard JWT**) — `{squadCardIds[3], nonce}` → validate membership/ownership/health/fatigue/caps → resolve → injuries → battle report.
- `POST /api/raid/rally` (**hard JWT**) — debit 150 AP (pointLog row), unlock attack #3; 409 on repeat/insufficient.
- `GET /api/raid/leaderboard` — guilds by **% damage** (fair across sizes) + kill times.
- `GET /api/raid/history?guildId` — season record.

## 10 · Frontend
- **`/raid`** (Lunar kit): full-bleed boss hero (name in display serif, series word in italic crimson), gimmick in one sentence, huge animating HP bar; attack slots; squad picker reusing dungeon roster components (injured greyed, fatigued "resting"); guild board; gems-style countdown chip.
- **Battle report modal**: sequenced multiplier lines, PackReveal-adjacent drama, framer-only (Performance Mode safe).
- **Guild page hook**: encounter card (art thumb, HP, "dealt 61%") → /raid. [VERIFY insertion point in teammate's guild page.]
- **Entry points**: hub tile with boss thumb + Dock sheet row. Killed state shows carcass + kill time + MVPs + next-boss countdown.

## 11 · Build plan (backend-first; live-probe verification per no-local-build)
1. **Skeleton:** models, raidBosses.ts (8 entries, placeholder art), lazy spawn, GET, attack+formula+injuries, rally, settlement. Prove via curl: spawn, attack, replay nonce, hand-check math.
2. **The page:** /raid hero+picker+report+boards, hub tile, dock row. Prove: owner attacks with real collection.
3. **The week:** payouts visible, escape state, leaderboard, guild hook. Prove: dev boss with tiny HP, full kill→payout cycle.
4. **The season:** record, banner, title via limited-drop machinery, real art.

## 12 · Open decisions (recommended defaults marked)
1. Boss art — owner-supplied; **ship 1–3 with placeholders**, art by phase 4.
2. Rally price — **150 AP**; retune after week 2.
3. Guildless — **excluded in v1** (join CTA); mercenary lobby is v2.
4. Mythos raid passive — **no in v1** (×4.5 already honors them).
5. Season length/title — **8 weeks; name each season's title after its finale boss**.
6. Shared injury pool with dungeon — **yes** (one body per card).
