
import { GoogleGenAI, Modality, Type, LiveServerMessage } from "@google/genai";
import { LanguageCode, VoiceType, TranslationAnalysis, TranscriptionResult, PracticeTurnResponse, ChatMessage, FriendPersona, FriendChatResponse } from '../types';

export function getApiKey(): string {
  const viteEnv = (typeof import.meta !== 'undefined' && (import.meta as any).env) ? (import.meta as any).env : {};
  const procEnv = (typeof process !== 'undefined' && process.env) ? process.env : {};
  const candidates = [
    procEnv.GEMINI_API_KEY,
    procEnv.API_KEY,
    viteEnv.VITE_GEMINI_API_KEY,
    viteEnv.VITE_API_KEY,
  ];
  const found = candidates.find(k => typeof k === 'string' && k.trim() !== '' && k !== 'PLACEHOLDER_API_KEY');
  return found ? found.trim() : '';
}

export function hasConfiguredApiKey(): boolean {
  return getApiKey().length > 0;
}

function getAiClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: getApiKey() });
}

const PREBUILT_VOICES = {
    female: 'Kore',
    male: 'Puck',
};

// Helper to run text generation with automatic model fallback for external deployments (e.g. Vercel)
async function generateContentWithModelFallback(params: {
  primaryModel: string;
  fallbackModel?: string;
  contents: any;
  config?: any;
}) {
  const ai = getAiClient();
  try {
    return await ai.models.generateContent({
      model: params.primaryModel,
      contents: params.contents,
      config: params.config,
    });
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (
      params.fallbackModel &&
      (msg.includes('404') || msg.includes('not found') || msg.includes('NOT_FOUND') || msg.includes('is not supported'))
    ) {
      return await ai.models.generateContent({
        model: params.fallbackModel,
        contents: params.contents,
        config: params.config,
      });
    }
    throw err;
  }
}

// Retry helper for handling intermittent model overload or rate limits
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2, delayMs = 800): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err?.message || err);
      const isRetryable = 
        errMsg.includes('overloaded') ||
        errMsg.includes('503') ||
        errMsg.includes('429') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('fetch failed');
      
      if (attempt < maxRetries && isRetryable) {
        console.warn(`Gemini API call failed with retryable error (attempt ${attempt + 1}/${maxRetries}):`, errMsg);
        await new Promise(res => setTimeout(res, delayMs * (attempt + 1)));
      } else {
        break;
      }
    }
  }
  throw lastError;
}

// HELPER: Base64 to ArrayBuffer for audio
export function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function translateText(
  text: string,
  sourceLang: LanguageCode,
  targetLang: LanguageCode
): Promise<string> {
  if (!text.trim()) return "";
  if (!hasConfiguredApiKey()) {
    return "Chưa cấu hình GEMINI_API_KEY trên Vercel. Vui lòng vào Vercel -> Settings -> Environment Variables -> thêm GEMINI_API_KEY rồi bấm Redeploy.";
  }
  try {
    const prompt = `Translate the following text from ${sourceLang} to ${targetLang}. 
Provide only the translated text directly, without markdown quotes or explanation.

Text: ${text}`;
    
    return await withRetry(async () => {
      const response = await generateContentWithModelFallback({
          primaryModel: 'gemini-3.8-flash',
          fallbackModel: 'gemini-2.5-flash',
          contents: prompt
      });
      const cleanText = response.text?.trim() || "";
      if (!cleanText) throw new Error("Empty translation response");
      return cleanText;
    });
  } catch (error: any) {
    console.error("Translation error:", error);
    const msg = String(error?.message || "");
    if (msg.includes('overloaded') || msg.includes('503')) {
      return "Hệ thống AI đang quá tải tạm thời. Vui lòng bấm thử lại sau giây lát.";
    }
    return `Không thể dịch lúc này (${formatGeminiError(error)}).`;
  }
}

