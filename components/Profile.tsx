
import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, Camera, Scan, X, Check, Loader2, Sparkles, Zap, 
  Volume2, ShieldCheck, Info, ChevronRight, Play, Square,
  Dna, Gauge, LogOut, Ruler, Target, Activity, User as UserIcon, Edit3
} from 'lucide-react';
import { UserProfile, DeviceState } from '../types';
import { getHRZones } from '../constants';
import { geminiService } from '../services/gemini';

// --- Utils for Audio ---
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

interface ProfileProps {
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  device: DeviceState;
  setDevice: React.Dispatch<React.SetStateAction<DeviceState>>;
  coachPersona: string;
  setCoachPersona: (id: string) => void;
}

const COACH_PERSONAS = [
  { id: 'encouraging', name: '温柔励志', desc: '注重情感链接，持续鼓励', icon: '☀️' },
  { id: 'strict', name: '铁血教官', desc: '目标导向，严格执行计划', icon: '🎖️' },
  { id: 'scientific', name: '数据专家', desc: '极致专业，解读生理指标', icon: '🧪' },
];

const VOICE_LIBRARY = [
  { id: 'Kore', name: 'Kore (活力女声)', type: 'Female' },
  { id: 'Fenrir', name: 'Fenrir (浑厚男声)', type: 'Male' },
  { id: 'Charon', name: 'Charon (冷静专家)', type: 'Professional' },
  { id: 'Puck', name: 'Puck (幽默风趣)', type: 'Humorous' },
];

