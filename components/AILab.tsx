
import React, { useState, useEffect } from 'react';
import { 
  Palette, Play, Image as ImageIcon, Video, Share2, Loader2, Sparkles, 
  Download, FlaskConical, Maximize, Layout, Check, ChevronRight, 
  Trophy, Flame, Clock, Heart, Zap, Waves, Wand2, X, Scissors, AlertCircle
} from 'lucide-react';
import { geminiService } from '../services/gemini';
import { Workout } from '../types';

interface AILabProps {
  workouts: Workout[];
}

const STYLES = [
  { id: 'cyber', name: '赛博健身', prompt: 'Cyberpunk futuristic gym style, neon lighting, highly detailed, octane render' },
  { id: 'minimal', name: '极简主义', prompt: 'Minimalist flat vector illustration, clean lines, professional health app aesthetic' },
  { id: 'cinematic', name: '电影质感', prompt: 'Cinematic photography, dramatic athletic lighting, 8k resolution, photorealistic' },
  { id: 'anime', name: '热血动漫', prompt: 'Dynamic shonen anime style, intense workout energy, aura effects' },
];

const ASPECT_RATIOS = [
  { id: '1:1', label: '1:1', desc: '正方形' },
  { id: '9:16', label: '9:16', desc: '垂直/壁纸' },
  { id: '16:9', label: '16:9', desc: '宽屏/海报' },
];

const RESOLUTIONS = ['1K', '2K', '4K'];

const VEO_STEPS = [
  "正在解析人体运动拓扑...",
  "正在构建物理动力学模型...",
  "正在解算肌肉纤维拉伸动效...",
  "正在模拟汗水与光影交互...",
  "正在进行最终渲染输出..."
];

