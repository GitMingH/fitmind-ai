
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Dumbbell, 
  Utensils, 
  FlaskConical, 
  User,
  Heart,
  Plus,
  Zap,
  Mic,
  Settings,
  RefreshCcw
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import AICoach from './components/AICoach';
import DietTracker from './components/DietTracker';
import WorkoutLogger from './components/WorkoutLogger';
import AILab from './components/AILab';
import Profile from './components/Profile';
import { DeviceState, UserProfile, Meal, Workout, ExerciseType } from './types';
import { getHRZones } from './constants';

const INITIAL_PROFILE: UserProfile = {
  name: '智体先锋', // 默认昵称
  age: 28,
  gender: 'male',
  height: 180,
  weight: 75,
  targetWeight: 72,
  allergies: [],
  dietPreference: '高蛋白',
  injuryHistory: '无',
  bmr: 1800
};

// 全局人格配置映射
export const PERSONA_CONFIGS: Record<string, { systemInstruction: string, voice: string }> = {
  encouraging: {
    systemInstruction: "你是一位温柔且充满阳光的健身教练。说话多使用鼓励性的词汇和颜文字，语气亲切，像是用户最好的朋友。重点在于情感支持和持续的赞美。",
    voice: "Kore"
  },
  strict: {
    systemInstruction: "你是一位极其严格的铁血特种兵教官。说话简短、有力、不留情面。专注于目标达成，杜绝任何借口。语气严肃且具有压迫感。",
    voice: "Fenrir"
  },
  scientific: {
    systemInstruction: "你是一位极致专业的运动生理学专家。说话冷静、理性，大量引用代谢当量(MET)、生理指标、营养学数据。不带个人情感，只提供基于科学的最优解。",
    voice: "Charon"
  }
};

const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: '概览' },
    { path: '/coach', icon: Zap, label: '教练' },
    { path: '/workout', icon: Dumbbell, label: '训练' },
    { path: '/diet', icon: Utensils, label: '饮食' },
    { path: '/lab', icon: FlaskConical, label: '实验室' },
    { path: '/profile', icon: User, label: '我的' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900/90 backdrop-blur-md border-t border-zinc-800 pb-safe z-50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
                isActive ? 'text-emerald-500' : 'text-zinc-500'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

const App: React.FC = () => {
  // --- Data Persistence ---
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('fm_profile');
    return saved ? JSON.parse(saved) : INITIAL_PROFILE;
  });
  
  // 新增：全局教练人格设定
  const [coachPersona, setCoachPersona] = useState<string>(() => {
    return localStorage.getItem('fm_persona') || 'encouraging';
  });

  const [meals, setMeals] = useState<Meal[]>(() => {
    const saved = localStorage.getItem('fm_meals');
    return saved ? JSON.parse(saved) : [];
  });
  const [workouts, setWorkouts] = useState<Workout[]>(() => {
    const saved = localStorage.getItem('fm_workouts');
    return saved ? JSON.parse(saved) : [];
  });
  const [waterIntake, setWaterIntake] = useState<number>(() => {
    const saved = localStorage.getItem('fm_water');
    return saved ? parseFloat(saved) : 0;
  });

  useEffect(() => {
    localStorage.setItem('fm_profile', JSON.stringify(profile));
    localStorage.setItem('fm_persona', coachPersona);
    const calculatedBmr = Math.round(10 * profile.weight + 6.25 * profile.height - 5 * profile.age + (profile.gender === 'male' ? 5 : -161));
    if (profile.bmr !== calculatedBmr) {
      setProfile(prev => ({ ...prev, bmr: calculatedBmr }));
    }
  }, [profile.weight, profile.height, profile.age, profile.gender, coachPersona]);

  useEffect(() => localStorage.setItem('fm_meals', JSON.stringify(meals)), [meals]);
  useEffect(() => localStorage.setItem('fm_workouts', JSON.stringify(workouts)), [workouts]);
  useEffect(() => localStorage.setItem('fm_water', waterIntake.toString()), [waterIntake]);

  const [device, setDevice] = useState<DeviceState>({
    isConnected: false,
    name: '',
    battery: 0,
    heartRate: 0,
    type: 'watch',
    syncFrequency: 'off',
    lastSync: Date.now()
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const syncTimerRef = useRef<any>(null);

  useEffect(() => {
    if (device.isConnected && device.syncFrequency !== 'off') {
      const intervalMs = device.syncFrequency === '1h' ? 30000 : 
                        device.syncFrequency === '4h' ? 120000 : 86400000;
      
      syncTimerRef.current = setInterval(() => {
        setIsSyncing(true);
        setTimeout(() => {
          setDevice(prev => ({
            ...prev,
            lastSync: Date.now(),
            battery: Math.max(0, prev.battery - 1)
          }));
          setIsSyncing(false);
        }, 2000);
      }, intervalMs);
    } else {
      clearInterval(syncTimerRef.current);
    }
    return () => clearInterval(syncTimerRef.current);
  }, [device.isConnected, device.syncFrequency]);

  useEffect(() => {
    let interval: any;
    if (device.isConnected) {
      interval = setInterval(() => {
        setDevice(prev => ({
          ...prev,
          heartRate: Math.floor(Math.random() * (165 - 60 + 1)) + 60
        }));
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [device.isConnected]);

  const zones = getHRZones(profile.age);
  const currentZone = zones.find(z => device.heartRate >= z.min && device.heartRate <= z.max) || zones[0];

  return (
    <HashRouter>
      <div className="min-h-screen bg-zinc-950 text-zinc-50 pb-20 flex flex-col">
        <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 p-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Zap className="text-zinc-950 w-5 h-5 fill-current" />
            </div>
            <h1 className="font-black text-lg tracking-tighter">FITMIND AI</h1>
          </div>
          {device.isConnected && (
            <div className="flex items-center space-x-2">
              {isSyncing && <RefreshCcw className="w-3 h-3 text-emerald-500 animate-spin" />}
              <div 
                className="flex items-center bg-zinc-900 border border-zinc-800 rounded-full px-4 py-1.5 transition-all"
                style={{ borderColor: `${currentZone.color}66` }}
              >
                <div className="w-2 h-2 rounded-full mr-2 animate-pulse" style={{ backgroundColor: currentZone.color }} />
                <span className="text-[10px] font-black tabular-nums">{device.heartRate} BPM</span>
              </div>
            </div>
          )}
        </header>

        <main className="flex-1 max-w-lg mx-auto w-full p-4 overflow-x-hidden">
          <Routes>
            <Route path="/" element={
              <Dashboard 
                profile={profile} 
                setProfile={setProfile}
                meals={meals} 
                workouts={workouts} 
                device={device} 
                waterIntake={waterIntake}
                setWaterIntake={setWaterIntake}
              />
            } />
            <Route path="/coach" element={<AICoach profile={profile} workouts={workouts} device={device} personaId={coachPersona} />} />
            <Route path="/workout" element={<WorkoutLogger workouts={workouts} setWorkouts={setWorkouts} profile={profile} device={device} personaId={coachPersona} />} />
            <Route path="/diet" element={<DietTracker meals={meals} setMeals={setMeals} profile={profile} />} />
            <Route path="/lab" element={<AILab workouts={workouts} />} />
            <Route path="/profile" element={<Profile profile={profile} setProfile={setProfile} device={device} setDevice={setDevice} coachPersona={coachPersona} setCoachPersona={setCoachPersona} />} />
          </Routes>
        </main>

        <Navigation />
      </div>
    </HashRouter>
  );
};

export default App;
