import React, { useState, useEffect } from 'react';
import { geminiService, playPcmAudio, createWavBlob } from './geminiService';
import { VoiceName, TargetLanguage, ScriptStyle, AppMode, TranscriptLine, TitleSuggestion } from './types';

const App: React.FC = () => {
  const [isLaunching, setIsLaunching] = useState(true);
  const [showKeySelector, setShowKeySelector] = useState(false);
  const [mode, setMode] = useState<AppMode>(AppMode.VIDEO);
  const [scriptPrompt, setScriptPrompt] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [titles, setTitles] = useState<TitleSuggestion[]>([]);
  const [generatedAudioB64, setGeneratedAudioB64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // Settings
  const [voice1, setVoice1] = useState<VoiceName>(VoiceName.ZEPHYR);
  const [voice2, setVoice2] = useState<VoiceName>(VoiceName.KORE);
  const [targetLang, setTargetLang] = useState<TargetLanguage>(TargetLanguage.BANGLA);
  const [scriptStyle, setScriptStyle] = useState<ScriptStyle>(ScriptStyle.SERIOUS);
  const [isDualVoice, setIsDualVoice] = useState(false);

  useEffect(() => {
    checkApiKey();
    
    // Simulate Native Splash Screen
    setTimeout(() => {
      setIsLaunching(false);
    }, 2000);

    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  const checkApiKey = async () => {
    const hasKey = geminiService.isApiKeyConfigured();
    const hasSelected = (window as any).aistudio?.hasSelectedApiKey ? await (window as any).aistudio.hasSelectedApiKey() : false;
    
    if (!hasKey && !hasSelected) {
      setShowKeySelector(true);
    } else {
      setShowKeySelector(false);
    }
  };

  const handleOpenKeySelector = async () => {
    triggerHaptic();
    if ((window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
      setShowKeySelector(false);
      window.location.reload(); // Refresh to apply the new key
    } else {
      setError("এই ডিভাইসে চাবি সিলেক্ট করার অপশন পাওয়া যাচ্ছে না।");
    }
  };

  const triggerHaptic = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }
  };

  const processContent = async () => {
    triggerHaptic();
    setError(null);
    setGeneratedAudioB64(null);

    if (mode === AppMode.VIDEO && !videoFile) {
      setError("ভিডিও ফাইল সিলেক্ট করুন।");
      return;
    }
    if (mode === AppMode.AI_GEN && !scriptPrompt.trim()) {
      setError("টপিক লিখুন।");
      return;
    }

    setIsProcessing(true);
    
    try {
      let result;
      if (mode === AppMode.VIDEO && videoFile) {
        const reader = new FileReader();
        const base64VideoPromise = new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(videoFile);
        });
        const base64Video = await base64VideoPromise;
        result = await geminiService.processVideoContent(base64Video, videoFile.type, targetLang, scriptStyle, isDualVoice);
      } else {
        result = await geminiService.generateScriptFromText(scriptPrompt, targetLang, scriptStyle, isDualVoice);
      }
      
      setTranscript(result.script || []);
      setTitles(result.titles || []);

      if (result.script?.length > 0) {
        const audio = await geminiService.generateSpeech(
          result.script.map((l: any) => ({ text: l.rewritten, speaker: l.speaker })), 
          voice1, 
          voice2, 
          isDualVoice
        );
        if (audio) setGeneratedAudioB64(audio);
      }
    } catch (err: any) {
      const msg = err.message || "";
      if (msg === "INVALID_KEY" || msg.includes("API key not valid") || msg.includes("entity was not found")) {
        setError("আপনার API Key টি কাজ করছে না। অনুগ্রহ করে সঠিক কি (Key) সিলেক্ট করুন।");
        setShowKeySelector(true);
      } else {
        setError("দুঃখিত, কোনো একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।");
      }
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    }
  };

  if (isLaunching) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-[100]">
        <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl shadow-indigo-200 splash-icon">
          <i className="fa-solid fa-bolt-lightning text-4xl"></i>
        </div>
        <div className="absolute bottom-16 flex flex-col items-center gap-2">
          <p className="font-black text-slate-900 tracking-tighter text-xl uppercase">Tutul Boss Studio</p>
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce"></div>
            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
            <div className="w-1.5 h-1.5 bg-indigo-200 rounded-full animate-bounce [animation-delay:0.4s]"></div>
          </div>
        </div>
      </div>
    );
  }

  if (showKeySelector) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex flex-col items-center justify-center z-[110] px-10 text-center">
        <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-6">
          <i className="fa-solid fa-key text-3xl"></i>
        </div>
        <h2 className="text-xl font-black text-slate-900 mb-2">Setup Required</h2>
        <p className="text-slate-500 text-sm mb-8 leading-relaxed">
          অ্যাপটি ব্যবহার করার জন্য আপনাকে একটি বৈধ <b>API Key</b> সিলেক্ট করতে হবে। এটি সম্পূর্ণ নিরাপদ।
        </p>
        <button 
          onClick={handleOpenKeySelector}
          className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black shadow-xl shadow-indigo-100 btn-active mb-4"
        >
          SELECT API KEY
        </button>
        <a 
          href="https://ai.google.dev/gemini-api/docs/billing" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-indigo-600 text-[10px] font-black uppercase tracking-widest underline decoration-2 underline-offset-4"
        >
          Learn About Billing
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white animate-app-in">
      {/* Header */}
      <header className="px-6 pt-14 pb-4 bg-white/90 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between border-b border-slate-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
            <i className="fa-solid fa-bolt-lightning text-sm"></i>
          </div>
          <div className="flex flex-col">
            <h1 className="font-black text-slate-900 tracking-tighter text-base leading-none">TUTUL BOSS</h1>
            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> SYSTEM ONLINE
            </span>
          </div>
        </div>
        <button onClick={() => { triggerHaptic(); window.location.reload(); }} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
          <i className="fa-solid fa-rotate-right text-xs"></i>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-5 pt-6 pb-40 space-y-6">
        
        {/* Error Message UI */}
        {error && (
          <div className="p-5 bg-rose-50 border border-rose-100 rounded-[2rem] flex items-start gap-4 animate-shake">
            <div className="w-10 h-10 bg-rose-500 rounded-full flex items-center justify-center text-white shrink-0 shadow-lg shadow-rose-100">
              <i className="fa-solid fa-triangle-exclamation text-xs"></i>
            </div>
            <div>
              <p className="text-xs font-black text-rose-600 uppercase mb-1">Error Detected</p>
              <p className="text-xs font-bold text-rose-500 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        <div className="bg-slate-100/50 p-1.5 rounded-[2rem] flex items-center gap-1">
          <button onClick={() => { triggerHaptic(); setMode(AppMode.VIDEO); }} className={`flex-1 py-3.5 rounded-[1.75rem] text-[10px] font-black tracking-widest transition-all ${mode === AppMode.VIDEO ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>VIDEO MODE</button>
          <button onClick={() => { triggerHaptic(); setMode(AppMode.AI_GEN); }} className={`flex-1 py-3.5 rounded-[1.75rem] text-[10px] font-black tracking-widest transition-all ${mode === AppMode.AI_GEN ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>AI STORY</button>
        </div>

        <div className="bg-white rounded-[2.5rem] p-7 shadow-[0_20px_50px_rgba(0,0,0,0.03)] border border-slate-50 space-y-7">
          {mode === AppMode.VIDEO ? (
            <div className="relative">
              <input type="file" accept="video/*" className="absolute inset-0 opacity-0 z-10" onChange={(e) => { triggerHaptic(); setVideoFile(e.target.files?.[0] || null); }} />
              <div className="border-2 border-dashed border-slate-200 rounded-[2rem] p-10 flex flex-col items-center justify-center bg-slate-50/50">
                <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-indigo-600 mb-3">
                  <i className="fa-solid fa-clapperboard text-xl"></i>
                </div>
                <p className="text-sm font-black text-slate-700">{videoFile ? videoFile.name : 'ভিডিও আপলোড করুন'}</p>
              </div>
            </div>
          ) : (
            <textarea 
              value={scriptPrompt} onChange={(e) => setScriptPrompt(e.target.value)}
              placeholder="গল্পের আইডিয়াটি এখানে লিখুন..."
              className="w-full h-40 p-6 bg-slate-50 rounded-[2rem] text-sm font-bold border-none focus:ring-0 transition-all resize-none"
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 p-4 rounded-2xl">
              <label className="text-[8px] font-black text-slate-400 uppercase mb-1 block">Language</label>
              <select value={targetLang} onChange={(e) => setTargetLang(e.target.value as TargetLanguage)} className="w-full bg-transparent text-xs font-bold border-none outline-none appearance-none">
                {Object.values(TargetLanguage).map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl">
              <label className="text-[8px] font-black text-slate-400 uppercase mb-1 block">Mood</label>
              <select value={scriptStyle} onChange={(e) => setScriptStyle(e.target.value as ScriptStyle)} className="w-full bg-transparent text-xs font-bold border-none outline-none appearance-none">
                {Object.values(ScriptStyle).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <button onClick={processContent} disabled={isProcessing} className="w-full py-5 bg-indigo-600 text-white rounded-[1.75rem] font-black text-sm shadow-xl shadow-indigo-100 disabled:opacity-50 btn-active flex items-center justify-center gap-3">
            {isProcessing ? <><i className="fa-solid fa-circle-notch animate-spin"></i> PROCESSING...</> : <><i className="fa-solid fa-wand-magic-sparkles"></i> START GENERATING</>}
          </button>
        </div>

        {titles.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Viral Titles</h3>
            {titles.map((t, i) => (
              <div key={i} className="bg-white p-5 rounded-3xl flex items-center justify-between border border-slate-50 shadow-sm active:bg-slate-50 transition-all">
                <p className="text-sm font-bold text-slate-800">{t.local}</p>
                <button onClick={() => { triggerHaptic(); navigator.clipboard.writeText(t.local); alert('Copied!'); }} className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                  <i className="fa-solid fa-copy text-xs"></i>
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Audio Player */}
      {generatedAudioB64 && (
        <div className="fixed bottom-28 inset-x-6 z-40">
          <div className="bg-slate-900 rounded-[3rem] p-5 flex items-center justify-between shadow-2xl border border-white/10 backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg">
                <i className="fa-solid fa-microphone-lines"></i>
              </div>
              <div>
                <p className="text-white text-xs font-black">AI Voice Ready</p>
                <p className="text-slate-400 text-[10px] font-bold">Studio Quality Audio</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { triggerHaptic(); playPcmAudio(generatedAudioB64); }} className="w-12 h-12 bg-white text-slate-900 rounded-full flex items-center justify-center btn-active">
                <i className="fa-solid fa-play"></i>
              </button>
              <button onClick={() => { triggerHaptic(); const blob = createWavBlob(generatedAudioB64); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download='voice.wav'; a.click(); }} className="w-12 h-12 bg-white/10 text-white rounded-full flex items-center justify-center btn-active">
                <i className="fa-solid fa-download"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-100 px-10 pt-4 pb-10 flex justify-around items-center z-50">
        <button onClick={() => { triggerHaptic(); setMode(AppMode.VIDEO); }} className={`flex flex-col items-center gap-1 transition-all ${mode === AppMode.VIDEO ? 'text-indigo-600 scale-110' : 'text-slate-300'}`}>
          <i className="fa-solid fa-clapperboard text-xl"></i>
          <span className="text-[9px] font-black uppercase tracking-tighter">Studio</span>
        </button>
        <button onClick={() => { triggerHaptic(); setMode(AppMode.AI_GEN); }} className={`flex-1 mx-4 h-12 max-w-[48px] bg-slate-50 rounded-2xl flex items-center justify-center transition-all ${mode === AppMode.AI_GEN ? 'bg-indigo-600 text-white shadow-lg rotate-12' : 'text-slate-300'}`}>
          <i className="fa-solid fa-wand-sparkles text-xl"></i>
        </button>
        <button onClick={() => { triggerHaptic(); setShowKeySelector(true); }} className="flex flex-col items-center gap-1 text-slate-300">
          <i className="fa-solid fa-key text-xl"></i>
          <span className="text-[9px] font-black uppercase tracking-tighter">Key</span>
        </button>
      </nav>
    </div>
  );
};

export default App;