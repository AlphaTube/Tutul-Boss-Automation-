import React, { useState, useEffect } from 'react';
import { geminiService, playPcmAudio, createWavBlob } from './geminiService';
import { VoiceName, TargetLanguage, ScriptStyle, AppMode, TranscriptLine, TitleSuggestion } from './types';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.VIDEO);
  const [scriptPrompt, setScriptPrompt] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [titles, setTitles] = useState<TitleSuggestion[]>([]);
  const [generatedAudioB64, setGeneratedAudioB64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiReady, setApiReady] = useState<boolean>(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  
  // Settings
  const [voice1, setVoice1] = useState<VoiceName>(VoiceName.ZEPHYR);
  const [voice2, setVoice2] = useState<VoiceName>(VoiceName.KORE);
  const [targetLang, setTargetLang] = useState<TargetLanguage>(TargetLanguage.BANGLA);
  const [scriptStyle, setScriptStyle] = useState<ScriptStyle>(ScriptStyle.SERIOUS);
  const [isDualVoice, setIsDualVoice] = useState(false);

  useEffect(() => {
    const isConfigured = geminiService.isApiKeyConfigured();
    setApiReady(isConfigured);
    if (isConfigured) {
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 5000);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setError(null);
      setTranscript([]);
      setGeneratedAudioB64(null);
    }
  };

  const processContent = async () => {
    if (!apiReady) {
      setError("API_KEY খুঁজে পাওয়া যাচ্ছে না! দয়া করে ভার্সেল সেটিংস থেকে কী যোগ করুন।");
      return;
    }
    if (mode === AppMode.VIDEO && !videoFile) {
      setError("প্রথমে একটি ভিডিও সিলেক্ট করুন!");
      return;
    }
    if (mode === AppMode.AI_GEN && !scriptPrompt.trim()) {
      setError("আপনার টপিকটি লিখুন!");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setGeneratedAudioB64(null);
    
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
      
      setTranscript(result.script);
      setTitles(result.titles);

      if (result.script.length > 0) {
        const audio = await geminiService.generateSpeech(
          result.script.map((l: any) => ({ text: l.rewritten, speaker: l.speaker })), 
          voice1, 
          voice2, 
          isDualVoice
        );
        if (audio) setGeneratedAudioB64(audio);
      } else {
        throw new Error("স্ক্রিপ্ট তৈরি করা যায়নি। ভিডিওটি কি খুব বড়?");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "কানেকশন এরর। আবার চেষ্টা করুন।");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadAudio = () => {
    if (!generatedAudioB64) return;
    const blob = createWavBlob(generatedAudioB64);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tutul-boss-${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {showSuccessToast && (
        <div className="fixed top-20 left-4 right-4 z-50 animate-in slide-in-from-top-10 fade-in duration-500">
          <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <i className="fa-solid fa-check text-sm"></i>
            </div>
            <div>
              <p className="text-xs font-black">API Connected!</p>
              <p className="text-[10px] font-bold">সিস্টেম এখন অনলাইনে আছে।</p>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white p-4 shadow-sm flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <i className="fa-solid fa-bolt-lightning"></i>
          </div>
          <div>
            <h1 className="font-black text-slate-800 text-lg leading-tight flex items-center gap-2">
              TUTUL BOSS
              <span className={`w-2 h-2 rounded-full animate-pulse ${apiReady ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              {apiReady ? 'System Online' : 'System Offline'}
            </p>
          </div>
        </div>
        <button onClick={() => window.location.reload()} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 active:rotate-180 transition-all">
          <i className="fa-solid fa-rotate-right"></i>
        </button>
      </header>

      <main className="p-4 space-y-6 max-w-lg mx-auto">
        {!apiReady && (
          <div className="bg-rose-50 border border-rose-100 p-5 rounded-[2rem] space-y-2">
            <p className="text-[10px] font-black text-rose-600 uppercase flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation"></i> API Key Missing
            </p>
            <p className="text-xs font-medium text-rose-500 leading-relaxed">
              আপনার ভার্সেল প্রজেক্ট সেটিংস-এ গিয়ে <b>API_KEY</b> এনভায়রনমেন্ট ভেরিয়েবল যোগ করুন এবং <b>Redeploy</b> দিন।
            </p>
          </div>
        )}

        <div className="flex bg-white p-1 rounded-2xl shadow-sm">
          <button onClick={() => setMode(AppMode.VIDEO)} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${mode === AppMode.VIDEO ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>
            <i className="fa-solid fa-video mr-2"></i>VIDEO MODE
          </button>
          <button onClick={() => setMode(AppMode.AI_GEN)} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${mode === AppMode.AI_GEN ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>
            <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>AI GENERATOR
          </button>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] shadow-xl space-y-5 border border-white">
          {mode === AppMode.VIDEO ? (
            <div className="group border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center bg-slate-50 hover:bg-indigo-50/30 hover:border-indigo-200 transition-all relative overflow-hidden">
              <input type="file" accept="video/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleFileChange} />
              <div className="relative z-0">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-3 text-indigo-500">
                  <i className="fa-solid fa-cloud-arrow-up text-2xl"></i>
                </div>
                <p className="text-sm font-black text-slate-700">{videoFile ? videoFile.name : 'ভিডিও সিলেক্ট করুন'}</p>
                <p className="text-[10px] text-slate-400 mt-1 font-bold">MP4, MOV up to 20MB</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2">গল্পের টপিক</label>
              <textarea value={scriptPrompt} onChange={(e) => setScriptPrompt(e.target.value)} placeholder="উদা: একটি বিড়াল ও একটি ইঁদুরের মজার গল্প..." className="w-full h-32 p-5 bg-slate-50 rounded-3xl text-sm font-medium border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all resize-none outline-none" />
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">ভাষা</label>
                <select value={targetLang} onChange={(e) => setTargetLang(e.target.value as TargetLanguage)} className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-bold border-none appearance-none cursor-pointer">
                  {Object.values(TargetLanguage).map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">মুড</label>
                <select value={scriptStyle} onChange={(e) => setScriptStyle(e.target.value as ScriptStyle)} className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-bold border-none appearance-none cursor-pointer">
                  {Object.values(ScriptStyle).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-3xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-microphone-lines text-indigo-500 text-xs"></i>
                  <span className="text-[10px] font-black text-slate-500 uppercase">Dual Voice Mode</span>
                </div>
                <button onClick={() => setIsDualVoice(!isDualVoice)} className={`w-10 h-5 rounded-full transition-all relative ${isDualVoice ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isDualVoice ? 'left-6' : 'left-1'}`}></div>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-bold text-slate-400 min-w-[50px]">ভয়েস ১:</span>
                   <select value={voice1} onChange={(e) => setVoice1(e.target.value as VoiceName)} className="flex-1 bg-white p-2 rounded-xl text-[10px] font-bold border-none">
                     {Object.values(VoiceName).map(v => <option key={v} value={v}>{v}</option>)}
                   </select>
                </div>
                {isDualVoice && (
                  <div className="flex items-center gap-2 animate-in fade-in">
                     <span className="text-[10px] font-bold text-slate-400 min-w-[50px]">ভয়েস ২:</span>
                     <select value={voice2} onChange={(e) => setVoice2(e.target.value as VoiceName)} className="flex-1 bg-white p-2 rounded-xl text-[10px] font-bold border-none">
                       {Object.values(VoiceName).map(v => <option key={v} value={v}>{v}</option>)}
                     </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button onClick={processContent} disabled={isProcessing} className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black text-sm shadow-xl disabled:opacity-50 active:scale-95 transition-all">
            {isProcessing ? 'ম্যাজিক চলছে...' : 'ভিডিও ডাবিং শুরু করুন'}
          </button>

          {error && <p className="text-[10px] font-bold text-rose-500 bg-rose-50 p-3 rounded-xl border border-rose-100 text-center">{error}</p>}
        </div>

        {titles.length > 0 && (
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest"><i className="fa-solid fa-fire text-orange-500 mr-2"></i>Viral Titles</h3>
            <div className="space-y-2">
              {titles.map((t, i) => (
                <div key={i} className="p-4 bg-slate-50 rounded-2xl text-xs font-bold text-slate-700 flex justify-between items-center group">
                  <span>{t.local}</span>
                  <button onClick={() => navigator.clipboard.writeText(t.local)} className="opacity-0 group-hover:opacity-100 text-indigo-500"><i className="fa-solid fa-copy"></i></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {transcript.length > 0 && (
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm space-y-4 animate-in fade-in">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest"><i className="fa-solid fa-file-lines text-indigo-500 mr-2"></i>Script Preview</h3>
            <div className="space-y-4">
              {transcript.map((line, i) => (
                <div key={i} className="space-y-1">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase ${line.speaker === 'Speaker 2' ? 'bg-purple-100 text-purple-600' : 'bg-indigo-100 text-indigo-600'}`}>{line.speaker || 'Voice'}</span>
                  <p className="text-sm font-bold text-slate-800 pl-2 border-l-4 border-indigo-400 bg-indigo-50/20 p-2 rounded-r-xl">{line.rewritten}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {generatedAudioB64 && (
        <div className="fixed bottom-6 left-4 right-4 z-30 animate-in slide-in-from-bottom-10">
          <div className="bg-slate-900 text-white p-5 rounded-[2rem] flex items-center justify-between shadow-2xl border border-slate-800">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center">
                <i className="fa-solid fa-music text-lg"></i>
              </div>
              <div>
                <p className="text-xs font-black">AI ভয়েস রেডি!</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase">24kHz PCM Audio</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => playPcmAudio(generatedAudioB64)} className="w-12 h-12 bg-white text-slate-900 rounded-2xl flex items-center justify-center hover:scale-105 transition-all"><i className="fa-solid fa-play ml-1"></i></button>
              <button onClick={downloadAudio} className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:scale-105 transition-all"><i className="fa-solid fa-download"></i></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;