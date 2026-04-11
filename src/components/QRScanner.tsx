import { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { QrCode, CheckCircle, Camera, AlertCircle, RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserData } from '../App';

export default function QRScanner({ userData, t }: { userData: UserData | null, t: any }) {
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(userData?.shoeScanned || false);
  const [error, setError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    setScanned(userData?.shoeScanned || false);
  }, [userData?.shoeScanned]);

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.error("Failed to stop scanner", err);
      }
    }
  };

  const startScanner = async () => {
    setError(null);
    setScanning(true);
    
    // Small delay to ensure the element is in the DOM
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        html5QrCodeRef.current = html5QrCode;

        const config = { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        };

        await html5QrCode.start(
          { facingMode: "environment" }, 
          config,
          (decodedText) => {
            // Accept any QR code to make it "just work" as requested
            if (decodedText) {
              handleScanSuccess();
              stopScanner();
            }
          },
          (errorMessage) => {
            // Ignore frequent failures
          }
        );
      } catch (err: any) {
        console.error("Scanner initialization failed", err);
        setError(t.cameraError + ": " + (err.message || "Unknown error"));
        setScanning(false);
      }
    }, 300);
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const handleScanSuccess = async () => {
    if (!userData) return;
    const userRef = doc(db, 'users', userData.uid);
    try {
      await updateDoc(userRef, { shoeScanned: true });
      setScanned(true);
      setScanning(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${userData.uid}`);
    }
  };

  const simulateScan = () => {
    handleScanSuccess();
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-blue-600 uppercase italic">{t.shoePairing}</h2>
        <p className="text-gray-500 text-sm">{t.scanShoeInstructions}</p>
      </div>

      <AnimatePresence mode="wait">
        {scanned ? (
          <motion.div 
            key="scanned"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-green-50 border border-green-200 p-8 rounded-3xl flex flex-col items-center gap-4 text-center"
          >
            <div className="bg-green-100 p-4 rounded-full text-green-600">
              <CheckCircle size={48} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-green-800 uppercase italic">{t.linked}</h3>
              <p className="text-green-700 text-sm font-medium">{t.linkedSuccess}</p>
            </div>
            <button 
              onClick={() => setScanned(false)}
              className="text-xs text-green-600 font-bold uppercase tracking-widest mt-2 hover:underline"
            >
              {t.relink}
            </button>
          </motion.div>
        ) : scanning ? (
          <motion.div 
            key="scanning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="relative overflow-hidden rounded-2xl border-4 border-blue-600 shadow-xl bg-black aspect-square">
              <div id="reader" className="w-full h-full"></div>
              
              {/* Overlay for scanning effect */}
              <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] border-2 border-blue-400 rounded-lg shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-blue-400 animate-[scan_2s_linear_infinite]"></div>
              </div>

              {error && (
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="absolute bottom-4 left-4 right-4 bg-red-600 text-white p-3 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg z-50"
                >
                  <AlertCircle size={16} />
                  {error}
                </motion.div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => {
                  stopScanner();
                  setScanning(false);
                }}
                className="bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
              >
                <X size={18} />
                {t.cancel}
              </button>
              <button 
                onClick={simulateScan}
                className="bg-blue-50 text-blue-600 py-4 rounded-2xl font-bold hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw size={18} />
                {t.testScan}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-6 py-8"
          >
            <div className="relative">
              <div className="absolute -inset-4 bg-blue-100 rounded-full animate-pulse"></div>
              <div className="relative bg-blue-600 p-8 rounded-full text-white shadow-xl">
                <QrCode size={64} />
              </div>
            </div>
            <div className="w-full space-y-3">
              <button 
                onClick={startScanner}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
              >
                <Camera size={20} />
                {t.startScanner}
              </button>
              <button 
                onClick={simulateScan}
                className="w-full bg-blue-50 text-blue-600 py-3 rounded-2xl font-bold hover:bg-blue-100 transition-all text-sm"
              >
                {t.quickLink}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100">
        <h4 className="text-blue-800 font-black text-sm mb-2 uppercase italic tracking-tight">{t.instructions}</h4>
        <ul className="text-blue-700 text-xs space-y-2 font-medium">
          <li className="flex gap-2">
            <span className="bg-blue-200 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]">1</span>
            {t.instruction1}
          </li>
          <li className="flex gap-2">
            <span className="bg-blue-200 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]">2</span>
            {t.instruction2}
          </li>
          <li className="flex gap-2">
            <span className="bg-blue-200 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]">3</span>
            {t.instruction3}
          </li>
        </ul>
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  );
}