export async function getPracticeResponse(
    history: ChatMessage[],
    scenarioPrompt: string,
    userInput: string
): Promise<PracticeTurnResponse | null> {
    try {
        const historyContext = history.map(m => `${m.role === 'ai' ? 'AI' : 'User'}: ${m.text}`).join('\n');
        
        const systemInstruction = `You are an expert English teacher. 
Context: ${scenarioPrompt}

Feedback Rules (IN VIETNAMESE):
1. Evaluate grammar and naturalness.
2. Provide "pronunciationTip" focusing on phonetic pitfalls for Vietnamese learners for this specific sentence.
3. Give "moreWaysToSay" with idiomatic expressions.
4. Keep the roleplay response engaging in English.`;

        return await withRetry(async () => {
          const response = await generateContentWithModelFallback({
              primaryModel: 'gemini-3.8-flash',
              fallbackModel: 'gemini-2.5-flash',
              contents: `History:\n${historyContext}\nUser's message: "${userInput}"`,
              config: {
                  systemInstruction,
                  responseMimeType: "application/json",
                  responseSchema: {
                      type: Type.OBJECT,
                      properties: {
                          aiResponse: { type: Type.STRING },
                          feedback: {
                              type: Type.OBJECT,
                              properties: {
                                  isCorrect: { type: Type.BOOLEAN },
                                  explanation: { type: Type.STRING },
                                  suggestion: { type: Type.STRING },
                                  moreWaysToSay: { type: Type.ARRAY, items: { type: Type.STRING } },
                                  pronunciationTip: { type: Type.STRING, description: "Phonetic advice in Vietnamese" }
                              },
                              required: ["isCorrect", "explanation", "suggestion", "moreWaysToSay", "pronunciationTip"]
                          }
                      },
                      required: ["aiResponse", "feedback"]
                  }
              }
          });

          const result = response.text;
          return result ? JSON.parse(result) : null;
        });
    } catch (error) {
        console.error("Practice response error:", error);
        return null;
    }
}

export async function getFriendChatResponse(
    history: { role: 'user' | 'friend', text: string }[],
    persona: FriendPersona,
    targetLang: LanguageCode,
    userInput: string,
    topicContext?: string
): Promise<FriendChatResponse | null> {
    try {
        const historyFormatted = history.slice(-12).map(m => `${m.role === 'friend' ? persona.name : 'User'}: ${m.text}`).join('\n');
        
        const systemInstruction = `You are ${persona.name}, a genuine, warm, lively, and empathetic close friend chatting with the user.
Personality: ${persona.personality}
Target Language for your response: ${targetLang}
Current Topic Context: ${topicContext || persona.defaultTopic}

IMPORTANT FRIEND BEHAVIOR:
1. Act 100% like a supportive, enthusiastic best friend messaging or talking together. Be expressive, use realistic emojis, natural colloquial phrases, slang, and authentic reactions (e.g., laughter, curiosity, encouragement).
2. Never act like a robot, formal teacher, or search engine.
3. Keep the conversation flowing smoothly: react warmly to what the user said, share a bit of your own relatable experience or story, and ask an engaging open-ended question.
4. Reply primarily in ${targetLang} (or if targetLang is Vietnamese, chat in natural Vietnamese).
5. Always provide a natural, colloquial Vietnamese translation of your response.
6. Provide 3 varied, realistic, natural suggested replies in ${targetLang} that the user could tap to send (1 casual agreement/continuation, 1 personal thought/story, 1 curious question).
7. If the user's message had unnatural phrasing or awkward vocabulary, include a gentle, friendly tip (in Vietnamese) explaining the more native, natural way friends speak; otherwise leave it null.
8. Highlight 1-2 interesting slang, idiom, or daily phrases used in your response with Vietnamese meanings and examples so the user can learn natural expressions.`;

        return await withRetry(async () => {
          const response = await generateContentWithModelFallback({
              primaryModel: 'gemini-3.8-flash',
              fallbackModel: 'gemini-2.5-flash',
              contents: `Conversation History:\n${historyFormatted || 'None yet. Starting conversation.'}\n\nUser's message: "${userInput}"`,
              config: {
                  systemInstruction,
                  responseMimeType: "application/json",
                  responseSchema: {
                      type: Type.OBJECT,
                      properties: {
                          friendResponse: { type: Type.STRING, description: "Your friendly in-character reply in the target language" },
                          translationInVietnamese: { type: Type.STRING, description: "Natural Vietnamese translation of your reply" },
                          suggestedReplies: {
                              type: Type.ARRAY,
                              items: { type: Type.STRING },
                              description: "3 natural response ideas in the target language"
                          },
                          friendlyTip: {
                              type: Type.OBJECT,
                              properties: {
                                  correction: { type: Type.STRING },
                                  naturalAlternative: { type: Type.STRING },
                                  explanation: { type: Type.STRING }
                              },
                              required: ["explanation"]
                          },
                          highlightedVocabulary: {
                              type: Type.ARRAY,
                              items: {
                                  type: Type.OBJECT,
                                  properties: {
                                      word: { type: Type.STRING },
                                      definition: { type: Type.STRING },
                                      example: { type: Type.STRING }
                                  },
                                  required: ["word", "definition", "example"]
                              }
                          }
                      },
                      required: ["friendResponse", "translationInVietnamese", "suggestedReplies"]
                  }
              }
          });

          const result = response.text;
          return result ? JSON.parse(result) : null;
        });
    } catch (error) {
        console.error("Friend chat error:", error);
        return null;
    }
}

