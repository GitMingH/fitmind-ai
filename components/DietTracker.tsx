
import React, { useState, useMemo } from 'react';
import { 
  Camera, Image as ImageIcon, Plus, Trash2, Wand2, Loader2, 
  ChevronRight, Sparkles, PieChart as PieChartIcon, 
  Coffee, Sun, Moon, Candy, X, Check, Save, Share2
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { geminiService } from '../services/gemini';
import { Meal, UserProfile } from '../types';

interface DietTrackerProps {
  meals: Meal[];
  setMeals: React.Dispatch<React.SetStateAction<Meal[]>>;
  profile: UserProfile; // 新增：需要 profile 来获取名字
}

const MEAL_TYPES = [
  { id: 'breakfast', label: '早餐', icon: Coffee, color: 'text-orange-400' },
  { id: 'lunch', label: '午餐', icon: Sun, color: 'text-yellow-400' },
  { id: 'dinner', label: '晚餐', icon: Moon, color: 'text-blue-400' },
  { id: 'snack', label: '加餐', icon: Candy, color: 'text-pink-400' },
];

const DietTracker: React.FC<DietTrackerProps> = ({ meals, setMeals, profile }) => {
  const [loading, setLoading] = useState(false);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [editInstruction, setEditInstruction] = useState('');
  const [isEditingImg, setIsEditingImg] = useState(false);

  // Stats calculation
  const stats = useMemo(() => {
    const totals = meals.reduce((acc, m) => ({
      kcal: acc.kcal + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat
    }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

    const pieData = [
      { name: '蛋白质', value: totals.protein * 4, color: '#10b981' },
      { name: '碳水', value: totals.carbs * 4, color: '#f59e0b' },
      { name: '脂肪', value: totals.fat * 9, color: '#3b82f6' },
    ];

    return { totals, pieData };
  }, [meals]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const analysis = await geminiService.analyzeMealImage(base64, profile.name);
        
        // Determine type by hour
        const hour = new Date().getHours();
        let type: Meal['type'] = 'snack';
        if (hour >= 6 && hour < 10) type = 'breakfast';
        else if (hour >= 11 && hour < 14) type = 'lunch';
        else if (hour >= 18 && hour < 21) type = 'dinner';

        const newMeal: Meal = {
          id: Date.now().toString(),
          type,
          name: analysis.name,
          calories: analysis.calories,
          protein: analysis.protein,
          carbs: analysis.carbs,
          fat: analysis.fat,
          healthScore: analysis.healthScore,
          coachTip: analysis.coachTip,
          image: reader.result as string,
          timestamp: Date.now()
        };
        setMeals(prev => [newMeal, ...prev]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const startAiEdit = (meal: Meal) => {
    setEditingMeal(meal);
    setIsEditingImg(true);
  };

  const processAiEdit = async () => {
    if (!editingMeal || !editingMeal.image || !editInstruction.trim()) return;
    
    setLoading(true);
    try {
      const base64 = editingMeal.image.split(',')[1];
      const newImgUrl = await geminiService.editMealImage(base64, editInstruction);
      if (newImgUrl) {
        setMeals(prev => prev.map(m => m.id === editingMeal.id ? { ...m, image: newImgUrl } : m));
        setIsEditingImg(false);
        setEditingMeal(null);
        setEditInstruction('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const removeMeal = (id: string) => {
    setMeals(prev => prev.filter(m => m.id !== id));
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header & Daily Stats */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 shadow-2xl overflow-hidden relative">
        <div className="flex justify-between items-start mb-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-black tracking-tight">智体食录</h2>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">今日总摄入：{stats.totals.kcal} kcal</p>
          </div>
          <label className="bg-emerald-500 text-zinc-950 p-4 rounded-2xl cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            <Camera className="w-6 h-6" />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-6 items-center">
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={45}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {stats.pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '12px', fontSize: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
             {stats.pieData.map(d => (
               <div key={d.name} className="flex items-center justify-between">
                 <div className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-[10px] text-zinc-400 font-bold">{d.name}</span>
                 </div>
                 <span className="text-xs font-black">{Math.round((d.value / (stats.totals.kcal || 1)) * 400) / 100}%</span>
               </div>
             ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="bg-emerald-500/5 border-2 border-dashed border-emerald-500/20 rounded-[32px] p-12 flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-500">
          <div className="relative">
             <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
             <div className="absolute inset-0 bg-emerald-500/20 blur-xl animate-pulse rounded-full" />
          </div>
          <div className="text-center">
            <p className="text-sm font-black text-zinc-100 mb-1">AI 正在深度识餐中...</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">利用 Gemini 3 视觉模型计算能量</p>
          </div>
        </div>
      )}

      {/* AI Image Edit Modal */}
      {isEditingImg && (
        <div className="fixed inset-0 z-[70] bg-zinc-950/90 backdrop-blur-xl p-6 flex flex-col animate-in zoom-in-95 duration-300">
           <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black tracking-tighter flex items-center">
                <Wand2 className="w-5 h-5 mr-2 text-emerald-500" />
                AI 魔法编辑 (Nano Banana)
              </h3>
              <button onClick={() => setIsEditingImg(false)} className="p-2 bg-zinc-900 rounded-full"><X className="w-5 h-5" /></button>
           </div>
           
           <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-[32px] overflow-hidden relative group">
              <img src={editingMeal?.image} className="w-full h-full object-contain" />
              {loading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                   <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
                </div>
              )}
           </div>

           <div className="mt-6 space-y-4">
              <textarea 
                value={editInstruction}
                onChange={(e) => setEditInstruction(e.target.value)}
                placeholder="输入修图指令，如：'让背景变干净' 或 '让食物看起来更美味'..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm focus:ring-1 focus:ring-emerald-500 outline-none h-24 resize-none"
              />
              <button 
                onClick={processAiEdit}
                disabled={loading || !editInstruction.trim()}
                className="w-full bg-emerald-500 text-zinc-950 p-4 rounded-2xl font-black text-sm shadow-lg shadow-emerald-500/20 disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-2" /> 确认魔法修图</>}
              </button>
           </div>
        </div>
      )}

      {/* Meals grouped by type */}
      <div className="space-y-8">
        {MEAL_TYPES.map((type) => {
          const typeMeals = meals.filter(m => m.type === type.id);
          if (typeMeals.length === 0) return null;

          return (
            <div key={type.id} className="space-y-4">
              <div className="flex items-center space-x-2 px-1">
                <type.icon className={`w-5 h-5 ${type.color}`} />
                <h3 className="text-sm font-black uppercase tracking-widest">{type.label}</h3>
                <span className="text-[10px] text-zinc-500 font-bold ml-auto">{typeMeals.reduce((a, b) => a + b.calories, 0)} kcal</span>
              </div>

              <div className="space-y-4">
                {typeMeals.map((meal) => (
                  <div key={meal.id} className="bg-zinc-900/50 border border-zinc-800 rounded-[32px] overflow-hidden group hover:bg-zinc-900 transition-colors">
                    <div className="p-4 flex">
                      <div className="relative w-28 h-28 rounded-[24px] overflow-hidden shrink-0 shadow-2xl">
                        <img src={meal.image} className="w-full h-full object-cover" />
                        <button 
                          onClick={() => startAiEdit(meal)}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        >
                          <Wand2 className="w-6 h-6 text-emerald-500" />
                        </button>
                        {meal.healthScore && (
                          <div className="absolute bottom-2 right-2 bg-zinc-950/80 px-2 py-1 rounded-lg backdrop-blur-md">
                             <span className="text-[10px] font-black text-emerald-500">{meal.healthScore}</span>
                          </div>
                        )}
                      </div>

                      <div className="ml-5 flex-1 flex flex-col justify-between py-1">
                        <div>
                          <div className="flex justify-between items-start">
                             <h4 className="font-black text-sm tracking-tight">{meal.name}</h4>
                             <button onClick={() => removeMeal(meal.id)} className="text-zinc-600 hover:text-red-500 transition-colors">
                               <Trash2 className="w-4 h-4" />
                             </button>
                          </div>
                          <p className="text-[9px] text-zinc-600 font-black uppercase tracking-tighter mt-1">
                            {new Date(meal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                           {[
                             { label: 'CAL', val: meal.calories, color: 'text-zinc-200' },
                             { label: 'PRO', val: meal.protein, color: 'text-emerald-500' },
                             { label: 'CAR', val: meal.carbs, color: 'text-orange-500' },
                             { label: 'FAT', val: meal.fat, color: 'text-zinc-400' },
                           ].map(macro => (
                             <div key={macro.label} className="text-center">
                               <p className="text-[8px] text-zinc-600 font-black mb-0.5">{macro.label}</p>
                               <p className={`text-[10px] font-black ${macro.color}`}>{macro.val}g</p>
                             </div>
                           ))}
                        </div>
                      </div>
                    </div>
                    
                    {meal.coachTip && (
                      <div className="px-5 pb-5 pt-1">
                        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-3 flex items-start space-x-2">
                           <Sparkles className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                           <p className="text-[10px] text-zinc-300 font-medium italic leading-relaxed">
                             {meal.coachTip}
                           </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {meals.length === 0 && !loading && (
          <div className="text-center py-20 bg-zinc-900/30 rounded-[32px] border-2 border-dashed border-zinc-800 opacity-50">
            <PieChartIcon className="w-12 h-12 mx-auto mb-4 text-zinc-700" />
            <p className="text-xs font-bold text-zinc-600">空盘行动，点击右上方相机记录</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DietTracker;
