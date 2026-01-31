import React, { useState, useRef, useEffect } from 'react';
// 1. 引入 Globe 图标
import { Sparkles, Calendar, ChevronRight, Mic, Play, Loader2, Send, Zap, Waves, MessageSquare, Volume2, X, Activity, Heart, ShieldAlert, Globe } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { geminiService } from '../services/gemini';
import { DailyPlan, UserProfile, Workout, DeviceState } from '../types';
import { PERSONA_CONFIGS } from '../App';

// ... (Audio Utils 代码保持不变，省略以节省篇幅) ...
function encode(bytes: Uint8Array) { /* ... */ return btoa(binary); }
function decode(base64: string) { /* ... */ return bytes; }
async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  /* ... 代码保持不变 ... */
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// ... (AudioVisualizer 组件保持不变) ...
const AudioVisualizer = ({ isActive, volume = 0, isUserSpeaking = false }: { isActive: boolean, volume?: number, isUserSpeaking?: boolean }) => {
  return (
    <div className="flex items-center justify-center space-x-1.5 h-16">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className={`w-1 rounded-full transition-all duration-75 ${
            isActive ? (isUserSpeaking ? 'bg-blue-400' : 'bg-emerald-500') : 'bg-zinc-800 h-1.5 opacity-20'
          }`}
          style={{
            height: isActive ? `${10 + (volume * 1.2 * (0.3 + Math.random() * 0.7))}%` : '6px',
            opacity: isActive ? 0.4 + (volume / 80) : 0.1,
            boxShadow: isActive && volume > 15 ? `0 0 15px ${isUserSpeaking ? 'rgba(96, 165, 250, 0.4)' : 'rgba(16, 185, 129, 0.4)'}` : 'none'
          }}
        />
      ))}
    </div>
  );
};

interface AICoachProps {
  profile: UserProfile;
  workouts: Workout[];
  device: DeviceState;
  personaId: string;
}