export async function generateVocabImage(prompt: string): Promise<string | null> {
    try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-image',
            contents: { parts: [{ text: `A clean 3D render illustration of: ${prompt}. High quality, educational style.` }] },
            config: { imageConfig: { aspectRatio: "1:1" } }
        });
        if (response.candidates?.[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
              if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
        return null;
    } catch (error) {
      console.warn("Vocab image generation error:", error);
      return null;
    }
}

export async function analyzeTranslation(
    text: string,
    sourceLang: string,
    targetLang: string,
    translatedText: string
): Promise<TranslationAnalysis | null> {
    try {
        return await withRetry(async () => {
          const response = await generateContentWithModelFallback({
              primaryModel: 'gemini-3.8-flash',
              fallbackModel: 'gemini-2.5-flash',
              contents: `Analyze the translation. Source (${sourceLang}): "${text}" | Target (${targetLang}): "${translatedText}". Provide the analysis (grammar, variations, vocabulary definitions and examples) in Vietnamese. Extract key vocabulary from the target text.`,
              config: {
                  responseMimeType: "application/json",
                  responseSchema: {
                      type: Type.OBJECT,
                      properties: {
                          grammar: { type: Type.STRING },
                          variations: {
                              type: Type.ARRAY,
                              items: {
                                  type: Type.OBJECT,
                                  properties: { style: { type: Type.STRING }, text: { type: Type.STRING } },
                                  required: ["style", "text"]
                              }
                          },
                          vocabulary: {
                              type: Type.ARRAY,
                              items: {
                                  type: Type.OBJECT,
                                  properties: {
                                      word: { type: Type.STRING },
                                      definition: { type: Type.STRING },
                                      example: { type: Type.STRING },
                                      visualPrompt: { type: Type.STRING }
                                  },
                                  required: ["word", "definition", "example", "visualPrompt"]
                              }
                          }
                      },
                      required: ["grammar", "variations", "vocabulary"]
                  }
              }
          });
          return response.text ? JSON.parse(response.text) : null;
        });
    } catch (error) {
      console.warn("Analysis error:", error);
      return null;
    }
}

export async function transcribeAudio(
  audioBase64: string,
  mimeType: string,
  language: string
): Promise<TranscriptionResult> {
  try {
    return await withRetry(async () => {
      const response = await generateContentWithModelFallback({
        primaryModel: 'gemini-3.5-transcribe',
        fallbackModel: 'gemini-2.5-flash',
        contents: {
          parts: [{ inlineData: { data: audioBase64, mimeType } }, { text: `Transcribe this ${language} audio. Focus on accuracy.` }],
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    text: { type: Type.STRING },
                    score: { type: Type.NUMBER },
                    feedback: { type: Type.STRING }
                },
                required: ["text", "score", "feedback"]
            }
        }
      });
      return response.text ? JSON.parse(response.text) : { text: "", score: 0, feedback: "" };
    });
  } catch (error) { throw error; }
}

export interface SpeechDiagnostic {
  level: 'ok' | 'warning' | 'error';
  message: string;
  detail?: string;
}

type SpeechDiagnosticListener = (diag: SpeechDiagnostic) => void;
const diagnosticListeners = new Set<SpeechDiagnosticListener>();

export function subscribeSpeechDiagnostics(listener: SpeechDiagnosticListener): () => void {
  diagnosticListeners.add(listener);
  return () => {
    diagnosticListeners.delete(listener);
  };
}

