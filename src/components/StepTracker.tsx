import { useState, useEffect } from 'react';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Footprints, TrendingUp, Target } from 'lucide-react';
import { motion } from 'motion/react';
import { UserData } from '../App';
import { playSound, SOUNDS } from '../utils/sound';

export default function StepTracker({ userData, t }: { userData: UserData | null, t: any }) {
  if (!userData) return null;

  const progress = Math.min((userData.steps / userData.goal) * 100, 100);
  const isGoalReached = userData.steps >= userData.goal;

  const simulateSteps = async () => {
    if (!userData.shoeScanned) {
      alert(t.scanInstructions);
      return;
    }

    playSound(SOUNDS.step);

    let newSteps = userData.steps + 1000;
    let newGoal = userData.goal;
    let newCredits = userData.credits;

    if (newSteps >= userData.goal) {
      // Goal reached!
      newSteps = 0;
      newGoal = userData.goal + 1000;
      if (newGoal > 10000) newGoal = 10000;
      newCredits += 1;
    }

    const userRef = doc(db, 'users', userData.uid);
    try {
      await updateDoc(userRef, {
        steps: newSteps,
        goal: newGoal,
        credits: newCredits
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${userData.uid}`);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-6 mb-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-gray-500 text-sm font-bold uppercase tracking-wider">{t.currentProgress}</h2>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black text-blue-600">{userData.steps}</span>
            <span className="text-gray-400 font-bold">/ {userData.goal} {t.steps.toLowerCase()}</span>
          </div>
        </div>
        <div className="bg-blue-50 p-3 rounded-2xl text-blue-600">
          <Footprints size={24} />
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="absolute top-0 left-0 h-full bg-blue-600 rounded-full"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-3">
          <div className="bg-yellow-100 p-2 rounded-lg text-yellow-600">
            <Target size={20} />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase">{t.goal}</p>
            <p className="font-bold text-gray-700">{userData.goal}</p>
          </div>
        </div>
        <div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-3">
          <div className="bg-green-100 p-2 rounded-lg text-green-600">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase">{t.status}</p>
            <p className="font-bold text-gray-700">{isGoalReached ? t.completed : t.inProgress}</p>
          </div>
        </div>
      </div>

      {!userData.shoeScanned ? (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-2xl text-yellow-800 text-sm font-medium text-center">
          {t.scanInstructions}
        </div>
      ) : (
        <div className="space-y-3">
          <button 
            onClick={simulateSteps}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition-all active:scale-95"
          >
            {t.simulateSteps}
          </button>
        </div>
      )}
    </div>
  );
}
