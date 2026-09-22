
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Language, LanguageCode, VoiceType, TranslationAnalysis, TranscriptionResult, VocabularyItem, Scenario, ChatMessage, Dialogue, FriendPersona, FriendMessage, FriendChatResponse } from './types';
import { LANGUAGES, SCENARIOS, DIALOGUES, FRIEND_PERSONAS, FRIEND_TOPICS } from './constants';
import { translateText, generateSpeech, transcribeAudio, analyzeTranslation, generateVocabImage, getPracticeResponse, decode, connectLive, getFriendChatResponse } from './services/geminiService';

// ICONS
const SwapIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
);
const SpeakerIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" /></svg>
);
const TranslateInlineIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.621m0 0a48.474 48.474 0 016 .621m-12 0L10.5 21" /></svg>
);
const BookmarkIcon = ({ active }: { active?: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill={active ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 ${active ? 'text-amber-500' : ''}`}><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg>
);
const LiveIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" /></svg>
);

const ListeningTab = ({ voice, isSlow }: { voice: VoiceType, isSlow: boolean }) => {
    const [selectedDialogue, setSelectedDialogue] = useState<Dialogue | null>(null);
    const [showTranslation, setShowTranslation] = useState(false);
    const [isPlayingAll, setIsPlayingAll] = useState(false);

    const handleTTS = async (text: string) => {
        const audioData = await generateSpeech(isSlow ? `Slowly: ${text}` : text, voice);
        if (audioData) {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            const bytes = decode(audioData);
            const int16 = new Int16Array(bytes.buffer);
            const buffer = ctx.createBuffer(1, int16.length, 24000);
            buffer.getChannelData(0).set(Array.from(int16).map(v => v / 32768.0));
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            source.start();
            return new Promise((resolve) => { source.onended = resolve; });
        }
    };

    const playFullDialogue = async () => {
        if (!selectedDialogue || isPlayingAll) return;
        setIsPlayingAll(true);
        for (const line of selectedDialogue.lines) {
            await handleTTS(`${line.speaker} says: ${line.text}`);
            await new Promise(r => setTimeout(r, 500)); // Gap between lines
        }
        setIsPlayingAll(false);
    };

    if (selectedDialogue) {
        return (
            <div className="animate-fadeIn">
                <div className="flex items-center justify-between mb-8">
                    <button onClick={() => setSelectedDialogue(null)} className="text-sm font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                        ← Quay lại thư viện
                    </button>
                    <div className="flex gap-4">
                         <button 
                            onClick={() => setShowTranslation(!showTranslation)} 
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${showTranslation ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 text-gray-400'}`}
                        >
                            {showTranslation ? 'Ẩn dịch' : 'Hiện dịch'}
                        </button>
                        <button 
                            onClick={playFullDialogue} 
                            disabled={isPlayingAll}
                            className="px-6 py-2 bg-indigo-600 text-white text-[10px] font-black rounded-xl shadow-lg uppercase tracking-widest flex items-center gap-2 disabled:opacity-50"
                        >
                            <SpeakerIcon /> {isPlayingAll ? 'Đang phát...' : 'Nghe toàn bộ'}
                        </button>
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-[3rem] p-8 space-y-8 border border-gray-100 dark:border-gray-800">
                    <div className="text-center mb-10">
                        <div className="text-4xl mb-2">{selectedDialogue.icon}</div>
                        <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tighter">{selectedDialogue.title}</h2>
                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full">{selectedDialogue.category}</span>
                    </div>

                    <div className="space-y-6">
                        {selectedDialogue.lines.map((line, idx) => (
                            <div key={idx} className="flex gap-4 group">
                                <div className="w-20 shrink-0 text-[10px] font-black uppercase text-gray-400 mt-1">{line.speaker}</div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                        <p className="text-lg font-medium text-gray-800 dark:text-gray-100">{line.text}</p>
                                        <button onClick={() => handleTTS(line.text)} className="p-2 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"><SpeakerIcon /></button>
                                    </div>
                                    {showTranslation && (
                                        <p className="text-sm text-gray-500 dark:text-gray-400 italic mt-1 animate-fadeIn">🇻🇳 {line.translation}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fadeIn">
            <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tighter mb-8">Thư viện luyện nghe chuyên sâu</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {DIALOGUES.map((d) => (
                    <button 
                        key={d.id} 
                        onClick={() => setSelectedDialogue(d)}
                        className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:scale-[1.03] transition-all text-left border border-gray-100 dark:border-gray-700 group"
                    >
                        <div className="text-5xl mb-6 group-hover:scale-110 transition-transform duration-500">{d.icon}</div>
                        <h3 className="font-black text-xl text-gray-900 dark:text-white mb-2 leading-tight uppercase tracking-tight">{d.title}</h3>
                        <div className="flex items-center justify-between mt-4">
                            <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full uppercase tracking-widest">{d.category}</span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{d.lines.length} câu thoại</span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

const NotebookTab = ({ notebook, setNotebook }: { notebook: VocabularyItem[], setNotebook: any }) => {
    const removeCard = (id: string) => setNotebook(notebook.filter(n => n.id !== id));
    
    return (
        <div className="animate-fadeIn">
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tighter">Sổ tay thông minh ({notebook.length})</h2>
                <div className="text-xs font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-full">LẶP LẠI NGẮT QUÃNG TRONG PHIÊN</div>
            </div>
            {notebook.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-[3rem] border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <div className="text-6xl mb-4">📖</div>
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Chưa có từ vựng nào được lưu</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {notebook.map((item) => (
                        <div key={item.id} className="group relative bg-white dark:bg-gray-800 rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all border border-gray-100 dark:border-gray-700">
                            <div className="h-48 bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
                                {item.imageUrl ? (
                                    <img src={item.imageUrl} className="w-full h-full object-cover" alt={item.word} />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-xs font-black text-gray-300">NO IMAGE</div>
                                )}
                                <div className="absolute top-4 right-4 flex gap-2">
                                    <button onClick={() => removeCard(item.id)} className="p-2 bg-white/80 dark:bg-black/80 rounded-full text-red-500 hover:scale-110 transition-transform">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                    </button>
                                </div>
                            </div>
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-2xl font-black text-blue-600 tracking-tight">{item.word}</span>
                                    <div className="flex gap-1">
                                        {[1,2,3,4,5].map(lv => (
                                            <div key={lv} className={`w-1.5 h-1.5 rounded-full ${lv <= (item.level || 1) ? 'bg-amber-400' : 'bg-gray-200'}`} />
                                        ))}
                                    </div>
                                </div>
                                <div className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">{item.definition}</div>
                                <p className="text-xs text-gray-400 italic">"{item.example}"</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const LiveTalkOverlay = ({ isActive, onClose, systemInstruction }: { isActive: boolean, onClose: () => void, systemInstruction: string }) => {
    const [status, setStatus] = useState<'connecting' | 'listening' | 'speaking' | 'closed'>('connecting');
    const [transcription, setTranscription] = useState("");
    const sessionRef = useRef<any>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const nextStartTimeRef = useRef(0);

    useEffect(() => {
        if (!isActive) return;

        let inputAudioContext: AudioContext;
        let scriptProcessor: ScriptProcessorNode;
        
        const init = async () => {
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            const sessionPromise = connectLive({
                onOpen: () => {
                    setStatus('listening');
                    const source = inputAudioContext.createMediaStreamSource(stream);
                    scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                    scriptProcessor.onaudioprocess = (e) => {
                        const inputData = e.inputBuffer.getChannelData(0);
                        const int16 = new Int16Array(inputData.length);
                        for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
                        sessionPromise.then(s => s.sendRealtimeInput({ media: { data: btoa(String.fromCharCode(...new Uint8Array(int16.buffer))), mimeType: 'audio/pcm;rate=16000' } }));
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContext.destination);
                },
                onMessage: async (msg) => {
                    if (msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
                        setStatus('speaking');
                        const audioData = msg.serverContent.modelTurn.parts[0].inlineData.data;
                        const ctx = outputAudioContextRef.current!;
                        const bytes = decode(audioData);
                        const int16 = new Int16Array(bytes.buffer);
                        const buffer = ctx.createBuffer(1, int16.length, 24000);
                        buffer.getChannelData(0).set(Array.from(int16).map(v => v / 32768.0));
                        const source = ctx.createBufferSource();
                        source.buffer = buffer;
                        source.connect(ctx.destination);
                        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                        source.start(nextStartTimeRef.current);
                        nextStartTimeRef.current += buffer.duration;
                        source.onended = () => { if (ctx.currentTime >= nextStartTimeRef.current - 0.1) setStatus('listening'); };
                    }
                },
                onError: (e) => { console.error(e); setStatus('closed'); },
                onClose: () => setStatus('closed')
            }, systemInstruction);

            sessionRef.current = await sessionPromise;
        };

        init();
        return () => {
            sessionRef.current?.close();
            inputAudioContext?.close();
            outputAudioContextRef.current?.close();
        };
    }, [isActive]);

    if (!isActive) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl animate-fadeIn p-4">
            <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-[3.5rem] p-10 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 animate-pulse" />
                
                <h3 className="text-xs font-black text-blue-600 uppercase tracking-[0.4em] mb-10">Gemini Live Talk</h3>
                
                <div className="flex justify-center items-center h-40 mb-10">
                    <div className="flex items-center gap-1.5">
                        {[...Array(12)].map((_, i) => (
                            <div 
                                key={i} 
                                className={`w-2 rounded-full transition-all duration-300 ${status === 'speaking' ? 'bg-indigo-500' : 'bg-blue-400'}`}
                                style={{ 
                                    height: status === 'connecting' ? '8px' : `${Math.random() * 80 + 20}%`,
                                    animation: status !== 'connecting' ? `wave 1s ease-in-out infinite ${i * 0.1}s` : 'none'
                                }}
                            />
                        ))}
                    </div>
                </div>

                <div className="mb-10">
                    <div className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                        {status === 'connecting' && 'Đang kết nối...'}
                        {status === 'listening' && 'Tôi đang nghe đây...'}
                        {status === 'speaking' && 'Gemini đang trả lời...'}
                        {status === 'closed' && 'Đã ngắt kết nối'}
                    </div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Nói chuyện tự nhiên với AI</p>
                </div>

                <button onClick={onClose} className="px-10 py-4 bg-red-50 dark:bg-red-900/20 text-red-600 font-black rounded-3xl hover:bg-red-100 transition-colors uppercase text-xs tracking-widest">
                    Kết thúc cuộc gọi
                </button>
            </div>
            <style>{`
                @keyframes wave {
                    0%, 100% { height: 20%; }
                    50% { height: 80%; }
                }
            `}</style>
        </div>
    );
};

const CustomScenarioModal = ({ isOpen, onClose, onStart }: { isOpen: boolean, onClose: () => void, onStart: (name: string, prompt: string) => void }) => {
    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[3rem] p-10 shadow-2xl">
                <h3 className="text-2xl font-black text-gray-800 dark:text-white mb-2 tracking-tight">Tạo phối cảnh mới</h3>
                <p className="text-sm text-gray-400 mb-8">Mô tả tình huống bạn muốn luyện tập.</p>
                <div className="space-y-4">
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Tên phối cảnh (vd: Phỏng vấn visa)" className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-700 border-none font-bold" />
                    <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Chi tiết: Bạn đang ở đâu? Nói chuyện với ai? (Vd: Tôi đang ở đại sứ quán Mỹ để phỏng vấn visa du học)" className="w-full h-32 p-4 rounded-2xl bg-gray-50 dark:bg-gray-700 border-none resize-none font-medium" />
                </div>
                <div className="flex gap-4 mt-8">
                    <button onClick={onClose} className="flex-1 py-4 text-gray-400 font-black uppercase text-xs tracking-widest">Hủy</button>
                    <button onClick={() => onStart(name, desc)} className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs tracking-widest hover:scale-105 active:scale-95 transition-all">Bắt đầu</button>
                </div>
            </div>
        </div>
    );
};

const ConversationTab = ({ voice, isSlow, state, setState }: { voice: VoiceType, isSlow: boolean, state: any, setState: any }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isLiveMode, setIsLiveMode] = useState(false);
    const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
    const [translatedMessages, setTranslatedMessages] = useState<Record<number, string>>({});
    const [translatingIndex, setTranslatingIndex] = useState<number | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    useEffect(() => { scrollToBottom(); }, [state.messages]);

    const startScenario = async (s: Scenario) => {
        setTranslatedMessages({});
        setState({ ...state, scenario: s, loading: true, messages: [] });
        const response = await getPracticeResponse([], s.initialPrompt, "Hello, let's start.");
        if (response) {
            setState({ ...state, scenario: s, loading: false, messages: [{ role: 'ai', text: response.aiResponse }] });
            handleTTS(response.aiResponse);
        } else {
            setState({ ...state, scenario: s, loading: false });
        }
    };

    const handleCustomStart = (name: string, desc: string) => {
        setIsCustomModalOpen(false);
        const customScenario: Scenario = {
            id: 'custom-' + Date.now(),
            name,
            icon: '✨',
            description: desc,
            initialPrompt: `You are in a scenario described as: ${desc}. I am your conversation partner. Start a natural conversation in English.`,
            isCustom: true
        };
        startScenario(customScenario);
    };

    const handleSendMessage = async (text: string) => {
        if (!text.trim() || !state.scenario || state.loading) return;
        const newUserMsg: ChatMessage = { role: 'user', text };
        setState({ ...state, messages: [...state.messages, newUserMsg], inputText: '', loading: true });

        const response = await getPracticeResponse(state.messages, state.scenario.initialPrompt, text);
        if (response) {
            setState({ 
                ...state, 
                messages: [...state.messages, { ...newUserMsg, feedback: response.feedback }, { role: 'ai', text: response.aiResponse }],
                loading: false 
            });
            handleTTS(response.aiResponse);
        } else {
            setState({ ...state, loading: false });
        }
    };

    const handleTranslateMessage = async (index: number, text: string) => {
        if (translatedMessages[index]) {
            const newTrans = { ...translatedMessages }; delete newTrans[index]; setTranslatedMessages(newTrans);
            return;
        }
        setTranslatingIndex(index);
        try {
            const translation = await translateText(text, 'English', 'Vietnamese');
            setTranslatedMessages(prev => ({ ...prev, [index]: translation }));
        } finally { setTranslatingIndex(null); }
    };

    const handleTTS = async (text: string) => {
        const audioData = await generateSpeech(isSlow ? `Slowly: ${text}` : text, voice);
        if (audioData) {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            const bytes = decode(audioData);
            const int16 = new Int16Array(bytes.buffer);
            const buffer = ctx.createBuffer(1, int16.length, 24000);
            buffer.getChannelData(0).set(Array.from(int16).map(v => v / 32768.0));
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            source.start();
        }
    };

    if (!state.scenario) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
                {SCENARIOS.map(s => (
                    <button key={s.id} onClick={() => startScenario(s)} className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all text-left border border-gray-100 dark:border-gray-700">
                        <div className="text-4xl mb-4">{s.icon}</div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">{s.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">{s.description}</p>
                    </button>
                ))}
                <button onClick={() => setIsCustomModalOpen(true)} className="bg-blue-600/5 dark:bg-blue-900/20 p-6 rounded-3xl border-2 border-dashed border-blue-200 dark:border-blue-800 text-left hover:scale-[1.02] transition-all">
                    <div className="text-4xl mb-4">✨</div>
                    <h3 className="font-black text-lg text-blue-700 dark:text-blue-300">Tạo phối cảnh riêng</h3>
                    <p className="text-sm text-blue-400 mt-1">Luyện tập bất kỳ tình huống nào bạn muốn.</p>
                </button>
                <CustomScenarioModal isOpen={isCustomModalOpen} onClose={() => setIsCustomModalOpen(false)} onStart={handleCustomStart} />
            </div>
        );
    }

    return (
        <div className="flex flex-col animate-fadeIn">
            <div className="flex items-center justify-between mb-4 px-2">
                <button onClick={() => setState({ ...state, scenario: null })} className="text-sm font-bold text-blue-600">← Thoát</button>
                <button onClick={() => setIsLiveMode(true)} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-xs font-black rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all uppercase tracking-widest">
                    <LiveIcon /> Live Talk
                </button>
            </div>

            <div className="h-[500px] overflow-y-auto p-4 space-y-6 bg-gray-50 dark:bg-gray-900/50 rounded-3xl mb-4 scrollbar-hide shadow-inner">
                {state.messages.map((m: ChatMessage, i: number) => (
                    <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-slideIn`}>
                        <div className={`max-w-[85%] p-4 rounded-2xl ${m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-tl-none shadow-sm'}`}>
                            <div className="flex flex-col gap-2">
                                <div>{m.text}</div>
                                {translatedMessages[i] && <div className="text-[13px] border-t border-current/20 pt-2 italic opacity-80">🇻🇳 {translatedMessages[i]}</div>}
                            </div>
                            <div className="flex items-center gap-3 mt-2 opacity-50 hover:opacity-100">
                                <button onClick={() => handleTTS(m.text)}><SpeakerIcon /></button>
                                <button onClick={() => handleTranslateMessage(i, m.text)} className={translatingIndex === i ? 'animate-pulse' : ''}><TranslateInlineIcon /></button>
                            </div>
                        </div>
                        {m.feedback && (
                            <div className={`mt-2 w-[85%] p-5 rounded-[1.5rem] text-xs border ${m.feedback.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                                <div className="font-black mb-2 uppercase tracking-widest opacity-60">Nhận xét của Gemini</div>
                                <div className="mb-3 leading-relaxed">{m.feedback.explanation}</div>
                                
                                <div className="p-3 bg-white/60 dark:bg-black/10 rounded-xl font-medium mb-3">
                                    💡 Nên nói: <span className="text-blue-600 italic">"{m.feedback.suggestion}"</span>
                                </div>

                                {m.feedback.pronunciationTip && (
                                    <div className="mt-3 p-3 bg-blue-100/40 rounded-xl text-blue-900 flex gap-2">
                                        <div className="text-lg">👅</div>
                                        <div className="flex-1">
                                            <span className="font-black uppercase text-[10px] block mb-0.5">Mẹo phát âm:</span>
                                            {m.feedback.pronunciationTip}
                                        </div>
                                    </div>
                                )}

                                {m.feedback.moreWaysToSay && m.feedback.moreWaysToSay.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-black/5">
                                        <div className="text-[10px] font-black uppercase mb-3 opacity-60 tracking-widest">Biến thể học thuật:</div>
                                        {m.feedback.moreWaysToSay.map((way, idx) => (
                                            <div key={idx} className="italic mb-2 flex items-center gap-2 group">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                                "{way}"
                                                <button onClick={() => handleTTS(way)} className="opacity-0 group-hover:opacity-100"><SpeakerIcon /></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div className="flex gap-2 mb-2">
                <input value={state.inputText} onChange={e => setState({ ...state, inputText: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleSendMessage(state.inputText)} placeholder="Nhập câu trả lời bằng tiếng Anh..." className="flex-1 p-4 rounded-2xl bg-white dark:bg-gray-800 border-none font-medium" />
                <button onClick={() => handleSendMessage(state.inputText)} disabled={!state.inputText.trim() || state.loading} className="px-8 bg-blue-600 text-white font-black rounded-2xl shadow-lg uppercase text-xs tracking-widest disabled:opacity-50 transition-all">Gửi</button>
            </div>
            
            <LiveTalkOverlay isActive={isLiveMode} onClose={() => setIsLiveMode(false)} systemInstruction={state.scenario.initialPrompt} />
        </div>
    );
};

const FriendChatTab = ({ voice, isSlow, notebook, setNotebook }: { voice: VoiceType, isSlow: boolean, notebook: VocabularyItem[], setNotebook: any }) => {
    const [selectedPersona, setSelectedPersona] = useState<FriendPersona>(FRIEND_PERSONAS[0]);
    const [targetLang, setTargetLang] = useState<LanguageCode>(FRIEND_PERSONAS[0].language);
    const [currentTopic, setCurrentTopic] = useState<string>(FRIEND_PERSONAS[0].defaultTopic);
    const [messages, setMessages] = useState<FriendMessage[]>([
        {
            id: 'init-1',
            role: 'friend',
            text: FRIEND_PERSONAS[0].introMessage,
            translation: 'Chào đằng ấy! Có gì mới không nè? Mình là Alex. Rất hào hứng được trò chuyện cùng bạn! Ngày hôm nay của bạn thế nào rồi?',
            suggestedReplies: [
                "I had a busy day today, but I'm doing great! How about you?",
                "Just relaxing with some coffee. What exciting things did you do today?",
                "Tell me about your favorite weekend spots!"
            ],
            timestamp: Date.now()
        }
    ]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [isLiveMode, setIsLiveMode] = useState(false);
    const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
    const [showTranslations, setShowTranslations] = useState<Record<string, boolean>>({});
    const [isRecording, setIsRecording] = useState(false);
    const [recordingStatus, setRecordingStatus] = useState<string>('');
    const [selectedVocabPreview, setSelectedVocabPreview] = useState<{ word: string; definition: string; example: string } | null>(null);

    const recognitionRef = useRef<any>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, loading]);

    // Handle switching persona
    const handleSelectPersona = (p: FriendPersona) => {
        setSelectedPersona(p);
        setTargetLang(p.language);
        setCurrentTopic(p.defaultTopic);
        setShowTranslations({});
        setMessages([
            {
                id: 'init-' + Date.now(),
                role: 'friend',
                text: p.introMessage,
                timestamp: Date.now(),
                suggestedReplies: p.language === 'English' ? [
                    "Hey! Super happy to chat with you. How's your day?",
                    "I was just thinking about weekend plans. What do you like to do?",
                    "Tell me something fun that happened to you recently!"
                ] : p.language === 'Korean' ? [
                    "안녕! 오늘 하루는 어땠어? 맛있는 거 먹었니?",
                    "요즘 한국에서 인기 있는 노래나 드라마 추천해줘!",
                    "주말에 보통 뭐 하고 지내?"
                ] : p.language === 'Simplified Chinese' ? [
                    "嗨！今天过得挺充实的，你呢？",
                    "最近有什么好吃的或者好看的电影推荐吗？",
                    "我们来聊聊你最想去旅游的地方吧！"
                ] : p.language === 'Cantonese' ? [
                    "哈囉！今日過得幾好呀，你點呀？",
                    "平時放假最鍾意去邊度玩？",
                    "有冇咩好食嘅餐廳或者點心推介？"
                ] : [
                    "Chào bạn nha! Hôm nay công việc và cuộc sống của bạn thế nào?",
                    "Rất vui được tâm sự với bạn. Cuối tuần này bạn có dự định gì chưa?",
                    "Kể cho mình nghe về sở thích của bạn nhé!"
                ]
            }
        ]);
    };

    // Handle changing conversation topic
    const handleSelectTopic = async (topic: { id: string; icon: string; label: string; prompt: string }) => {
        setCurrentTopic(topic.label);
        const starterMsg: FriendMessage = {
            id: 'user-topic-' + Date.now(),
            role: 'user',
            text: `[Đổi chủ đề: ${topic.icon} ${topic.label}]`,
            timestamp: Date.now()
        };
        const updatedMessages = [...messages, starterMsg];
        setMessages(updatedMessages);
        setLoading(true);
        try {
            const prompt = `Let's switch our conversation topic to "${topic.label}". ${topic.prompt}. Start by sharing a quick relatable thought and asking me an engaging, friendly question about this!`;
            const history = messages.map(m => ({ role: m.role, text: m.text }));
            const res = await getFriendChatResponse(history, selectedPersona, targetLang, prompt, topic.label);
            if (res) {
                const friendMsg: FriendMessage = {
                    id: 'friend-' + Date.now(),
                    role: 'friend',
                    text: res.friendResponse,
                    translation: res.translationInVietnamese,
                    suggestedReplies: res.suggestedReplies,
                    friendlyTip: res.friendlyTip,
                    vocabulary: res.highlightedVocabulary,
                    timestamp: Date.now()
                };
                setMessages(prev => [...prev, friendMsg]);
                handleTTS(res.friendResponse, friendMsg.id);
            }
        } finally {
            setLoading(false);
        }
    };

    // Send user message
    const handleSendMessage = async (textToSend?: string) => {
        const text = (textToSend !== undefined ? textToSend : inputText).trim();
        if (!text || loading) return;

        const userMsg: FriendMessage = {
            id: 'user-' + Date.now(),
            role: 'user',
            text,
            timestamp: Date.now()
        };

        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setInputText('');
        setLoading(true);

        try {
            const history = updatedMessages.map(m => ({ role: m.role, text: m.text }));
            const res = await getFriendChatResponse(history, selectedPersona, targetLang, text, currentTopic);
            if (res) {
                const friendMsg: FriendMessage = {
                    id: 'friend-' + Date.now(),
                    role: 'friend',
                    text: res.friendResponse,
                    translation: res.translationInVietnamese,
                    suggestedReplies: res.suggestedReplies,
                    friendlyTip: res.friendlyTip,
                    vocabulary: res.highlightedVocabulary,
                    timestamp: Date.now()
                };
                setMessages(prev => [...prev, friendMsg]);
                handleTTS(res.friendResponse, friendMsg.id);
            }
        } finally {
            setLoading(false);
        }
    };

    // TTS playback
    const handleTTS = async (text: string, msgId?: string) => {
        if (msgId) setPlayingMsgId(msgId);
        try {
            const audioData = await generateSpeech(isSlow ? `Slowly: ${text}` : text, voice);
            if (audioData) {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                const bytes = decode(audioData);
                const int16 = new Int16Array(bytes.buffer);
                const buffer = ctx.createBuffer(1, int16.length, 24000);
                buffer.getChannelData(0).set(Array.from(int16).map(v => v / 32768.0));
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);
                source.start();
                source.onended = () => {
                    if (msgId) setPlayingMsgId(null);
                };
            }
        } catch {
            if (msgId) setPlayingMsgId(null);
        }
    };

    // Toggle Voice Recording
    const toggleRecording = async () => {
        if (isRecording) {
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch {}
            }
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                try { mediaRecorderRef.current.stop(); } catch {}
            }
            setIsRecording(false);
            setRecordingStatus('');
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            try {
                const recognition = new SpeechRecognition();
                recognition.continuous = false;
                recognition.interimResults = true;
                
                const langMap: Record<LanguageCode, string> = {
                    'English': 'en-US',
                    'Korean': 'ko-KR',
                    'Simplified Chinese': 'zh-CN',
                    'Cantonese': 'zh-HK',
                    'Vietnamese': 'vi-VN'
                };
                recognition.lang = langMap[targetLang] || 'en-US';

                recognition.onstart = () => {
                    setIsRecording(true);
                    setRecordingStatus('Đang lắng nghe giọng bạn...');
                };

                recognition.onresult = (event: any) => {
                    const transcript = Array.from(event.results)
                        .map((r: any) => r[0].transcript)
                        .join('');
                    setInputText(transcript);
                };

                recognition.onerror = () => {
                    setIsRecording(false);
                    setRecordingStatus('');
                };

                recognition.onend = () => {
                    setIsRecording(false);
                    setRecordingStatus('');
                };

                recognitionRef.current = recognition;
                recognition.start();
                return;
            } catch {}
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                stream.getTracks().forEach(t => t.stop());
                setRecordingStatus('Đang xử lý âm thanh...');
                try {
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                        const base64Audio = (reader.result as string).split(',')[1];
                        const res = await transcribeAudio(base64Audio, 'audio/webm', targetLang);
                        if (res?.text) {
                            setInputText(res.text);
                        }
                        setRecordingStatus('');
                    };
                    reader.readAsDataURL(audioBlob);
                } catch {
                    setRecordingStatus('');
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingStatus('Đang ghi âm (nhấn lại để gửi)...');
        } catch {
            setIsRecording(false);
            setRecordingStatus('Không thể mở micro');
            setTimeout(() => setRecordingStatus(''), 3000);
        }
    };

    // Save vocab to notebook
    const saveVocabToNotebook = async (v: { word: string; definition: string; example: string }) => {
        if (notebook.some((n: VocabularyItem) => n.word.toLowerCase() === v.word.toLowerCase())) return;
        const newItem: VocabularyItem = {
            id: 'vocab-' + Date.now(),
            word: v.word,
            definition: v.definition,
            example: v.example,
            visualPrompt: `Illustration of "${v.word}" representing: ${v.definition}`,
            createdAt: Date.now(),
            level: 1
        };
        const img = await generateVocabImage(newItem.visualPrompt);
        if (img) newItem.imageUrl = img;
        setNotebook((prev: VocabularyItem[]) => [...prev, newItem]);
        setSelectedVocabPreview(null);
    };

    const friendSystemPrompt = `You are ${selectedPersona.name}, a genuine and lively close friend. Personality: ${selectedPersona.personality}. Speak primarily in ${targetLang}. Talk warmly, share real feelings, and ask engaging follow-ups!`;

    return (
        <div className="animate-fadeIn space-y-6">
            {/* Persona Selector Carousel */}
            <div className="bg-gradient-to-br from-indigo-50/80 via-white to-blue-50/60 dark:from-gray-800/80 dark:via-gray-800/40 dark:to-gray-900/60 p-5 rounded-[2.5rem] border border-indigo-100/60 dark:border-gray-700/60 shadow-sm">
                <div className="flex items-center justify-between mb-3 px-1">
                    <div className="text-xs font-black uppercase tracking-[0.25em] text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                        <span>👥 Chọn bạn bè trò chuyện</span>
                    </div>
                    <div className="text-[11px] font-bold text-gray-400">
                        {FRIEND_PERSONAS.length} người bạn sẵn sàng kết nối
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    {FRIEND_PERSONAS.map(p => {
                        const isSelected = selectedPersona.id === p.id;
                        return (
                            <button
                                key={p.id}
                                onClick={() => handleSelectPersona(p)}
                                className={`flex flex-col items-center p-3.5 rounded-2xl transition-all text-center relative border-2 ${
                                    isSelected
                                        ? 'bg-white dark:bg-gray-700 border-indigo-600 shadow-md scale-[1.02]'
                                        : 'bg-white/60 dark:bg-gray-800/60 border-transparent hover:border-indigo-200 dark:hover:border-gray-600 hover:bg-white'
                                }`}
                            >
                                <div className="text-3xl mb-1.5 filter drop-shadow-sm">{p.avatar}</div>
                                <div className="font-bold text-xs text-gray-900 dark:text-white truncate w-full">{p.name}</div>
                                <div className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">{p.language}</div>
                                {isSelected && (
                                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Active Friend Header & Control Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-white dark:bg-gray-800/80 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="text-4xl p-3 bg-indigo-50 dark:bg-gray-700 rounded-2xl shadow-inner">{selectedPersona.avatar}</div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-gray-800 rounded-full" title="Đang trực tuyến"></div>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="font-black text-xl text-gray-900 dark:text-white">{selectedPersona.name}</h2>
                            <span className="px-2.5 py-0.5 text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 rounded-full border border-indigo-100 dark:border-indigo-800">
                                {targetLang}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-md">{selectedPersona.tagline}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Language selector for this friend */}
                    <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-600">
                        <span className="text-[11px] font-bold text-gray-400">Ngôn ngữ:</span>
                        <select
                            value={targetLang}
                            onChange={(e) => setTargetLang(e.target.value as LanguageCode)}
                            className="bg-transparent text-xs font-bold text-gray-800 dark:text-gray-200 border-none outline-none cursor-pointer"
                        >
                            {LANGUAGES.map(l => (
                                <option key={l.code} value={l.code}>{l.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Live Voice Call Button */}
                    <button
                        onClick={() => setIsLiveMode(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl text-xs font-black shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
                    >
                        <LiveIcon />
                        <span>Gọi thoại Live</span>
                    </button>

                    {/* Reset Chat Button */}
                    <button
                        onClick={() => handleSelectPersona(selectedPersona)}
                        title="Bắt đầu lại cuộc trò chuyện"
                        className="p-2.5 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 text-gray-500 dark:text-gray-300 rounded-xl transition-all"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Quick Conversation Starters / Topics Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 whitespace-nowrap pl-1">
                    Gợi ý chủ đề:
                </span>
                {FRIEND_TOPICS.map(topic => (
                    <button
                        key={topic.id}
                        onClick={() => handleSelectTopic(topic)}
                        disabled={loading}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                            currentTopic === topic.label
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                        }`}
                    >
                        <span className="mr-1.5">{topic.icon}</span>
                        {topic.label}
                    </button>
                ))}
            </div>

            {/* Chat Messages Stream */}
            <div className="h-[480px] overflow-y-auto p-4 sm:p-6 bg-gray-50/70 dark:bg-gray-900/40 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 space-y-5">
                {messages.map((msg, idx) => {
                    const isFriend = msg.role === 'friend';
                    const isLatest = idx === messages.length - 1;
                    const isTranslating = showTranslations[msg.id];

                    return (
                        <div
                            key={msg.id}
                            className={`flex flex-col ${isFriend ? 'items-start' : 'items-end'} animate-slideIn`}
                        >
                            <div className={`flex items-end gap-2.5 max-w-[90%] sm:max-w-[80%] ${isFriend ? 'flex-row' : 'flex-row-reverse'}`}>
                                {isFriend ? (
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-gray-700 flex items-center justify-center text-lg flex-shrink-0 mb-1 shadow-sm">
                                        {selectedPersona.avatar}
                                    </div>
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black flex-shrink-0 mb-1 shadow-sm">
                                        Bạn
                                    </div>
                                )}

                                <div
                                    className={`p-4 sm:p-5 rounded-3xl ${
                                        isFriend
                                            ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm shadow-sm border border-gray-100 dark:border-gray-700'
                                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-sm shadow-md'
                                    }`}
                                >
                                    {/* Main Text */}
                                    <div className="text-base sm:text-lg font-medium leading-relaxed">
                                        {msg.text}
                                    </div>

                                    {/* Inline Vietnamese translation */}
                                    {isFriend && msg.translation && isTranslating && (
                                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-sm text-indigo-600 dark:text-indigo-300 font-medium">
                                            🇻🇳 {msg.translation}
                                        </div>
                                    )}

                                    {/* Friendly Coach Tip Card */}
                                    {isFriend && msg.friendlyTip && (
                                        <div className="mt-3.5 p-3.5 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 rounded-2xl text-xs space-y-1">
                                            <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                                                <span>💡 Mẹo giao tiếp tự nhiên từ bạn bè:</span>
                                            </div>
                                            {msg.friendlyTip.naturalAlternative && (
                                                <div className="text-gray-800 dark:text-gray-200 font-semibold">
                                                    Nói tự nhiên: <span className="text-emerald-600 dark:text-emerald-400">"{msg.friendlyTip.naturalAlternative}"</span>
                                                </div>
                                            )}
                                            {msg.friendlyTip.explanation && (
                                                <div className="text-gray-600 dark:text-gray-400">
                                                    {msg.friendlyTip.explanation}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Highlighted Vocabulary & Slang Badges */}
                                    {isFriend && msg.vocabulary && msg.vocabulary.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                                            <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">
                                                Cụm từ / Tiếng lóng nổi bật:
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {msg.vocabulary.map((v, vIdx) => (
                                                    <button
                                                        key={vIdx}
                                                        onClick={() => setSelectedVocabPreview(v)}
                                                        className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all border border-indigo-200/60 dark:border-indigo-800/60"
                                                    >
                                                        ✨ {v.word}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons Toolbar for Friend Messages */}
                                    {isFriend && (
                                        <div className="flex items-center gap-3 mt-3 pt-2 text-xs text-gray-400">
                                            <button
                                                onClick={() => handleTTS(msg.text, msg.id)}
                                                className={`flex items-center gap-1 hover:text-blue-600 font-bold transition-all ${
                                                    playingMsgId === msg.id ? 'text-blue-600 font-black animate-pulse' : ''
                                                }`}
                                            >
                                                <SpeakerIcon />
                                                <span>{playingMsgId === msg.id ? 'Đang đọc...' : 'Nghe'}</span>
                                            </button>

                                            {msg.translation && (
                                                <button
                                                    onClick={() => setShowTranslations(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                                                    className="flex items-center gap-1 hover:text-indigo-600 font-bold transition-all"
                                                >
                                                    <TranslateInlineIcon />
                                                    <span>{isTranslating ? 'Ẩn dịch' : 'Dịch nghĩa'}</span>
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Suggested Quick Replies (Under the latest friend message) */}
                            {isFriend && isLatest && msg.suggestedReplies && msg.suggestedReplies.length > 0 && !loading && (
                                <div className="mt-3 ml-11 flex flex-wrap gap-2 max-w-[85%]">
                                    {msg.suggestedReplies.map((reply, rIdx) => (
                                        <button
                                            key={rIdx}
                                            onClick={() => handleSendMessage(reply)}
                                            className="px-3.5 py-2 bg-white dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-gray-700 border border-indigo-100 dark:border-gray-700 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-2xl shadow-sm hover:scale-[1.02] active:scale-95 transition-all text-left"
                                        >
                                            💬 {reply}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Loading typing indicator */}
                {loading && (
                    <div className="flex items-end gap-2.5 animate-slideIn">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-gray-700 flex items-center justify-center text-lg flex-shrink-0 mb-1">
                            {selectedPersona.avatar}
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-3xl rounded-bl-sm border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"></span>
                            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.2s]"></span>
                            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.4s]"></span>
                            <span className="text-xs text-gray-400 font-bold ml-2">{selectedPersona.name} đang soạn tin...</span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Recording Status Prompt */}
            {recordingStatus && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs font-bold text-amber-700 dark:text-amber-300 text-center animate-pulse">
                    🎙️ {recordingStatus}
                </div>
            )}

            {/* Input Bar */}
            <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-lg">
                {/* Microphone Button */}
                <button
                    onClick={toggleRecording}
                    className={`p-3.5 rounded-2xl transition-all ${
                        isRecording
                            ? 'bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-500/40'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-indigo-50 hover:text-indigo-600'
                    }`}
                    title={isRecording ? 'Dừng ghi âm' : 'Nói bằng giọng nói'}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                    </svg>
                </button>

                {/* Text input */}
                <input
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage(inputText)}
                    placeholder={`Nhắn gì đó với ${selectedPersona.name} bằng ${targetLang}...`}
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-transparent text-gray-900 dark:text-white border-none outline-none font-medium text-sm placeholder-gray-400"
                />

                {/* Send Button */}
                <button
                    onClick={() => handleSendMessage(inputText)}
                    disabled={!inputText.trim() || loading}
                    className="px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black rounded-2xl shadow-md uppercase text-xs tracking-widest disabled:opacity-40 hover:scale-[1.02] active:scale-95 transition-all"
                >
                    Gửi
                </button>
            </div>

            {/* Vocab preview & save modal */}
            {selectedVocabPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="bg-white dark:bg-gray-800 w-full max-w-md p-6 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                                🔖 Chi tiết cụm từ / từ vựng
                            </span>
                            <button
                                onClick={() => setSelectedVocabPreview(null)}
                                className="text-gray-400 hover:text-gray-600 text-lg font-bold p-1"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="text-2xl font-black text-gray-900 dark:text-white uppercase mb-2">
                            {selectedVocabPreview.word}
                        </div>
                        <div className="text-sm font-semibold text-indigo-600 dark:text-indigo-300 mb-3">
                            {selectedVocabPreview.definition}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-700/50 p-3 rounded-2xl mb-6">
                            "{selectedVocabPreview.example}"
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => saveVocabToNotebook(selectedVocabPreview)}
                                className="flex-1 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold rounded-2xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase tracking-wider"
                            >
                                📖 Lưu vào sổ tay thông minh
                            </button>
                            <button
                                onClick={() => setSelectedVocabPreview(null)}
                                className="px-5 py-3.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-2xl text-xs hover:bg-gray-200 transition-all"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Live voice call overlay */}
            <LiveTalkOverlay
                isActive={isLiveMode}
                onClose={() => setIsLiveMode(false)}
                systemInstruction={friendSystemPrompt}
            />
        </div>
    );
};

const DictionaryTab = ({ voice, isSlow, state, setState, notebook, setNotebook }: { voice: VoiceType, isSlow: boolean, state: any, setState: any, notebook: VocabularyItem[], setNotebook: any }) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [translateError, setTranslateError] = useState<string | null>(null);

    const handleTranslate = async () => {
        if (!state.inputText.trim() || state.loading) return;
        setTranslateError(null);
        setState((prev: any) => ({ ...prev, loading: true, analysis: null }));
        
        try {
            const trans = await translateText(state.inputText, state.sourceLang, state.targetLang);
            
            // Check if translation response is an error message
            if (trans.startsWith("Hệ thống AI đang quá tải") || trans.startsWith("Không thể dịch")) {
                setTranslateError(trans);
                setState((prev: any) => ({ ...prev, outputText: trans, loading: false }));
                return;
            }

            // Immediately show translation result
            setState((prev: any) => ({ ...prev, outputText: trans, loading: false }));

            // Then asynchronously run vocabulary and grammar analysis without blocking UI
            setIsAnalyzing(true);
            try {
                const insights = await analyzeTranslation(state.inputText, state.sourceLang, state.targetLang, trans);
                if (insights) {
                    setState((prev: any) => ({ ...prev, analysis: insights }));
                }
            } catch (analysisErr) {
                console.warn("Background analysis failed:", analysisErr);
            } finally {
                setIsAnalyzing(false);
            }
        } catch (e: any) {
            const errMsg = "Đã xảy ra lỗi khi kết nối với máy chủ AI. Vui lòng bấm thử lại.";
            setTranslateError(errMsg);
            setState((prev: any) => ({ ...prev, outputText: errMsg, loading: false }));
        }
    };

    const handleTTS = async (text: string) => {
        if (!text || text === translateError) return;
        const audioData = await generateSpeech(isSlow ? `Slowly: ${text}` : text, voice);
        if (audioData) {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            const bytes = decode(audioData);
            const int16 = new Int16Array(bytes.buffer);
            const buffer = ctx.createBuffer(1, int16.length, 24000);
            buffer.getChannelData(0).set(Array.from(int16).map(v => v / 32768.0));
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            source.start();
        }
    };

    const saveToNotebook = async (item: VocabularyItem) => {
        if (notebook.some(n => n.word === item.word)) return;
        let finalItem = { ...item, id: Date.now().toString(), createdAt: Date.now(), level: 1 };
        if (!finalItem.imageUrl) finalItem.imageUrl = await generateVocabImage(finalItem.visualPrompt) || "";
        setNotebook([...notebook, finalItem]);
    };

    return (
        <div className="animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4">
                <div className="space-y-2">
                    <select value={state.sourceLang} onChange={e => setState((prev: any) => ({ ...prev, sourceLang: e.target.value as LanguageCode }))} className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-700 border-none font-bold">
                        {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                    </select>
                    <div className="relative">
                        <textarea 
                            value={state.inputText} 
                            onChange={e => setState((prev: any) => ({ ...prev, inputText: e.target.value }))}
                            onKeyDown={e => {
                                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                    e.preventDefault();
                                    handleTranslate();
                                }
                            }}
                            className="w-full h-56 p-6 rounded-3xl bg-gray-50 dark:bg-gray-700/50 border-none resize-none text-xl focus:ring-2 focus:ring-blue-500/20" 
                            placeholder="Nhập văn bản cần dịch... (Nhấn Ctrl+Enter hoặc Cmd+Enter để dịch nhanh)" 
                        />
                        {state.inputText && (
                            <button 
                                onClick={() => setState((prev: any) => ({ ...prev, inputText: '', outputText: '', analysis: null }))}
                                className="absolute top-4 right-4 text-xs font-semibold px-2.5 py-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 text-gray-600 dark:text-gray-200 rounded-full transition-all"
                            >
                                Xóa
                            </button>
                        )}
                    </div>
                </div>
                <button 
                    onClick={() => setState((prev: any) => ({ ...prev, sourceLang: prev.targetLang, targetLang: prev.sourceLang, inputText: prev.outputText, outputText: prev.inputText }))} 
                    className="self-center mt-8 p-4 rounded-full bg-blue-50 text-blue-600 hover:rotate-180 transition-all duration-700 hover:bg-blue-100"
                    title="Đổi chiều ngôn ngữ"
                >
                    <SwapIcon />
                </button>
                <div className="space-y-2">
                    <select value={state.targetLang} onChange={e => setState((prev: any) => ({ ...prev, targetLang: e.target.value as LanguageCode }))} className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-700 border-none font-bold">
                        {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                    </select>
                    <div className="relative">
                        <textarea 
                            value={state.outputText} 
                            readOnly 
                            className={`w-full h-56 p-6 rounded-3xl border-none resize-none text-xl font-medium ${translateError ? 'bg-red-50/50 dark:bg-red-950/20 text-red-600 dark:text-red-400' : 'bg-blue-50/30 dark:bg-blue-900/10'}`} 
                            placeholder="Kết quả bản dịch sẽ hiển thị tại đây..." 
                        />
                        {state.loading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 dark:bg-gray-800/70 rounded-3xl backdrop-blur-xs gap-3">
                                <div className="animate-spin h-10 w-10 border-4 border-blue-500 rounded-full border-t-transparent" />
                                <span className="text-xs font-bold text-blue-600 tracking-wide">Đang dịch qua Gemini AI...</span>
                            </div>
                        )}
                        {state.outputText && !state.loading && !translateError && (
                            <div className="absolute bottom-4 right-4 flex items-center gap-2">
                                <button 
                                    onClick={() => navigator.clipboard.writeText(state.outputText)} 
                                    className="p-3 bg-white dark:bg-gray-600 text-gray-600 dark:text-gray-200 hover:text-blue-600 rounded-full shadow-lg transition-all"
                                    title="Sao chép"
                                >
                                    📋
                                </button>
                                <button 
                                    onClick={() => handleTTS(state.outputText)} 
                                    className="p-4 bg-white dark:bg-gray-600 text-blue-600 hover:scale-105 active:scale-95 rounded-full shadow-2xl transition-all"
                                    title="Nghe phát âm"
                                >
                                    <SpeakerIcon />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {translateError && (
                <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-amber-800 dark:text-amber-200 text-sm font-medium">
                        <span className="text-xl">⚠️</span>
                        <span>{translateError}</span>
                    </div>
                    <button 
                        onClick={handleTranslate} 
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all shrink-0"
                    >
                        Thử lại ngay
                    </button>
                </div>
            )}

            <div className="mt-8 text-center flex items-center justify-center gap-4">
                <button 
                    onClick={handleTranslate} 
                    disabled={state.loading || !state.inputText.trim()} 
                    className="px-16 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black rounded-3xl shadow-xl hover:scale-[1.03] active:scale-95 transition-all uppercase tracking-widest text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {state.loading ? 'Đang dịch...' : 'Dịch & Phân tích chuyên sâu'}
                </button>
            </div>
            
            {isAnalyzing && (
                <div className="mt-6 text-center text-xs font-semibold text-blue-600 flex items-center justify-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent" />
                    <span>Đang bóc tách ngữ pháp & từ vựng thông minh...</span>
                </div>
            )}

            {state.analysis && (
                <div className="mt-10 p-8 bg-blue-50 dark:bg-gray-800/50 rounded-[2.5rem] border border-blue-100 dark:border-blue-900/30">
                    <h3 className="font-black text-blue-800 dark:text-blue-300 mb-6 flex items-center gap-2 uppercase text-xs tracking-[0.3em]">Hệ thống từ vựng thông minh</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {state.analysis.vocabulary.map((v: VocabularyItem, i: number) => (
                            <div key={i} className="bg-white dark:bg-gray-800 p-4 rounded-[2rem] shadow-sm relative group overflow-hidden border border-gray-100 dark:border-gray-700">
                                <div className="font-black text-xl text-gray-900 dark:text-white mb-1 uppercase tracking-tighter">{v.word}</div>
                                <div className="text-sm font-semibold text-blue-600 mb-3">{v.definition}</div>
                                <div className="text-xs text-gray-400 italic mb-4">"{v.example}"</div>
                                <button 
                                    onClick={() => saveToNotebook(v)} 
                                    className="flex items-center gap-2 w-full justify-center py-3 bg-gray-50 dark:bg-gray-700 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-amber-50 hover:text-amber-600 transition-all"
                                >
                                    <BookmarkIcon active={notebook.some(n => n.word === v.word)} />
                                    {notebook.some(n => n.word === v.word) ? 'Đã lưu vào sổ tay' : 'Lưu vào sổ tay'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function App() {
    const [activeTab, setActiveTab] = useState<'translate' | 'friend' | 'practice' | 'listening' | 'notebook'>('translate');
    const [voice, setVoice] = useState<VoiceType>('female');
    const [isSlowMode, setIsSlowMode] = useState(false);
    const [notebook, setNotebook] = useState<VocabularyItem[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem('gemini_notebook');
        if (saved) setNotebook(JSON.parse(saved));
    }, []);

    useEffect(() => {
        localStorage.setItem('gemini_notebook', JSON.stringify(notebook));
    }, [notebook]);

    const [translateState, setTranslateState] = useState({
        inputText: '', outputText: '', sourceLang: 'Vietnamese' as LanguageCode, targetLang: 'English' as LanguageCode, loading: false, analysis: null as TranslationAnalysis | null
    });

    const [practiceState, setPracticeState] = useState({
        scenario: null as Scenario | null, messages: [] as ChatMessage[], inputText: '', loading: false, miniInput: '', miniOutput: '', miniSourceLang: 'English' as LanguageCode, miniTargetLang: 'Vietnamese' as LanguageCode, miniLoading: false
    });

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 sm:p-8">
            <div className="max-w-6xl mx-auto">
                <header className="flex flex-col lg:flex-row items-center justify-between mb-10 gap-6">
                    <div>
                        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 tracking-tighter">GEMINI ELT</h1>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-[0.4em] mt-1">Advanced Language Ecosystem</p>
                    </div>
                    <div className="flex p-1.5 bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-x-auto max-w-full">
                        {['translate', 'friend', 'practice', 'listening', 'notebook'].map((tab) => (
                            <button 
                                key={tab}
                                onClick={() => setActiveTab(tab as any)} 
                                className={`px-5 sm:px-7 py-3 rounded-2xl text-[10px] sm:text-xs font-black transition-all uppercase tracking-widest whitespace-nowrap ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                            >
                                {tab === 'translate' ? '🌐 Dịch thuật' : tab === 'friend' ? '💬 Bạn bè AI' : tab === 'practice' ? 'Tình huống' : tab === 'listening' ? 'Luyện nghe' : 'Sổ tay'}
                            </button>
                        ))}
                    </div>
                </header>

                <main className="bg-white dark:bg-gray-800 shadow-2xl rounded-[3.5rem] p-6 sm:p-12 border border-gray-100 dark:border-gray-700">
                    <div className="mb-10 flex flex-wrap justify-end items-center gap-4">
                        <button onClick={() => setIsSlowMode(!isSlowMode)} className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${isSlowMode ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-gray-50 border-transparent text-gray-400'}`}>
                            🐢 Nói chậm
                        </button>
                        <div className="flex items-center gap-2 p-1.5 bg-gray-50 dark:bg-gray-700 rounded-2xl">
                            <button onClick={() => setVoice('female')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${voice === 'female' ? 'bg-white dark:bg-gray-600 text-blue-600 shadow-sm' : 'text-gray-400'}`}>Giọng Nữ</button>
                            <button onClick={() => setVoice('male')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${voice === 'male' ? 'bg-white dark:bg-gray-600 text-blue-600 shadow-sm' : 'text-gray-400'}`}>Giọng Nam</button>
                        </div>
                    </div>

                    <div className={activeTab === 'friend' ? 'block' : 'hidden'}>
                        <FriendChatTab voice={voice} isSlow={isSlowMode} notebook={notebook} setNotebook={setNotebook} />
                    </div>
                    <div className={activeTab === 'translate' ? 'block' : 'hidden'}>
                        <DictionaryTab voice={voice} isSlow={isSlowMode} state={translateState} setState={setTranslateState} notebook={notebook} setNotebook={setNotebook} />
                    </div>
                    <div className={activeTab === 'practice' ? 'block' : 'hidden'}>
                        <ConversationTab voice={voice} isSlow={isSlowMode} state={practiceState} setState={setPracticeState} />
                    </div>
                    <div className={activeTab === 'listening' ? 'block' : 'hidden'}>
                        <ListeningTab voice={voice} isSlow={isSlowMode} />
                    </div>
                    <div className={activeTab === 'notebook' ? 'block' : 'hidden'}>
                        <NotebookTab notebook={notebook} setNotebook={setNotebook} />
                    </div>
                </main>

                <footer className="text-center mt-12 text-gray-400 text-[10px] font-bold uppercase tracking-[0.5em] opacity-60">
                    Gemini Advanced Learning Ecosystem &bull; v4.2.0 AI Companion Update
                </footer>
            </div>
            <style>{`
                .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
                .animate-slideIn { animation: slideIn 0.3s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
                @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
}