function emitSpeechDiagnostic(diag: SpeechDiagnostic) {
  diagnosticListeners.forEach(fn => {
    try {
      fn(diag);
    } catch {}
  });
}

function formatGeminiError(error: any): string {
  const raw = String(error?.message || error || 'Lỗi không xác định');
  if (raw.includes('API_KEY_INVALID') || raw.includes('API key not valid')) {
    return 'GEMINI_API_KEY không hợp lệ. Vui lòng kiểm tra lại mã khóa trong Vercel Environment Variables.';
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED') || raw.includes('quota')) {
    return 'Hết hạn mức gọi AI (Quota Exceeded / 429). Vui lòng đợi một lát rồi thử lại.';
  }
  if (raw.includes('403') || raw.includes('PERMISSION_DENIED')) {
    return 'Từ chối truy cập API (403 Permission Denied). Kiểm tra quyền của GEMINI_API_KEY.';
  }
  if (raw.includes('Failed to fetch') || raw.includes('NetworkError') || raw.includes('fetch failed')) {
    return 'Lỗi kết nối mạng khi tải âm thanh từ máy chủ AI.';
  }
  return raw.length > 180 ? raw.slice(0, 180) + '...' : raw;
}

export async function generateSpeech(text: string, voice: VoiceType): Promise<string | null> {
  const res = await generateSpeechWithError(text, voice);
  return res.audioData;
}

async function generateSpeechWithError(
  text: string,
  voice: VoiceType
): Promise<{ audioData: string | null; error?: string }> {
  if (!text.trim()) return { audioData: null };
  const key = getApiKey();
  if (!key) {
    return {
      audioData: null,
      error: 'Chưa cấu hình biến môi trường GEMINI_API_KEY (hoặc VITE_GEMINI_API_KEY) trên Vercel.'
    };
  }
  try {
    const data = await withRetry(async () => {
      const response = await generateContentWithModelFallback({
        primaryModel: "gemini-3.8-flash-lite-tts",
        fallbackModel: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: PREBUILT_VOICES[voice] } } },
        },
      });
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    });
    if (!data) {
      return { audioData: null, error: 'Máy chủ AI trả về dữ liệu âm thanh trống.' };
    }
    return { audioData: data };
  } catch (error: any) {
    console.warn("Speech generation error:", error);
    return { audioData: null, error: formatGeminiError(error) };
  }
}

// Shared AudioContext & HTMLAudioElement for mobile (iOS Safari / Android Chrome) compatibility
let sharedAudioCtx: AudioContext | null = null;
let currentSourceNode: AudioBufferSourceNode | null = null;
let sharedHtmlAudio: HTMLAudioElement | null = null;
let isHtmlAudioUnlocked = false;
let currentObjectUrl: string | null = null;

// 44-byte valid 1-sample silent WAV for unlocking HTMLAudioElement on iOS/Android tap
const SILENT_WAV_URI = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

function getOrUnlockAudioContext(): AudioContext | null {
  try {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtxClass();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    const silentBuffer = sharedAudioCtx.createBuffer(1, 1, 22050);
    const silentSource = sharedAudioCtx.createBufferSource();
    silentSource.buffer = silentBuffer;
    silentSource.connect(sharedAudioCtx.destination);
    silentSource.start(0);
    return sharedAudioCtx;
  } catch (e) {
    console.warn("AudioContext unlock warning:", e);
    return null;
  }
}

function getOrUnlockHtmlAudio(): HTMLAudioElement | null {
  try {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
    if (!sharedHtmlAudio) {
      sharedHtmlAudio = new Audio();
      sharedHtmlAudio.preload = 'auto';
      (sharedHtmlAudio as any).playsInline = true;
    }
    if (!isHtmlAudioUnlocked) {
      sharedHtmlAudio.src = SILENT_WAV_URI;
      const playPromise = sharedHtmlAudio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            isHtmlAudioUnlocked = true;
          })
          .catch(() => {});
      }
    }
    return sharedHtmlAudio;
  } catch {
    return null;
  }
}

