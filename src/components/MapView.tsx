import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Store, Navigation, Info, X, MapPin, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Supermarket } from '../App';
import { translations } from '../translations';

// Fix for default marker icons in Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

// Custom icon for user location
const UserIcon = L.divIcon({
  html: `<div class="bg-blue-600 p-2 rounded-full border-2 border-white shadow-lg text-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

L.Marker.prototype.options.icon = DefaultIcon;

const SCHIEDAM_CENTER: [number, number] = [51.9173, 4.3995];

function RecenterMap({ coords }: { coords: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(coords);
  }, [coords, map]);
  return null;
}

export default function MapView({ supermarkets, t }: { supermarkets: Supermarket[], t: any }) {
  const [selected, setSelected] = useState<Supermarket | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        },
        (err) => console.warn("Geolocation error", err)
      );
    }
  }, []);

  const openRoute = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-blue-600 uppercase italic">{t.map}</h2>
        <p className="text-gray-500 text-sm">{t.findSupermarkets}</p>
      </div>

      <div className="relative flex-1 rounded-3xl overflow-hidden border-4 border-white shadow-lg z-0">
        <MapContainer 
          center={SCHIEDAM_CENTER} 
          zoom={13} 
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {userLocation && (
            <Marker position={userLocation} icon={UserIcon}>
              <Popup>{t.yourLocation}</Popup>
            </Marker>
          )}

          {supermarkets.map((store) => (
            <Marker 
              key={store.id} 
              position={[store.lat, store.lng]}
              eventHandlers={{
                click: () => setSelected(store),
              }}
            >
              <Popup>{store.name}</Popup>
            </Marker>
          ))}
          
          <RecenterMap coords={SCHIEDAM_CENTER} />
        </MapContainer>

        {userLocation && (
          <button 
            onClick={() => setUserLocation(userLocation)}
            className="absolute bottom-4 right-4 z-[400] bg-white p-3 rounded-full shadow-lg text-blue-600 hover:bg-blue-50 transition-all"
          >
            <MapPin size={24} />
          </button>
        )}
      </div>

      {/* Selected Store Info Panel */}
      <AnimatePresence>
        {selected && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 space-y-4 z-10"
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="bg-yellow-100 p-4 rounded-2xl text-yellow-600">
                  <Store size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-blue-600 uppercase italic">{selected.name}</h3>
                  <p className="text-gray-500 text-sm">{selected.address}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelected(null)}
                className="p-2 text-gray-300 hover:text-gray-500"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex gap-3">
                <button 
                  onClick={() => openRoute(selected.lat, selected.lng)}
                  className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                >
                  <Navigation size={20} />
                  {t.route}
                </button>
              <button 
                onClick={() => setShowInfoModal(true)}
                className="bg-gray-100 text-gray-600 px-6 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all"
              >
                <Info size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Modal */}
      <AnimatePresence>
        {showInfoModal && selected && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-6 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm p-8 space-y-6 shadow-2xl relative"
            >
              <button 
                onClick={() => setShowInfoModal(false)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>

              <div className="text-center space-y-4">
                <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-blue-600">
                  <Store size={40} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-blue-600 uppercase italic">{selected.name}</h3>
                  <p className="text-gray-500">{selected.address}</p>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-2xl space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 font-bold uppercase tracking-wider">{t.openingHours}</span>
                  <span className="text-blue-600 font-bold">08:00 - 21:00</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 font-bold uppercase tracking-wider">{t.distance}</span>
                  <span className="text-blue-600 font-bold">~1.2 km</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 font-bold uppercase tracking-wider">{t.fruitStock}</span>
                  <span className="text-green-600 font-bold">{t.available}</span>
                </div>
              </div>

              <button 
                onClick={() => setShowInfoModal(false)}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition-all"
              >
                {t.close}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