const AILab: React.FC<AILabProps> = ({ workouts }) => {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0]);
  const [aspectRatio, setAspectRatio] = useState<any>('1:1');
  const [resolution, setResolution] = useState<any>('1K');
  
  const [loading, setLoading] = useState(false);
  const [veoStep, setVeoStep] = useState(0);
  const [stage, setStage] = useState<'idle' | 'image' | 'video' | 'poster'>('idle');
  
  const [generatedImg, setGeneratedImg] = useState<string | null>(null);
  const [generatedVid, setGeneratedVid] = useState<string | null>(null);
  const [posterImg, setPosterImg] = useState<string | null>(null);

  // Veo steps animation logic
  useEffect(() => {
    let interval: any;
    if (loading && stage === 'video') {
      interval = setInterval(() => {
        setVeoStep(prev => (prev + 1) % VEO_STEPS.length);
      }, 7000);
    } else {
      setVeoStep(0);
    }
    return () => clearInterval(interval);
  }, [loading, stage]);

  const checkApiKey = async () => {
    // 强制检查是否有 API KEY，特别是对于 Veo 和 Pro 模型
    const hasKey = await (window as any).aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await (window as any).aistudio.openSelectKey();
      // 用户选择后，我们继续尝试下一步
      return true; 
    }
    return true;
  };

  const handleGenerateImage = async () => {
    if (!prompt.trim()) return;
    await checkApiKey();

    setLoading(true);
    setStage('image');
    setGeneratedVid(null);
    try {
      const fullPrompt = `${selectedStyle.prompt}. Subject: ${prompt}.`;
      const url = await geminiService.generateInspirationImage(fullPrompt, aspectRatio, resolution);
      setGeneratedImg(url || null);
    } catch (e: any) {
      console.error(e);
      if (e.message?.includes("Requested entity was not found.")) {
        await (window as any).aistudio.openSelectKey();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!generatedImg) return;
    await checkApiKey();

    setLoading(true);
    setStage('video');
    try {
      const videoUrl = await geminiService.generateVeoVideo(
        `Professional workout motion based on this scene: ${prompt}. Smooth, realistic physics.`, 
        generatedImg.split(',')[1]
      );
      setGeneratedVid(videoUrl);
    } catch (e: any) {
      console.error(e);
      if (e.message?.includes("Requested entity was not found.")) {
        await (window as any).aistudio.openSelectKey();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePoster = async () => {
    await checkApiKey();
    setLoading(true);
    setStage('poster');
    try {
      // 提取本周亮点
      const bestWorkout = workouts.length > 0 ? [...workouts].sort((a,b) => b.caloriesBurned - a.caloriesBurned)[0] : null;
      const highlight = bestWorkout ? `本周巅峰：${bestWorkout.type}，消耗${bestWorkout.caloriesBurned}卡路里` : "智体 AI 健身挑战者";
      
      const posterPrompt = `High-end minimalist fitness achievement poster for social media. Typography: "POWERED BY AI". Background: artistic representation of ${bestWorkout?.type || 'fitness'}. Color palette: Emerald and Dark Zinc. Highlight: ${highlight}. 2K resolution.`;
      
      const url = await geminiService.generateInspirationImage(posterPrompt, "9:16", "2K");
      setPosterImg(url || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const shareResult = async (url: string) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: '我的智体 AI 创作',
          text: '来看看我的 AI 私教为我生成的作品！',
          url: window.location.href
        });
      } else {
        await navigator.clipboard.writeText(url);
        alert('链接已复制');
      }
    } catch (e) {}
  };

  return (
    <div className="space-y-8 pb-28 animate-in fade-in duration-700">
      <div className="flex justify-between items-end px-1">
        <div>
          <h2 className="text-3xl font-black tracking-tighter flex items-center">
            <FlaskConical className="w-8 h-8 mr-3 text-purple-500" />
            智体实验室
          </h2>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
            由 Gemini 3 Pro & Veo 3.1 强力驱动
          </p>
        </div>
        <button 
          onClick={handleGeneratePoster}
          disabled={loading}
          className="bg-zinc-900 border border-emerald-500/30 text-emerald-500 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/5 transition-all flex items-center shadow-lg active:scale-95 disabled:opacity-50"
        >
          {loading && stage === 'poster' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trophy className="w-4 h-4 mr-2" />}
          成就海报
        </button>
      </div>

      {/* API Key Notice */}
      <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-3xl flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">
          实验室功能涉及 <span className="text-purple-400 font-black">Veo 视频生成</span> 及 <span className="text-purple-400 font-black">4K 高清绘图</span>，需在弹出框中选择已启用计费（Paid Project）的 API Key。
        </p>
      </div>

      {/* Creator Console */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-[40px] p-6 space-y-8 shadow-2xl relative overflow-hidden">
        <div className="space-y-4 relative z-10">
          <div className="flex items-center space-x-2">
            <Wand2 className="w-4 h-4 text-purple-500" />
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">创意提示词</h3>
          </div>
          <textarea 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例如：'一位在赛博朋克森林中练习瑜伽的女性'..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-[28px] p-6 text-sm min-h-[140px] outline-none focus:ring-2 focus:ring-purple-500/50 transition-all resize-none font-medium leading-relaxed"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          <div className="space-y-4">
             <div className="flex items-center space-x-2">
               <Palette className="w-4 h-4 text-zinc-500" />
               <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">视觉风格</span>
             </div>
             <div className="grid grid-cols-2 gap-2">
               {STYLES.map(s => (
                 <button 
                  key={s.id}
                  onClick={() => setSelectedStyle(s)}
                  className={`p-3.5 rounded-2xl text-[10px] font-black border transition-all ${selectedStyle.id === s.id ? 'bg-purple-600 border-purple-600 text-white shadow-xl' : 'bg-zinc-800 border-transparent text-zinc-400 hover:bg-zinc-750'}`}
                 >
                   {s.name}
                 </button>
               ))}
             </div>
          </div>

          <div className="space-y-4">
             <div className="flex items-center space-x-2">
               <Layout className="w-4 h-4 text-zinc-500" />
               <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">画布配置</span>
             </div>
             <div className="space-y-3">
               <div className="flex space-x-2">
                  {ASPECT_RATIOS.map(r => (
                    <button 
                      key={r.id}
                      onClick={() => setAspectRatio(r.id)}
                      className={`flex-1 py-3.5 rounded-2xl flex flex-col items-center border transition-all ${aspectRatio === r.id ? 'bg-zinc-100 border-zinc-100 text-zinc-900 shadow-xl' : 'bg-zinc-800 border-transparent text-zinc-500'}`}
                    >
                      <span className="text-[10px] font-black">{r.label}</span>
                    </button>
                  ))}
               </div>
               <div className="flex space-x-2">
                  {RESOLUTIONS.map(res => (
                    <button 
                      key={res}
                      onClick={() => setResolution(res)}
                      className={`flex-1 py-3 rounded-2xl border text-[10px] font-black transition-all ${resolution === res ? 'bg-zinc-100 border-zinc-100 text-zinc-900 shadow-xl' : 'bg-zinc-800 border-transparent text-zinc-500'}`}
                    >
                      {res}
                    </button>
                  ))}
               </div>
             </div>
          </div>
        </div>

        <button 
          onClick={handleGenerateImage}
          disabled={loading || !prompt.trim()}
          className="w-full bg-purple-600 text-white p-6 rounded-[32px] font-black uppercase tracking-[0.2em] shadow-[0_20px_40px_rgba(147,51,234,0.2)] active:scale-95 transition-all flex items-center justify-center space-x-3 disabled:opacity-50"
        >
          {loading && stage === 'image' ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-5 h-5" /> <span>立即生成大师之作</span></>}
        </button>
      </div>

      {/* Render State Indicator */}
      {loading && stage === 'video' && (
        <div className="bg-zinc-900 border border-purple-500/20 rounded-[40px] p-12 flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-500">
          <div className="relative">
             <div className="w-20 h-20 rounded-full bg-purple-600/10 flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
             </div>
             <div className="absolute inset-0 bg-purple-500/20 blur-[50px] rounded-full animate-pulse" />
          </div>
          <div className="text-center space-y-3">
            <p className="text-xl font-black tracking-tighter text-zinc-100">{VEO_STEPS[veoStep]}</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">由谷歌最新 VEO 视频扩散模型驱动</p>
          </div>
          <div className="w-full max-w-xs bg-zinc-950 h-2 rounded-full overflow-hidden p-0.5 border border-zinc-800">
             <div className="bg-gradient-to-r from-purple-600 to-emerald-500 h-full transition-all duration-1000 rounded-full" style={{ width: `${((veoStep + 1) / VEO_STEPS.length) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Output Results */}
      {(generatedImg || generatedVid) && !loading && (
        <div className="space-y-6 animate-in slide-in-from-bottom-12 duration-700">
           <div className="flex items-center justify-between px-1">
             <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                <h3 className="text-sm font-black uppercase tracking-widest">实验室创作成果</h3>
             </div>
             <button onClick={() => {setGeneratedImg(null); setGeneratedVid(null); setStage('idle');}} className="text-zinc-500 hover:text-white"><X className="w-5 h-5"/></button>
           </div>

           <div className="bg-zinc-900 border border-zinc-800 rounded-[44px] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.5)]">
              <div className="w-full bg-zinc-950 relative group flex items-center justify-center min-h-[300px]" 
                   style={{ aspectRatio: aspectRatio === '9:16' ? '9/16' : (aspectRatio === '16:9' ? '16/9' : '1/1') }}>
                 {generatedVid ? (
                   <video src={generatedVid} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                 ) : (
                   <img src={generatedImg!} className="w-full h-full object-cover" />
                 )}
                 
                 <div className="absolute top-6 right-6 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => shareResult(generatedImg!)} className="p-4 bg-zinc-900/90 backdrop-blur-xl rounded-[20px] text-white hover:bg-zinc-800 transition-all shadow-2xl">
                      <Share2 className="w-6 h-6" />
                    </button>
                 </div>
              </div>

              <div className="p-8 bg-zinc-900 flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
                 <button 
                  onClick={handleGenerateVideo}
                  disabled={!!generatedVid || loading}
                  className="flex-1 bg-zinc-950 border border-purple-500/40 text-purple-400 p-5 rounded-[24px] text-xs font-black uppercase tracking-widest hover:bg-purple-500/10 transition-all flex items-center justify-center space-x-3 disabled:opacity-30 disabled:border-zinc-800 disabled:text-zinc-600"
                 >
                   <Video className="w-5 h-5" />
                   <span>{generatedVid ? '物理动效已完成' : '赋予画面物理动力 (VEO)'}</span>
                 </button>
                 <a 
                  href={generatedVid || generatedImg!} 
                  download="fitmind-ai-lab-export"
                  className="p-5 bg-zinc-800 border border-zinc-700 rounded-[24px] text-zinc-400 hover:text-white transition-all flex items-center justify-center"
                 >
                   <Download className="w-6 h-6" />
                 </a>
              </div>
           </div>
        </div>
      )}

      {/* Poster Result (Modal) */}
      {posterImg && !loading && stage === 'poster' && (
        <div className="fixed inset-0 z-[100] bg-zinc-950/98 backdrop-blur-3xl p-6 flex flex-col items-center justify-center animate-in zoom-in-95 duration-300">
           <button onClick={() => setPosterImg(null)} className="absolute top-8 right-8 p-4 bg-zinc-900 rounded-full text-zinc-500 hover:text-white transition-all border border-zinc-800 shadow-2xl">
             <X className="w-7 h-7" />
           </button>
           
           <div className="max-w-md w-full space-y-8">
              <div className="aspect-[9/16] w-full bg-zinc-900 rounded-[48px] overflow-hidden shadow-[0_0_120px_rgba(16,185,129,0.2)] border-2 border-emerald-500/20">
                 <img src={posterImg} className="w-full h-full object-cover" />
              </div>
              <div className="flex space-x-4">
                 <button onClick={() => shareResult(posterImg)} className="flex-1 bg-emerald-500 text-zinc-950 p-6 rounded-[32px] font-black uppercase tracking-widest shadow-2xl shadow-emerald-500/30 active:scale-95 transition-all">
                   一键分享成果
                 </button>
                 <a href={posterImg} download="fitmind-poster" className="bg-zinc-900 border border-zinc-800 p-6 rounded-[32px] text-white hover:bg-zinc-800 transition-all shadow-xl">
                   <Download className="w-7 h-7" />
                 </a>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default AILab;
