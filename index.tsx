
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, Modality, Type } from "@google/genai";

// Gemini API instance (re-initialized when apiKey changes)
let ai: GoogleGenAI | null = null;

const MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "gemini-2.5-flash-image", label: "Gemini 2.5 Flash (Image)" },
  { id: "gemini-2.5-flash-preview-tts", label: "Gemini 2.5 Flash (TTS)" },
];

function initAI(apiKey: string) {
  ai = new GoogleGenAI({ apiKey });
}

// Load saved key from localStorage
const savedKey = localStorage.getItem("saga_api_key") || "";
const savedModel = localStorage.getItem("saga_model") || MODELS[0].id;
if (savedKey) initAI(savedKey);

const VOICES = ["Puck", "Charon", "Kore", "Fenrir", "Zephyr"];

const DURATIONS = [
  { label: "~750", value: "750" },
  { label: "~1250", value: "1250" },
  { label: "~1800", value: "1800" },
  { label: "~2500", value: "2500" },
];

const SPEEDS = [
  { label: "0.8x", value: 0.8 },
  { label: "0.9x", value: 0.9 },
  { label: "1.0x (Normal)", value: 1.0 },
  { label: "1.1x", value: 1.1 },
  { label: "1.2x", value: 1.2 },
];

// --- Utils ---

function getFileName(bookTitle: string, type: string) {
  const safeTitle = (bookTitle || "Untitled").replace(/[^a-zA-Z0-9]/g, '_');
  const date = new Date();
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0'); // January is 0!
  return `Saga_${safeTitle}_${type}_${dd}${mm}`;
}

function cleanJsonText(text: string): string {
  if (!text) return "{}";
  // Remove markdown code blocks if present
  let cleaned = text.replace(/```json/g, "").replace(/```/g, "");
  
  // Robustly find the JSON object boundaries
  const firstOpen = cleaned.indexOf('{');
  const lastClose = cleaned.lastIndexOf('}');
  
  if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
    cleaned = cleaned.substring(firstOpen, lastClose + 1);
  }
  
  return cleaned.trim();
}

function safeJsonParse(text: string) {
    const cleaned = cleanJsonText(text);
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        // Fallback: simple sanitization for unescaped control chars in strings
        // This handles cases where LLM puts real newlines inside string values
        let inString = false;
        let escaped = false;
        let sanitized = '';
        
        for (let i = 0; i < cleaned.length; i++) {
            const char = cleaned[i];
            if (char === '"' && !escaped) {
                inString = !inString;
                sanitized += char;
            } else if (inString && (char === '\n' || char === '\r' || char === '\t')) {
                 if (char === '\n') sanitized += '\\n';
                 else if (char === '\r') sanitized += '\\r';
                 else if (char === '\t') sanitized += '\\t';
            } else {
                 sanitized += char;
            }
            if (char === '\\' && !escaped) escaped = true;
            else escaped = false;
        }
        
        try {
            return JSON.parse(sanitized);
        } catch (e2) {
            console.error("Failed to parse JSON even after sanitization:", e2);
            throw e2; 
        }
    }
}

function splitText(text: string, maxChars: number = 2500): string[] {
  const chunks: string[] = [];
  let currentChunk = "";
  
  // Split by double newlines first to preserve paragraph structure
  const paragraphs = text.split(/\n\n+/);
  
  for (const para of paragraphs) {
    if ((currentChunk + para).length < maxChars) {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
    } else {
       if (currentChunk) {
         chunks.push(currentChunk);
         currentChunk = "";
       }
       
       if (para.length > maxChars) {
         // Split long paragraph by sentences if it exceeds limit alone
         const sentences = para.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [para];
         for (const sentence of sentences) {
            if ((currentChunk + sentence).length < maxChars) {
               currentChunk += (currentChunk ? " " : "") + sentence;
            } else {
               if (currentChunk) chunks.push(currentChunk);
               currentChunk = sentence;
            }
         }
       } else {
         currentChunk = para;
       }
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

// --- Audio Utils ---

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function pcm16ToWavBlob(pcmData: Uint8Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.length;
  const bufferSize = 44 + dataSize;
  
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);
  
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true); 
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); 
  view.setUint16(20, 1, true); 
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true); 
  
  const payload = new Uint8Array(buffer, 44);
  payload.set(pcmData);
  
  return new Blob([buffer], { type: "audio/wav" });
}

