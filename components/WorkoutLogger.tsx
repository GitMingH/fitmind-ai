
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Activity, Clock, Flame, ChevronRight, Info, Play, Plus, Loader2, 
  BarChart3, History, Timer, Target, CheckCircle2, X, Volume2, Waves,
  Sparkles, Heart, Square
} from 'lucide-react';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
// Add required imports from @google/genai
import { GoogleGenAI, Modality } from "@google/genai";
import { Workout, ExerciseType, UserProfile, DeviceState, MuscleGroup } from '../types';
import { EXERCISE_METADATA, MET_VALUES, BREATHING_MET_MAP, getHRZones } from '../constants';
import { geminiService } from '../services/gemini';
import { PERSONA_CONFIGS } from '../App';

// --- Audio Utils ---
function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length;
  const buffer = ctx.createBuffer(1, frameCount, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i] / 32768.0;
  return buffer;
}

interface WorkoutLoggerProps {
  workouts: Workout[];
  setWorkouts: React.Dispatch<React.SetStateAction<Workout[]>>;
  profile: UserProfile;
  device: DeviceState;
  personaId: string;
}

const MUSCLE_GROUPS: MuscleGroup[] = ['胸部', '背部', '腿部', '肩部', '手臂', '核心', '全身'];

const WorkoutLogger: React.FC<WorkoutLoggerProps> = ({ workouts, setWorkouts, profile, device, personaId }) => {
  const [tab, setTab] = useState<'history' | 'stats'>('history');
  const [showAdd, setShowAdd] = useState(false);
  const [isLive, setIsLive] = useState(false);
  
  const persona = PERSONA_CONFIGS[personaId] || PERSONA_CONFIGS.encouraging;

  const [selectedType, setSelectedType] = useState<ExerciseType>(ExerciseType.RUNNING);
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup>('核心');
  const [duration, setDuration] = useState(30);
  const [intensity, setIntensity] = useState(5);
  
  const [elapsedTime, setElapsedTime] = useState(0);
  const [liveHeartRates, setLiveHeartRates] = useState<number[]>([]);
  const timerRef = useRef<any>(null);

  const [guidance, setGuidance] = useState<string | null>(null);
  const [loadingGuidance, setLoadingGuidance] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    if (isLive) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
        if (device.isConnected) setLiveHeartRates(prev => [...prev, device.heartRate]);
      }, 1000);
    } else { clearInterval(timerRef.current); }
    return () => clearInterval(timerRef.current);
  }, [isLive, device.isConnected, device.heartRate]);

  const handleFinishWorkout = async () => {
    setLoadingGuidance(true);
    const durInMin = isLive ? Math.ceil(elapsedTime / 60) : duration;
    const avgHr = liveHeartRates.length > 0 ? Math.round(liveHeartRates.reduce((a, b) => a + b, 0) / liveHeartRates.length) : undefined;
    
    let feedback = "";
    try {
      feedback = await geminiService.getQuickTip(`${persona.systemInstruction} 用户（昵称：${profile.name}）完成了${selectedType}训练，时长${durInMin}分。请给出简短中文反馈并称呼其名字。`, profile.name);
    } catch (e) { feedback = `${profile.name}，你表现得棒极了！`; }

    const newWorkout: Workout = { id: Date.now().toString(), type: selectedType, duration: durInMin, intensity, caloriesBurned: 300, timestamp: Date.now(), avgHeartRate: avgHr, coachFeedback: feedback };
    setWorkouts(prev => [newWorkout, ...prev]);
    setIsLive(false); setShowAdd(false); setElapsedTime(0); setLiveHeartRates([]); setLoadingGuidance(false); stopGuidance();
  };

  const stopGuidance = () => {
    if (audioSourceRef.current) { try { audioSourceRef.current.stop(); } catch (e) {} audioSourceRef.current = null; }
    setIsSpeaking(false); setIsSynthesizing(false);
  };

  const speakGuidance = async () => {
    if (isSpeaking || isSynthesizing) { stopGuidance(); return; }
    if (!guidance) return;
    setIsSynthesizing(true);
    try {
      const response = await (new GoogleGenAI({ apiKey: process.env.API_KEY })).models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: guidance }] }],
        config: { 
          responseModalities: [Modality.AUDIO], 
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: persona.voice } } } 
        }
      });
      const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      setIsSynthesizing(false);
      if (audioBase64) {
        if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') await ctx.resume();
        const buffer = await decodeAudioData(decodeBase64(audioBase64), ctx);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => { setIsSpeaking(false); audioSourceRef.current = null; };
        audioSourceRef.current = source;
        setIsSpeaking(true);
        source.start();
      }
    } catch (e) { console.error(e); setIsSynthesizing(false); setIsSpeaking(false); }
  };

  const fetchGuidance = async () => {
    setLoadingGuidance(true);
    const type = selectedType === ExerciseType.STRENGTH ? `${selectedMuscle}训练` : selectedType;
    try {
      const res = await geminiService.getQuickTip(`${persona.systemInstruction} 给名为“${profile.name}”的用户简述${type}的3个技术重点。`, profile.name);
      setGuidance(res);
    } catch (e) { console.error(e); }
    finally { setLoadingGuidance(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center px-1">
        <div>
          <h2 className="text-2xl font-black tracking-tight">训练追踪</h2>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">当前设定：{personaId === 'strict' ? '铁血模式' : (personaId === 'scientific' ? '数据模式' : '鼓励模式')}</p>
        </div>
        <div className="flex bg-zinc-900 border border-zinc-800 rounded-2xl p-1">
          <button onClick={() => setTab('history')} className={`px-4 py-2 rounded-xl text-xs font-black ${tab === 'history' ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-500'}`}>日志</button>
          <button onClick={() => setTab('stats')} className={`px-4 py-2 rounded-xl text-xs font-black ${tab === 'stats' ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-500'}`}>统计</button>
        </div>
      </div>

      {tab === 'history' ? (
        <>
          <div className="grid grid-cols-2 gap-4">
             <button onClick={() => { setSelectedType(ExerciseType.RUNNING); setShowAdd(true); setGuidance(null); }} className="bg-emerald-500 text-zinc-950 p-5 rounded-[32px] flex flex-col items-center justify-center space-y-2 shadow-xl shadow-emerald-500/10 active:scale-95 transition-all">
              <Plus className="w-6 h-6" />
              <span className="text-xs font-black">记录过往</span>
            </button>
            <button onClick={() => { setSelectedType(ExerciseType.HIIT); setShowAdd(true); setIsLive(true); setGuidance(null); }} className="bg-zinc-900 border border-emerald-500/30 text-emerald-500 p-5 rounded-[32px] flex flex-col items-center justify-center space-y-2 active:scale-95 transition-all">
              <Timer className="w-6 h-6" />
              <span className="text-xs font-black">开启实战</span>
            </button>
          </div>

          {showAdd && !isLive && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 space-y-6 animate-in slide-in-from-top-4 duration-300">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">记录新训练</h3>
                <button onClick={() => { setShowAdd(false); stopGuidance(); }}><X className="w-5 h-5 text-zinc-500" /></button>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {EXERCISE_METADATA.map((m) => (
                  <button key={m.type} onClick={() => { setSelectedType(m.type); setGuidance(null); }} className={`flex flex-col items-center p-3 rounded-2xl border transition-all ${selectedType === m.type ? 'bg-emerald-500 border-emerald-500 text-zinc-950' : 'bg-zinc-800 border-transparent text-zinc-500'}`}>
                    <span className="text-xl mb-1">{m.icon}</span>
                    <span className="text-[8px] font-black uppercase">{m.type.slice(0,2)}</span>
                  </button>
                ))}
              </div>

              <div className="flex space-x-3 pt-4">
                <button onClick={fetchGuidance} className="flex-1 bg-zinc-800 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center">
                  {loadingGuidance ? <Loader2 className="w-4 h-4 animate-spin" /> : 'AI 动作要领'}
                </button>
                <button onClick={handleFinishWorkout} disabled={loadingGuidance} className="flex-1 bg-emerald-500 text-zinc-950 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">确认保存</button>
              </div>

              {guidance && (
                <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/20">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{isSynthesizing ? '正在合成语音...' : '教练建议'}</span>
                    <button onClick={speakGuidance} className={`p-2 rounded-xl transition-all ${isSpeaking || isSynthesizing ? 'bg-red-500 text-white' : 'bg-emerald-500 text-zinc-950'}`}>
                      {isSynthesizing ? <Loader2 className="w-4 h-4 animate-spin" /> : (isSpeaking ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />)}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed font-medium italic">{guidance}</p>
                </div>
              )}
            </div>
          )}

          {isLive && (
            <div className="fixed inset-0 z-[60] bg-zinc-950 p-8 flex flex-col justify-between animate-in slide-in-from-bottom-8">
               <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">实战模式 - {personaId === 'encouraging' ? '温柔指导' : (personaId === 'strict' ? '铁血强化' : '数据分析')}</p>
                    <h2 className="text-3xl font-black tracking-tighter">{selectedType}</h2>
                  </div>
                  <button onClick={() => { setIsLive(false); stopGuidance(); }} className="p-4 bg-zinc-900 rounded-full text-zinc-500"><X className="w-6 h-6" /></button>
               </div>
               <div className="flex-1 flex flex-col items-center justify-center">
                  <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest mb-4">持续时间</p>
                  <p className="text-7xl font-black tracking-tighter tabular-nums">{Math.floor(elapsedTime / 60).toString().padStart(2,'0')}:{(elapsedTime % 60).toString().padStart(2,'0')}</p>
                  <div className="mt-12 bg-zinc-900 border border-zinc-800 rounded-[40px] p-10 text-center relative overflow-hidden group">
                     <Heart className="w-8 h-8 text-emerald-500 mx-auto mb-2 animate-pulse" />
                     <p className="text-6xl font-black tracking-tighter tabular-nums text-emerald-500">{device.isConnected ? device.heartRate : '--'}</p>
                     <p className="text-[8px] text-zinc-500 font-black uppercase mt-2">REAL-TIME BPM</p>
                  </div>
               </div>
               <button onClick={handleFinishWorkout} className="w-full bg-emerald-500 text-zinc-950 p-6 rounded-[32px] text-sm font-black uppercase tracking-widest active:scale-95 transition-all">结束并保存</button>
            </div>
          )}

          <div className="space-y-4">
            {workouts.map((w) => (
              <div key={w.id} className="bg-zinc-900/50 rounded-[32px] p-5 border border-zinc-800">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-xl text-emerald-500">
                    {EXERCISE_METADATA.find(m => m.type === w.type)?.icon}
                  </div>
                  <div className="ml-4 flex-1">
                    <div className="flex justify-between"><h4 className="font-black text-sm">{w.type}</h4><span className="text-[9px] text-zinc-600 font-black">{new Date(w.timestamp).toLocaleDateString()}</span></div>
                    <div className="flex items-center space-x-4 mt-2">
                       <div className="text-[10px] font-bold text-zinc-500"><Clock className="w-3 h-3 inline mr-1" />{w.duration} MIN</div>
                       <div className="text-[10px] font-bold text-zinc-500"><Flame className="w-3 h-3 inline mr-1" />{w.caloriesBurned} KCAL</div>
                    </div>
                  </div>
                </div>
                {w.coachFeedback && (
                  <div className="mt-4 pt-3 border-t border-zinc-800/50 flex items-start space-x-2">
                    <Sparkles className="w-3 h-3 text-emerald-500 mt-0.5" />
                    <p className="text-[10px] text-zinc-400 font-medium italic leading-relaxed">{w.coachFeedback}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-zinc-900/50 p-6 rounded-[32px] border border-zinc-800 h-64 flex flex-col items-center justify-center text-zinc-600">
           <BarChart3 className="w-10 h-10 mb-2 opacity-20" />
           <p className="text-[10px] font-black uppercase">暂无可视化统计数据</p>
        </div>
      )}
    </div>
  );
};

export default WorkoutLogger;
