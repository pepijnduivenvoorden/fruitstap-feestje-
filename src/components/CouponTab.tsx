import { useState, useEffect } from 'react';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Ticket, Calendar, Store, CheckCircle, Trash2, Gift } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Coupon } from '../App';

export default function CouponTab({ userId, t }: { userId: string, t: any }) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'coupons'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Coupon));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCoupons(list);
      setLoading(false);
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'coupons'));

    return () => unsubscribe();
  }, [userId]);

  const redeemCoupon = async (id: string) => {
    const couponRef = doc(db, 'coupons', id);
    try {
      await updateDoc(couponRef, { redeemed: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `coupons/${id}`);
    }
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm(t.resetUser + "?")) return;
    const couponRef = doc(db, 'coupons', id);
    try {
      await deleteDoc(couponRef);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `coupons/${id}`);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-400">{t.loading}</div>;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-blue-600 uppercase italic">{t.coupons}</h2>
        <p className="text-gray-500 text-sm">{t.redeemInstructions}</p>
      </div>

      {coupons.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-gray-200 space-y-4">
          <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-gray-300">
            <Ticket size={40} />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-gray-400 uppercase tracking-wider">{t.noCoupons}</h3>
            <p className="text-gray-400 text-sm">{t.walkMoreCoupons}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {coupons.map((coupon) => (
              <motion.div 
                key={coupon.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={`bg-white rounded-3xl p-5 shadow-sm border border-gray-100 relative overflow-hidden ${coupon.redeemed ? 'opacity-60 grayscale' : ''}`}
              >
                <div className="absolute top-1/2 -left-3 w-6 h-6 bg-gray-50 rounded-full -translate-y-1/2 border-r border-gray-100"></div>
                <div className="absolute top-1/2 -right-3 w-6 h-6 bg-gray-50 rounded-full -translate-y-1/2 border-l border-gray-100"></div>

                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-50 p-4 rounded-2xl text-blue-600 text-3xl">
                      {coupon.fruitEmoji || '🎁'}
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-blue-600 uppercase italic">Gratis {coupon.fruitType}</h3>
                      <div className="flex items-center gap-1 text-gray-400 text-xs font-bold uppercase tracking-wider">
                        <Store size={12} />
                        <span>{coupon.supermarketName}</span>
                      </div>
                    </div>
                  </div>
                  {!coupon.redeemed && (
                    <button 
                      onClick={() => deleteCoupon(coupon.id)}
                      className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>

                <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-center">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">{t.uniqueCode}</p>
                  <p className="text-lg font-mono font-black text-blue-600 tracking-widest">{coupon.code || 'FRUIT-STAP-2026'}</p>
                </div>

                <div className="mt-4 pt-4 border-t border-dashed border-gray-100 flex justify-between items-center">
                  <div className="flex items-center gap-1 text-gray-400 text-[10px] font-bold uppercase tracking-widest">
                    <Calendar size={12} />
                    <span>{t.expiry}: {new Date(coupon.expiryDate).toLocaleDateString()}</span>
                  </div>
                  
                  {coupon.redeemed ? (
                    <div className="flex items-center gap-1 text-green-600 font-black text-sm uppercase italic">
                      <CheckCircle size={16} />
                      <span>{t.redeemed}</span>
                    </div>
                  ) : (
                    <button 
                      onClick={() => redeemCoupon(coupon.id)}
                      className="bg-yellow-400 text-blue-900 px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest shadow-md hover:bg-yellow-300 transition-all active:scale-95"
                    >
                      {t.redeemed}
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
