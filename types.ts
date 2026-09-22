
export type LanguageCode = 'Vietnamese' | 'English' | 'Korean' | 'Simplified Chinese' | 'Cantonese';

export interface Language {
  code: LanguageCode;
  name: string;
}

export type VoiceType = 'female' | 'male';

export interface VocabularyItem {
  id: string;
  word: string;
  definition: string;
  example: string;
  visualPrompt: string;
  imageUrl?: string;
  level?: number; // 1-5 for SRS
  createdAt: number;
}

export interface TranslationAnalysis {
  grammar: string;
  variations: {
    style: string;
    text: string;
  }[];
  vocabulary: VocabularyItem[];
}

export interface TranscriptionResult {
  text: string;
  score: number;
  feedback: string;
}

export interface Scenario {
  id: string;
  name: string;
  icon: string;
  description: string;
  initialPrompt: string;
  isCustom?: boolean;
}

export interface DialogueLine {
  speaker: string;
  text: string;
  translation: string;
}

export interface Dialogue {
  id: string;
  title: string;
  category: 'Store' | 'Hotel' | 'Restaurant' | 'General';
  icon: string;
  lines: DialogueLine[];
}

export interface ChatMessage {
  role: 'ai' | 'user';
  text: string;
  feedback?: {
    isCorrect: boolean;
    explanation: string;
    suggestion: string;
    moreWaysToSay?: string[];
    pronunciationTip?: string;
  };
}

export interface PracticeTurnResponse {
  aiResponse: string;
  feedback: {
    isCorrect: boolean;
    explanation: string;
    suggestion: string;
    moreWaysToSay: string[];
    pronunciationTip: string;
  };
}

export interface FriendPersona {
  id: string;
  name: string;
  avatar: string;
  tagline: string;
  language: LanguageCode;
  personality: string;
  defaultTopic: string;
  introMessage: string;
}

export interface FriendMessage {
  id: string;
  role: 'friend' | 'user';
  text: string;
  translation?: string;
  suggestedReplies?: string[];
  friendlyTip?: {
    correction?: string;
    naturalAlternative?: string;
    explanation?: string;
  };
  vocabulary?: {
    word: string;
    definition: string;
    example: string;
  }[];
  timestamp: number;
}

export interface FriendChatResponse {
  friendResponse: string;
  translationInVietnamese: string;
  suggestedReplies: string[];
  friendlyTip?: {
    correction?: string;
    naturalAlternative?: string;
    explanation?: string;
  };
  highlightedVocabulary?: {
    word: string;
    definition: string;
    example: string;
  }[];
}
