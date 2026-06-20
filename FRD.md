# Functional Requirements Document: Saga — AI Storyteller

**Version:** 1.0
**Date:** 2026-06-20
**Status:** Draft

---

## 1. Overview

Saga is a browser-based AI storytelling application that transforms book titles or original scripts into immersive audio-visual content. It uses Google's Gemini AI models for text generation, text-to-speech, and image creation, then composites the results into a downloadable video.

### 1.1 Product Vision

Enable anyone to create professional-quality book summary videos and audio stories with zero editing skills, using AI to handle scriptwriting, voiceover, visuals, and video assembly.

### 1.2 Target Users

- **Content creators** making book summary videos for YouTube
- **Podcasters** needing narrated scripts with visual assets
- **Storytellers** wanting to convert written stories into audio experiences
- **Students/educators** creating educational content

### 1.3 Constraints

- Client-side only — no backend server
- Requires internet connection and Gemini API key
- All AI operations are subject to Gemini API rate limits and quotas
- Generated content quality depends on AI model capabilities

---

## 2. Functional Requirements

### FR-1: Application Modes

| ID | Requirement | Priority |
|---|---|---|
| FR-1.1 | The app shall provide two creation modes: **Saga Mode** (book summary) and **Story Studio** (original script) | P0 |
| FR-1.2 | A tab-based navigation shall allow switching between modes | P0 |
| FR-1.3 | Switching modes shall reset mode-specific state but preserve shared state (voice, speed, duration) | P2 |

### FR-2: Book Input & Verification (Saga Mode)

| ID | Requirement | Priority |
|---|---|---|
| FR-2.1 | User shall enter a book name (required) and author name (optional) | P0 |
| FR-2.2 | A "Find Book" button shall trigger AI-based book title/author verification | P0 |
| FR-2.3 | The system shall send a prompt to Gemini asking it to identify the correct full title and author | P0 |
| FR-2.4 | If the user provided an author name, the AI must prioritize finding a book by that author | P1 |
| FR-2.5 | A confirmation card shall display the found book details with "Generate Script" and "Change" actions | P0 |
| FR-2.6 | The system shall auto-populate the book name and author fields from the verification result | P1 |
| FR-2.7 | If verification fails, an error message shall be displayed | P1 |
| FR-2.8 | User shall be able to paste custom text content to summarize instead of AI-generating script | P1 |
| FR-2.9 | User shall be able to upload an audio file to bypass AI script generation entirely | P2 |

### FR-3: Script Generation

| ID | Requirement | Priority |
|---|---|---|
| FR-3.1 | The system shall generate a book summary script using Gemini AI | P0 |
| FR-3.2 | The generated script shall follow a structure: Hook → Core Concepts → Practical Application → Ending | P0 |
| FR-3.3 | The tone shall be energetic, engaging, and conversational | P1 |
| FR-3.4 | The script length shall be configurable: ~750, ~1250, ~1800, or ~2500 words | P0 |
| FR-3.5 | The output language shall be configurable: English or Hinglish (Hindi+English in Roman script) | P0 |
| FR-3.6 | The script must end with a recap and encouragement to read the book | P1 |
| FR-3.7 | The script shall not contain persuasive filler phrases ("Honestly", "Trust me", "Believe me") | P1 |
| FR-3.8 | The script shall not contain engagement calls-to-action ("Like", "Subscribe", "Share", "Comment") | P1 |
| FR-3.9 | A loading indicator shall be shown during generation | P0 |
| FR-3.10 | The generated script shall be displayed in an editable textarea | P0 |
| FR-3.11 | A word count badge shall be displayed next to the script | P1 |

### FR-4: Story Studio Mode

| ID | Requirement | Priority |
|---|---|---|
| FR-4.1 | User shall paste or write an original script with scene/SFX/narration notation | P0 |
| FR-4.2 | The script may use bracket notation for scene descriptions: `[Scene: description]` | P1 |
| FR-4.3 | The script may use parentheses for tone indicators: `(Whispering)` | P1 |
| FR-4.4 | The script may use colon-prefixed speaker labels: `Host: dialogue` | P1 |
| FR-4.5 | A "Generate Audio Story" button shall trigger script processing | P0 |
| FR-4.6 | Upon generation, the system shall: generate metadata, generate visuals, and generate audio | P0 |

### FR-5: YouTube Metadata Generation

| ID | Requirement | Priority |
|---|---|---|
| FR-5.1 | The system shall generate a YouTube video title, description, and hashtags | P0 |
| FR-5.2 | In Saga mode, the title format shall be: `"[Book Title] | Book Summary - [Short Tagline]"` | P1 |
| FR-5.3 | In Story mode, the title format shall be: `"[Creative Title] | Audio Story"` | P1 |
| FR-5.4 | The description shall use bullet points for key takeaways | P1 |
| FR-5.5 | Each metadata field shall have a "Copy" button for clipboard copying | P1 |
| FR-5.6 | A "Generate Metadata" button shall allow regenerating metadata independently | P2 |

### FR-6: Text-to-Speech Audio Generation