const AICoach: React.FC<AICoachProps> = ({ profile, workouts, device, personaId }) => {
  // ... (State 定义保持不变) ...
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [chat, setChat] = useState<{role: 'user' | 'ai', text: string}[]>([]);
  const [input, setInput] = useState('');
  
  const persona = PERSONA_CONFIGS[personaId] || PERSONA_CONFIGS.encouraging;

  // Live API States
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [currentInputTranscription, setCurrentInputTranscription] = useState('');
  const [currentOutputTranscription, setCurrentOutputTranscription] = useState('');
  const [isAiTalking, setIsAiTalking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [inputVolume, setInputVolume] = useState(0);
  
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const audioContextsRef = useRef<{ input?: AudioContext, output?: AudioContext }>({});
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const transcriptionRef = useRef<{ input: string, output: string }>({ input: '', output: '' });
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  const generatePlan = async () => {
    setLoading(true);
    try {
      const result = await geminiService.generateWeeklyPlan(profile, workouts.slice(-5));
      setPlans(result);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setChat(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);
    try {
      const response = await geminiService.getQuickTip(`${persona.systemInstruction} 用户说：${userMsg}`, profile.name);
      setChat(prev => [...prev, { role: 'ai', text: response || '教练正在思考...' }]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const startLiveMode = async () => {
    setIsLiveMode(true);
    setCurrentInputTranscription('正在极速初始化语音引擎...');
    setCurrentOutputTranscription('');
    transcriptionRef.current = { input: '', output: '' };

    // ⚠️ 关键点：语音 Live 模式使用 WebSocket，Vercel 代理不支持 WebSocket。
    // 所以这里必须使用真实的 process.env.API_KEY 进行直连。
    // 这意味着用户必须开启 VPN 才能使用此功能，这正是我们添加“需特殊网络”提示的原因。
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // ... (后续 startLiveMode 逻辑完全保持不变) ...
    const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000, latencyHint: 'interactive' });
    const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000, latencyHint: 'interactive' });
    
    if (inputCtx.state === 'suspended') await inputCtx.resume();
    if (outputCtx.state === 'suspended') await outputCtx.resume();
    
    audioContextsRef.current = { input: inputCtx, output: outputCtx };

    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    
    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: () => {
          setCurrentInputTranscription('正在极速监听...');
          const source = inputCtx.createMediaStreamSource(stream);
          const gainNode = inputCtx.createGain();
          gainNode.gain.value = 5.0; 
          const scriptProcessor = inputCtx.createScriptProcessor(2048, 1, 1);
          scriptProcessorRef.current = scriptProcessor;
          
          scriptProcessor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            let sum = 0;
            for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
            const vol = Math.sqrt(sum / inputData.length) * 1500; 
            setInputVolume(Math.min(100, vol));
            setIsUserSpeaking(vol > 8); 

            const int16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
            
            const pcmBlob: Blob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
            sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
          };

          source.connect(gainNode);
          gainNode.connect(scriptProcessor);
          scriptProcessor.connect(inputCtx.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          if (message.serverContent?.outputTranscription) {
            transcriptionRef.current.output += message.serverContent.outputTranscription.text;
            setCurrentOutputTranscription(transcriptionRef.current.output);
          } else if (message.serverContent?.inputTranscription) {
            transcriptionRef.current.input += message.serverContent.inputTranscription.text;
            setCurrentInputTranscription(transcriptionRef.current.input);
          }

          if (message.serverContent?.turnComplete) {
            setChat(prev => [...prev, { role: 'user', text: transcriptionRef.current.input || '(语音已识别)' }, { role: 'ai', text: transcriptionRef.current.output || '(教练已回答)' }]);
            transcriptionRef.current = { input: '', output: '' };
            setCurrentInputTranscription('教练正在专注倾听...');
            setCurrentOutputTranscription('');
          }

          const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (base64Audio) {
            setIsAiTalking(true);
            const outCtx = audioContextsRef.current.output!;
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
            const audioBuffer = await decodeAudioData(decode(base64Audio), outCtx, 24000, 1);
            const source = outCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outCtx.destination);
            source.onended = () => {
              sourcesRef.current.delete(source);
              if (sourcesRef.current.size === 0) setIsAiTalking(false);
            };
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += audioBuffer.duration;
            sourcesRef.current.add(source);
          }

          if (message.serverContent?.interrupted) {
            sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
            sourcesRef.current.clear();
            nextStartTimeRef.current = 0;
            setIsAiTalking(false);
          }
        },
        onerror: (e) => { console.error(e); stopLiveMode(); },
        onclose: () => setIsLiveMode(false),
      },
      config: {
        responseModalities: [Modality.AUDIO],
        outputAudioTranscription: {},
        inputAudioTranscription: {},
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: persona.voice } } },
        systemInstruction: `${persona.systemInstruction} 用户名为：${profile.name}。请务必在对话中自然地称呼其名字（如：${profile.name}，保持呼吸）。用户状态：${profile.age}岁，体重${profile.weight}kg。心率：${device.isConnected ? `${device.heartRate} BPM` : '未连接'}。`
      }
    });

    sessionPromiseRef.current = sessionPromise;
  };

  const stopLiveMode = () => {
    setIsLiveMode(false);
    setIsAiTalking(false);
    setIsUserSpeaking(false);
    setInputVolume(0);
    const ctxs = audioContextsRef.current;
    if (ctxs.input) ctxs.input.close().catch(()=>{});
    if (ctxs.output) ctxs.output.close().catch(()=>{});
    audioContextsRef.current = {};
    if (scriptProcessorRef.current) { scriptProcessorRef.current.onaudioprocess = null; scriptProcessorRef.current.disconnect(); }
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    sessionPromiseRef.current?.then(session => session.close());
    sessionPromiseRef.current = null;
  };

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-140px)]">
      {/* Immersive Header Indicator */}
      <div className="flex items-center justify-between px-1 shrink-0">
         <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">当前教练：{personaId === 'encouraging' ? '温柔励志' : (personaId === 'strict' ? '铁血教官' : '科学专家')}</span>
         </div>
         <div className="flex items-center text-[10px] text-zinc-600 font-bold">
            <ShieldAlert className="w-3 h-3 mr-1" />
            实时监控中
         </div>
      </div>

      <div className="bg-zinc-900 border border-emerald-500/30 rounded-[32px] p-5 relative overflow-hidden group shadow-2xl shrink-0">
        <div className="flex justify-between items-center relative z-10">
          <div className="flex items-center space-x-4">
             <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform">
                <Activity className="w-6 h-6 text-emerald-500" />
             </div>
             <div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-0.5">智能方案</p>
                <p className="text-base font-black text-zinc-100 line-clamp-1">{plans[0]?.workout.title || '生成您的训练计划'}</p>
             </div>
          </div>
          
          {/* --- 2. 语音实战入口 UI 修改：添加网络提示 --- */}
          <div className="flex flex-col items-end space-y-1">
            <button 
              onClick={startLiveMode}
              className="bg-emerald-500 text-zinc-950 px-5 py-2.5 rounded-2xl text-xs font-black shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center"
            >
              <Waves className="w-4 h-4 mr-2" />
              语音实战
            </button>
            <span className="flex items-center text-[9px] text-zinc-500 font-medium opacity-70">
              <Globe className="w-3 h-3 mr-1" />
              需特殊网络支持
            </span>
          </div>
          {/* ------------------------------------------- */}
          
        </div>
      </div>

      {/* ... (Plan Scroller 及后续代码保持不变) ... */}
      <div className="space-y-3 shrink-0">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-sm font-bold flex items-center text-zinc-400">
            <Calendar className="w-4 h-4 mr-2 text-emerald-500" />
            周计划
          </h3>
          <button onClick={generatePlan} className="text-[10px] text-emerald-500 font-bold px-2 py-1 rounded-lg hover:bg-emerald-500/5 transition-colors">
            {loading ? 'AI 正在排课...' : '生成计划'}
          </button>
        </div>
        
        <div className="flex space-x-4 overflow-x-auto pb-4 scrollbar-hide snap-x px-1">
          {plans.length === 0 ? (
            <div className="w-full h-28 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-[32px] text-zinc-600">
               <p className="text-[10px] font-black uppercase tracking-widest">点击上方按钮生成</p>
            </div>
          ) : (
            plans.map((p, i) => (
              <div key={i} className="min-w-[240px] bg-zinc-900/50 border border-zinc-800/60 rounded-[32px] p-5 snap-center hover:bg-zinc-900 transition-colors">
                <span className="text-[10px] font-black text-emerald-500 uppercase mb-3 block">{p.day}</span>
                <p className="text-sm font-bold text-zinc-200 line-clamp-1">{p.workout.title}</p>
                <p className="text-[10px] text-zinc-500 mt-2 line-clamp-1">{p.meals.breakfast.split(' ')[0]}...</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ... (Coach Chat & Live View 保持不变) ... */}
      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-[40px] overflow-hidden flex flex-col relative shadow-inner">
        {isLiveMode && (
          <div className="absolute inset-0 bg-zinc-950/98 backdrop-blur-3xl z-40 flex flex-col items-center justify-between p-8 animate-in fade-in zoom-in-95 duration-300">
             <div className="w-full flex justify-between items-center">
                <div className="flex items-center space-x-3">
                   <div className={`w-3 h-3 rounded-full animate-pulse ${isUserSpeaking ? 'bg-blue-500 shadow-[0_0_10px_#3b82f6]' : 'bg-emerald-500 shadow-[0_0_10px_#10b981]'}`} />
                   <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{personaId === 'encouraging' ? '温柔模式' : '极速响应'}</span>
                </div>
                <button onClick={stopLiveMode} className="p-3 bg-zinc-900 rounded-full border border-zinc-800"><X className="w-5 h-5" /></button>
             </div>

             <div className="flex flex-col items-center space-y-12 w-full max-w-sm">
                <div className={`w-40 h-40 rounded-full flex items-center justify-center transition-all duration-300 ${isAiTalking ? 'bg-emerald-500/20 scale-110' : 'bg-zinc-900'}`}>
                  <div className={`w-32 h-32 rounded-full flex items-center justify-center ${isAiTalking ? 'bg-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.3)]' : (isUserSpeaking ? 'bg-blue-500' : 'bg-zinc-800')}`}>
                    {isAiTalking ? <Volume2 className="w-14 h-14 text-zinc-950 animate-bounce" /> : <Mic className={`w-14 h-14 ${isUserSpeaking ? 'text-white' : 'text-emerald-500'}`} />}
                  </div>
                </div>
                <div className="w-full space-y-6 text-center">
                   <AudioVisualizer isActive={isLiveMode} volume={isAiTalking ? 85 : inputVolume} isUserSpeaking={isUserSpeaking} />
                   <div className="min-h-[60px]">
                      <p className="text-sm font-bold text-emerald-500 leading-relaxed px-4">{currentOutputTranscription}</p>
                   </div>
                </div>
             </div>

             <div className="text-center">
                <div className="flex items-center justify-center space-x-3 mb-2">
                  <Heart className={`w-6 h-6 ${device.heartRate > 150 ? 'text-red-500' : 'text-emerald-500'}`} />
                  <span className="text-4xl font-black tracking-tighter tabular-nums">{device.isConnected ? device.heartRate : '--'}</span>
                </div>
                <p className="text-[8px] text-zinc-600 font-black uppercase tracking-[0.2em]">生理监测仪表</p>
             </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {chat.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-zinc-800 space-y-4 opacity-50">
                <MessageSquare className="w-10 h-10" />
                <p className="text-xs font-bold text-center">你好，我是你的{personaId === 'encouraging' ? '专属动力' : '铁血教官'}<br/>有什么我可以帮你的？</p>
             </div>
          ) : (
            chat.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-5 py-3 rounded-[24px] text-sm ${m.role === 'user' ? 'bg-emerald-500 text-zinc-950 rounded-tr-none font-bold' : 'bg-zinc-800/80 text-zinc-100 rounded-tl-none font-medium'}`}>
                  {m.text}
                </div>
              </div>
            ))
          )}
          {loading && <div className="flex justify-start"><div className="bg-zinc-800/50 p-4 rounded-2xl"><Loader2 className="w-4 h-4 animate-spin text-emerald-500" /></div></div>}
        </div>

        <div className="p-4 bg-zinc-950/50 border-t border-zinc-800/50 flex items-center space-x-3">
          <button onClick={startLiveMode} className="p-3 bg-zinc-800 rounded-2xl"><Mic className="w-6 h-6" /></button>
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="咨询动作或寻求饮食建议..." 
            className="flex-1 bg-zinc-800 border-none rounded-2xl px-5 py-3.5 text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
          />
          <button onClick={handleSendMessage} className="p-3 bg-emerald-500 text-zinc-950 rounded-2xl shadow-xl shadow-emerald-500/20"><Send className="w-6 h-6" /></button>
        </div>
      </div>
    </div>
  );
};

export default AICoach;