/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { auth, db, googleProvider, OperationType, handleFirestoreError } from './firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInAnonymously
} from 'firebase/auth';
import { doc, onSnapshot, setDoc, collection, query, getDocs, writeBatch } from 'firebase/firestore';
import { translations, Language } from './translations';
import { 
  Footprints, 
  QrCode, 
  Ticket, 
  Map as MapIcon, 
  Settings, 
  LogOut, 
  LogIn,
  Trophy,
  Coins,
  Store
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { playSound, SOUNDS } from './utils/sound';
import confetti from 'canvas-confetti';

// Components
import QRScanner from './components/QRScanner';
import StepTracker from './components/StepTracker';
import FruitMachine from './components/FruitMachine';
import CouponTab from './components/CouponTab';
import MapView from './components/MapView';
import AdminPanel from './components/AdminPanel';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface UserData {
  uid: string;
  displayName: string;
  email: string;
  steps: number;
  goal: number;
  credits: number;
  shoeScanned: boolean;
  role?: 'admin' | 'user';
  language: Language;
}

export interface Supermarket {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface Coupon {
  id: string;
  userId: string;
  supermarketId?: string;
  supermarketName?: string;
  fruitType: string;
  fruitEmoji?: string;
  expiryDate: string;
  redeemed: boolean;
  createdAt: string;
  code: string;
}

export interface AppConfig {
  winChance: number;
  ads: { text: string, url: string }[];
  prizes: { key: string, emoji: string, name: string, weight: number }[];
}

type Tab = 'steps' | 'scan' | 'coupons' | 'map' | 'admin';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('steps');
  const [loading, setLoading] = useState(true);
  const [supermarkets, setSupermarkets] = useState<Supermarket[]>([]);
  const [trollEffect, setTrollEffect] = useState<{ type: string, timestamp: number } | null>(null);
  const [isAtTop, setIsAtTop] = useState(true);
  
  const partyAudioRef = useRef<HTMLAudioElement | null>(null);

  const t = translations.nl;

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error('Anonymous sign-in failed', error);
          setLoading(false);
        }
      } else {
        setUser(u);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // User Data Listener
  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserData(docSnap.data() as UserData);
      } else {
        // Initialize user data
        const newData: UserData = {
          uid: user.uid,
          displayName: user.displayName || 'Gebruiker',
          email: user.email || '',
          steps: 0,
          goal: 1000,
          credits: 0,
          shoeScanned: false,
          language: 'nl',
        };
        setDoc(userRef, newData).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`));
      }
      setLoading(false);
    }, (e) => handleFirestoreError(e, OperationType.GET, `users/${user.uid}`));

    return () => unsubscribe();
  }, [user]);

  // Supermarkets Listener
  useEffect(() => {
    const q = query(collection(db, 'supermarkets'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supermarket));
      setSupermarkets(list);
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'supermarkets'));

    return () => unsubscribe();
  }, []);

  // Global Trolls Listener
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'trolls'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        console.log('Troll data received:', data);
        if (data.active) {
          // Party mode is persistent, others are time-based
          if (data.type === 'party' || data.timestamp > (Date.now() - 5000)) {
            setTrollEffect({ type: data.type, timestamp: data.timestamp });
            
            if (data.type === 'fart' && data.timestamp > (Date.now() - 2000)) {
              playSound(SOUNDS.fart);
            }
            
            if (data.type === 'party' && data.timestamp > (Date.now() - 2000)) {
              playSound(SOUNDS.win);
            }
          } else {
            setTrollEffect(null);
          }
        } else {
          setTrollEffect(null);
        }
      }
    }, (err) => console.error('Troll listener error:', err));
    return () => unsub();
  }, []);

  // Periodic confetti for party mode
  useEffect(() => {
    if (trollEffect?.type === 'party') {
      const fire = () => {
        try {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']
          });
        } catch (e) {
          console.error('Confetti failed:', e);
        }
      };
      
      fire(); // Initial fire
      const interval = setInterval(fire, 3000);

      // Handle Europapa music
      if (!partyAudioRef.current) {
        // Using a more reliable URL for Europapa if possible, or at least handling errors
        partyAudioRef.current = new Audio('https://ia800508.us.archive.org/15/items/joost-klein-europapa/Joost%20Klein%20-%20Europapa.mp3');
        partyAudioRef.current.loop = true;
        partyAudioRef.current.volume = 0.5;
        
        partyAudioRef.current.onerror = (e) => {
          console.error('Audio load error:', e);
          // Try a fallback URL if the first one fails
          if (partyAudioRef.current) {
            partyAudioRef.current.src = 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3'; // Fallback to a simple sound if Europapa fails
            partyAudioRef.current.play().catch(err => console.warn('Fallback audio blocked:', err));
          }
        };
      }
      
      const playMusic = async () => {
        try {
          await partyAudioRef.current?.play();
        } catch (e) {
          console.warn('Party music blocked by browser:', e);
        }
      };

      playMusic();

      return () => {
        clearInterval(interval);
        if (partyAudioRef.current) {
          partyAudioRef.current.pause();
          partyAudioRef.current.currentTime = 0;
        }
      };
    }
  }, [trollEffect]);

  // Clear troll effect after some time (only for non-persistent ones)
  useEffect(() => {
    if (trollEffect && trollEffect.type !== 'party' && trollEffect.type !== 'invert' && trollEffect.type !== 'rotate') {
      const timer = setTimeout(() => {
        setTrollEffect(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [trollEffect]);

  // Scroll listener for banner
  useEffect(() => {
    const handleScroll = () => {
      setIsAtTop(window.scrollY < 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getTrollStyles = () => {
    if (!trollEffect) return {};
    switch (trollEffect.type) {
      case 'invert': return { filter: 'invert(1)' };
      case 'rotate': return { transform: 'rotate(180deg)' };
      case 'shake': return { animation: 'shake 0.5s infinite' };
      case 'party': return { animation: 'party-flash 0.5s infinite' };
      default: return {};
    }
  };

  const [authError, setAuthError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    try {
      setAuthError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed', error);
      setAuthError('Google login failed');
    }
  };

  const toggleLanguage = async () => {
    if (!user || !userData) return;
    const newLang = userData.language === 'nl' ? 'en' : 'nl';
    try {
      await setDoc(doc(db, 'users', user.uid), { language: newLang }, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActiveTab('steps');
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-blue-600 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  // No more login screen - we use anonymous auth by default


  return (
    <div 
      className="min-h-screen bg-gray-50 flex flex-col pb-20 transition-all duration-500"
      style={getTrollStyles()}
    >
      <style>{`
        @keyframes shake {
          0% { transform: translate(1px, 1px) rotate(0deg); }
          10% { transform: translate(-1px, -2px) rotate(-1deg); }
          20% { transform: translate(-3px, 0px) rotate(1deg); }
          30% { transform: translate(3px, 2px) rotate(0deg); }
          40% { transform: translate(1px, -1px) rotate(1deg); }
          50% { transform: translate(-1px, 2px) rotate(-1deg); }
          60% { transform: translate(-3px, 1px) rotate(0deg); }
          70% { transform: translate(3px, 1px) rotate(-1deg); }
          80% { transform: translate(-1px, -1px) rotate(1deg); }
          90% { transform: translate(1px, 2px) rotate(0deg); }
          100% { transform: translate(1px, -2px) rotate(-1deg); }
        }
        @keyframes party-flash {
          0% { background-color: rgba(255, 0, 0, 0.1); }
          25% { background-color: rgba(0, 255, 0, 0.1); }
          50% { background-color: rgba(0, 0, 255, 0.1); }
          75% { background-color: rgba(255, 255, 0, 0.1); }
          100% { background-color: rgba(255, 0, 255, 0.1); }
        }
      `}</style>
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-md sticky top-0 z-50">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-yellow-400 p-2 rounded-lg">
              <Footprints size={24} className="text-blue-600" />
            </div>
            <span className="font-bold text-xl">{t.appName}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-blue-700 px-3 py-1 rounded-full text-sm font-bold">
              <Coins size={16} className="text-yellow-400" />
              <span>{userData?.credits || 0}</span>
            </div>
            {user && !user.isAnonymous && (
              <button onClick={handleLogout} className="p-2 hover:bg-blue-500 rounded-full transition-colors">
                <LogOut size={20} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-md mx-auto w-full p-4">
        <AnimatePresence mode="wait">
          {activeTab === 'steps' && (
            <motion.div
              key="steps"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Party Banner */}
              <AnimatePresence>
                {trollEffect?.type === 'party' && (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="mb-6"
                  >
                    <div className="bg-yellow-400 text-blue-900 p-6 rounded-3xl shadow-xl border-4 border-white flex flex-col items-center gap-2 text-center">
                      <div className="flex items-center gap-4">
                        <span className="text-3xl">🎉</span>
                        <h2 className="text-2xl font-black uppercase italic tracking-tighter">Happy Livegang!</h2>
                        <span className="text-3xl">🎉</span>
                      </div>
                      <p className="text-xs font-bold opacity-70 uppercase tracking-widest">Het feest is begonnen!</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <StepTracker userData={userData} t={t} />
              <FruitMachine userData={userData} supermarkets={supermarkets} t={t} />
            </motion.div>
          )}

          {activeTab === 'scan' && (
            <motion.div
              key="scan"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <QRScanner userData={userData} t={t} />
            </motion.div>
          )}

          {activeTab === 'coupons' && (
            <motion.div
              key="coupons"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <CouponTab userId={user.uid} t={t} />
            </motion.div>
          )}

          {activeTab === 'map' && (
            <motion.div
              key="map"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-[calc(100vh-12rem)]"
            >
              <MapView supermarkets={supermarkets} t={t} />
            </motion.div>
          )}

          {activeTab === 'admin' && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <AdminPanel userData={userData} t={t} onAdminLogin={handleGoogleLogin} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 z-50">
        <div className="max-w-md mx-auto flex justify-around items-center">
          <NavButton 
            active={activeTab === 'steps'} 
            onClick={() => setActiveTab('steps')}
            icon={<Footprints size={24} />}
            label={t.steps}
          />
          <NavButton 
            active={activeTab === 'scan'} 
            onClick={() => setActiveTab('scan')}
            icon={<QrCode size={24} />}
            label={t.scan}
          />
          <NavButton 
            active={activeTab === 'coupons'} 
            onClick={() => setActiveTab('coupons')}
            icon={<Ticket size={24} />}
            label={t.coupons}
          />
          <NavButton 
            active={activeTab === 'map'} 
            onClick={() => setActiveTab('map')}
            icon={<MapIcon size={24} />}
            label={t.map}
          />
          <NavButton 
            active={activeTab === 'admin'} 
            onClick={() => setActiveTab('admin')}
            icon={<Settings size={24} />}
            label={t.admin}
          />
        </div>
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
        active ? "text-blue-600 bg-blue-50" : "text-gray-400 hover:text-gray-600"
      )}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      {active && (
        <motion.div 
          layoutId="nav-indicator"
          className="w-1 h-1 bg-blue-600 rounded-full"
        />
      )}
    </button>
  );
}
