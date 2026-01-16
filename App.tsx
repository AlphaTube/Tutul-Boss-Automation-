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

  // Settings
  const [voice1, setVoice1] = useState<VoiceName>(VoiceName.ZEPHYR);
  const [voice2, setVoice2] = useState<VoiceName>(VoiceName.KORE);
  const [targetLang, setTargetLang] = useState<TargetLanguage>(TargetLanguage.BANGLA);
  const [scriptStyle, setScriptStyle] = useState<ScriptStyle>(ScriptStyle.SERIOUS);
  const [isDualVoice, setIsDualVoice] = useState(false);

  useEffect(() => {
    checkApiKey();
    setTimeout(() => setIsLaunching(false), 2000);
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
      // Wait a bit then check again
      setTimeout(checkApiKey, 500);
    } else {
      setError("আপনার ব্রাউজারে 'Direct Key Selector' সাপোর্ট করছে না। অনুগ্রহ করে Vercel Settings-এ API_KEY সেট করুন।");
    }
  };

  const triggerHaptic = () => {
    if ('vibrate' in navigator) navigator.vibrate(20);
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
      if (msg === "INVALID_KEY" || msg.includes("API key not valid")) {
        setError("আপনার API Key টি কাজ করছে না। সঠিক Key ব্যবহার করুন।");
        setShowKeySelector(true);
      } else {
        setError("AI সার্ভারে সমস্যা হচ্ছে। অনুগ্রহ করে আবার চেষ্টা করুন।");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLaunching) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-[100]">
        <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl animate-pulse">
          <i className="fa-solid fa-bolt-lightning text-4xl"></i>
        </div>
        <div className="absolute bottom-16 flex flex-col items-center gap-2">
          <p className="font-black text-slate-900 tracking-tighter text-xl uppercase">Tutul Boss Studio</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Powering Creativity</p>
        </div>
      </div>
    );
  }

  if (showKeySelector) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex flex-col items-center justify-center z-[110] px-10 text-center animate-app-in">
        <div className="w-24 h-24 bg-white rounded-[2rem] shadow-xl flex items-center justify-center text-indigo-600 mb-8">
          <i className="fa-solid fa-key text-4xl"></i>
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-3">Setup Required</h2>
        <p className="text-slate-500 text-sm mb-10 leading-relaxed max-w-xs">
          অ্যাপটি ব্যবহার করার জন্য আপনাকে একটি বৈধ <b>API Key</b> সেট করতে হবে। এটি আপনার কাজের সিকিউরিটি নিশ্চিত করে।
        </p>
        
        <div className="w-full space-y-4">
          <button 
            onClick={handleOpenKeySelector}
            className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black shadow-2xl shadow-indigo-200 active:scale-95 transition-all"
          >
            SELECT API KEY
          </button>
          
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            className="block text-indigo-600 text-[10px] font-black uppercase tracking-widest underline underline-offset-4"
          >
            Learn About Billing
          </a>
        </div>

        {error && (
          <div className="mt-8 p-4 bg-rose-50 rounded-2xl border border-rose-100 text-rose-500 text-[10px] font-bold">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden animate-app-in">
      {/* Header */}
      <header className="px-6 pt-14 pb-4 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
            <i className="fa-solid fa-bolt-lightning text-sm"></i>
          </div>
          <div className="flex flex-col">
            <h1 className="font-black text-slate-900 tracking-tighter text-base leading-none">TUTUL BOSS</h1>
            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mt-1">SYSTEM ONLINE</span>
          </div>
        </div>
        <button onClick={() => { triggerHaptic(); window.location.reload(); }} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
          <i className="fa-solid fa-rotate-right text-xs"></i>
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 overflow-y-auto px-5 py-6 space-y-6 pb-44">
        
        {error && (
          <div className="p-5 bg-rose-50 border border-rose-100 rounded-[2rem] flex items-center gap-4 animate-shake">
            <div className="w-8 h-8 bg-rose-500 rounded-full flex items-center justify-center text-white shrink-0">
              <i className="fa-solid fa-exclamation text-xs"></i>
            </div>
            <p className="text-xs font-bold text-rose-600">{error}</p>
          </div>
        )}

        {/* Mode Selector */}
        <div className="bg-white p-1.5 rounded-[2rem] flex items-center gap-1 shadow-sm">
          <button onClick={() => { triggerHaptic(); setMode(AppMode.VIDEO); }} className={`flex-1 py-3.5 rounded-[1.75rem] text-[10px] font-black tracking-widest transition-all ${mode === AppMode.VIDEO ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>VIDEO MODE</button>
          <button onClick={() => { triggerHaptic(); setMode(AppMode.AI_GEN); }} className={`flex-1 py-3.5 rounded-[1.75rem] text-[10px] font-black tracking-widest transition-all ${mode === AppMode.AI_GEN ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>AI STORY</button>
        </div>

        {/* Input Card */}
        <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 space-y-6">
          {mode === AppMode.VIDEO ? (
            <div className="relative group">
              <input type="file" accept="video/*" className="absolute inset-0 opacity-0 z-10 cursor-pointer" onChange={(e) => { triggerHaptic(); setVideoFile(e.target.files?.[0] || null); }} />
              <div className="border-2 border-dashed border-slate-200 rounded-[2rem] p-12 flex flex-col items-center justify-center bg-slate-50 group-active:scale-[0.98] transition-all">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-md flex items-center justify-center text-indigo-600 mb-4">
                  <i className="fa-solid fa-clapperboard text-2xl"></i>
                </div>
                <p className="text-sm font-black text-slate-700">{videoFile ? videoFile.name : 'ভিডিও আপলোড করুন'}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-2">MP4, MOV up to 20MB</p>
              </div>
            </div>
          ) : (
            <textarea 
              value={scriptPrompt} onChange={(e) => setScriptPrompt(e.target.value)}
              placeholder="গল্পের আইডিয়াটি এখানে লিখুন..."
              className="w-full h-40 p-6 bg-slate-50 rounded-[2rem] text-sm font-bold border-none focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
            />
          )}

          {/* Configs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">ভাষা</label>
              <div className="relative">
                <select value={targetLang} onChange={(e) => setTargetLang(e.target.value as TargetLanguage)} className="w-full h-14 pl-5 pr-10 bg-slate-50 rounded-2xl text-xs font-black appearance-none border-none outline-none focus:bg-white focus:ring-2 focus:ring-indigo-50">
                  {Object.values(TargetLanguage).map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down absolute right-5 top-1/2 -translate-y-1/2 text-[10px] text-slate-300 pointer-events-none"></i>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">মুড</label>
              <div className="relative">
                <select value={scriptStyle} onChange={(e) => setScriptStyle(e.target.value as ScriptStyle)} className="w-full h-14 pl-5 pr-10 bg-slate-50 rounded-2xl text-xs font-black appearance-none border-none outline-none focus:bg-white focus:ring-2 focus:ring-indigo-50">
                  {Object.values(ScriptStyle).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down absolute right-5 top-1/2 -translate-y-1/2 text-[10px] text-slate-300 pointer-events-none"></i>
              </div>
            </div>
          </div>

          {/* Voice Settings */}
          <div className="bg-indigo-50/50 p-5 rounded-[2rem] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-microphone text-indigo-600 text-xs"></i>
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Dual Voice Mode</span>
              </div>
              <button 
                onClick={() => { triggerHaptic(); setIsDualVoice(!isDualVoice); }}
                className={`w-12 h-6 rounded-full transition-all relative ${isDualVoice ? 'bg-indigo-600' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isDualVoice ? 'left-7' : 'left-1'}`}></div>
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-black text-slate-400 uppercase w-12">ভয়েস ১:</span>
                <select value={voice1} onChange={(e) => setVoice1(e.target.value as VoiceName)} className="flex-1 h-10 bg-white rounded-xl text-xs font-bold px-3 border-none outline-none">
                  {Object.values(VoiceName).map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              {isDualVoice && (
                <div className="flex items-center gap-3 animate-app-in">
                  <span className="text-[9px] font-black text-slate-400 uppercase w-12">ভয়েস ২:</span>
                  <select value={voice2} onChange={(e) => setVoice2(e.target.value as VoiceName)} className="flex-1 h-10 bg-white rounded-xl text-xs font-bold px-3 border-none outline-none">
                    {Object.values(VoiceName).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          <button onClick={processContent} disabled={isProcessing} className="w-full py-5 bg-indigo-600 text-white rounded-[1.75rem] font-black text-sm shadow-xl shadow-indigo-100 disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-3">
            {isProcessing ? <><i className="fa-solid fa-circle-notch animate-spin"></i> ভিডিও ডাবিং শুরু হচ্ছে...</> : <><i className="fa-solid fa-wand-magic-sparkles"></i> ভিডিও ডাবিং শুরু করুন</>}
          </button>
        </div>

        {/* Results */}
        {titles.length > 0 && (
          <div className="space-y-4 animate-app-in">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Viral Titles</h3>
            <div className="grid gap-3">
              {titles.map((t, i) => (
                <div key={i} className="bg-white p-5 rounded-[1.5rem] flex items-center justify-between shadow-sm active:bg-slate-50 transition-all border border-slate-50">
                  <p className="text-sm font-bold text-slate-800">{t.local}</p>
                  <button onClick={() => { triggerHaptic(); navigator.clipboard.writeText(t.local); }} className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                    <i className="fa-solid fa-copy text-xs"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Floating Audio Bar */}
      {generatedAudioB64 && (
        <div className="fixed bottom-28 inset-x-5 z-40 animate-app-in">
          <div className="bg-slate-900 rounded-[2.5rem] p-5 flex items-center justify-between shadow-2xl border border-white/10 backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg animate-pulse">
                <i className="fa-solid fa-microphone-lines"></i>
              </div>
              <div>
                <p className="text-white text-xs font-black">AI Voice Ready</p>
                <p className="text-slate-400 text-[10px] font-bold tracking-tight">Studio Quality Output</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { triggerHaptic(); playPcmAudio(generatedAudioB64); }} className="w-12 h-12 bg-white text-slate-900 rounded-full flex items-center justify-center active:scale-90 transition-all">
                <i className="fa-solid fa-play"></i>
              </button>
              <button onClick={() => { triggerHaptic(); const blob = createWavBlob(generatedAudioB64); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download='audio.wav'; a.click(); }} className="w-12 h-12 bg-white/10 text-white rounded-full flex items-center justify-center active:scale-90 transition-all">
                <i className="fa-solid fa-download"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
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
          <span className="text-[9px] font-black uppercase tracking-tighter">Setup</span>
        </button>
      </nav>
    </div>
  );
};

export default App;