// Convert raw 16-bit mono PCM (24000Hz) into a standard WAV Blob URL so mobile <audio> plays over Media speaker channel
function createWavUrlFromPcm(pcmBytes: Uint8Array, sampleRate = 24000): string {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBytes.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true);  // PCM format = 1
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const outBytes = new Uint8Array(buffer, 44, dataSize);
  outBytes.set(pcmBytes);

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

export function stopSpeech(): void {
  try {
    if (currentSourceNode) {
      currentSourceNode.onended = null;
      currentSourceNode.stop();
      currentSourceNode.disconnect();
      currentSourceNode = null;
    }
  } catch {}
  try {
    if (sharedHtmlAudio) {
      sharedHtmlAudio.onended = null;
      sharedHtmlAudio.onerror = null;
      sharedHtmlAudio.pause();
    }
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }
  } catch {}
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
    }
  } catch {}
}

function speakWithNativeFallback(
  text: string,
  voice: VoiceType,
  isSlow: boolean,
  lang: LanguageCode = 'English'
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve({ ok: false, error: 'Trình duyệt trên thiết bị này không hỗ trợ bộ đọc SpeechSynthesis.' });
      return;
    }
    try {
      const synth = window.speechSynthesis;
      if (synth.speaking || synth.pending) {
        synth.cancel();
      }

      const cleanedText = text.replace(/^[A-Za-z\s]+says:\s*/i, '').trim();
      if (!cleanedText) {
        resolve({ ok: true });
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanedText);
      const langMap: Record<LanguageCode, string> = {
        'English': 'en-US',
        'Vietnamese': 'vi-VN',
        'Korean': 'ko-KR',
        'Simplified Chinese': 'zh-CN',
        'Cantonese': 'zh-HK',
      };
      utterance.lang = langMap[lang] || 'en-US';
      utterance.rate = isSlow ? 0.78 : 1.0;
      utterance.pitch = voice === 'female' ? 1.08 : 0.95;

      const voices = synth.getVoices();
      const targetLangPrefix = utterance.lang.split('-')[0].toLowerCase();
      const matchingVoices = voices.filter(v => v.lang.toLowerCase().startsWith(targetLangPrefix));
      if (matchingVoices.length > 0) {
        utterance.voice = matchingVoices[0];
      }

      let settled = false;
      const finish = (res: { ok: boolean; error?: string }) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          resolve(res);
        }
      };

      // Safety timeout in case mobile browser never fires onend
      const estimatedMs = Math.max(4000, Math.min(20000, cleanedText.length * 120));
      const timeoutId = setTimeout(() => {
        finish({ ok: true });
      }, estimatedMs);

      utterance.onend = () => finish({ ok: true });
      utterance.onerror = (e: any) => {
        const errCode = e?.error ? String(e.error) : 'unknown';
        if (errCode === 'canceled' || errCode === 'interrupted') {
          finish({ ok: true });
        } else {
          finish({ ok: false, error: `Bộ đọc thiết bị báo lỗi (${errCode}).` });
        }
      };

      synth.speak(utterance);
    } catch (err: any) {
      resolve({ ok: false, error: String(err?.message || err) });
    }
  });
}

