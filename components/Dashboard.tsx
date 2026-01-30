
import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { Droplets, Flame, Footprints, Battery, Radio, Heart, Plus, Scale, ChevronRight } from 'lucide-react';
import { UserProfile, Meal, Workout, DeviceState } from '../types';
import { getHRZones } from '../constants';
import { useNavigate } from 'react-router-dom';

interface DashboardProps {
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  meals: Meal[];
  workouts: Workout[];
  device: DeviceState;
  waterIntake: number;
  setWaterIntake: React.Dispatch<React.SetStateAction<number>>;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  profile, 
  setProfile,
  meals, 
  workouts, 
  device, 
  waterIntake, 
  setWaterIntake 
}) => {
  const navigate = useNavigate();
  const consumedCalories = meals.reduce((acc, m) => acc + m.calories, 0);
  const burnedCalories = workouts.reduce((acc, w) => acc + w.caloriesBurned, 0);
  
  // Dynamic Calorie Target based on BMR + Activity
  // We assume a base activity multiplier or just use BMR as the floor
  const dailyTarget = (profile.bmr || 1800) + 500; // Target is BMR + 500 for maintenance/slight deficit
  const remaining = Math.max(0, dailyTarget - consumedCalories + burnedCalories);

  const calorieData = [
    { name: '已摄入', value: consumedCalories, color: '#10b981' },
    { name: '剩余', value: remaining, color: '#27272a' },
  ];

  const zones = getHRZones(profile.age);
  const currentZone = zones.find(z => device.heartRate >= z.min && device.heartRate <= z.max) || zones[0];

  const handleAddWater = () => {
    setWaterIntake(prev => parseFloat((prev + 0.25).toFixed(2)));
  };

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newWeight = parseInt(e.target.value);
    setProfile(prev => ({ ...prev, weight: newWeight }));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* Real-time Device Card - Upgraded Visuals */}
      {device.isConnected && (
        <div 
          className="bg-zinc-900 border rounded-2xl p-4 flex items-center justify-between emerald-glow transition-all duration-700 overflow-hidden relative"
          style={{ borderColor: `${currentZone.color}66`, background: `linear-gradient(135deg, #18181b 0%, ${currentZone.color}11 100%)` }}
        >
          <div className="flex items-center space-x-4 relative z-10">
            <div className="relative">
              <div 
                className="absolute inset-0 rounded-full animate-ping" 
                style={{ backgroundColor: `${currentZone.color}44` }} 
              />
              <Heart className="w-8 h-8" style={{ color: currentZone.color }} />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">实时状态追踪</p>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-black tracking-tighter" style={{ color: currentZone.color }}>
                  {currentZone.icon} {currentZone.label}
                </span>
                <span className="text-sm text-zinc-400 font-mono font-bold">{device.heartRate} BPM</span>
              </div>
            </div>
          </div>
          <div className="text-right relative z-10">
            <div className="flex items-center text-[10px] text-zinc-400 justify-end mb-1">
              <Battery className="w-3 h-3 mr-1" />
              <span>{device.battery}%</span>
            </div>
            <div className="flex items-center text-[10px] text-emerald-500 font-bold">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse" />
              <span>已同步</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Energy Balance - Dynamic with BMR */}
      <div className="bg-zinc-900 rounded-[32px] p-6 relative overflow-hidden border border-zinc-800 shadow-2xl">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest">今日能量天平</h3>
            <p className="text-4xl font-black tracking-tighter mt-1 tabular-nums">
              {remaining} <span className="text-lg font-medium text-zinc-600">kcal</span>
            </p>
            <p className="text-[10px] text-emerald-500/80 font-medium">剩余建议摄入量</p>
          </div>
          <div className="w-28 h-28 -mr-2 -mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={calorieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={45}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                  animationBegin={0}
                  animationDuration={1500}
                >
                  {calorieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} className="drop-shadow-lg" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-zinc-800/50">
          <div className="text-center group">
            <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">饮食摄入</p>
            <p className="text-lg font-black text-emerald-500 tabular-nums">{consumedCalories}</p>
          </div>
          <div className="text-center border-x border-zinc-800/50 group">
            <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">训练消耗</p>
            <p className="text-lg font-black text-orange-500 tabular-nums">{burnedCalories}</p>
          </div>
          <div className="text-center group" onClick={() => navigate('/profile')}>
            <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">基础代谢</p>
            <p className="text-lg font-black text-blue-500 tabular-nums">{profile.bmr}</p>
          </div>
        </div>
      </div>

      {/* Quick Adjust Widgets */}
      <div className="grid grid-cols-2 gap-4">
        {/* Interactive Water Tracker */}
        <div className="bg-zinc-900 p-5 rounded-3xl border border-zinc-800 hover:border-blue-500/30 transition-all group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-500/10 rounded-xl group-hover:scale-110 transition-transform">
              <Droplets className="text-blue-500 w-5 h-5" />
            </div>
            <button 
              onClick={handleAddWater}
              className="bg-zinc-800 hover:bg-blue-600 hover:text-white w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">今日饮水</p>
            <div className="flex items-baseline space-x-1">
              <p className="text-2xl font-black tabular-nums">{waterIntake}</p>
              <p className="text-xs text-zinc-500 font-bold">L</p>
            </div>
            <div className="w-full bg-zinc-800 h-1 rounded-full mt-3 overflow-hidden">
                <div 
                  className="bg-blue-500 h-full transition-all duration-1000" 
                  style={{ width: `${Math.min(100, (waterIntake / 2.5) * 100)}%` }} 
                />
            </div>
          </div>
        </div>

        {/* Quick Weight Update - Real-time adjust */}
        <div className="bg-zinc-900 p-5 rounded-3xl border border-zinc-800 hover:border-emerald-500/30 transition-all group">
           <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-emerald-500/10 rounded-xl group-hover:scale-110 transition-transform">
              <Scale className="text-emerald-500 w-5 h-5" />
            </div>
            <button 
              onClick={() => navigate('/profile')}
              className="text-zinc-600 hover:text-zinc-300 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-1">
             <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">当前体重</p>
             <div className="flex items-baseline space-x-1">
               <p className="text-2xl font-black tabular-nums">{profile.weight}</p>
               <p className="text-xs text-zinc-500 font-bold">kg</p>
             </div>
             <input 
              type="range" min="40" max="150" step="1" 
              value={profile.weight} 
              onChange={handleWeightChange}
              className="w-full accent-emerald-500 bg-zinc-800 h-1 rounded-lg appearance-none cursor-pointer mt-3"
            />
          </div>
        </div>
      </div>

      {/* Weekly Trends Chart */}
      <div className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-sm font-bold flex items-center">
            <Flame className="w-4 h-4 mr-2 text-orange-500" />
            能量代谢趋势
          </h3>
          <span className="text-[10px] text-zinc-500 font-medium">近 7 日概览</span>
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={[
              { day: '周一', kcal: 1200 },
              { day: '周二', kcal: 1800 },
              { day: '周三', kcal: 1500 },
              { day: '周四', kcal: 2100 },
              { day: '周五', kcal: 1900 },
              { day: '周六', kcal: 2400 },
              { day: '周日', kcal: 1700 },
            ]}>
              <defs>
                <linearGradient id="colorKcal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#71717a', fontSize: 10}} />
              <Tooltip 
                contentStyle={{backgroundColor: '#18181b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '10px'}}
                itemStyle={{color: '#10b981'}}
                cursor={{ stroke: '#27272a', strokeWidth: 2 }}
              />
              <Area 
                type="monotone" 
                dataKey="kcal" 
                stroke="#10b981" 
                fillOpacity={1} 
                fill="url(#colorKcal)" 
                strokeWidth={3} 
                animationDuration={2000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
