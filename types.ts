
export enum ExerciseType {
  STRENGTH = '力量训练',
  RUNNING = '跑步',
  YOGA = '瑜伽',
  HIIT = '高强度间歇训练',
  BREATHING = '呼吸训练'
}

export type MuscleGroup = '胸部' | '背部' | '腿部' | '肩部' | '手臂' | '核心' | '全身';

export type SyncFrequency = 'off' | '1h' | '4h' | '1d';

export interface UserProfile {
  name: string; // 新增：用户昵称
  age: number;
  gender: 'male' | 'female';
  height: number;
  weight: number;
  targetWeight: number;
  bodyFat?: number;
  bmr?: number;
  allergies: string[];
  dietPreference: string;
  injuryHistory: string;
}

export interface Meal {
  id: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  image?: string;
  timestamp: number;
  healthScore?: number;
  coachTip?: string;
}

export interface Workout {
  id: string;
  type: ExerciseType;
  duration: number; // minutes
  intensity: number; // 1-10
  caloriesBurned: number;
  timestamp: number;
  notes?: string;
  targetMuscle?: MuscleGroup;
  avgHeartRate?: number;
  coachFeedback?: string;
}

export interface DailyPlan {
  day: string;
  workout: {
    title: string;
    details: string;
  };
  meals: {
    breakfast: string;
    lunch: string;
    dinner: string;
  };
}

export interface DeviceState {
  isConnected: boolean;
  name: string;
  battery: number;
  heartRate: number;
  type: 'watch' | 'strap' | 'scale';
  syncFrequency: SyncFrequency;
  lastSync?: number;
}

export interface HRZone {
  name: string;
  min: number;
  max: number;
  color: string;
  label: string;
  icon: string;
}
