
import { GoogleGenAI, Modality, Type, LiveServerMessage } from "@google/genai";
import { LanguageCode, VoiceType, TranslationAnalysis, TranscriptionResult, PracticeTurnResponse, ChatMessage, FriendPersona, FriendChatResponse } from '../types';

function getApiKey(): string {
  const envKey = (typeof process !== 'undefined' && process.env)
    ? (process.env.GEMINI_API_KEY || process.env.API_KEY || '')
    : '';
  return envKey === 'PLACEHOLDER_API_KEY' ? '' : envKey;
}

function getAiClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: getApiKey() });
}

const PREBUILT_VOICES = {
    female: 'Kore',
    male: 'Puck',
};

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
  try {
    const prompt = `Translate the following text from ${sourceLang} to ${targetLang}. 
Provide only the translated text directly, without markdown quotes or explanation.

Text: ${text}`;
    
    return await withRetry(async () => {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
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
    return "Không thể dịch lúc này. Vui lòng kiểm tra kết nối và thử lại.";
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
          const ai = getAiClient();
          const response = await ai.models.generateContent({
              model: 'gemini-3.8-flash',
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
          const ai = getAiClient();
          const response = await ai.models.generateContent({
              model: 'gemini-3.8-flash',
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
          const ai = getAiClient();
          const response = await ai.models.generateContent({
              model: 'gemini-3.8-flash',
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
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
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

export async function generateSpeech(text: string, voice: VoiceType): Promise<string | null> {
  if (!text.trim()) return null;
  try {
    return await withRetry(async () => {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-tts-preview",
          contents: [{ parts: [{ text }] }],
          config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: PREBUILT_VOICES[voice] } } },
          },
      });
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    });
  } catch (error) {
    console.warn("Speech generation error:", error);
    return null;
  }
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