const Logo = () => (
  <svg width="56" height="56" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 12C10 10.8954 10.8954 10 12 10H24V38H12C10.8954 38 10 37.1046 10 36V12Z" fill="url(#paint0_linear)" />
    <path d="M24 10H36C37.1046 10 38 10.8954 38 12V24C38 24 38 28 34 28C30 28 30 32 26 32C24 32 24 38 24 38" stroke="url(#paint1_linear)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M38 18C38 18 42 18 42 22" stroke="#818CF8" strokeWidth="3" strokeLinecap="round"/>
    <path d="M38 14C38 14 45 14 45 20" stroke="#C7D2FE" strokeWidth="3" strokeLinecap="round"/>
    <defs>
      <linearGradient id="paint0_linear" x1="10" y1="10" x2="24" y2="38" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4F46E5"/>
        <stop offset="1" stopColor="#312E81"/>
      </linearGradient>
      <linearGradient id="paint1_linear" x1="24" y1="10" x2="38" y2="38" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4F46E5"/>
        <stop offset="1" stopColor="#EC4899"/>
      </linearGradient>
    </defs>
  </svg>
);

const WelcomePlaceholder = () => (
  <div className="welcome-placeholder">
     <div className="placeholder-content">
        <div className="placeholder-icon">✨</div>
        <h3>Create your first Saga</h3>
        <p>Enter a book title or use the Story Studio to generate an immersive audio story with visuals.</p>
        <div className="feature-pills">
            <span>📖  Script</span>
            <span>🎧  Audio</span>
            <span>🎨  Visuals</span>
            <span>📹  Video</span>
        </div>
     </div>
  </div>
);

const SetupScreen = ({ onSave }: { onSave: (key: string, model: string) => void }) => {
  const [key, setKey] = useState(savedKey);
  const [model, setModel] = useState(savedModel);
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="setup-overlay">
      <div className="setup-card">
        <Logo />
        <h1>Welcome to Saga</h1>
        <p className="setup-subtitle">Connect your AI provider to get started</p>

        <div className="setup-field">
          <label>LLM Provider</label>
          <select className="text-input" value="google" disabled>
            <option value="google">Google Gemini</option>
          </select>
        </div>

        <div className="setup-field">
          <label>Model</label>
          <select className="text-input" value={model} onChange={e => setModel(e.target.value)}>
            {MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="setup-field">
          <label>API Key</label>
          <div className="setup-key-row">
            <input
              type={showKey ? "text" : "password"}
              className="text-input"
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="Enter your Gemini API key"
            />
            <button className="icon-btn" onClick={() => setShowKey(!showKey)} tabIndex={-1}>
              {showKey ? "🙈" : "👁️"}
            </button>
          </div>
          <p className="setup-hint">
            Get a free key at{" "}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
              aistudio.google.com/apikey
            </a>
          </p>
        </div>

        <button
          className="primary-btn"
          disabled={!key.trim()}
          onClick={() => onSave(key.trim(), model)}
        >
          Get Started
        </button>
      </div>
    </div>
  );
};

// --- Video Modal ---
interface VideoModalProps {
  mode: 'saga' | 'story';
  audioUrl: string;
  backgroundUrl: string; // Saga: Concept Art, Story: Cover Art
  overlayUrl?: string; // Saga: Book Cover
  title: string;
  tagline?: string;
  author?: string;
  playbackSpeed: number;
  onClose: () => void;
}

const VideoModal = ({ 
  mode,
  audioUrl, 
  backgroundUrl, 
  overlayUrl,
  title,
  tagline,
  author,
  playbackSpeed,
  onClose 
}: VideoModalProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // State for Assets
  const [bgImageSrc, setBgImageSrc] = useState(backgroundUrl);
  const [overlayImageSrc, setOverlayImageSrc] = useState(overlayUrl || "");
  const [showCover, setShowCover] = useState(true);

  // State for Text
  const [videoTitle, setVideoTitle] = useState(title);
  const [videoTagline, setVideoTagline] = useState(tagline || "");
  const [videoAuthor, setVideoAuthor] = useState(author || "");

  // Text Sizes
  const [titleSize, setTitleSize] = useState(mode === 'story' ? 50 : 45);
  const [taglineSize, setTaglineSize] = useState(25);
  const [authorSize, setAuthorSize] = useState(22);

  // App State
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [silentRender, setSilentRender] = useState(false);
  
  // Generation State
  const [artPrompt, setArtPrompt] = useState(title + " art, 4k");
  const [artLoading, setArtLoading] = useState(false);
  const [smartArtPrompt, setSmartArtPrompt] = useState("");

  // Refs
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const overlayImgRef = useRef<HTMLImageElement | null>(null);
  
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animationRef = useRef<number>(0);

  // Load BG Image
  useEffect(() => {
    if (bgImageSrc) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = bgImageSrc;
        img.onload = () => { bgImgRef.current = img; };
    }
  }, [bgImageSrc]);

  // Load Overlay Image (Saga only)
  useEffect(() => {
    if (overlayImageSrc && mode === 'saga') {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = overlayImageSrc;
        img.onload = () => { overlayImgRef.current = img; };
    }
  }, [overlayImageSrc, mode]);

  // Setup Audio
  useEffect(() => {
    const audio = new Audio(audioUrl);
    audio.crossOrigin = "anonymous";
    audio.playbackRate = playbackSpeed;
    audioElRef.current = audio;

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = ctx;
    
    const source = ctx.createMediaElementSource(audio);
    const dest = ctx.createMediaStreamDestination();
    const gainNode = ctx.createGain();

    source.connect(dest); 
    source.connect(gainNode); 
    gainNode.connect(ctx.destination); 
    
    sourceRef.current = source;
    destRef.current = dest;
    gainNodeRef.current = gainNode;

    return () => {
       ctx.close();
       audio.pause();
    };
  }, [audioUrl]);

  useEffect(() => {
    if (audioElRef.current) {
      audioElRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setBgImageSrc(URL.createObjectURL(file));
  };

  const handleOverlayUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setOverlayImageSrc(URL.createObjectURL(file));
  };
  
  const regenerateArt = async (type: 'bg' | 'overlay', customPrompt?: string) => {
      const promptToUse = customPrompt || artPrompt;
      if (!promptToUse.trim()) return;
      
      setArtLoading(true);
      try {
          const prompt = type === 'bg' 
            ? `Create cinematic background art. 16:9. Context: ${promptToUse}`
            : `Create a book cover design. Vertical aspect ratio. Context: ${promptToUse}`;
            
          const res = await ai.models.generateContent({
             model: "gemini-2.5-flash-image",
             contents: prompt
          });
          const data = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (data) {
              const url = `data:image/png;base64,${data}`;
              if (type === 'bg') setBgImageSrc(url);
              else setOverlayImageSrc(url);
          }
      } catch (e) {
          console.error(e);
      } finally {
          setArtLoading(false);
      }
  };
  
  const handleSmartArtGenerate = () => {
    if(smartArtPrompt) regenerateArt('bg', smartArtPrompt);
  };

  // Draw Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;

      // 1. Draw Background
      if (bgImgRef.current && bgImgRef.current.complete && bgImgRef.current.naturalWidth > 0) {
         const img = bgImgRef.current;
         const ratio = Math.max(w / img.width, h / img.height);
         const cx = (w - img.width * ratio) / 2;
         const cy = (h - img.height * ratio) / 2;
         
         ctx.save();
         // Dim background differently based on mode
         ctx.filter = mode === 'saga' ? "brightness(0.35) blur(2px)" : "brightness(0.6)"; 
         ctx.drawImage(img, cx, cy, img.width * ratio, img.height * ratio);
         ctx.restore();
      } else {
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(0, 0, w, h);
      }

      if (mode === 'saga') {
          // --- SAGA MODE LAYOUT: Centered Cover ---
          
          // Draw Overlay (Book Cover) in Center
          if (showCover && overlayImgRef.current && overlayImgRef.current.complete) {
              const coverH = h * 0.65; // Cover is 65% of screen height
              const coverW = (overlayImgRef.current.width / overlayImgRef.current.height) * coverH;
              const coverX = (w - coverW) / 2; // Centered
              const coverY = (h - coverH) / 2; // Centered vertically
              
              // Reflection / Shadow
              ctx.save();
              ctx.shadowColor = "rgba(0,0,0,0.8)";
              ctx.shadowBlur = 40;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 20;
              
              ctx.drawImage(overlayImgRef.current, coverX, coverY, coverW, coverH);
              ctx.restore();
          }

          // Draw Text - Top, Middle, Bottom Centered
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "white";
          
          ctx.shadowColor = "rgba(0,0,0,0.9)";
          ctx.shadowBlur = 10;
          
          const centerX = w / 2;
          
          // Title (Top)
          ctx.font = `bold ${titleSize}px "Roboto", sans-serif`;
          wrapText(ctx, videoTitle, centerX, h * 0.12, w * 0.9, titleSize * 1.2);

          // Tagline (Middle - Overlaps Cover)
          ctx.font = `italic 700 ${taglineSize}px "Roboto", sans-serif`;
          ctx.fillStyle = "#fbbf24"; // Amber
          // Draw with strong stroke for visibility over cover
          ctx.lineWidth = 4;
          ctx.strokeStyle = "rgba(0,0,0,0.8)";
          wrapText(ctx, videoTagline, centerX, h * 0.5, w * 0.9, taglineSize * 1.2, true);
          ctx.fillStyle = "#fbbf24";
          wrapText(ctx, videoTagline, centerX, h * 0.5, w * 0.9, taglineSize * 1.2);

          // Author (Bottom)
          ctx.font = `500 ${authorSize}px "Roboto", sans-serif`;
          ctx.fillStyle = "#cbd5e1"; 
          ctx.fillText(`BY ${videoAuthor.toUpperCase()}`, centerX, h * 0.9);

      } else {
          // --- STORY MODE LAYOUT: Simplified ---
          // Just Header Text Centered on Art
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "white";
          ctx.shadowColor = "rgba(0,0,0,1)";
          ctx.shadowBlur = 20;
          ctx.shadowOffsetY = 4;

          ctx.font = `bold ${titleSize}px "Roboto", sans-serif`;
          const y = h * 0.85;
          wrapText(ctx, videoTitle, w / 2, y, w * 0.8, titleSize * 1.2);
      }

      // Update Progress
      if (audioElRef.current && audioElRef.current.duration) {
         setProgress((audioElRef.current.currentTime / audioElRef.current.duration) * 100);
      }
      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationRef.current);
  }, [
      bgImageSrc, overlayImageSrc, showCover, 
      videoTitle, videoTagline, videoAuthor, 
      titleSize, taglineSize, authorSize, mode
  ]);

  function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, stroke: boolean = false) {
    const words = text.split(' ');
    let line = '';
    let dy = y;

    for(let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        if(stroke) ctx.strokeText(line, x, dy);
        else ctx.fillText(line, x, dy);
        line = words[n] + ' ';
        dy += lineHeight;
      } else {
        line = testLine;
      }
    }
    if(stroke) ctx.strokeText(line, x, dy);
    else ctx.fillText(line, x, dy);
  }

  const startRecording = async () => {
    if (!canvasRef.current || !destRef.current || !audioElRef.current || !audioCtxRef.current) return;
    setIsRecording(true);
    setDownloadUrl(null);
    chunksRef.current = [];
    if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();
    if (gainNodeRef.current) gainNodeRef.current.gain.value = silentRender ? 0 : 1;
    audioElRef.current.currentTime = 0;
    const canvasStream = canvasRef.current.captureStream(30);
    const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...destRef.current.stream.getAudioTracks()]);
    
    const options = { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 3000000 };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) delete (options as any).mimeType; 

    const recorder = new MediaRecorder(combinedStream, options);
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setDownloadUrl(URL.createObjectURL(blob));
      setIsRecording(false);
      if (gainNodeRef.current) gainNodeRef.current.gain.value = 1;
    };
    recorderRef.current = recorder;
    recorder.start();
    audioElRef.current.play();
    setIsPlaying(true);
    audioElRef.current.onended = () => { if (recorder.state === "recording") recorder.stop(); setIsPlaying(false); };
  };

  const togglePreview = async () => {
    if (!audioElRef.current || !audioCtxRef.current) return;
    if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();
    if (gainNodeRef.current) gainNodeRef.current.gain.value = 1;
    if (isPlaying) audioElRef.current.pause(); else audioElRef.current.play();
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="video-modal-overlay">
      <div className="video-modal-content">
        <div className="video-header">
           <h3>{mode === 'saga' ? "Saga Video Studio" : "Story Video Studio"}</h3>
           <button onClick={onClose} className="close-btn" style={{color:'white'}}>×</button>
        </div>
        
        <div className="video-modal-body">
            {/* Left: Preview */}
            <div className="preview-section">
                <div className="canvas-container">
                   <canvas ref={canvasRef} width={1280} height={720} className="preview-canvas" />
                   {isRecording && (
                     <div className="recording-overlay">
                       <div className="recording-status">
                          <div className="spinner"></div>
                          <h3>Rendering Video...</h3>
                          <div className="progress-bar-container">
                            <div className="progress-bar-fill" style={{width: `${Math.min(progress, 100)}%`}}></div>
                          </div>
                       </div>
                     </div>
                   )}
                </div>
                <div className="video-controls">
                  <label className="checkbox-label">
                    <input type="checkbox" checked={silentRender} onChange={(e) => setSilentRender(e.target.checked)} /> Silent Render
                  </label>
                  {!isRecording ? (
                    <>
                      <button className="secondary-btn" onClick={togglePreview}>{isPlaying ? "⏸" : "▶ Preview"}</button>
                      <button className="primary-btn small-btn" onClick={startRecording} style={{ background: '#ec4899' }}>⚡ Render Video</button>
                    </>
                  ) : <button className="secondary-btn" disabled>Recording...</button>}
                  {downloadUrl && <a href={downloadUrl} download={getFileName(title, "Video.webm")} className="primary-btn small-btn">⬇ Download</a>}
                </div>
            </div>
            
            {/* Right: Settings */}
            <div className="settings-panel">
               
               {/* 1. Background / Cover Art Section */}
               <h4>{mode === 'saga' ? "Background Art (Concept)" : "Cover Art (Background)"}</h4>
               
               <div className="smart-art-control">
                  <input 
                    type="text" 
                    value={smartArtPrompt} 
                    onChange={e => setSmartArtPrompt(e.target.value)} 
                    placeholder="Bg Art..." 
                    className="video-text-input" 
                  />
                  <button className="secondary-btn small-btn" onClick={handleSmartArtGenerate} disabled={artLoading || !smartArtPrompt}>
                    Gen
                  </button>
               </div>

               <div className="assets-grid">
                  <div style={{gridColumn:'1/-1', display:'flex', flexDirection:'column', gap:'0.5rem'}}>
                      <div style={{display:'flex', gap:'0.5rem'}}>
                         <button className="secondary-btn" onClick={() => regenerateArt('bg')} disabled={artLoading} style={{flex:1}}>
                             ↻ Regenerate
                         </button>
                         <label className="secondary-btn" style={{flex:1, textAlign:'center', cursor:'pointer'}}>
                             Upload <input type="file" accept="image/*" onChange={handleBgUpload} style={{display:'none'}} />
                         </label>
                      </div>
                  </div>
               </div>
               
               {/* 2. Saga Specific: Overlay (Book Cover) */}
               {mode === 'saga' && (
                   <>
                       <div style={{width:'100%', height:'1px', background:'#334155', margin:'1rem 0'}}></div>
                       <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                           <h4>Book Cover</h4>
                           <label className="checkbox-label"><input type="checkbox" checked={showCover} onChange={e => setShowCover(e.target.checked)} /> Show</label>
                       </div>
                       {showCover && (
                           <div style={{display:'flex', gap:'0.5rem'}}>
                               <button className="secondary-btn" onClick={() => regenerateArt('overlay')} disabled={artLoading} style={{flex:1}}>↻ Gen</button>
                               <label className="secondary-btn" style={{flex:1, textAlign:'center', cursor:'pointer'}}>
                                   Up <input type="file" accept="image/*" onChange={handleOverlayUpload} style={{display:'none'}} />
                               </label>
                           </div>
                       )}
                   </>
               )}

               <div style={{width:'100%', height:'1px', background:'#334155', margin:'1rem 0'}}></div>

               {/* 3. Text Controls */}
               <h4>Text Overlays</h4>
               <div className="text-control-group">
                   <input type="text" value={videoTitle} onChange={e => setVideoTitle(e.target.value)} placeholder="Title (Top)" className="video-text-input" />
                   <div className="slider-group"><small>Size</small><input type="range" min="20" max="100" value={titleSize} onChange={e => setTitleSize(Number(e.target.value))} /></div>
               </div>

               {mode === 'saga' && (
                   <>
                       <div className="text-control-group">
                           <input type="text" value={videoTagline} onChange={e => setVideoTagline(e.target.value)} placeholder="Tagline (Middle)" className="video-text-input" />
                           <div className="slider-group"><small>Size</small><input type="range" min="15" max="80" value={taglineSize} onChange={e => setTaglineSize(Number(e.target.value))} /></div>
                       </div>
                       <div className="text-control-group">
                           <input type="text" value={videoAuthor} onChange={e => setVideoAuthor(e.target.value)} placeholder="Author (Bottom)" className="video-text-input" />
                           <div className="slider-group"><small>Size</small><input type="range" min="15" max="50" value={authorSize} onChange={e => setAuthorSize(Number(e.target.value))} /></div>
                       </div>
                   </>
               )}
            </div>
        </div>
      </div>
    </div>
  );
};