const Profile: React.FC<ProfileProps> = ({ profile, setProfile, device, setDevice, coachPersona, setCoachPersona }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState(profile);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingScan, setLoadingScan] = useState(false);
  const [aiInsights, setAiInsights] = useState<{fitnessAge?: number, nextGoal?: string, weeksToTarget?: number} | null>(null);
  const [visualScan, setVisualScan] = useState<any>(null);
  
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // 初始获取 AI 健康洞察
  useEffect(() => {
    const fetchInsights = async () => {
      setLoadingInsights(true);
      try {
        const insights = await geminiService.getHealthInsights(profile);
        setAiInsights(insights);
      } catch (e) { console.error(e); }
      finally { setLoadingInsights(false); }
    };
    fetchInsights();
  }, [profile.weight, profile.targetWeight]);

  const stopAudio = () => {
    if (currentSourceRef.current) { try { currentSourceRef.current.stop(); } catch(e) {} currentSourceRef.current = null; }
    setPlayingAudioId(null); setLoadingAudioId(null);
  };

  const playAudioData = async (audioBase64: string, id: string) => {
    if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') await ctx.resume();
    const buffer = await decodeAudioData(decodeBase64(audioBase64), ctx);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => { if (playingAudioId === id) setPlayingAudioId(null); };
    stopAudio();
    currentSourceRef.current = source;
    setPlayingAudioId(id);
    source.start();
  };

  const handleVisualScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingScan(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const result = await geminiService.analyzePhysique(base64);
        setVisualScan({ ...result, image: reader.result });
        if (aiInsights && result.fitnessAgeAdjustment) {
          setAiInsights(prev => prev ? ({ ...prev, fitnessAge: prev.fitnessAge! + result.fitnessAgeAdjustment }) : null);
        }
      } catch (err) { console.error(err); }
      finally { setLoadingScan(false); }
    };
    reader.readAsDataURL(file);
  };

  const previewPersona = async (persona: any) => {
    if (playingAudioId === persona.id) { stopAudio(); return; }
    setCoachPersona(persona.id);
    setLoadingAudioId(persona.id);
    try {
      const audioBase64 = await geminiService.generatePersonaPreview(persona.id, persona.name);
      setLoadingAudioId(null);
      if (audioBase64) await playAudioData(audioBase64, persona.id);
    } catch (e) { console.error(e); setLoadingAudioId(null); }
  };

  const previewVoiceInLibrary = async (voice: any) => {
    if (playingAudioId === voice.id) { stopAudio(); return; }
    setLoadingAudioId(voice.id);
    try {
      const audioBase64 = await geminiService.generateVoiceSample(voice.id);
      setLoadingAudioId(null);
      if (audioBase64) await playAudioData(audioBase64, voice.id);
    } catch (e) { console.error(e); setLoadingAudioId(null); }
  };

  const saveProfile = () => {
    setProfile(editValues);
    setIsEditing(false);
  };

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-700 relative">
      {/* Settings Modals Overlay */}
      {activeModal && (
        <div className="fixed inset-0 z-[90] bg-zinc-950/98 backdrop-blur-3xl p-8 flex flex-col animate-in slide-in-from-bottom-12 duration-500">
           <div className="flex justify-between items-center mb-10">
              <h2 className="text-xl font-black tracking-tighter uppercase">{activeModal}</h2>
              <button onClick={() => { setActiveModal(null); stopAudio(); }} className="p-3 bg-zinc-900 rounded-full"><X className="w-6 h-6"/></button>
           </div>
           <div className="flex-1 overflow-y-auto space-y-8">
              {activeModal === '智体算法文档' && (
                <div className="space-y-6">
                   <div className="bg-zinc-900/50 p-6 rounded-[32px] border border-zinc-800 space-y-4">
                      <div className="flex items-center space-x-3 text-emerald-500"><Dna className="w-5 h-5"/><h4 className="font-bold">能量消耗算法 (MET)</h4></div>
                      <p className="text-xs text-zinc-400 leading-relaxed">FitMind 使用代射当量 (MET) 计算模型：<br/><code className="text-emerald-400 font-mono">Calories = MET * Weight(kg) * Time(hrs)</code></p>
                   </div>
                   <div className="bg-zinc-900/50 p-6 rounded-[32px] border border-zinc-800 space-y-4">
                      <div className="flex items-center space-x-3 text-emerald-500"><Gauge className="w-5 h-5"/><h4 className="font-bold">基础代谢公式 (Mifflin-St Jeor)</h4></div>
                      <p className="text-xs text-zinc-400 leading-relaxed">这是目前全球公认的针对亚洲人体质最精准的代谢预测模型。</p>
                   </div>
                </div>
              )}
              {activeModal === '语音交互与音色库' && (
                <div className="space-y-4">
                   <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20 mb-6 flex items-center space-x-2">
                      <Volume2 className="w-5 h-5 text-emerald-500" /><p className="text-[10px] text-zinc-300 font-black uppercase tracking-widest">Gemini 2.5 TTS 引擎</p>
                   </div>
                   <div className="grid grid-cols-1 gap-4">
                      {VOICE_LIBRARY.map(v => (
                        <button key={v.id} onClick={() => previewVoiceInLibrary(v)} className={`bg-zinc-900 p-6 rounded-[28px] flex justify-between items-center border transition-all ${playingAudioId === v.id ? 'border-emerald-500' : 'border-zinc-800'}`}>
                           <div className="text-left"><span className="text-sm font-black text-zinc-100">{v.name}</span><p className="text-[10px] text-zinc-500 mt-0.5">{v.type} Persona</p></div>
                           <div className={`p-3 rounded-full ${playingAudioId === v.id ? 'bg-red-500' : (loadingAudioId === v.id ? 'bg-zinc-800' : 'bg-emerald-500')} text-zinc-950`}>
                              {loadingAudioId === v.id ? <Loader2 className="w-5 h-5 animate-spin text-emerald-500" /> : (playingAudioId === v.id ? <Square className="w-5 h-5 fill-current text-white" /> : <Play className="w-5 h-5 fill-current" />)}
                           </div>
                        </button>
                      ))}
                   </div>
                </div>
              )}
              {activeModal === '隐私保护协议' && (
                <div className="space-y-4 text-zinc-400 text-sm leading-relaxed">
                   <p>1. 您的体态照片仅用于实时分析，不会被存储于我们的服务器。</p>
                   <p>2. 所有生理数据（如心率）均严格保存在您的本地加密空间中。</p>
                </div>
              )}
           </div>
        </div>
      )}

      {/* 沉浸式头部 - 头像与编辑按钮 */}
      <div className="relative pt-6 px-1 flex items-center justify-between">
        <div className="flex items-center space-x-5">
           <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-tr from-emerald-500 to-emerald-400 rounded-full blur opacity-40 group-hover:opacity-100 transition duration-1000"></div>
              <div className="relative w-24 h-24 bg-zinc-900 rounded-full border-4 border-zinc-950 overflow-hidden shadow-2xl">
                 <img src={visualScan?.image || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop"} className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-emerald-500 p-2 rounded-full border-2 border-zinc-950 shadow-lg cursor-pointer">
                <label className="cursor-pointer">
                   <input type="file" className="hidden" accept="image/*" onChange={handleVisualScan} />
                   <Camera className="w-4 h-4 text-zinc-950" />
                </label>
              </div>
           </div>
           <div>
              {isEditing ? (
                 <div className="relative group/input">
                    <input 
                      type="text" 
                      value={editValues.name}
                      onChange={(e) => setEditValues({...editValues, name: e.target.value})}
                      className="bg-zinc-900 border-b-2 border-emerald-500 px-2 py-1 text-2xl font-black text-zinc-100 outline-none w-40"
                      placeholder="智体代号"
                      maxLength={10}
                    />
                    <Edit3 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/50" />
                 </div>
              ) : (
                 <h2 className="text-2xl font-black tracking-tighter flex items-center">
                    {profile.name}
                    <div className="ml-2 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                       <span className="text-[10px] font-black text-emerald-500 uppercase">Lv.12</span>
                    </div>
                 </h2>
              )}
              <p className="text-[10px] text-zinc-500 font-bold mt-1 uppercase tracking-widest">智体特工任务中</p>
           </div>
        </div>
        <button 
          onClick={() => { setIsEditing(!isEditing); setEditValues(profile); }}
          className={`p-4 rounded-3xl transition-all shadow-xl active:scale-90 ${isEditing ? 'bg-zinc-800 text-zinc-400' : 'bg-emerald-500 text-zinc-950'}`}
        >
          {isEditing ? <X className="w-6 h-6" /> : <Settings className="w-6 h-6" />}
        </button>
      </div>

      {/* AI Health Insights Card - 体态视觉扫描结果 */}
      <div className="bg-zinc-900 border border-emerald-500/20 rounded-[40px] p-8 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
           <Activity className="w-24 h-24 text-emerald-500" />
        </div>
        <div className="flex justify-between items-center mb-6 relative z-10">
           <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-emerald-500" />
              <h3 className="text-xs font-black uppercase tracking-widest text-emerald-500">智体视觉扫描报告</h3>
           </div>
           {loadingScan ? <Loader2 className="w-4 h-4 animate-spin text-emerald-500"/> : (
             <label className="flex items-center space-x-1 cursor-pointer bg-zinc-800 px-3 py-1.5 rounded-xl border border-zinc-700 hover:bg-zinc-700">
                <input type="file" className="hidden" accept="image/*" onChange={handleVisualScan} />
                <Scan className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-[10px] font-black uppercase text-zinc-400">重新扫描</span>
             </label>
           )}
        </div>

        <div className="grid grid-cols-2 gap-8 relative z-10">
           <div className="space-y-4">
              <div>
                 <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">AI 预估体龄</p>
                 <div className="flex items-baseline space-x-1">
                    <span className="text-4xl font-black tracking-tighter tabular-nums">
                      {loadingInsights ? '--' : (aiInsights?.fitnessAge || 26)}
                    </span>
                    <span className="text-xs text-zinc-500 font-bold">岁</span>
                 </div>
              </div>
              <div className="pt-4 border-t border-zinc-800">
                 <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">预计达标时间</p>
                 <p className="text-base font-black text-emerald-500">
                   {loadingInsights ? '...' : (aiInsights?.weeksToTarget || 8)} <span className="text-xs">WEEKS</span>
                 </p>
              </div>
           </div>
           
           <div className="space-y-4">
              <div>
                 <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">动作改进建议</p>
                 <p className="text-xs font-bold text-zinc-200 leading-relaxed italic">
                   {loadingScan ? "分析体态中..." : (visualScan?.advice || aiInsights?.nextGoal || "继续保持当前的训练强度。")}
                 </p>
              </div>
              {visualScan && (
                 <div className="flex space-x-3 pt-2">
                    <div className="flex-1 bg-zinc-950 p-2 rounded-xl text-center border border-zinc-800">
                       <p className="text-[8px] text-zinc-500 font-black mb-0.5">视觉体脂</p>
                       <p className="text-[10px] font-black text-orange-400">{visualScan.visualBodyFat}</p>
                    </div>
                    <div className="flex-1 bg-zinc-950 p-2 rounded-xl text-center border border-zinc-800">
                       <p className="text-[8px] text-zinc-500 font-black mb-0.5">肌肉分</p>
                       <p className="text-[10px] font-black text-emerald-500">{visualScan.muscleScore}</p>
                    </div>
                 </div>
              )}
           </div>
        </div>
      </div>

      {/* Profile Metrics Grid - 指标卡片与编辑模式 */}
      <div className="grid grid-cols-3 gap-4">
        {isEditing ? (
          <div className="col-span-3 grid grid-cols-2 gap-3 animate-in slide-in-from-top-4 duration-300">
            <div className="bg-zinc-900 p-4 rounded-3xl border border-emerald-500/30">
              <p className="text-[10px] text-emerald-500 font-black mb-2 uppercase">体重(kg)</p>
              <input 
                type="number" 
                value={editValues.weight} 
                onChange={(e) => setEditValues({...editValues, weight: parseInt(e.target.value)})} 
                className="w-full bg-transparent border-none outline-none font-black text-xl text-zinc-100" 
              />
            </div>
            <div className="bg-zinc-900 p-4 rounded-3xl border border-emerald-500/30">
              <p className="text-[10px] text-emerald-500 font-black mb-2 uppercase">身高(cm)</p>
              <input 
                type="number" 
                value={editValues.height} 
                onChange={(e) => setEditValues({...editValues, height: parseInt(e.target.value)})} 
                className="w-full bg-transparent border-none outline-none font-black text-xl text-zinc-100" 
              />
            </div>
            <div className="col-span-2 bg-zinc-900 p-4 rounded-3xl border border-emerald-500/30">
              <p className="text-[10px] text-emerald-500 font-black mb-2 uppercase">目标体重(kg)</p>
              <input 
                type="range" min="40" max="150"
                value={editValues.targetWeight} 
                onChange={(e) => setEditValues({...editValues, targetWeight: parseInt(e.target.value)})} 
                className="w-full accent-emerald-500" 
              />
              <p className="text-center font-black mt-1">{editValues.targetWeight} kg</p>
            </div>
            <button onClick={saveProfile} className="col-span-2 bg-emerald-500 text-zinc-950 py-5 rounded-[32px] font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
              同步智体核心参数
            </button>
          </div>
        ) : (
          <>
            {[
              { label: '身高', value: `${profile.height}cm`, icon: <Ruler className="w-3 h-3"/> },
              { label: '目标', value: `${profile.targetWeight}kg`, icon: <Target className="w-3 h-3"/> },
              { label: '体脂', value: visualScan?.visualBodyFat || '待扫描', icon: <Activity className="w-3 h-3"/> },
            ].map(s => (
              <div key={s.label} className="bg-zinc-900/50 p-5 rounded-[32px] border border-zinc-800 text-center group hover:bg-zinc-900 transition-colors">
                <p className="text-[10px] text-zinc-500 font-black mb-2 uppercase tracking-widest flex items-center justify-center">
                   {s.icon} <span className="ml-1">{s.label}</span>
                </p>
                <p className="text-sm font-black text-zinc-100">{s.value}</p>
              </div>
            ))}
          </>
        )}
      </div>

      {/* 教练人格选择 - 全局同步系统 */}
      <div className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 px-1 flex items-center">
           <Zap className="w-4 h-4 mr-2 text-emerald-500" /> 教练人格同步 (System Wide)
        </h3>
        <div className="grid grid-cols-1 gap-3">
           {COACH_PERSONAS.map(p => (
             <button 
              key={p.id} 
              onClick={() => previewPersona(p)} 
              className={`p-6 rounded-[36px] border flex items-center justify-between transition-all active:scale-95 ${coachPersona === p.id ? 'bg-zinc-900 border-emerald-500 shadow-xl shadow-emerald-500/5' : 'bg-zinc-900/50 border-zinc-800 opacity-60 hover:opacity-100'}`}
             >
               <div className="flex items-center space-x-5 text-left">
                  <span className="text-3xl transition-transform group-active:scale-110">{p.icon}</span>
                  <div>
                    <p className={`text-base font-black ${coachPersona === p.id ? 'text-zinc-100' : 'text-zinc-400'}`}>{p.name}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{loadingAudioId === p.id ? '正在切换人格音色...' : p.desc}</p>
                  </div>
               </div>
               <div className={`p-3 rounded-full ${playingAudioId === p.id ? 'bg-red-500' : (coachPersona === p.id ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-600')}`}>
                  {loadingAudioId === p.id ? <Loader2 className="w-5 h-5 animate-spin text-emerald-500" /> : (playingAudioId === p.id ? <Square className="w-5 h-5 fill-current text-white" /> : <Play className="w-5 h-5 fill-current" />)}
               </div>
             </button>
           ))}
        </div>
      </div>

      {/* 功能设置列表 */}
      <div className="space-y-3">
        {[
          { icon: Volume2, label: '语音交互与音色库' },
          { icon: Info, label: '智体算法文档' },
          { icon: ShieldCheck, label: '隐私保护协议' }
        ].map(item => (
          <button 
            key={item.label} 
            onClick={() => setActiveModal(item.label)} 
            className="w-full bg-zinc-900/50 p-6 rounded-[32px] border border-zinc-800 flex items-center justify-between hover:bg-zinc-900 active:scale-95 transition-all"
          >
             <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-zinc-800 rounded-2xl flex items-center justify-center">
                   <item.icon className="w-5 h-5 text-zinc-500" />
                </div>
                <span className="text-sm font-black text-zinc-200">{item.label}</span>
             </div>
             <ChevronRight className="w-4 h-4 text-zinc-700" />
          </button>
        ))}
        
        <button 
          onClick={() => { localStorage.clear(); window.location.reload(); }}
          className="w-full mt-6 bg-red-500/10 text-red-500 p-6 rounded-[36px] border border-red-500/20 flex items-center justify-center font-black text-xs uppercase tracking-widest active:scale-95 transition-all"
        >
          <LogOut className="w-5 h-5 mr-3" />
          重置智体认知系统
        </button>
      </div>

      <div className="text-center pt-8 opacity-40">
        <p className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.6em]">FitMind Physiological Agent</p>
      </div>
    </div>
  );
};

export default Profile;