export async function playSpeech(
  text: string,
  voice: VoiceType,
  isSlow: boolean = false,
  lang: LanguageCode = 'English'
): Promise<SpeechDiagnostic> {
  if (!text.trim()) {
    return { level: 'ok', message: '' };
  }

  // 1. Unlock BOTH HTMLAudioElement and AudioContext synchronously inside the user tap gesture!
  stopSpeech();
  const ctx = getOrUnlockAudioContext();
  const audioEl = getOrUnlockHtmlAudio();

  const cleanedForPrompt = text.replace(/^[A-Za-z\s]+says:\s*/i, '').trim();
  const hasKey = hasConfiguredApiKey();

  // 2. If no API Key is configured (e.g. on Vercel before setting GEMINI_API_KEY),
  // run native device TTS IMMEDIATELY without awaiting network so mobile user-gesture activation stays active!
  if (!hasKey) {
    const nativeRes = await speakWithNativeFallback(cleanedForPrompt, voice, isSlow, lang);
    const diag: SpeechDiagnostic = nativeRes.ok
      ? {
          level: 'warning',
          message: 'Đang phát bằng giọng đọc mặc định của thiết bị (Do trên Vercel chưa cài đặt GEMINI_API_KEY).',
          detail: 'Nếu muốn nghe giọng AI tự nhiên hơn, hãy vào Vercel -> Settings -> Environment Variables -> thêm GEMINI_API_KEY rồi Redeploy.'
        }
      : {
          level: 'error',
          message: 'Không thể phát âm thanh: Chưa có GEMINI_API_KEY trên Vercel và trình duyệt chặn giọng đọc mặc định.',
          detail: nativeRes.error || 'Vui lòng thêm GEMINI_API_KEY trên Vercel Settings -> Environment Variables rồi bấm Redeploy.'
        };
    emitSpeechDiagnostic(diag);
    return diag;
  }

  // 3. Request AI speech audio from Gemini
  const { audioData, error: aiError } = await generateSpeechWithError(
    isSlow ? `Slowly: ${cleanedForPrompt}` : cleanedForPrompt,
    voice
  );

  if (audioData) {
    const bytes = decode(audioData);

    // 3a. Try playing as WAV via HTMLAudioElement first (plays over Media channel even if iPhone Silent Switch is ON!)
    if (audioEl) {
      try {
        if (currentObjectUrl) {
          URL.revokeObjectURL(currentObjectUrl);
        }
        const wavUrl = createWavUrlFromPcm(bytes, 24000);
        currentObjectUrl = wavUrl;

        const playedViaHtmlAudio = await new Promise<boolean>((resolve) => {
          audioEl.src = wavUrl;
          audioEl.onended = () => resolve(true);
          audioEl.onerror = () => resolve(false);
          const p = audioEl.play();
          if (p !== undefined) {
            p.catch(() => resolve(false));
          }
        });

        if (playedViaHtmlAudio) {
          const okDiag: SpeechDiagnostic = { level: 'ok', message: '' };
          emitSpeechDiagnostic(okDiag);
          return okDiag;
        }
      } catch (e) {
        console.warn("HTMLAudio WAV playback fallback to WebAudio:", e);
      }
    }

    // 3b. Fallback to WebAudio AudioContext
    if (ctx) {
      try {
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
          float32[i] = int16[i] / 32768.0;
        }
        const buffer = ctx.createBuffer(1, float32.length, 24000);
        buffer.getChannelData(0).set(float32);

        await new Promise<void>((resolve) => {
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          currentSourceNode = source;
          source.onended = () => {
            if (currentSourceNode === source) currentSourceNode = null;
            resolve();
          };
          source.start(0);
        });

        const okDiag: SpeechDiagnostic = { level: 'ok', message: '' };
        emitSpeechDiagnostic(okDiag);
        return okDiag;
      } catch (err: any) {
        console.warn("WebAudio playback failed, falling back to native TTS:", err);
      }
    }
  }

  // 4. AI TTS failed or returned no audio -> Fallback to device SpeechSynthesis AND show the error/warning clearly!
  const nativeRes = await speakWithNativeFallback(cleanedForPrompt, voice, isSlow, lang);
  const diag: SpeechDiagnostic = nativeRes.ok
    ? {
        level: 'warning',
        message: `Giọng đọc AI gặp sự cố nên đã tự động phát bằng giọng của thiết bị.`,
        detail: aiError ? `Chi tiết lỗi AI: ${aiError}` : undefined
      }
    : {
        level: 'error',
        message: `Không thể phát âm thanh trên thiết bị này.`,
        detail: [aiError ? `Lỗi AI: ${aiError}` : '', nativeRes.error ? `Lỗi thiết bị: ${nativeRes.error}` : '']
          .filter(Boolean)
          .join(' | ')
      };
  emitSpeechDiagnostic(diag);
  return diag;
}

// LIVE API SESSION HANDLER
export function connectLive(callbacks: {
    onOpen: () => void,
    onMessage: (msg: LiveServerMessage) => void,
    onError: (e: any) => void,
    onClose: () => void
}, systemInstruction: string) {
    const aiLive = getAiClient();
    return aiLive.live.connect({
        model: 'gemini-3.8-live',
        callbacks: {
            onopen: callbacks.onOpen,
            onmessage: callbacks.onMessage,
            onerror: callbacks.onError,
            onclose: callbacks.onClose,
        },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
            systemInstruction
        }
    });
}

