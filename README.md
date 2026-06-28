# Da Vinci (Anime Tracker)

**Da Vinci** is a clean, modern, and legally compliant anime information tracker built with Next.js, TypeScript, and Tailwind CSS. It focuses entirely on discovery, scheduling, and personal status tracking, without engaging in piracy, scraping, or illegal video streaming.

## Features

- **Live AniList GraphQL Data**: Fetches highly accurate metadata directly from the official AniList API.
- **Airing Calendar**: Tracks exact airing times and countdowns for currently releasing seasonal anime.
- **Local Storage Tracker**: Keeps track of your personal lists (Interested, Watching, Waiting, Finished, Dropped) securely within your browser's `localStorage` via a custom React hook (`useAnimeStatus`).
- **Cinematic UI**: Netflix-inspired dark mode UI with glassmorphism, horizontal smooth-scroll carousels, and dynamic badging.
- **Advanced Search**: Utilizes GraphQL search queries to filter by Status, Season, and Title.

## Important Note
This application **does not stream anime**. It is an educational tool demonstrating how to build a high-quality frontend tracker using Next.js caching (`next: { revalidate: 3600 }`) and external GraphQL endpoints legally. There are no video players, and no third-party websites are scraped.

## Tech Stack
- Next.js (App Router, Server Components)
- React 19
- TypeScript
- Tailwind CSS 4
- Framer Motion (Micro-animations)
- Lucide React (Icons)
- AniList API v2

## Getting Started

1. Clone the repository.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open [http://localhost:3000](http://localhost:3000) to view the application.
