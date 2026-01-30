
import React from 'react';
import { ExerciseType, HRZone } from './types';

export const MET_VALUES: Record<ExerciseType, number> = {
  [ExerciseType.STRENGTH]: 6.0,
  [ExerciseType.RUNNING]: 8.0,
  [ExerciseType.YOGA]: 3.0,
  [ExerciseType.HIIT]: 10.0,
  [ExerciseType.BREATHING]: 1.5, // Default base
};

// Specific breathing intensities as requested
export const BREATHING_MET_MAP: Record<number, number> = {
  1: 1.3, // Low
  5: 2.0, // Mid
  10: 3.0, // High
};

export const EXERCISE_METADATA = [
  { type: ExerciseType.STRENGTH, icon: '🏋️', color: 'bg-blue-500' },
  { type: ExerciseType.RUNNING, icon: '🏃', color: 'bg-orange-500' },
  { type: ExerciseType.YOGA, icon: '🧘', color: 'bg-purple-500' },
  { type: ExerciseType.HIIT, icon: '⚡', color: 'bg-red-500' },
  { type: ExerciseType.BREATHING, icon: '🌬️', color: 'bg-emerald-500' },
];

export const MOCK_DEVICES = [
  { id: '1', name: 'FitMind Strap Pro', type: 'strap', battery: 85 },
  { id: '2', name: 'Apple Watch Series 9', type: 'watch', battery: 42 },
  { id: '3', name: 'Smart Scale X1', type: 'scale', battery: 100 },
];

export const getHRZones = (age: number): HRZone[] => {
  const mhr = 220 - age;
  return [
    { name: 'Warm-up', label: '热身', min: 0, max: Math.floor(mhr * 0.6), color: '#71717a', icon: '🧘' },
    { name: 'Fat Burn', label: '燃脂', min: Math.floor(mhr * 0.6), max: Math.floor(mhr * 0.7), color: '#10b981', icon: '🔥' },
    { name: 'Aerobic', label: '有氧', min: Math.floor(mhr * 0.7), max: Math.floor(mhr * 0.8), color: '#3b82f6', icon: '🫁' },
    { name: 'Anaerobic', label: '无氧', min: Math.floor(mhr * 0.8), max: Math.floor(mhr * 0.9), color: '#f59e0b', icon: '⚡' },
    { name: 'VO2 Max', label: '极限', min: Math.floor(mhr * 0.9), max: mhr, color: '#ef4444', icon: '🏆' },
  ];
};
