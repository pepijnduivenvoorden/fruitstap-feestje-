import { useState, useEffect, useRef } from 'react';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { doc, updateDoc, collection, addDoc, getDocs, query, limit, getDoc, onSnapshot } from 'firebase/firestore';
import { Coins, Play, X, CheckCircle, Gift, Info, Store, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { UserData, Supermarket, AppConfig } from '../App';
import { playSound, SOUNDS } from '../utils/sound';

export default function FruitMachine({ userData, supermarkets, t }: { userData: UserData | null, supermarkets: Supermarket[], t: any }) {
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState(['🍎', '🍎', '🍎']);
  const [showAd, setShowAd] = useState(false);
  const [adCount, setAdCount] = useState(0);
  const [result, setResult] = useState<{ won: boolean, fruit?: string } | null>(null);
  const [config, setConfig] = useState<AppConfig>({
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
  const [wonSupermarket, setWonSupermarket] = useState<Supermarket | null>(null);
  const [adsMuted, setAdsMuted] = useState(false);

  const prizes = config.prizes && config.prizes.length > 0 ? config.prizes : [
    { key: 'apple', emoji: '🍎', name: 'Appel', weight: 40 },
    { key: 'banana', emoji: '🍌', name: 'Banaan', weight: 30 },
    { key: 'pear', emoji: '🍐', name: 'Peer', weight: 20 },
    { key: 'grapes', emoji: '🍇', name: 'Druiven', weight: 7 },
    { key: 'kiwi', emoji: '🥝', name: 'Kiwi', weight: 3 }
  ];
  const FRUITS_LIST = prizes.map(p => p.emoji);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'app'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setConfig({
          ...config,
          ...data,
          ads: Array.isArray(data.ads) ? data.ads : []
        });
      }
    }, (e) => handleFirestoreError(e, OperationType.GET, 'config/app'));
    return () => unsub();
  }, []);

  const [activeAds, setActiveAds] = useState<{ text: string, url: string }[]>([]);

  const startSpin = () => {
    if (!userData || userData.credits <= 0) {
      alert(t.noCredits);
      return;
    }
    
    playSound(SOUNDS.click);
    
    // Pick 2 random ads from the config
    const allAds = config.ads && config.ads.length > 0 ? config.ads : [
      { text: 'FruitStap: Wandel je weg naar gezondheid!', url: '' },
      { text: 'Eet elke dag vers fruit voor meer energie.', url: '' }
    ];
    
    const shuffled = [...allAds].sort(() => 0.5 - Math.random());
    setActiveAds(shuffled.slice(0, 2));
    
    setShowAd(true);
    setAdCount(1);
  };

  const nextAd = () => {
    playSound(SOUNDS.click);
    if (adCount < 2) {
      setAdCount(adCount + 1);
    } else {
      setShowAd(false);
      setAdCount(0);
      spin();
    }
  };

  const spin = async () => {
    if (!userData) return;
    setSpinning(true);
    setResult(null);
    setWonSupermarket(null);
    playSound(SOUNDS.spin);

    // Deduct credit
    const userRef = doc(db, 'users', userData.uid);
    try {
      await updateDoc(userRef, { credits: userData.credits - 1 });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${userData.uid}`);
    }

    // Spin animation
    let count = 0;
    const interval = setInterval(() => {
      setReels([
        FRUITS_LIST[Math.floor(Math.random() * FRUITS_LIST.length)],
        FRUITS_LIST[Math.floor(Math.random() * FRUITS_LIST.length)],
        FRUITS_LIST[Math.floor(Math.random() * FRUITS_LIST.length)],
      ]);
      count++;
      if (count > 20) {
        clearInterval(interval);
        finishSpin();
      }
    }, 100);
  };

  const getRandomPrizeByWeight = () => {
    const totalWeight = prizes.reduce((a, b) => a + b.weight, 0);
    let random = Math.random() * totalWeight;
    for (const prize of prizes) {
      if (random < prize.weight) return prize;
      random -= prize.weight;
    }
    return prizes[0];
  };

  const finishSpin = async () => {
    if (!userData) return;
    
    const win = Math.random() < config.winChance;
    const wonPrize = getRandomPrizeByWeight();
    
    const finalReels = win 
      ? Array(3).fill(wonPrize.emoji)
      : [
          FRUITS_LIST[Math.floor(Math.random() * FRUITS_LIST.length)],
          FRUITS_LIST[Math.floor(Math.random() * FRUITS_LIST.length)],
          FRUITS_LIST[Math.floor(Math.random() * FRUITS_LIST.length)],
        ];
    
    if (!win && finalReels[0] === finalReels[1] && finalReels[1] === finalReels[2]) {
      finalReels[0] = FRUITS_LIST[(FRUITS_LIST.indexOf(finalReels[0]) + 1) % FRUITS_LIST.length];
    }

    setReels(finalReels);
    setSpinning(false);

    if (win) {
      playSound(SOUNDS.win);
      const fruitName = wonPrize.name;
      setResult({ won: true, fruit: fruitName });
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#2563eb', '#facc15', '#ffffff']
      });

      // Create coupon
      const randomSupermarket = supermarkets.length > 0 
        ? supermarkets[Math.floor(Math.random() * supermarkets.length)]
        : { id: 'unknown', name: 'Deelnemende Supermarkt' } as Supermarket;
      
      setWonSupermarket(randomSupermarket);
        
      const uniqueCode = Math.random().toString(36).substring(2, 10).toUpperCase();

      try {
        await addDoc(collection(db, 'coupons'), {
          userId: userData.uid,
          supermarketId: randomSupermarket.id,
          supermarketName: randomSupermarket.name,
          fruitType: fruitName,
          fruitEmoji: wonPrize.emoji,
          expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          redeemed: false,
          createdAt: new Date().toISOString(),
          code: uniqueCode
        });
      } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, 'coupons');
      }
    } else {
      playSound(SOUNDS.lose);
      setResult({ won: false });
    }
  };

  const currentAd = activeAds[adCount - 1] || { text: t.tagline, url: '' };

  const renderAdContent = () => {
    if (!currentAd.url) {
      return <Play size={48} className="text-blue-600 opacity-20" />;
    }

    const url = currentAd.url.toLowerCase();
    const isVideo = url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.ogg') || url.endsWith('.mov') || url.includes('video');
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');

    if (isYouTube) {
      let videoId = '';
      if (url.includes('v=')) {
        videoId = currentAd.url.split('v=')[1].split('&')[0];
      } else if (url.includes('youtu.be/')) {
        videoId = currentAd.url.split('youtu.be/')[1].split('?')[0];
      } else if (url.includes('embed/')) {
        videoId = currentAd.url.split('embed/')[1].split('?')[0];
      }

      return (
        <iframe 
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${adsMuted ? 1 : 0}&loop=1&playlist=${videoId}&controls=0`}
          className="w-full h-full border-0"
          allow="autoplay; encrypted-media"
          allowFullScreen
        />
      );
    }

    if (isVideo && currentAd.url) {
      return (
        <video 
          src={currentAd.url} 
          autoPlay 
          muted={adsMuted} 
          loop 
          playsInline
          className="w-full h-full object-cover" 
          onError={(e) => {
            console.error('Video load error:', e);
            // Fallback to image if video fails
            const target = e.target as HTMLVideoElement;
            target.style.display = 'none';
          }}
        />
      );
    }

    return (
      <img 
        src={currentAd.url} 
        alt="Ad" 
        className="w-full h-full object-cover" 
        referrerPolicy="no-referrer" 
      />
    );
  };

  return (
    <div className="bg-blue-600 rounded-3xl p-6 shadow-xl border-4 border-yellow-400 space-y-6 relative overflow-hidden">
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-400 opacity-10 rounded-full blur-2xl"></div>
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl"></div>

      <div className="text-center space-y-1">
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">{t.winFruit}</h2>
        <div className="flex items-center justify-center gap-2 text-yellow-400 font-bold text-sm">
          <Coins size={16} />
          <span>{userData?.credits || 0} {t.credits}</span>
        </div>
      </div>

      <div className="bg-blue-800 p-4 rounded-2xl flex justify-around items-center gap-2 border-b-4 border-blue-900 shadow-inner">
        {reels.map((fruit, i) => (
          <motion.div 
            key={i}
            animate={spinning ? { y: [0, -20, 0] } : {}}
            transition={{ repeat: Infinity, duration: 0.1 }}
            className="w-20 h-24 bg-white rounded-xl flex items-center justify-center text-4xl shadow-md border-b-4 border-gray-200"
          >
            {fruit}
          </motion.div>
        ))}
      </div>

      <button 
        onClick={startSpin}
        disabled={spinning || (userData?.credits || 0) <= 0}
        className="w-full bg-yellow-400 text-blue-900 py-5 rounded-2xl font-black text-xl shadow-lg hover:bg-yellow-300 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3"
      >
        <Play size={24} fill="currentColor" />
        {t.spin}
      </button>

      {/* Ad Modal */}
      <AnimatePresence>
        {showAd && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-6"
          >
            <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
              <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
                <span className="font-bold text-sm">{t.watchAds} {adCount}/2</span>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setAdsMuted(!adsMuted)}
                    className="p-1 hover:bg-blue-500 rounded-lg transition-colors"
                  >
                    {adsMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                  <div className="bg-blue-500 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest">ADS</div>
                </div>
              </div>
              <div className="p-8 space-y-6 text-center">
                <div className="aspect-video bg-gray-100 rounded-2xl flex items-center justify-center overflow-hidden">
                  {renderAdContent()}
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-gray-900">{t.appName}</h3>
                  <p className="text-gray-500 text-sm">{currentAd.text}</p>
                </div>
                <button 
                  onClick={nextAd}
                  className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition-all"
                >
                  {adCount === 1 ? t.nextAd : t.spin}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result Modal */}
      <AnimatePresence>
        {result && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 bg-blue-900/80 z-[100] flex items-center justify-center p-6 backdrop-blur-sm"
          >
            <div className="bg-white rounded-3xl w-full max-w-sm p-8 text-center space-y-6 shadow-2xl relative">
              <button 
                onClick={() => setResult(null)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>

              {result.won ? (
                <>
                  <div className="bg-yellow-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto text-5xl shadow-inner">
                    🎁
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black text-blue-600 uppercase italic">{t.congrats}</h3>
                    <p className="text-gray-600">
                      {t.youWon} <span className="font-bold text-blue-600">{result.fruit}</span>!
                    </p>
                    {wonSupermarket && (
                      <div className="flex items-center justify-center gap-1 text-blue-600 font-bold text-sm">
                        <Store size={16} />
                        <span>{t.redeemAt}: {wonSupermarket.name}</span>
                      </div>
                    )}
                  </div>
                  <div className="bg-blue-50 p-4 rounded-2xl flex items-center gap-3 text-left">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                      <Gift size={20} />
                    </div>
                    <p className="text-xs text-blue-800 leading-relaxed">
                      {t.scanInstructions}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-gray-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto text-5xl shadow-inner grayscale">
                    😢
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black text-gray-400 uppercase italic">GEEN PRIJS</h3>
                    <p className="text-gray-600">{t.tryAgain}</p>
                  </div>
                </>
              )}

              <button 
                onClick={() => setResult(null)}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition-all"
              >
                {t.saveCoupon}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
