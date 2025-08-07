# Channel3 AI Try-On Demo

A minimal Next.js app that lets users search products via Channel3, capture a webcam photo, and generate an AI try-on image via Glam AI. Images are uploaded to Cloudflare Images; the app is deployed to Cloudflare Workers using OpenNext.

## Features

- Product search using `channel3-sdk`
- In-browser camera capture
- Try-on generation via Glam AI
- Image upload to Cloudflare Images
- Deployable to Cloudflare Workers with OpenNext

## Tech Stack

- Next.js App Router (React 19)
- Tailwind CSS (v4)
- Cloudflare Workers + OpenNext

## Prerequisites

- Node.js 18+
- Cloudflare account with Images enabled
- API keys for Channel3 and Glam AI

## Environment Variables

Create a `.env.local` (for local dev) or configure env vars in Cloudflare.

Required:

- `CHANNEL3_API_KEY` — Channel3 API key
- `GLAM_AI_API_KEY` — Glam AI API key
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID
- `CLOUDFLARE_IMAGES_API_TOKEN` — API token with Cloudflare Images write access

Optional (fallback when Cloudflare Images response has no variants):

- `CLOUDFLARE_IMAGES_ACCOUNT_HASH` — Images delivery account hash for constructing delivery URLs

See `.env.example` for a template.

## Local Development

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Build

```bash
npm run build
npm start
```

## Deploy to Cloudflare Workers (OpenNext)

This project is configured for OpenNext on Cloudflare Workers.

- Preview (ephemeral):

```bash
npm run preview
```

- Deploy (production):

```bash
npm run deploy
```

Ensure you have configured your Cloudflare account and secrets (e.g., via `wrangler secret put`) for the required variables above.

## How It Works

- `app/api/search/route.ts`: Wraps Channel3 search
- `app/api/upload/route.ts`: Direct upload to Cloudflare Images
- `app/api/tryon/route.ts`: Calls Glam AI try-on and normalizes response
- `app/api/tryon-status/route.ts`: Polls Glam AI event status and normalizes response
- `app/page.tsx`: UI workflow (search → capture → try-on)

## Notes

- The API layer normalizes 3rd-party responses to camelCase fields: `eventId`, `mediaUrls`, `outputImage`.
- The UI expects those normalized fields.

## License

MIT
