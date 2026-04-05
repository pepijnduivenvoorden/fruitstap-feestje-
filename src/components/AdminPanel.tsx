import React, { useState, useEffect } from 'react';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, addDoc, getDocs, getDoc, writeBatch } from 'firebase/firestore';
import { Settings, Users, Store, Plus, Trash2, Lock, Unlock, Eye, EyeOff, Database, CheckCircle, X, AlertTriangle, RefreshCcw, Sliders, Ticket } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserData, Supermarket, AppConfig } from '../App';
import { playSound, SOUNDS } from '../utils/sound';

export default function AdminPanel({ userData: currentUser, t }: { userData: UserData | null, t: any }) {
  const [password, setPassword] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [users, setUsers] = useState<UserData[]>([]);
  const [supermarkets, setSupermarkets] = useState<Supermarket[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'stores' | 'config' | 'coupons'>('users');
  const [newStore, setNewStore] = useState({ name: '', address: '', lat: 0, lng: 0 });
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [resetUserConfirm, setResetUserConfirm] = useState<string | null>(null);
  const [resetAppConfirm, setResetAppConfirm] = useState(false);
  const [newAd, setNewAd] = useState({ text: '', url: '' });
  const [newPrize, setNewPrize] = useState({ key: '', emoji: '', name: '', weight: 10 });
  const [appConfig, setAppConfig] = useState<AppConfig>({
    winChance: 0.3,
    ads: [
      { text: 'FruitStap: Wandel je weg naar gezondheid!', url: '' },
      { text: 'Eet elke dag vers fruit voor meer energie.', url: '' }
    ],
    prizes: [
      { key: 'apple', emoji: '🍎', name: 'Appel', weight: 40 },
      { key: 'banana', emoji: '🍌', name: 'Banaan', weight: 30 },
      { key: 'pear', emoji: '🍐', name: 'Peer', weight: 20 },
      { key: 'grapes', emoji: '🍇', name: 'Druiven', weight: 7 },
      { key: 'kiwi', emoji: '🥝', name: 'Kiwi', weight: 3 }
    ]
  });

  const isAdmin = currentUser?.role === 'admin' || currentUser?.email === 'pepijnduivenvoorden@gmail.com';

  useEffect(() => {
    if (isAuthorized) {
      let unsubUsers = () => {};
      if (isAdmin) {
        const qUsers = query(collection(db, 'users'));
        unsubUsers = onSnapshot(qUsers, (snap) => {
          setUsers(snap.docs.map(doc => doc.data() as UserData));
        }, (e) => handleFirestoreError(e, OperationType.LIST, 'users'));
      }

      const qStores = query(collection(db, 'supermarkets'));
      const unsubStores = onSnapshot(qStores, (snap) => {
        setSupermarkets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supermarket)));
      }, (e) => handleFirestoreError(e, OperationType.LIST, 'supermarkets'));

      const unsubConfig = onSnapshot(doc(db, 'config', 'app'), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setAppConfig({
            ...appConfig,
            ...data,
            ads: Array.isArray(data.ads) ? data.ads : []
          });
        }
      }, (e) => handleFirestoreError(e, OperationType.GET, 'config/app'));

      const qCoupons = query(collection(db, 'coupons'));
      const unsubCoupons = onSnapshot(qCoupons, (snap) => {
        setCoupons(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (e) => handleFirestoreError(e, OperationType.LIST, 'coupons'));

      return () => {
        unsubUsers();
        unsubStores();
        unsubConfig();
        unsubCoupons();
      };
    }
  }, [isAuthorized, isAdmin]);

  const [statusMessage, setStatusMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin123' || currentUser?.role === 'admin') {
      playSound(SOUNDS.click);
      setIsAuthorized(true);
    } else {
      setStatusMessage({ text: "Onjuist wachtwoord!", type: 'error' });
    }
  };

  const saveConfig = async () => {
    playSound(SOUNDS.click);
    setLoading(true);
    try {
      await setDoc(doc(db, 'config', 'app'), appConfig);
      setStatusMessage({ text: "Configuratie opgeslagen!", type: 'success' });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'config/app');
      setStatusMessage({ text: "Opslaan mislukt!", type: 'error' });
    }
    setLoading(false);
  };

  const triggerTroll = async (type: string) => {
    playSound(SOUNDS.click);
    try {
      await setDoc(doc(db, 'config', 'trolls'), {
        type,
        active: true,
        timestamp: Date.now()
      });
      setStatusMessage({ text: `Troll '${type}' geactiveerd!`, type: 'success' });
      
      // Reset after a short delay so it can be triggered again
      setTimeout(async () => {
        await setDoc(doc(db, 'config', 'trolls'), { active: false }, { merge: true });
      }, 2000);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'config/trolls');
    }
  };

  const stopTrolls = async () => {
    playSound(SOUNDS.click);
    try {
      await setDoc(doc(db, 'config', 'trolls'), { active: false, type: 'none', timestamp: 0 });
      setStatusMessage({ text: "Alle trolls gestopt!", type: 'success' });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'config/trolls');
    }
  };

  const addAd = () => {
    playSound(SOUNDS.click);
    if (!newAd.text.trim()) {
      setStatusMessage({ text: "Vul tenminste een tekst in!", type: 'error' });
      return;
    }
    const currentAds = Array.isArray(appConfig.ads) ? appConfig.ads : [];
    const updatedConfig = {
      ...appConfig,
      ads: [...currentAds, { ...newAd }]
    };
    setAppConfig(updatedConfig);
    setNewAd({ text: '', url: '' });
    setStatusMessage({ text: "Advertentie toegevoegd aan lijst (vergeet niet op te slaan!)", type: 'success' });
  };

  const addPrize = () => {
    playSound(SOUNDS.click);
    if (!newPrize.key || !newPrize.emoji || !newPrize.name) {
      setStatusMessage({ text: "Vul alle velden in voor de prijs!", type: 'error' });
      return;
    }
    const currentPrizes = Array.isArray(appConfig.prizes) ? appConfig.prizes : [];
    const updatedConfig = {
      ...appConfig,
      prizes: [...currentPrizes, { ...newPrize }]
    };
    setAppConfig(updatedConfig);
    setNewPrize({ key: '', emoji: '', name: '', weight: 10 });
    setStatusMessage({ text: "Prijs toegevoegd aan lijst (vergeet niet op te slaan!)", type: 'success' });
  };

  const removePrize = (index: number) => {
    const newPrizes = appConfig.prizes.filter((_, i) => i !== index);
    setAppConfig({ ...appConfig, prizes: newPrizes });
  };

  const removeAd = (index: number) => {
    const newAds = appConfig.ads.filter((_, i) => i !== index);
    setAppConfig({ ...appConfig, ads: newAds });
  };

  const resetUser = async (userId: string) => {
    try {
      await setDoc(doc(db, 'users', userId), {
        steps: 0,
        credits: 0,
        shoeScanned: false,
        goal: 1000
      }, { merge: true });
      setStatusMessage({ text: "Gebruiker gereset!", type: 'success' });
      setResetUserConfirm(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${userId}`);
      setStatusMessage({ text: "Reset mislukt!", type: 'error' });
    }
  };

  const resetAllData = async () => {
    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      const usersSnap = await getDocs(collection(db, 'users'));
      usersSnap.forEach(uDoc => {
        batch.update(uDoc.ref, { steps: 0, credits: 0, shoeScanned: false, goal: 1000 });
      });

      const couponsSnap = await getDocs(collection(db, 'coupons'));
      couponsSnap.forEach(cDoc => {
        batch.delete(cDoc.ref);
      });

      await batch.commit();
      setStatusMessage({ text: "Alle data is gereset!", type: 'success' });
      setResetAppConfirm(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'batch-reset');
      setStatusMessage({ text: "Reset mislukt!", type: 'error' });
    }
    setLoading(false);
  };

  const toggleRedeemed = async (couponId: string, currentStatus: boolean) => {
    playSound(SOUNDS.click);
    try {
      await setDoc(doc(db, 'coupons', couponId), { redeemed: !currentStatus }, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `coupons/${couponId}`);
    }
  };

  const deleteCoupon = async (couponId: string) => {
    playSound(SOUNDS.click);
    try {
      await deleteDoc(doc(db, 'coupons', couponId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `coupons/${couponId}`);
    }
  };

  const addSupermarket = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const id = Date.now().toString();
      await setDoc(doc(db, 'supermarkets', id), { ...newStore, id });
      setNewStore({ name: '', address: '', lat: 0, lng: 0 });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'supermarkets');
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteDoc(doc(db, 'supermarkets', deleteConfirm));
      setDeleteConfirm(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `supermarkets/${deleteConfirm}`);
    }
  };

  const seedData = async () => {
    setLoading(true);
    const initialStores = [
      { name: 'Albert Heijn Schiedam', address: 'Damrak 90, Schiedam', lat: 51.9173, lng: 4.3995 },
      { name: 'Jumbo Schiedam', address: 'Westerstraat 98, Schiedam', lat: 51.9200, lng: 4.4050 },
      { name: 'Lidl Schiedam', address: 'Nieuwezijds Voorburgwal 226, Schiedam', lat: 51.9150, lng: 4.3950 },
      { name: 'Aldi Schiedam', address: 'Rozengracht 1, Schiedam', lat: 51.9180, lng: 4.4020 },
    ];

    try {
      for (const store of initialStores) {
        const id = Math.random().toString(36).substr(2, 9);
        await setDoc(doc(db, 'supermarkets', id), { ...store, id });
      }
      alert("Seed data succesvol toegevoegd!");
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'supermarkets');
    }
    setLoading(false);
  };

  if (!isAuthorized) {
    return (
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 space-y-8">
        <div className="text-center space-y-2">
          <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-blue-600">
            <Lock size={40} />
          </div>
          <h2 className="text-2xl font-black text-blue-600 uppercase italic">{t.admin}</h2>
          <p className="text-gray-500 text-sm">Voer het beheerderswachtwoord in om door te gaan.</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="relative">
            <input 
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.password}
              className="w-full bg-gray-50 border border-gray-200 px-6 py-4 rounded-2xl font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <button 
            type="submit"
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
          >
            <Unlock size={20} />
            Toegang Krijgen
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Message Toast */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl z-[100] font-bold text-white ${
              statusMessage.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            {statusMessage.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-blue-600 uppercase italic">Admin Dashboard</h2>
        <button 
          onClick={() => setIsAuthorized(false)}
          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
        >
          <Lock size={20} />
        </button>
      </div>

      <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex gap-2 overflow-x-auto">
        <button 
          onClick={() => setActiveSubTab('users')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs transition-all whitespace-nowrap",
            activeSubTab === 'users' ? "bg-blue-600 text-white shadow-md" : "text-gray-400 hover:bg-gray-50"
          )}
        >
          <Users size={16} />
          Gebruikers
        </button>
        <button 
          onClick={() => setActiveSubTab('stores')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs transition-all whitespace-nowrap",
            activeSubTab === 'stores' ? "bg-blue-600 text-white shadow-md" : "text-gray-400 hover:bg-gray-50"
          )}
        >
          <Store size={16} />
          Winkels
        </button>
        <button 
          onClick={() => setActiveSubTab('coupons')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs transition-all whitespace-nowrap",
            activeSubTab === 'coupons' ? "bg-blue-600 text-white shadow-md" : "text-gray-400 hover:bg-gray-50"
          )}
        >
          <Ticket size={16} />
          Coupons
        </button>
        <button 
          onClick={() => setActiveSubTab('config')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs transition-all whitespace-nowrap",
            activeSubTab === 'config' ? "bg-blue-600 text-white shadow-md" : "text-gray-400 hover:bg-gray-50"
          )}
        >
          <Settings size={16} />
          Instellingen
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === 'users' && (
          <motion.div key="users" className="space-y-4">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Users size={20} className="text-blue-600" />
                  Online Gebruikers ({users.length})
                </h3>
                <button 
                  onClick={() => setResetAppConfirm(true)}
                  className="text-[10px] font-bold uppercase tracking-widest text-red-600 bg-red-50 px-3 py-1 rounded-full hover:bg-red-100"
                >
                  Reset App
                </button>
              </div>
              <div className="space-y-3">
                {users.map((u) => (
                  <div key={u.uid} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 w-10 h-10 rounded-full flex items-center justify-center text-blue-600 font-bold">
                        {u.displayName[0]}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{u.displayName}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs font-bold text-blue-600">{u.steps} stappen</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">{u.credits} credits</p>
                      </div>
                      <button 
                        onClick={() => setResetUserConfirm(u.uid)}
                        className="p-2 text-gray-300 hover:text-red-500"
                      >
                        <RefreshCcw size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeSubTab === 'stores' && (
          <motion.div key="stores" className="space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Plus size={20} className="text-blue-600" />
                Supermarkt Toevoegen
              </h3>
              <form onSubmit={addSupermarket} className="space-y-3">
                <input 
                  type="text" 
                  placeholder="Naam (bijv. Albert Heijn)" 
                  value={newStore.name}
                  onChange={(e) => setNewStore({...newStore, name: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl text-sm font-medium focus:outline-none"
                  required
                />
                <input 
                  type="text" 
                  placeholder="Adres" 
                  value={newStore.address}
                  onChange={(e) => setNewStore({...newStore, address: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl text-sm font-medium focus:outline-none"
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <input 
                    type="number" step="0.0001" placeholder="Lat" 
                    value={newStore.lat || ''}
                    onChange={(e) => setNewStore({...newStore, lat: parseFloat(e.target.value)})}
                    className="w-full bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl text-sm font-medium focus:outline-none"
                    required
                  />
                  <input 
                    type="number" step="0.0001" placeholder="Lng" 
                    value={newStore.lng || ''}
                    onChange={(e) => setNewStore({...newStore, lng: parseFloat(e.target.value)})}
                    className="w-full bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl text-sm font-medium focus:outline-none"
                    required
                  />
                </div>
                <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-md hover:bg-blue-700 transition-all">
                  Toevoegen
                </button>
              </form>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Store size={20} className="text-blue-600" />
                  Beheer Supermarkten
                </h3>
                <button onClick={seedData} className="text-[10px] font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                  Seed Data
                </button>
              </div>
              <div className="space-y-3">
                {supermarkets.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{s.name}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">{s.address}</p>
                    </div>
                    <button onClick={() => setDeleteConfirm(s.id)} className="p-2 text-gray-300 hover:text-red-500">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeSubTab === 'coupons' && (
          <motion.div key="coupons" className="space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                <Ticket size={20} className="text-blue-600" />
                Alle Gewonnen Coupons
              </h3>
              <div className="space-y-3">
                {coupons.length === 0 ? (
                  <p className="text-center py-8 text-gray-400 font-bold italic">Nog geen coupons gewonnen...</p>
                ) : (
                  coupons.map((c) => (
                    <div key={c.id} className="p-4 bg-gray-50 rounded-2xl space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-3">
                          <div className="text-3xl bg-white p-2 rounded-xl shadow-sm">{c.fruitEmoji || '🎁'}</div>
                          <div>
                            <p className="font-black text-blue-600 text-lg uppercase italic">{c.fruitType}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase">{c.supermarketName}</p>
                            <p className="text-[9px] font-mono text-gray-400">{c.code}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => toggleRedeemed(c.id, c.redeemed)}
                            className={cn(
                              "p-2 rounded-xl transition-all",
                              c.redeemed ? "bg-green-100 text-green-600" : "bg-gray-200 text-gray-400"
                            )}
                            title={c.redeemed ? "Markeer als niet ingeleverd" : "Markeer als ingeleverd"}
                          >
                            <CheckCircle size={18} />
                          </button>
                          <button 
                            onClick={() => deleteCoupon(c.id)}
                            className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-all"
                            title="Verwijder coupon"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full uppercase tracking-widest",
                          c.redeemed ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-600"
                        )}>
                          {c.redeemed ? "Ingeleverd" : "Openstaand"}
                        </span>
                        <span>Vervalt: {new Date(c.expiryDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeSubTab === 'config' && (
          <motion.div key="config" className="space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-6">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Settings size={20} className="text-blue-600" />
                Spel Instellingen
              </h3>

              <div className="space-y-4 p-4 bg-orange-50 border border-orange-100 rounded-3xl">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-orange-400 uppercase tracking-widest">Troll Panel (Live voor iedereen!)</label>
                  <button 
                    onClick={stopTrolls}
                    className="text-[10px] font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full flex items-center gap-1 uppercase tracking-widest"
                  >
                    <X size={12} />
                    Stop Alles
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => triggerTroll('fart')}
                    className="bg-white text-orange-700 p-4 rounded-2xl font-black text-xs uppercase tracking-tighter shadow-sm hover:bg-orange-100 transition-all flex flex-col items-center gap-2 border border-orange-100"
                  >
                    <span className="text-2xl">💨</span>
                    Harde Scheet
                  </button>
                  <button 
                    onClick={() => triggerTroll('shake')}
                    className="bg-white text-purple-700 p-4 rounded-2xl font-black text-xs uppercase tracking-tighter shadow-sm hover:bg-purple-100 transition-all flex flex-col items-center gap-2 border border-purple-100"
                  >
                    <span className="text-2xl">🫨</span>
                    Scherm Schudden
                  </button>
                  <button 
                    onClick={() => triggerTroll('invert')}
                    className="bg-gray-800 text-white p-4 rounded-2xl font-black text-xs uppercase tracking-tighter shadow-sm hover:bg-gray-900 transition-all flex flex-col items-center gap-2"
                  >
                    <span className="text-2xl">🌓</span>
                    Kleuren Inverteren
                  </button>
                  <button 
                    onClick={() => triggerTroll('rotate')}
                    className="bg-white text-pink-700 p-4 rounded-2xl font-black text-xs uppercase tracking-tighter shadow-sm hover:bg-pink-100 transition-all flex flex-col items-center gap-2 border border-pink-100"
                  >
                    <span className="text-2xl">🙃</span>
                    Ondersteboven
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t.winChance} (0.0 - 1.0)</label>
                <input 
                  type="range" min="0" max="1" step="0.05"
                  value={appConfig.winChance}
                  onChange={(e) => setAppConfig({...appConfig, winChance: parseFloat(e.target.value)})}
                  className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-sm font-bold text-blue-600">
                  <span>0%</span>
                  <span>{Math.round(appConfig.winChance * 100)}%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Prizes Management */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h4 className="text-sm font-black text-gray-900 uppercase italic">Beheer Prijzen</h4>
                
                <div className="bg-gray-50 p-4 rounded-2xl space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="text"
                      placeholder="Key (bijv: apple)"
                      value={newPrize.key}
                      onChange={(e) => setNewPrize({...newPrize, key: e.target.value})}
                      className="bg-white border border-gray-100 px-3 py-2 rounded-xl text-xs font-bold focus:outline-none"
                    />
                    <input 
                      type="text"
                      placeholder="Emoji (bijv: 🍎)"
                      value={newPrize.emoji}
                      onChange={(e) => setNewPrize({...newPrize, emoji: e.target.value})}
                      className="bg-white border border-gray-100 px-3 py-2 rounded-xl text-xs font-bold focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="text"
                      placeholder="Naam (bijv: Appel)"
                      value={newPrize.name}
                      onChange={(e) => setNewPrize({...newPrize, name: e.target.value})}
                      className="bg-white border border-gray-100 px-3 py-2 rounded-xl text-xs font-bold focus:outline-none"
                    />
                    <input 
                      type="number"
                      placeholder="Gewicht (bijv: 40)"
                      value={newPrize.weight}
                      onChange={(e) => setNewPrize({...newPrize, weight: parseInt(e.target.value) || 0})}
                      className="bg-white border border-gray-100 px-3 py-2 rounded-xl text-xs font-bold focus:outline-none"
                    />
                  </div>
                  <button 
                    onClick={addPrize}
                    className="w-full bg-blue-600 text-white py-2 rounded-xl font-bold text-xs shadow-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={14} />
                    Prijs Toevoegen
                  </button>
                </div>

                <div className="space-y-2">
                  {appConfig.prizes?.map((prize, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl relative group">
                      <div className="text-2xl">{prize.emoji}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <input 
                            type="text"
                            value={prize.name}
                            onChange={(e) => {
                              const newPrizes = [...appConfig.prizes];
                              newPrizes[index].name = e.target.value;
                              setAppConfig({ ...appConfig, prizes: newPrizes });
                            }}
                            className="bg-transparent border-none p-0 font-bold text-sm text-gray-900 focus:ring-0 w-24"
                          />
                          <span className="text-[10px] text-gray-400 font-bold uppercase">({prize.key})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400 font-bold uppercase">Gewicht:</span>
                          <input 
                            type="number"
                            value={prize.weight}
                            onChange={(e) => {
                              const newPrizes = [...appConfig.prizes];
                              newPrizes[index].weight = parseInt(e.target.value) || 0;
                              setAppConfig({ ...appConfig, prizes: newPrizes });
                            }}
                            className="bg-transparent border-none p-0 font-bold text-[10px] text-blue-600 focus:ring-0 w-12"
                          />
                        </div>
                      </div>
                      <button 
                        onClick={() => removePrize(index)}
                        className="p-1.5 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t.ads}</label>
                  <button 
                    onClick={addAd}
                    className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full flex items-center gap-1 uppercase tracking-widest"
                  >
                    <Plus size={12} />
                    Toevoegen
                  </button>
                </div>

                <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-blue-400 uppercase">Nieuwe Advertentie Tekst</label>
                    <input 
                      type="text"
                      value={newAd.text}
                      onChange={(e) => setNewAd({ ...newAd, text: e.target.value })}
                      className="w-full bg-white border border-blue-100 px-4 py-2 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="Bijv: Gratis appels bij 1000 stappen!"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-blue-400 uppercase">Afbeelding/Video URL</label>
                    <input 
                      type="text"
                      value={newAd.url}
                      onChange={(e) => setNewAd({ ...newAd, url: e.target.value })}
                      className="w-full bg-white border border-blue-100 px-4 py-2 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="https://..."
                    />
                    <p className="text-[9px] text-blue-400/70 px-1 italic">
                      Ondersteunt: Afbeeldingen, YouTube links en directe video links (.mp4, .webm)
                    </p>
                  </div>
                  <button 
                    type="button"
                    onClick={addAd}
                    className="w-full bg-blue-600 text-white py-2 rounded-xl font-bold text-xs shadow-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={14} />
                    Advertentie Toevoegen aan Lijst
                  </button>
                </div>

                {/* Existing Ads List */}
                <div className="space-y-3">
                  {appConfig.ads?.map((ad, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-2xl space-y-3 relative group">
                      <button 
                        onClick={() => removeAd(index)}
                        className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-sm z-10"
                      >
                        <Trash2 size={12} />
                      </button>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">{t.adText}</label>
                        <input 
                          type="text"
                          value={ad.text}
                          onChange={(e) => {
                            const newAds = [...appConfig.ads];
                            newAds[index].text = e.target.value;
                            setAppConfig({ ...appConfig, ads: newAds });
                          }}
                          className="w-full bg-white border border-gray-100 px-4 py-2 rounded-xl text-sm font-bold focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">{t.adUrl}</label>
                        <input 
                          type="text"
                          value={ad.url}
                          onChange={(e) => {
                            const newAds = [...appConfig.ads];
                            newAds[index].url = e.target.value;
                            setAppConfig({ ...appConfig, ads: newAds });
                          }}
                          className="w-full bg-white border border-gray-100 px-4 py-2 rounded-xl text-sm font-bold focus:outline-none"
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                onClick={saveConfig}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition-all"
              >
                Instellingen Opslaan
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm p-8 space-y-6 shadow-2xl text-center"
            >
              <div className="bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-red-600">
                <AlertTriangle size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-gray-900 uppercase italic">Verwijderen?</h3>
                <p className="text-gray-500 text-sm">Weet je zeker dat je deze supermarkt wilt verwijderen?</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                >
                  Annuleren
                </button>
                <button 
                  onClick={handleDelete}
                  className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-red-700 transition-all"
                >
                  Verwijderen
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset User Confirmation Modal */}
      <AnimatePresence>
        {resetUserConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm p-8 space-y-6 shadow-2xl text-center"
            >
              <div className="bg-yellow-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-yellow-600">
                <RefreshCcw size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-gray-900 uppercase italic">Gebruiker Resetten?</h3>
                <p className="text-gray-500 text-sm">Weet je zeker dat je de data van deze gebruiker wilt resetten?</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setResetUserConfirm(null)}
                  className="flex-1 bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                >
                  Annuleren
                </button>
                <button 
                  onClick={() => resetUser(resetUserConfirm)}
                  className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition-all"
                >
                  Resetten
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset App Confirmation Modal */}
      <AnimatePresence>
        {resetAppConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm p-8 space-y-6 shadow-2xl text-center"
            >
              <div className="bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-red-600">
                <Database size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-gray-900 uppercase italic">App Resetten?</h3>
                <p className="text-gray-500 text-sm">Weet je zeker dat je ALLE data wilt resetten? Dit kan niet ongedaan worden gemaakt.</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setResetAppConfirm(false)}
                  className="flex-1 bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                >
                  Annuleren
                </button>
                <button 
                  onClick={resetAllData}
                  className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-red-700 transition-all"
                >
                  Reset Alles
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