| ID | Requirement | Priority |
|---|---|---|
| FR-6.1 | The system shall convert script text to speech using Gemini TTS | P0 |
| FR-6.2 | Five AI voices shall be available: Puck, Charon, Kore, Fenrir, Zephyr | P0 |
| FR-6.3 | User shall preview a voice by playing a demo sentence | P1 |
| FR-6.4 | Playback speed shall be adjustable: 0.8x, 0.9x, 1.0x, 1.1x, 1.2x | P1 |
| FR-6.5 | Before TTS, the script text shall be cleaned: remove `[scene]` markers, `(tone)` markers, and `Speaker:` labels | P0 |
| FR-6.6 | Long scripts shall be split into chunks of ~2500 characters for processing | P0 |
| FR-6.7 | Audio chunks shall be assembled into a single WAV file at 24000 Hz sample rate | P0 |
| FR-6.8 | A progress indicator shall display chunk generation progress | P1 |
| FR-6.9 | The generated audio shall be playable via a sticky bottom audio player | P0 |
| FR-6.10 | The audio player shall provide native controls (play/pause, seek, volume) | P0 |
| FR-6.11 | A download button shall allow saving the audio as a WAV file | P0 |
| FR-6.12 | Audio regeneration shall be supported | P2 |

### FR-7: AI Image Generation

| ID | Requirement | Priority |
|---|---|---|
| FR-7.1 | The system shall generate a YouTube thumbnail image | P0 |
| FR-7.2 | The system shall generate a 16:9 concept art background image | P0 |
| FR-7.3 | In Saga mode, the system shall generate a vertical book cover image | P0 |
| FR-7.4 | Images shall be generated using Gemini's image model | P0 |
| FR-7.5 | Image generation shall use the book title/story title and script context as prompts | P1 |
| FR-7.6 | Each generated image shall have a download button | P1 |
| FR-7.7 | Each generated image shall have a "Regenerate" button | P1 |
| FR-7.8 | An input field below each image shall allow editing via a text prompt (Enter key triggers) | P2 |
| FR-7.9 | A "Regenerate All" button shall regenerate all visuals | P2 |
| FR-7.10 | A separate "Generate YouTube Thumbnails" feature shall produce two thumbnail variations | P2 |
| FR-7.11 | The thumbnail generator shall support inserting an uploaded image (e.g., book cover) as a composition element | P2 |
| FR-7.12 | Loading indicators shall be shown during image generation | P0 |

### FR-8: Video Studio

| ID | Requirement | Priority |
|---|---|---|
| FR-8.1 | A "Open Video Studio" button shall open a full-screen modal | P0 |
| FR-8.2 | The video studio shall display a canvas preview at 1280x720 resolution | P0 |
| FR-8.3 | In Saga mode, the canvas shall display: background image (dimmed + blurred), centered book cover with shadow, title text (top), tagline text (middle, amber color), and author text (bottom) | P0 |
| FR-8.4 | In Story mode, the canvas shall display: background image (dimmed) and title text (bottom) | P1 |
| FR-8.5 | The background image shall be the generated concept art | P0 |
| FR-8.6 | User shall upload custom background and overlay images | P1 |
| FR-8.7 | User shall regenerate background and overlay images via AI using a text prompt | P1 |
| FR-8.8 | User shall edit text overlays (title, tagline, author) and their font sizes | P1 |
| FR-8.9 | Audio playback shall be synchronized with canvas rendering | P0 |
| FR-8.10 | A "Preview" button shall play/pause audio with canvas | P0 |
| FR-8.11 | A "Render Video" button shall record the canvas + audio into a WebM video file | P0 |
| FR-8.12 | A "Silent Render" checkbox shall allow rendering without audio (muted) | P2 |
| FR-8.13 | A progress bar shall display during video rendering | P1 |
| FR-8.14 | A download link shall be provided after rendering completes | P0 |
| FR-8.15 | The video modal shall have a close button | P0 |

### FR-9: User Interface

| ID | Requirement | Priority |
|---|---|---|
| FR-9.1 | The app shall have a responsive two-column layout on desktop (input sidebar + output area) | P0 |
| FR-9.2 | The app shall have a single-column layout on mobile | P1 |
| FR-9.3 | A welcome placeholder shall be shown when no content exists | P0 |
| FR-9.4 | Error messages shall be displayed with a warning icon and red styling | P1 |
| FR-9.5 | A loading spinner shall be shown during asynchronous operations | P0 |
| FR-9.6 | The app shall have a sticky audio player at the bottom of the screen when audio is loaded | P0 |

---

## 3. Non-Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| NFR-1 | The app must work in modern Chrome, Firefox, Safari, and Edge browsers | P0 |
| NFR-2 | The app should load initial content within 3 seconds on a standard broadband connection | P1 |
| NFR-3 | The app must handle Gemini API errors gracefully with user-friendly messages | P1 |
| NFR-4 | Long operations (script generation, audio generation) must show progress indicators | P0 |
| NFR-5 | The UI must remain responsive during AI operations | P1 |
| NFR-6 | The app must not expose the Gemini API key in a way that allows unauthorized usage | P1 |
| NFR-7 | Generated files (audio, images, video) must use consistent naming convention | P2 |
| NFR-8 | The codebase must be maintainable with clear separation of concerns | P2 |

