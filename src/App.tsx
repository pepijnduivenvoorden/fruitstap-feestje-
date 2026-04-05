/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  partyMode?: boolean;
}

type Tab = 'steps' | 'scan' | 'coupons' | 'map' | 'admin';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('steps');
  const [loading, setLoading] = useState(true);
  const [supermarkets, setSupermarkets] = useState<Supermarket[]>([]);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'email'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [trollEffect, setTrollEffect] = useState<{ type: string, timestamp: number } | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);

  const t = translations.nl;

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setUserData(null);
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
          displayName: user.isAnonymous ? 'Gast' : (user.displayName || 'Gebruiker'),
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
        if (data.active && data.timestamp > (Date.now() - 5000)) {
          setTrollEffect({ type: data.type, timestamp: data.timestamp });
          
          if (data.type === 'fart') {
            playSound(SOUNDS.fart);
          }
        }
      }
    });
    return () => unsub();
  }, []);

  // Global Config Listener
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'app'), (snap) => {
      if (snap.exists()) {
        setAppConfig(snap.data() as AppConfig);
      }
    });
    return () => unsub();
  }, []);

  // Clear troll effect after some time
  useEffect(() => {
    if (trollEffect) {
      const timer = setTimeout(() => {
        if (trollEffect.type !== 'invert' && trollEffect.type !== 'rotate') {
          setTrollEffect(null);
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [trollEffect]);

  const getTrollStyles = () => {
    if (!trollEffect) return {};
    switch (trollEffect.type) {
      case 'invert': return { filter: 'invert(1)' };
      case 'rotate': return { transform: 'rotate(180deg)' };
      case 'shake': return { animation: 'shake 0.5s infinite' };
      default: return {};
    }
  };

  const [authError, setAuthError] = useState<string | null>(null);

  const handleAnonymousLogin = async () => {
    try {
      setAuthError(null);
      await signInAnonymously(auth);
    } catch (error) {
      console.error('Anonymous login failed', error);
      setAuthError('Inloggen als gast mislukt. Probeer het later opnieuw.');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setAuthError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Google login failed', error);
      setAuthError('Google login mislukt. Probeer het later opnieuw.');
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAuthError(null);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setAuthError('Admin login mislukt. Controleer je gegevens.');
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

  if (!user) {
    return (
      <div className="min-h-screen bg-blue-600 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-xl rounded-[40px] p-8 w-full max-w-sm border border-white/20 shadow-2xl text-center space-y-8"
        >
          <div className="space-y-4">
            <div className="bg-yellow-400 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto shadow-xl rotate-3">
              <Footprints size={48} className="text-blue-600" />
            </div>
            <div className="space-y-1">
              <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter">FruitStap</h1>
              <p className="text-blue-100 font-bold text-sm uppercase tracking-widest opacity-80">Wandel & Win Vers Fruit!</p>
            </div>
          </div>

          <div className="space-y-4">
            <button 
              onClick={handleAnonymousLogin}
              className="w-full bg-yellow-400 text-blue-900 py-5 rounded-2xl font-black text-lg uppercase italic shadow-xl hover:bg-yellow-300 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              <LogIn size={24} />
              Start Nu
            </button>
            <button 
              onClick={handleGoogleLogin}
              className="w-full bg-white text-blue-900 py-4 rounded-2xl font-bold shadow-lg hover:bg-gray-50 transition-all flex items-center justify-center gap-3"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              Google Login
            </button>
            <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest opacity-60">
              Geen account nodig • Geen gegevens delen
            </p>
          </div>

          {authError && (
            <div className="bg-red-500/20 border border-red-500/50 text-white p-3 rounded-xl text-xs font-bold">
              {authError}
            </div>
          )}

          <div className="pt-8 border-t border-white/10">
            <button 
              onClick={() => setAuthMode(authMode === 'login' ? 'email' : 'login')}
              className="text-blue-200 text-[10px] font-bold uppercase tracking-widest hover:text-white transition-colors"
            >
              {authMode === 'login' ? 'Beheerder Login' : 'Terug naar Start'}
            </button>
            
            {authMode === 'email' && (
              <form onSubmit={handleAdminLogin} className="mt-4 space-y-3">
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Admin Email"
                  className="w-full bg-white/10 border border-white/20 px-4 py-3 rounded-xl text-white placeholder:text-white/40 text-sm focus:outline-none"
                  required
                />
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Wachtwoord"
                  className="w-full bg-white/10 border border-white/20 px-4 py-3 rounded-xl text-white placeholder:text-white/40 text-sm focus:outline-none"
                  required
                />
                <button 
                  type="submit"
                  className="w-full bg-white text-blue-600 py-3 rounded-xl font-bold text-sm"
                >
                  Inloggen als Beheerder
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-gray-50 flex flex-col pb-20 transition-all duration-500 relative overflow-hidden"
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
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
      `}</style>

      {/* Party Mode Overlay */}
      <AnimatePresence>
        {appConfig?.partyMode && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-[100]"
          >
            <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-yellow-400 text-blue-900 px-8 py-4 rounded-full font-black text-2xl uppercase italic shadow-2xl border-4 border-white rotate-2 animate-bounce">
              Happy Livegang! 🎈
            </div>
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ y: '110vh', x: `${Math.random() * 100}vw` }}
                animate={{ 
                  y: '-20vh',
                  x: `${(Math.random() * 100)}vw`,
                }}
                transition={{ 
                  duration: 10 + Math.random() * 10, 
                  repeat: Infinity, 
                  delay: Math.random() * 10,
                  ease: "linear"
                }}
                className="absolute text-4xl"
                style={{ filter: `hue-rotate(${Math.random() * 360}deg)` }}
              >
                🎈
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

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
            <button onClick={handleLogout} className="p-2 hover:bg-blue-500 rounded-full transition-colors">
              <LogOut size={20} />
            </button>
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
              <AdminPanel userData={userData} t={t} />
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