// --- Main App Component ---

 const App = () => {
   const [configured, setConfigured] = useState(!!savedKey);
   const [activeTab, setActiveTab] = useState<'saga' | 'story'>('saga');
  
  // Saga Mode State
  const [bookName, setBookName] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [inputText, setInputText] = useState("");
  
  // Story Studio Mode State
  const [storyScript, setStoryScript] = useState("");
  
  // Shared/Generated State
  const [summary, setSummary] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoDescription, setVideoDescription] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [tagline, setTagline] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [duration, setDuration] = useState("1250");
  const [language, setLanguage] = useState("Hinglish");
  const [voice, setVoice] = useState("Puck");
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [demoLoading, setDemoLoading] = useState(false);

  // Audio State
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);

  // Verification State
  const [foundBook, setFoundBook] = useState<{title: string, author: string} | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Visuals State
  // Added 'cover' for Saga mode (Vertical Book Cover)
  const [visuals, setVisuals] = useState<{thumbnail: string | null, concept: string | null, cover: string | null}>({ thumbnail: null, concept: null, cover: null });
  const [visualsLoading, setVisualsLoading] = useState(false);
  
  // Thumbnails State
  const [generatedThumbnails, setGeneratedThumbnails] = useState<string[]>([]);
  const [thumbnailsLoading, setThumbnailsLoading] = useState(false);
  const [thumbInsertImg, setThumbInsertImg] = useState<string | null>(null);

  // Video State
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);

  // Apply playback speed to audio player
  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, audioUrl]);

  // --- Handlers ---

  const handleBookNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBookName(e.target.value);
    setFoundBook(null); // Reset verification on change
  };

  const handleAuthorNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAuthorName(e.target.value);
    setFoundBook(null); // Reset verification on change
  };
  
  const handleThumbImgChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setThumbInsertImg(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };
  
  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const url = URL.createObjectURL(file);
        setAudioUrl(url);
    }
  };

  const verifyBook = async () => {
    if (!bookName) return;
    setVerifying(true);
    setError("");

    try {
      const prompt = `
      You are a librarian database.
      User Input Book: "${bookName}"
      User Input Author: "${authorName}"

      Task: Identify the correct full book title and author. 
      STRICT RULE: If the user provided an author ("${authorName}"), you MUST prioritize finding a book by THAT author, even if the title is generic or matches a more famous book by someone else.
      
      Example:
      Input: "Rewire Your Anxious Brain", Author: "Nick Trenton"
      Output: Title: "Rewire Your Anxious Brain: How to Use the Neuroscience of Fear to End Anxiety, Panic, and Worry", Author: "Nick Trenton".

      Respond in JSON: { "title": "Full Title", "author": "Author Name" }
      If not found, return null.
      `;

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      
      const data = safeJsonParse(result.text);

      if (data && data.title) {
        setFoundBook(data);
        // Auto-update fields
        setBookName(data.title);
        setAuthorName(data.author);
      } else {
        setError("Could not identify this book. Please check the spelling.");
      }
    } catch (e) {
      console.error(e);
      setError("Error verifying book.");
    } finally {
      setVerifying(false);
    }
  };

  const generateSummary = async () => {
    const isSagaMode = activeTab === 'saga';
    
    // In Saga Mode, check valid book name
    if (isSagaMode && !bookName) {
      setError("Please enter a Book Name.");
      return;
    }

    // If input text is provided in Saga Mode, skip generation and use it
    if (isSagaMode && inputText.trim().length > 0) {
        setSummary(inputText);
        // Auto-trigger metadata generation for the pasted text
        generateMetadata(inputText);
        return;
    }
    
    // If we are in Story Mode, we don't generate a summary, we use the script directly.
    if (!isSagaMode) return;

    setLoading(true);
    setError("");
    setSummary("");

    try {
      // Logic for word count target based on duration selection
      let wordCountTarget = "approx 1250 words";
      if (duration === "750") wordCountTarget = "approx 750 words";
      if (duration === "1250") wordCountTarget = "approx 1250 words";
      if (duration === "1800") wordCountTarget = "approx 1800 words";
      if (duration === "2500") wordCountTarget = "approx 2500 words";

      const lengthPrompt = `Target Length: ${wordCountTarget}. This is a hard requirement.`;

      let langInstruction = "Output language: English.";
      if (language.includes("Hinglish")) {
        langInstruction = `Output language: Hinglish (Mix of Hindi and English). 
        IMPORTANT: Write the Hindi parts in Roman script (English alphabet) only. Do NOT use Devanagari script.`;
      }

      const titleToUse = foundBook ? foundBook.title : bookName;
      const authorToUse = foundBook ? foundBook.author : authorName;

      const prompt = `You are an expert YouTuber and storyteller. 
      Your goal is to create a high-quality Book Summary Video Script for "${titleToUse}" by ${authorToUse}.

      **Part 1: The Script**
      - Tone: Energetic, engaging, conversational (like a friend sharing a secret).
      - Structure: Hook -> Core Concepts -> Practical Application -> Ending.
      - Formatting: No markdown in the spoken text.
      - ${lengthPrompt}
      - ${langInstruction}

      **ENDING REQUIREMENT:**
      End the script with:
      1. A concise recap of the core principles.
      2. A calm encouragement to read the book for deeper understanding.

      **NEGATIVE CONSTRAINTS (STRICTLY FOLLOW):**
      - AVOID PHRASES: Do NOT use or paraphrase: "Honestly", "Trust me", "Believe me", or similar persuasive filler/reassurance phrases. If such language appears, rewrite to be neutral and direct.
      - CALL-TO-ACTION RESTRICTION: Do NOT include any engagement prompts such as: "Like the video", "Subscribe", "Share", "Comment below", "Hit the bell icon", or any variation or indirect request for viewer engagement. The script must end without requesting any audience action.

      **Part 2: YouTube Metadata**
      - Video Title: Must follow the format: "${titleToUse} | Book Summary - [Short Tagline]"
      - Video Description: Use bullet points for key takeaways. If language is Hinglish, you can mix Hindi and English in the description.
      - Hashtags: Generate relevant hashtags.
      - Tagline: A short, punchy phrase (max 10 words).

      Respond strictly in JSON format:
      {
          "script": "The full spoken script text...",
          "videoTitle": "Formatted Title",
          "videoDescription": "Description with bullet points...",
          "hashtags": "#Tag1 #Tag2...",
          "tagline": "Short tagline..."
      }`;

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const data = safeJsonParse(result.text);

      setSummary(data.script);
      setVideoTitle(data.videoTitle);
      setVideoDescription(data.videoDescription);
      setHashtags(data.hashtags);
      setTagline(data.tagline);
      
      // Auto-generate visuals if not present
      generateVisuals(titleToUse, data.script);

    } catch (e) {
      console.error(e);
      setError("Failed to generate script. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  const generateMetadata = async (contentToAnalyzeOverride?: string): Promise<{videoTitle: string, videoDescription: string, hashtags: string, tagline: string} | null> => {
    const isStoryMode = activeTab === 'story';

    // Validation
    if (!isStoryMode && !bookName) {
        setError("Please enter a Book Name first.");
        return null;
    }

    setMetadataLoading(true);
    
    try {
        const titleToUse = isStoryMode ? (bookName || "Original Audio Story") : (foundBook ? foundBook.title : bookName);
        const authorToUse = authorName;
        
        let contentToAnalyze = contentToAnalyzeOverride || summary;
        if (isStoryMode) contentToAnalyze = storyScript;
        
        // If no content yet, just use title
        if (!contentToAnalyze) contentToAnalyze = `Title: ${titleToUse}. Author: ${authorToUse}`;

        const prompt = `
        You are a YouTube SEO Expert. Generate metadata for a video.
        
        Context:
        ${contentToAnalyze.substring(0, 2000)}...
        
        Output Language: ${language}
        
        **Part 2: YouTube Metadata**
        ${!isStoryMode ? 
        `- Video Title: Must follow the format: "${titleToUse} | Book Summary - [Short Tagline]"` :
        `- Video Title: Create a creative title for this story. Format: "[Creative Title] | Audio Story"`
        }
        - Video Description: Use bullet points for key takeaways. If language is Hinglish, you can mix Hindi and English.
        - Hashtags: Generate relevant hashtags.
        - Tagline: A short, punchy phrase (max 10 words).
        
        Respond strictly in JSON:
        {
          "videoTitle": "...",
          "videoDescription": "...",
          "hashtags": "...",
          "tagline": "..."
        }
        `;
        
        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        
        const data = safeJsonParse(result.text);

        setVideoTitle(data.videoTitle);
        setVideoDescription(data.videoDescription);
        setHashtags(data.hashtags);
        setTagline(data.tagline);
        return data;
        
    } catch (e) {
        console.error(e);
        setError("Failed to generate metadata.");
        return null;
    } finally {
        setMetadataLoading(false);
    }
  };

  const handleStoryGenerate = async () => {
      if (!storyScript.trim()) {
          setError("Please enter a script first.");
          return;
      }
      setSummary(storyScript); // Display in Script card
      
      // Auto generate metadata and wait for it to get the title
      const meta = await generateMetadata(storyScript);
      
      // Determine title to use for visuals based on metadata or fallback
      let titleForVisuals = "Original Audio Story";
      if (meta && meta.videoTitle) {
          // Extract main title part if possible, or use full video title
          titleForVisuals = meta.videoTitle.split('|')[0].trim();
      }

      // Generate visuals with the specific story title
      generateVisuals(titleForVisuals, storyScript);

      // Trigger audio generation
      await generateAudio(storyScript, true);
  };

  const generateAudio = async (textToSpeakOverride?: string, isScriptMode: boolean = false) => {
    const textToSpeak = textToSpeakOverride || summary;
    if (!textToSpeak) return;
    
    setAudioLoading(true);
    setError("");
    setAudioUrl(null);
    setAudioProgress(0);

    // Stop current audio if playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    try {
      let cleanText = textToSpeak;
      
      cleanText = cleanText.replace(/\[.*?\]/g, "");
      
      if (isScriptMode) {
          cleanText = cleanText.replace(/\(.*?\)/g, ""); // Remove (Tone)
          cleanText = cleanText.replace(/^[A-Za-z0-9\s]+:/gm, ""); // Remove Speaker:
      }

      const chunks = splitText(cleanText, 2500);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const buffers: Float32Array[] = [];
      let totalLength = 0;

      for (let i = 0; i < chunks.length; i++) {
        setAudioProgress(Math.round(((i) / chunks.length) * 100));
        
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: {
             parts: [{ text: chunks[i] }]
          },
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
            },
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
           const audioData = decode(base64Audio);
           
           // Ensure even byte alignment
           const alignedLength = audioData.length % 2 === 0 ? audioData.length : audioData.length - 1;
           const alignedData = audioData.slice(0, alignedLength);

           const int16Array = new Int16Array(alignedData.buffer);
           const float32 = new Float32Array(int16Array.length);
           for (let j = 0; j < int16Array.length; j++) {
              float32[j] = int16Array[j] / 32768.0;
           }
           
           buffers.push(float32);
           totalLength += float32.length;
        }
      }

      setAudioProgress(100);

      const finalBuffer = audioCtx.createBuffer(1, totalLength, 24000);
      const channelData = finalBuffer.getChannelData(0);
      let offset = 0;
      for (const buf of buffers) {
         channelData.set(buf, offset);
         offset += buf.length;
      }
      
      const finalPcm16 = new Int16Array(totalLength);
      for (let i = 0; i < totalLength; i++) {
         let s = Math.max(-1, Math.min(1, channelData[i]));
         finalPcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      
      const wavBlob = pcm16ToWavBlob(new Uint8Array(finalPcm16.buffer), 24000);
      const url = URL.createObjectURL(wavBlob);
      setAudioUrl(url);

    } catch (e) {
      console.error(e);
      setError("Failed to generate audio.");
    } finally {
      setAudioLoading(false);
      setAudioProgress(0);
    }
  };

  const playVoiceDemo = async () => {
     setDemoLoading(true);
     try {
         const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: { parts: [{ text: `Hi, I am ${voice}. I will be narrating your book summary today.` }] },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }
            }
         });
         const base64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
         if (base64) {
             const audioData = decode(base64);
             const alignedLength = audioData.length % 2 === 0 ? audioData.length : audioData.length - 1;
             const alignedData = audioData.slice(0, alignedLength);
             
             const wav = pcm16ToWavBlob(alignedData, 24000);
             const url = URL.createObjectURL(wav);
             const audio = new Audio(url);
             audio.play();
         }
     } catch (e) {
         console.error(e);
     } finally {
         setDemoLoading(false);
     }
  };

  const generateVisuals = async (titleOverride?: string, scriptForContext?: string) => {
    const titleToUse = titleOverride || (activeTab === 'saga' ? (foundBook ? foundBook.title : bookName) : "Original Story");
    const scriptToUse = scriptForContext || summary || storyScript || "";

    if (!titleToUse && activeTab === 'saga') {
       setError("No title available for visuals.");
       return;
    }
    
    setVisualsLoading(true);
    try {
      if (activeTab === 'story') {
          // --- STORY MODE VISUALS (Independent) ---
          const thumbPrompt = `Create a YouTube Thumbnail for the story "${titleToUse}".
          Context: ${scriptToUse.substring(0, 500)}...
          The Scene: Depict the specific mythological event or character action.
          The Setting: Capture location and lighting.
          The Art Style: Epic digital fantasy art.
          Text: "${titleToUse}" bold.`;

          const conceptPrompt = `Create a cinematic concept art illustration for the story "${titleToUse}".
          Script Context: "${scriptToUse.substring(0, 800)}..."
          The Scene: Specific mythological event.
          The Setting: Detailed location and lighting.
          The Art Style: Epic digital fantasy art, 16:9, 4k.`;

          const [thumbRes, conceptRes] = await Promise.all([
            ai.models.generateContent({ model: "gemini-2.5-flash-image", contents: thumbPrompt }),
            ai.models.generateContent({ model: "gemini-2.5-flash-image", contents: conceptPrompt })
          ]);

          const thumbData = thumbRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          const conceptData = conceptRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

          setVisuals({
            thumbnail: thumbData ? `data:image/png;base64,${thumbData}` : null,
            concept: conceptData ? `data:image/png;base64,${conceptData}` : null,
            cover: null // Story mode doesn't need vertical cover
          });
      } else {
          // --- SAGA MODE VISUALS (Independent) ---
          // 1. Thumbnail (YouTube Standard)
          const thumbPrompt = `Create a YouTube Thumbnail for "${titleToUse}".
          Requirements: Relevant imagery, Topic Name BIG and BOLD.
          Style: High contrast, vibrant colors.`;

          // 2. Concept Art (Background - Abstract/Vector)
          const conceptPrompt = `Create a cinematic concept art background for "${titleToUse}".
          Focus: High Contrast Graphic Design, Vector Art, and Abstract Metaphors.
          Core Message: ${scriptToUse.substring(0, 300)}...
          Aspect Ratio: 16:9. Mood: Professional, Studio.`;
          
          // 3. Book Cover (Vertical)
          const coverPrompt = `Create a vertical Book Cover design for "${titleToUse}".
          Style: High quality, minimalist, professional book cover design.`;

          const [thumbRes, conceptRes, coverRes] = await Promise.all([
            ai.models.generateContent({ model: "gemini-2.5-flash-image", contents: thumbPrompt }),
            ai.models.generateContent({ model: "gemini-2.5-flash-image", contents: conceptPrompt }),
            ai.models.generateContent({ model: "gemini-2.5-flash-image", contents: coverPrompt })
          ]);

          const thumbData = thumbRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          const conceptData = conceptRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          const coverData = coverRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

          setVisuals({
            thumbnail: thumbData ? `data:image/png;base64,${thumbData}` : null,
            concept: conceptData ? `data:image/png;base64,${conceptData}` : null,
            cover: coverData ? `data:image/png;base64,${coverData}` : null
          });
      }
      
    } catch (e) {
      console.error(e);
      setError("Visuals generation failed.");
    } finally {
      setVisualsLoading(false);
    }
  };
  
  const generateThumbnails = async () => {
    setThumbnailsLoading(true);
    try {
        const titleToUse = activeTab === 'saga' ? (foundBook ? foundBook.title : bookName) : "Original Story";
        
        let insertImgPart = null;
        if (thumbInsertImg) {
            insertImgPart = {
                inlineData: {
                    mimeType: "image/png",
                    data: thumbInsertImg.split(',')[1]
                }
            };
        }

        const basePrompt = `Create a High-CTR YouTube Thumbnail for "${titleToUse}".
        NO photorealistic humans. Use Vector Art, Abstract Metaphors, or High Contrast Graphic Design.
        Text Overlay: "${titleToUse}" (Bold, Readable).
        ${insertImgPart ? "COMPOSITION RULE: The provided image is the BOOK COVER. Display it prominently in the MIDDLE-LEFT of the thumbnail." : ""}
        `;

        const prompts = [
            basePrompt + " Variation: Emotional, Dramatic lighting, Abstract symbolism.",
            basePrompt + " Variation: Minimalist, Bold Typography, Clean layout."
        ];
        
        const results = await Promise.all(prompts.map(p => 
            ai.models.generateContent({
                model: "gemini-2.5-flash-image",
                contents: {
                    parts: insertImgPart ? [insertImgPart, { text: p }] : [{ text: p }]
                }
            })
        ));

        const newThumbs = results.map(r => {
             const d = r.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
             return d ? `data:image/png;base64,${d}` : null;
        }).filter(Boolean) as string[];
        
        setGeneratedThumbnails(newThumbs);
        
    } catch(e) {
        console.error(e);
        setError("Thumbnail generation failed.");
    } finally {
        setThumbnailsLoading(false);
    }
  };

  const regenerateVisual = async (type: 'thumbnail' | 'concept' | 'cover') => {
      setVisualsLoading(true);
      try {
          const titleToUse = activeTab === 'saga' ? (foundBook ? foundBook.title : bookName) : "Original Story";
          let prompt = "";
          
          if (type === 'thumbnail') prompt = `Create a YouTube Thumbnail for "${titleToUse}". High contrast, 16:9.`;
          else if (type === 'concept') prompt = `Create a concept art background for "${titleToUse}". Abstract, Vector, High Contrast. 16:9.`;
          else if (type === 'cover') prompt = `Create a vertical Book Cover for "${titleToUse}". Minimalist, professional.`;
            
          const res = await ai.models.generateContent({
             model: "gemini-2.5-flash-image",
             contents: prompt 
          });
          const data = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          
          if (data) {
              setVisuals(prev => ({
                  ...prev,
                  [type]: `data:image/png;base64,${data}`
              }));
          }
      } catch (e) {
          console.error(e);
      } finally {
          setVisualsLoading(false);
      }
  };
  
  const editImage = async (base64Image: string, promptText: string, type: 'thumbnail' | 'concept' | 'cover') => {
    setVisualsLoading(true);
    try {
        const imagePart = {
            inlineData: {
                mimeType: "image/png",
                data: base64Image.split(',')[1]
            }
        };
        
        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash-image",
            contents: {
                parts: [imagePart, { text: promptText }]
            }
        });
        
        const data = result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (data) {
             setVisuals(prev => ({
                 ...prev,
                 [type]: `data:image/png;base64,${data}`
             }));
        }
    } catch (e) {
        console.error(e);
        setError("Image edit failed.");
    } finally {
        setVisualsLoading(false);
    }
  };

  const handleSetup = (key: string, model: string) => {
    localStorage.setItem("saga_api_key", key);
    localStorage.setItem("saga_model", model);
    initAI(key);
    setConfigured(true);
  };

  if (!configured) {
    return <SetupScreen onSave={handleSetup} />;
  }

  return (
    <div className="container">
      <div className="app-header">
        <div className="logo-lockup">
          <Logo />
          <h1>Saga</h1>
        </div>
        <p>Transform books & stories into immersive audio experiences with AI-generated scripts, visuals, and video.</p>
      </div>

      <div className="layout">
        {/* LEFT COLUMN: INPUTS */}
        <div className="input-section">
          <div className="section-title">
             <h2>Create New Saga</h2>
          </div>
          
          <div className="nav-tabs">
            <button className={`nav-tab ${activeTab === 'saga' ? 'active' : ''}`} onClick={() => setActiveTab('saga')}>Create Saga</button>
            <button className={`nav-tab ${activeTab === 'story' ? 'active' : ''}`} onClick={() => setActiveTab('story')}>Story Studio</button>
          </div>

          {activeTab === 'saga' && (
            <div className="book-inputs">
                <div className="book-identity-row">
                    <div className="input-group">
                        <label>Book Name <span style={{color: 'red'}}>*</span></label>
                        <input 
                        type="text" 
                        value={bookName} 
                        onChange={handleBookNameChange}
                        placeholder="e.g. Atomic Habits" 
                        className="text-input"
                        />
                    </div>
                    <div className="input-group">
                        <label>Author Name</label>
                        <input 
                        type="text" 
                        value={authorName} 
                        onChange={handleAuthorNameChange}
                        placeholder="e.g. James Clear" 
                        className="text-input"
                        />
                    </div>
                </div>

                {/* Verification UI */}
                {!foundBook && bookName.length > 3 && !verifying && (
                    <button className="secondary-btn" onClick={verifyBook}>
                    🔍 Find Book
                    </button>
                )}
                {verifying && <div className="status-message"><span className="loader small"></span> Finding book details...</div>}
                
                {foundBook && (
                    <div className="confirmation-card">
                        <div className="verified-details">
                            <p><strong>Found:</strong> {foundBook.title}</p>
                            <p className="subtitle">by {foundBook.author}</p>
                            <div className="confirmation-actions">
                                <button className="primary-btn small-btn" onClick={generateSummary} disabled={loading}>
                                {inputText.trim().length > 0 ? "Use Provided Text" : "Generate Script"}
                                </button>
                                <button className="secondary-btn small-btn" onClick={() => { setFoundBook(null); setBookName(""); setAuthorName(""); }}>
                                Change
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="input-group">
                    <label>Content to Summarize</label>
                    <textarea 
                    id="input-text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Paste text/chapter here to override AI generation..."
                    />
                </div>
                
                <div className="input-group">
                    <label>Or Upload Audio Source (Bypass Script)</label>
                    <input type="file" accept="audio/*" onChange={handleAudioUpload} className="file-input" />
                </div>
            </div>
          )}
          
          {activeTab === 'story' && (
              <div className="book-inputs">
                  <div className="input-group">
                      <label>Story Script (Scene, SFX, Narration)</label>
                      <textarea 
                        value={storyScript}
                        onChange={(e) => setStoryScript(e.target.value)}
                        placeholder={`[Scene: Dark forest]\n[Sound Effect: Owl hooting]\nHost: (Whispering) "Did you hear that?"`}
                        style={{minHeight: '300px', fontFamily: 'monospace'}}
                      />
                  </div>
                  <button className="primary-btn" onClick={handleStoryGenerate} disabled={loading || !storyScript.trim()}>
                      {loading ? "Generating..." : "Generate Audio Story"}
                  </button>
              </div>
          )}

          {/* SHARED SETTINGS */}
          <div className="input-group">
            <label>Length</label>
            <div className="radio-group">
              {DURATIONS.map(d => (
                <label key={d.value} className={duration === d.value ? 'active' : ''}>
                  <input 
                    type="radio" 
                    name="duration" 
                    value={d.value} 
                    checked={duration === d.value}
                    onChange={(e) => setDuration(e.target.value)}
                    style={{display: 'none'}}
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </div>

          <div className="input-group">
            <label>Language Style</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="Hinglish (Indian Podcaster)">Hinglish (Indian Podcaster)</option>
              <option value="English (Global)">English (Global)</option>
            </select>
          </div>
          
          {error && <div className="error-message">{error}</div>}
        </div>

        {/* RIGHT COLUMN: OUTPUTS */}
        <div className="output-section">
            {!summary && !audioUrl && !loading && !audioLoading && (
                <WelcomePlaceholder />
            )}

            {/* Script Card */}
            {(summary || loading) && (
             <div className={`summary-text-card`}>
                <div className="card-header">
                  <h3>Generated Script</h3>
                  {summary && <span className="stats-badge">{summary.split(/\s+/).length} words</span>}
                </div>
                
                {loading ? (
                    <div className="status-message" style={{padding: '4rem'}}>
                        <span className="loader"></span><br/><br/>
                        Crafting your story...
                    </div>
                ) : (
                    <>
                        <textarea 
                            className="summary-editor"
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                        />
                        <div className="action-row">
                            <div className="voice-controls">
                                <select value={playbackSpeed} onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}>
                                  {SPEEDS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                                <select value={voice} onChange={(e) => setVoice(e.target.value)}>
                                    {VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                                <button className="secondary-btn small-btn" onClick={playVoiceDemo} disabled={demoLoading}>
                                  {demoLoading ? "..." : "▶"}
                                </button>
                                <button 
                                    className="primary-btn small-btn" 
                                    onClick={() => generateAudio()}
                                    disabled={audioLoading}
                                >
                                    {audioLoading ? "Generating Audio..." : (audioUrl ? "Regenerate Audio" : "Generate Audio")}
                                </button>
                            </div>
                        </div>
                        {audioLoading && (
                            <div className="status-message">
                                Generating Audio Chunk {audioProgress}%...
                                <div style={{width: '100%', height: '4px', background: '#e2e8f0', marginTop: '8px', borderRadius: '2px'}}>
                                    <div style={{width: `${audioProgress}%`, height: '100%', background: '#4f46e5', borderRadius: '2px', transition: 'width 0.2s'}}></div>
                                </div>
                            </div>
                        )}
                    </>
                )}
             </div>
            )}
            
            {/* Visuals Card */}
            {(visuals.thumbnail || visuals.concept || visuals.cover || visualsLoading || audioUrl) && (
                <div className="summary-text-card">
                    <div className="card-header">
                        <h3>Visuals & Video</h3>
                         {!visualsLoading && (
                            <button className="secondary-btn small-btn" onClick={() => generateVisuals()}>
                                ↻ Regenerate All
                            </button>
                        )}
                    </div>
                    
                    {visualsLoading ? (
                         <div className="status-message" style={{padding: '2rem'}}>
                            <span className="loader"></span> Generating Assets...
                        </div>
                    ) : (
                        <>
                            <div className="visuals-grid">
                                {/* Thumbnail */}
                                {visuals.thumbnail && (
                                    <div className="visual-card">
                                        <div className="visual-image-container">
                                            <img src={visuals.thumbnail} className="visual-image" />
                                            <span className="visual-badge">Thumbnail</span>
                                            <a href={visuals.thumbnail} download={getFileName(bookName, "Thumbnail.png")} className="visual-download-btn">⬇</a>
                                            <button className="visual-regenerate-btn" onClick={() => regenerateVisual('thumbnail')}>↻</button>
                                        </div>
                                        <div className="edit-controls" style={{padding: '10px'}}>
                                            <input 
                                                type="text" 
                                                placeholder="Edit thumbnail..." 
                                                className="text-input"
                                                style={{fontSize: '0.8rem', padding: '6px'}}
                                                onKeyDown={(e) => {
                                                    if(e.key === 'Enter') editImage(visuals.thumbnail!, e.currentTarget.value, 'thumbnail');
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                                
                                {/* Concept Art */}
                                {visuals.concept && (
                                    <div className="visual-card">
                                        <div className="visual-image-container">
                                            <img src={visuals.concept} className="visual-image" />
                                            <span className="visual-badge">Background (16:9)</span>
                                            <a href={visuals.concept} download={getFileName(bookName, "Concept.png")} className="visual-download-btn">⬇</a>
                                            <button className="visual-regenerate-btn" onClick={() => regenerateVisual('concept')}>↻</button>
                                        </div>
                                         <div className="edit-controls" style={{padding: '10px'}}>
                                            <input 
                                                type="text" 
                                                placeholder="Edit background..." 
                                                className="text-input"
                                                style={{fontSize: '0.8rem', padding: '6px'}}
                                                onKeyDown={(e) => {
                                                    if(e.key === 'Enter') editImage(visuals.concept!, e.currentTarget.value, 'concept');
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                                
                                {/* Book Cover (Saga Only) */}
                                {visuals.cover && (
                                    <div className="visual-card">
                                        <div className="visual-image-container" style={{aspectRatio: '2/3'}}>
                                            <img src={visuals.cover} className="visual-image" style={{height:'100%', objectFit:'cover'}} />
                                            <span className="visual-badge">Book Cover</span>
                                            <a href={visuals.cover} download={getFileName(bookName, "Cover.png")} className="visual-download-btn">⬇</a>
                                            <button className="visual-regenerate-btn" onClick={() => regenerateVisual('cover')}>↻</button>
                                        </div>
                                         <div className="edit-controls" style={{padding: '10px'}}>
                                            <input 
                                                type="text" 
                                                placeholder="Edit cover..." 
                                                className="text-input"
                                                style={{fontSize: '0.8rem', padding: '6px'}}
                                                onKeyDown={(e) => {
                                                    if(e.key === 'Enter') editImage(visuals.cover!, e.currentTarget.value, 'cover');
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Generated Thumbnails */}
                                {generatedThumbnails.map((url, idx) => (
                                    <div className="visual-card" key={idx}>
                                        <div className="visual-image-container">
                                            <img src={url} className="visual-image" />
                                            <span className="visual-badge">Thumbnail Idea {idx + 1}</span>
                                            <a href={url} download={getFileName(bookName, `ThumbIdea${idx}.png`)} className="visual-download-btn">⬇</a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="action-row" style={{justifyContent: 'center', gap: '2rem'}}>
                                <div style={{flex: 1}}>
                                    <div className="input-group">
                                         <label>Insert Image into Thumbnail</label>
                                         <div style={{display: 'flex', gap: '0.5rem'}}>
                                            <input type="file" accept="image/*" onChange={handleThumbImgChange} className="file-input-small" />
                                            {thumbInsertImg && <img src={thumbInsertImg} style={{height: '30px', borderRadius: '4px'}} />}
                                         </div>
                                    </div>
                                    <button 
                                        className="secondary-btn" 
                                        style={{width: '100%', marginTop: '0.5rem'}}
                                        onClick={generateThumbnails}
                                        disabled={thumbnailsLoading}
                                    >
                                        {thumbnailsLoading ? "Generating..." : "🎨 Generate YouTube Thumbnails"}
                                    </button>
                                </div>
                                <button 
                                    className="primary-btn" 
                                    style={{ background: '#ec4899', padding: '1rem 3rem' }}
                                    onClick={() => setShowVideoModal(true)}
                                    disabled={!audioUrl}
                                >
                                    🎥 Open Video Studio
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
            
            {/* Metadata Card (Always visible if summary exists) */}
            {(summary || storyScript) && (
               <div className="metadata-card">
                  <div className="card-header" style={{border: 'none', padding: 0}}>
                      <h3>YouTube Metadata</h3>
                      <button className="secondary-btn small-btn" onClick={() => generateMetadata()} disabled={metadataLoading}>
                         {metadataLoading ? "..." : "Generate Metadata"}
                      </button>
                  </div>
                  
                  <div className="metadata-group">
                      <label>Title</label>
                      <div className="copy-row">
                          <input type="text" readOnly value={videoTitle} />
                          <button onClick={() => navigator.clipboard.writeText(videoTitle)}>Copy</button>
                      </div>
                  </div>

                  <div className="metadata-group">
                      <label>Description</label>
                      <div className="copy-row">
                          <textarea readOnly value={videoDescription} rows={4} />
                          <button onClick={() => navigator.clipboard.writeText(videoDescription)}>Copy</button>
                      </div>
                  </div>
                  
                  <div className="metadata-group">
                      <label>Hashtags</label>
                      <div className="copy-row">
                          <input type="text" readOnly value={hashtags} style={{color: '#4f46e5'}} />
                          <button onClick={() => navigator.clipboard.writeText(hashtags)}>Copy</button>
                      </div>
                  </div>
               </div>
            )}
        </div>
      </div>

      {showVideoModal && audioUrl && (
        <VideoModal 
          mode={activeTab}
          audioUrl={audioUrl}
          backgroundUrl={visuals.concept!} 
          // For Saga: Use Cover. For Story: Use Thumbnail (or Concept) if no specific cover
          overlayUrl={activeTab === 'saga' ? visuals.cover || undefined : undefined}
          title={videoTitle}
          tagline={tagline}
          author={activeTab === 'saga' ? (foundBook?.author || authorName) : ""}
          playbackSpeed={playbackSpeed}
          onClose={() => setShowVideoModal(false)} 
        />
      )}

      {audioUrl && (
        <div className="audio-player-card">
          <div className="audio-header">
             <h3>Audio Player</h3>
             <span className="audio-details-mini">{playbackSpeed}x Speed</span>
          </div>
          <div className="audio-controls-row">
              <audio 
                  ref={audioRef}
                  controls 
                  src={audioUrl} 
                  className="native-audio-player" 
              />
              <a href={audioUrl} download={getFileName(bookName, "Audio.wav")} className="download-icon-btn" title="Download WAV">
                ⬇
              </a>
          </div>
        </div>
      )}

    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