---

## 4. User Flows

### 4.1 Saga Mode Flow

```
Start → Enter book name + author → Click "Find Book"
  → AI verifies book → Confirmation card shown
  → Select length (750/1250/1800/2500) + language (English/Hinglish)
  → Click "Generate Script" → AI generates script + metadata
  → Edit script if needed → Select voice + speed
  → Click voice preview (optional) → Click "Generate Audio"
  → AI generates TTS audio → Sticky player appears
  → AI auto-generates visuals (thumbnail, concept art, cover)
  → Click "Open Video Studio" → Customize canvas
  → Click "Render Video" → Download WebM
```

### 4.2 Story Studio Flow

```
Start → Switch to "Story Studio" tab
  → Paste script with scene/SFX notation
  → Click "Generate Audio Story"
  → AI generates metadata + visuals + audio simultaneously
  → Edit/regenerate as needed → Open Video Studio → Render
```

### 4.3 Audio-Only Flow

```
Saga Mode → Upload audio file directly
  → Audio player appears → No script/visuals needed
```

---

## 5. Data Models

### 5.1 Application State (React useState)

| Field | Type | Default | Description |
|---|---|---|---|
| `activeTab` | `'saga' \| 'story'` | `'saga'` | Current mode |
| `bookName` | `string` | `''` | Book title input |
| `authorName` | `string` | `''` | Author name input |
| `inputText` | `string` | `''` | Custom text to summarize |
| `storyScript` | `string` | `''` | Story studio script input |
| `summary` | `string` | `''` | Generated/pasted script text |
| `videoTitle` | `string` | `''` | Generated YouTube title |
| `videoDescription` | `string` | `''` | Generated YouTube description |
| `hashtags` | `string` | `''` | Generated hashtags |
| `tagline` | `string` | `''` | Generated short tagline |
| `duration` | `string` | `'1250'` | Target script length |
| `language` | `string` | `'Hinglish'` | Output language |
| `voice` | `string` | `'Puck'` | TTS voice name |
| `playbackSpeed` | `number` | `1.0` | Audio playback speed |
| `audioUrl` | `string \| null` | `null` | Generated audio blob URL |
| `visuals` | `VisualsObject` | `{null, null, null}` | Generated images |
| `foundBook` | `{title, author} \| null` | `null` | Verified book identity |

### 5.2 Generated Outputs

| Asset | Format | Source |
|---|---|---|
| Script | Plain text | Gemini text generation |
| Audio | WAV (PCM16, 24000 Hz) | Gemini TTS |
| Thumbnail | PNG (data URL) | Gemini image generation |
| Concept Art | PNG (data URL) | Gemini image generation |
| Book Cover | PNG (data URL) | Gemini image generation |
| Video | WebM (VP9) | Canvas + MediaRecorder |

---

## 6. API Integrations

### 6.1 Google Gemini AI

| Operation | Model | Endpoint |
|---|---|---|
| Text generation (scripts, metadata) | `gemini-2.5-flash` | `GoogleGenAI.models.generateContent()` |
| Image generation | `gemini-2.5-flash-image` | `GoogleGenAI.models.generateContent()` |
| Text-to-Speech | `gemini-2.5-flash-preview-tts` | `GoogleGenAI.models.generateContent()` with `Modality.AUDIO` |

### 6.2 Browser APIs

| API | Purpose |
|---|---|
| Web Audio API | Audio chunk assembly, playback, and routing to MediaRecorder |
| Canvas API | Video frame rendering (background, overlay, text compositing) |
| MediaRecorder API | Video recording from canvas + audio stream |
| Clipboard API | Copy metadata fields |
| URL.createObjectURL | Blob URL creation for downloads |

---

## 7. Error Handling

| Scenario | Behavior |
|---|---|
| No API key | App loads but all AI operations fail with error message |
| API rate limit | Gemini returns error → displayed as error message |
| Network failure | API call throws → caught and displayed as error message |
| Invalid JSON from LLM | `safeJsonParse()` sanitizes and retries; throws if still invalid |
| Missing book name | Validation prevents script generation |
| Empty story script | Validation prevents story generation |
| Audio generation failure | Error message shown, audio URL stays null |
| Video rendering failure | Error caught during MediaRecorder lifecycle |

---

## 8. Future Considerations

| Feature | Description |
|---|---|
| User accounts | Save projects, access history |
| Backend API proxy | Protect API key, add usage tracking |
| Multi-language TTS | Beyond English/Hinglish |
| Custom voice cloning | Upload voice samples |
| Batch processing | Generate multiple scripts at once |
| Export formats | MP3 audio, MP4 video, PDF scripts |
| Template system | Pre-built script templates |
| Collaborative editing | Real-time multi-user script editing |
| Mobile app | Native iOS/Android wrappers |
| Analytics dashboard | Track API usage, popular books |
