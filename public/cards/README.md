# Custom card art

Drop an image here named exactly after the card id and it replaces that card's
procedural art. Anything without a file here keeps the drawn art, so this
directory is always safe to add to and safe to leave empty.

    public/cards/card_outergod.png   ->  The Outer God

## The eight legendaries

| File name              | Card                    | Set       |
|------------------------|-------------------------|-----------|
| `card_outergod.png`    | The Outer God           | Ascension |
| `card_gatekey.png`     | The Gate & The Key      | Ascension |
| `card_leviathan.png`   | The Sleeping Leviathan  | Abyssal   |
| `card_hollowtide.png`  | Hollow Tide             | Abyssal   |
| `card_lastronin.png`   | The Last Ronin          | Ronin     |
| `card_swordsaint.png`  | The Sword Saint         | Ronin     |
| `card_secondwind.png`  | Second Wind             | Succour   |
| `card_longmorrow.png`  | The Long Morrow         | Vigil     |

`.jpg` and `.webp` work too — the loader tries the id against each extension.

## Rules that matter

**Commit the files.** An image that exists on disk but was never `git add`ed
404s on Vercel and the card renders with a hole in it. This has already
happened once in this repo with the landing artwork.

**Portrait, roughly 5:7.** The art band is the top ~62% of the card, full
bleed. Anything squarer gets centre-cropped; anything much taller loses its
top and bottom. 700x980 or larger is ideal.

**Keep them small.** Twenty of these render at once on the collection page.
Aim under 300 KB each — a 4 MB PNG in a grid is felt immediately on a phone.

**Lowercase file names.** Vercel's filesystem is case-sensitive even though
Windows is not, so `Card_OuterGod.png` will work locally and 404 in production.
