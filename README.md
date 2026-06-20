# Saga - AI Storyteller

Transform books and stories into immersive audio experiences with AI-generated scripts, visuals, and video.

## Current Status

**Alpha / Pre-release.** The application is functional as a single-page web app but has not been deployed to production. It currently runs only locally via `npm run dev`. No test suite, CI/CD, or automated build pipeline exists.

## Features Implemented

- **Two Create Modes:**
  - **Saga Mode** — Enter a book title/author; AI generates a full book summary script with YouTube metadata.
  - **Story Studio** — Paste or write an original script (with scene/SFX directions); AI generates audio and visuals.
- **Book Verification** — Looks up book title/author via Gemini to confirm the correct identity.
- **Customizable Script Generation** — Choose length (~750 to ~2500 words) and language style (English or Hinglish).
- **Text-to-Speech Audio** — Five AI voices (Puck, Charon, Kore, Fenrir, Zephyr) via Gemini TTS. Adjustable playback speed (0.8x–1.2x).
- **AI Image Generation** — Automatic generation of YouTube thumbnail, 16:9 concept art, and vertical book cover using Gemini image models.
- **YouTube Metadata Generator** — Generates a formatted video title, description, and hashtags for YouTube uploads.
- **Video Studio** — Canvas-based video preview with background art, book cover overlay, text overlays, and audio-driven video recording/export (WebM).
- **Audio Player** — Sticky bottom player for generated audio with download (WAV).
- **Manual Edits** — Regenerate or edit individual images via text prompts.

## Tech Stack

| Layer | Technology |
|---|---|
| **Language** | TypeScript 5.8 |
| **Framework** | React 19 |
| **Build Tool** | Vite 6 |
| **AI SDK** | `@google/genai` (Gemini API) |
| **Styling** | Plain CSS (no framework) |
| **Audio/Video** | Web Audio API, Canvas API, MediaRecorder API |

## Folder Structure

```
├── index.html          # HTML entry point (with importmap fallback)
├── index.tsx           # Entire application source (~1715 lines)
├── index.css           # All styles (~1049 lines)
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
├── vite.config.ts      # Vite configuration + env loading
├── metadata.json       # Google AI Studio metadata (auto-generated)
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

## How to Run Locally

**Prerequisites:** Node.js 18+

```bash
# 1. Install dependencies
npm install

# 2. Create environment file
echo "GEMINI_API_KEY=your_key_here" > .env.local

# 3. Start development server
npm run dev
```

The app starts at **http://localhost:3000**.

Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).

## Available Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `vite` | Start development server on port 3000 |
| `build` | `vite build` | Production build to `dist/` |
| `preview` | `vite preview` | Preview production build locally |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google Gemini API key used for all AI operations |

The variable is loaded by Vite from `.env.local` (or `.env`) and injected via `process.env` at build time.

## Application Flow

1. **Saga Mode:** Enter book name (+ optional author) → Click "Find Book" (AI verification) → Click "Generate Script" → AI produces script + metadata → Click "Generate Audio" → TTS audio is created → AI generates visuals → "Open Video Studio" to produce a video.
2. **Story Studio:** Paste script with scene/SFX notation → Click "Generate Audio Story" → AI generates metadata + audio + visuals in one step.
3. **Video Studio:** Canvas preview with background image, optional book cover overlay, and text on screen. Controls for regenerating art, uploading custom images, adjusting text sizes, and recording a video (WebM).

## Important Files

| File | Lines | Purpose |
|---|---|---|
| `index.tsx` | 1715 | All React components, state, API calls, and utilities |
| `index.css` | 1049 | All styling |
| `vite.config.ts` | 23 | Build config with env var injection and React plugin |
| `package.json` | 22 | Dependencies and scripts |

## Known Issues / Gaps

1. **Monolithic code** — All 1715 lines of application logic are in a single `index.tsx` file with no component separation.
2. **No tests** — Zero test files, no testing framework configured.
3. **No error boundaries** — Runtime errors crash the app.
4. **Hardcoded models** — Gemini model names like `gemini-2.5-flash`, `gemini-2.5-flash-image`, and `gemini-2.5-flash-preview-tts` are hardcoded.
5. **Importmap duplication** — `index.html` uses both an importmap (for CDN fallback) and the Vite bundler, which may cause conflicts.
6. **No loading skeleton** — Only simple text/spinner loaders.
7. **No accessibility** — Missing ARIA labels, keyboard navigation gaps.
8. **No mobile optimization** — CSS has basic responsive breakpoints but is desktop-first.
9. **No backend** — Everything runs client-side; API keys are exposed in the client bundle.
10. **No lock file** — `package-lock.json` or equivalent is not committed, causing non-reproducible installs.

## Recommended Next Steps

1. Split `index.tsx` into separate components and hooks.
2. Add a `.env.example` file.
3. Add a testing framework (Vitest) and write unit/integration tests.
4. Add error boundaries for critical sections.
5. Move Gemini model names to a config file.
6. Remove duplicate `<script>` tags in `index.html`.
7. Configure linter (ESLint) and formatter (Prettier).
8. Add accessibility (ARIA labels, keyboard support).
9. Generate `package-lock.json` and commit it.
10. Consider a lightweight backend proxy for the Gemini API to protect the API key.
