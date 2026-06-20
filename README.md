# Saga — AI Storyteller

Turn any book or story into a full audio-visual experience — AI-written scripts, lifelike voiceovers, images, and videos — in minutes.

## What You Can Do

**Saga Mode — Book Summaries**
- Enter any book title → AI finds and verifies it
- Choose length (750–2500 words) and language (English / Hinglish)
- AI generates a script + YouTube title, description, and hashtags
- Pick a voice, generate audio, adjust playback speed
- Open Video Studio to composite audio + images into a downloadable video

**Story Studio — Original Scripts**
- Write or paste your own story using `[Scene: ...]` and `(tone)` markers
- AI generates audio, visuals, and metadata in one step

**Voice Options**
5 AI voices across male/female styles, with adjustable playback speed.

**Visuals**
Generate YouTube thumbnails, concept art, or book covers for any scene.

## Getting Started

1. Get a free API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Open terminal in the project folder and run:

```
npm install
npm run dev
```

3. Open **http://localhost:3002** in your browser
4. On first launch, paste your API key and select a model in the setup screen

Everything runs in your browser — no server or database needed.

## Deploying

Run `npm run build`, then upload the `dist` folder to Vercel, Netlify, Cloudflare Pages, or any static host.

> Restrict your API key by HTTP referrer in [Google AI Studio settings](https://aistudio.google.com/app/apikey) for safety.

## Project Files

```
├── index.html         # App shell
├── index.tsx          # All app logic
├── index.css          # All styles
├── src/               # Tests
├── package.json
├── .env.example       # API key reference
├── FRD.md             # Detailed feature specs
└── LICENSE
```

Built with React, TypeScript, Vite, and Google Gemini.
