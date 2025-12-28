import React, { useState, useEffect, useCallback } from "react";
import {
  Coordinates,
  LocationTarget,
  AppState,
  AnalysisResult,
  User,
  CollectionItem,
} from "./types";
import { LocationCard } from "./components/LocationCard";
import { CameraInterface } from "./components/CameraInterface";
import { AdminPanel } from "./components/AdminPanel";
import { AuthScreen } from "./components/AuthScreen";
import { authService } from "./services/authService";
import { locationService } from "./services/locationService";
import { collectionService } from "./services/collectionService";
import { generateCharacterPhoto } from "./services/geminiService";
import {
  Map,
  Trophy,
  Lock,
  LogOut,
  X,
  Download,
  Sparkles,
  AlertTriangle,
  RefreshCcw,
  Navigation2,
  Radar,
  CircleDot,
  CircleHelp,
} from "lucide-react";

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locations, setLocations] = useState<LocationTarget[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<LocationTarget | null>(
    null
  );
  const [appState, setAppState] = useState<AppState>(AppState.AUTH);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const [showViewer, setShowViewer] = useState<{
    isOpen: boolean;
    item?: CollectionItem;
    target?: LocationTarget;
  }>({ isOpen: false });
  const [collection, setCollection] = useState<Record<string, CollectionItem>>(
    {}
  );
  const [currentTab, setCurrentTab] = useState<"map" | "collection" | "admin">(
    "map"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      setAppState(AppState.LIST);
    }
  }, []);

  useEffect(() => {
    if (user && appState === AppState.LIST) {
      const loadData = async () => {
        try {
          const [locs, col] = await Promise.all([
            locationService.getAll(),
            collectionService.getUserCollection(user.id),
          ]);
          setLocations(locs);
          setCollection(col);
        } catch (e) {
          console.error("Load error:", e);
        }
      };
      loadData();
    }
  }, [user, appState]);

  useEffect(() => {
    if (user && "geolocation" in navigator) {
      // Configuration GPS ultra-précise : pas de cache, timeout court
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setUserLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        (err) => console.error("GPS Error:", err),
        {
          enableHighAccuracy: true,
          timeout: 2000,
          maximumAge: 0,
        }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [user]);

  const handleLogout = () => {
    authService.logout();
    setUser(null);
    setAppState(AppState.AUTH);
    setAnalysisResult(null);
    setSelectedTarget(null);
    setCollection({});
    setCurrentTab("map");
  };

  const handleFinish = useCallback(() => {
    setAppState(AppState.LIST);
    setAnalysisResult(null);
    setSelectedTarget(null);
    setErrorMessage(null);
  }, []);

  const downloadImage = async (base64Data: string, fileName: string) => {
    try {
      const base64Content = base64Data.includes(",")
        ? base64Data.split(",")[1]
        : base64Data;
      const byteCharacters = atob(base64Content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "image/jpeg" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ToonHunter_${fileName.replace(/\s+/g, "_")}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failed", e);
    }
  };

  const handleCapture = async (base64Image: string) => {
    if (!selectedTarget) return;
    setAppState(AppState.ANALYZING);
    setErrorMessage(null);

    try {
      const result = await generateCharacterPhoto(base64Image, selectedTarget);
      const fullResultImage = `data:image/jpeg;base64,${result.image}`;

      setAnalysisResult({
        originalImage: `data:image/jpeg;base64,${base64Image}`,
        processedImage: fullResultImage,
        quote: result.quote,
      });

      const newItem: CollectionItem = {
        locationId: selectedTarget.id,
        photoUrl: fullResultImage,
        quote: result.quote,
        capturedAt: new Date().toISOString(),
      };

      setCollection((prev) => ({ ...prev, [selectedTarget.id]: newItem }));
      await collectionService.addTrophy(
        user!.id,
        selectedTarget.id,
        fullResultImage,
        result.quote
      );
      setAppState(AppState.RESULT);
    } catch (error: any) {
      console.error("Capture Error:", error);
      let msg = "Une interférence magique empêche la matérialisation.";
      if (
        error.message?.includes("429") ||
        error.message?.toLowerCase().includes("quota")
      ) {
        msg = "La Magie est en panne. Veuillez réessayer dans un moment.";
      }
      setErrorMessage(msg);
      setAppState(AppState.ERROR);
    }
  };

  if (appState === AppState.AUTH) {
    return (
      <AuthScreen
        onLoginSuccess={(u) => {
          setUser(u);
          setAppState(AppState.LIST);
        }}
      />
    );
  }

  if (appState === AppState.ERROR) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#0f0518] flex flex-col items-center justify-center p-8 text-center">
        <div className="mb-6 p-4 bg-red-500/10 rounded-full">
          <AlertTriangle className="w-12 h-12 text-red-500" />
        </div>
        <h2 className="text-2xl font-display font-black text-white mb-4">
          Les éclats de magie ont perturbé la capture !
        </h2>
        <p className="text-gray-400 text-sm max-w-xs mb-12 leading-relaxed">
          {errorMessage}
        </p>
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button
            onClick={() => setAppState(AppState.CAMERA)}
            className="w-full py-4 bg-white/10 border border-white/20 rounded-xl font-bold uppercase text-white flex items-center justify-center gap-2 hover:bg-white/20 transition-all"
          >
            <RefreshCcw className="w-4 h-4" /> Réessayer la capture
          </button>
          <button
            onClick={handleFinish}
            className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl font-black uppercase text-white shadow-lg active:scale-95 transition-all"
          >
            Retour au parc
          </button>
        </div>
      </div>
    );
  }

  if (appState === AppState.ANALYZING) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#0f0518] flex flex-col items-center justify-center p-8 text-center">
        <div className="relative mb-8 flex items-center justify-center">
          <div className="absolute w-48 h-48 bg-purple-600/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="w-32 h-32 border-4 border-transparent border-t-purple-500 border-r-cyan-400 border-b-cyan-500 rounded-full animate-spin"></div>
          <Sparkles className="absolute w-12 h-12 text-cyan-300 fill-purple-500/30 animate-pulse drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
        </div>
        <h2 className="text-2xl font-display font-black text-white">
          Magie en cours...
        </h2>
        <p className="text-gray-400 text-sm mt-2 max-w-[200px]">
          {selectedTarget?.characterName} arrive dans votre photo !
        </p>
        <button
          onClick={handleFinish}
          className="mt-12 text-gray-500 underline text-xs uppercase tracking-widest hover:text-white transition-colors"
        >
          Annuler la magie
        </button>
      </div>
    );
  }

  if (appState === AppState.RESULT && analysisResult) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#0f0518] flex flex-col overflow-y-auto">
        <div className="p-6 flex justify-between items-center bg-black/40 backdrop-blur-md sticky top-0 z-10 border-b border-white/10">
          <h2 className="text-xl font-display font-black text-white">
            Capture Réussie !
          </h2>
          <button
            onClick={handleFinish}
            className="p-2 bg-white/10 rounded-full text-white"
          >
            <X />
          </button>
        </div>
        <div className="px-6 flex-1 flex flex-col gap-4 max-w-md mx-auto w-full pb-12 pt-4">
          <div className="rounded-3xl overflow-hidden shadow-2xl border-2 border-pink-500/50 bg-gray-900 shine-effect">
            <img
              src={analysisResult.processedImage}
              className="w-full aspect-[3/4] object-cover"
              alt="Result"
            />
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center shadow-inner">
            <p className="text-pink-400 font-bold mb-1 uppercase text-[10px] tracking-widest">
              Message de {selectedTarget?.characterName}
            </p>
            <p className="text-md font-display italic text-white leading-tight">
              "{analysisResult.quote}"
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() =>
                downloadImage(
                  analysisResult.processedImage,
                  selectedTarget?.characterName || "Toon"
                )
              }
              className="py-4 bg-white/10 border border-white/20 rounded-xl font-bold uppercase text-white flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-white/20"
            >
              <Download className="w-5 h-5" /> Sauvegarder
            </button>
            <button
              onClick={handleFinish}
              className="py-4 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl font-black uppercase text-white shadow-lg active:scale-95 transition-all"
            >
              Terminer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0518] text-white overflow-x-hidden font-nunito">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-20 -left-20 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-20 -right-20 w-96 h-96 bg-pink-600/10 rounded-full blur-[120px]"></div>
      </div>

      <header className="sticky top-0 z-30 bg-[#0f0518]/80 backdrop-blur-xl border-b border-white/10 p-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <h1 className="text-2xl font-display font-black tracking-tight text-white">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-500">
              TOON
            </span>
            HUNTER
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentTab("map")}
              className={`p-2.5 rounded-xl transition-all ${
                currentTab === "map"
                  ? "bg-white/10 text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.3)]"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Map className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentTab("collection")}
              className={`p-2.5 rounded-xl transition-all ${
                currentTab === "collection"
                  ? "bg-white/10 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3)]"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Trophy className="w-5 h-5" />
            </button>
            {user?.role === "admin" && (
              <button
                onClick={() => setCurrentTab("admin")}
                className={`p-2.5 rounded-xl transition-all ${
                  currentTab === "admin"
                    ? "bg-white/10 text-red-400 shadow-[0_0_15px_rgba(248,113,113,0.3)]"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <Lock className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={handleLogout}
              className="p-2.5 text-gray-500 hover:text-white transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 pb-24 relative z-10">
        {currentTab === "map" && (
          <div className="space-y-8">
            <div className="flex flex-col gap-1">
              <h2 className="text-3xl font-display font-black text-white">
                Exploration
              </h2>
              <p className="text-gray-400 text-sm">
                Découvrez les Toons cachés autour de vous.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 flex flex-wrap gap-4 items-center justify-between backdrop-blur-md shadow-xl">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20"></div>
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400">
                    <Navigation2 className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                    Signal GPS
                  </p>
                  <p className="text-sm font-bold text-white">
                    Position Active
                  </p>
                </div>
              </div>

              <div className="flex gap-6 items-center">
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-0.5">
                    Rayon Scan
                  </p>
                  <div className="flex items-center gap-1.5 justify-end">
                    <CircleDot className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-sm font-bold text-white">50m</span>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-0.5">
                    Toons proches
                  </p>
                  <div className="flex items-center gap-1.5 justify-end">
                    <Radar className="w-3.5 h-3.5 text-pink-500" />
                    <span className="text-sm font-bold text-white">
                      {locations.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {locations.map((loc) => (
                <LocationCard
                  key={loc.id}
                  location={loc}
                  userCoords={userLocation}
                  isCollected={!!collection[loc.id]}
                  hasAccess={
                    user?.isPaid ||
                    locations.slice(0, 3).some((l) => l.id === loc.id)
                  }
                  onSelect={(t) => {
                    if (collection[t.id]) {
                      setCurrentTab("collection");
                    } else {
                      setSelectedTarget(t);
                      setAppState(AppState.CAMERA);
                    }
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {currentTab === "collection" && (
          <div className="space-y-6">
            <h2 className="text-3xl font-display font-black text-white">
              Trophées
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {locations.map((loc) => {
                const item = collection[loc.id];
                const isFound = !!item;
                const rarityColor =
                  loc.rarity === "Legendary"
                    ? "text-amber-400"
                    : loc.rarity === "Rare"
                    ? "text-purple-400"
                    : "text-blue-400";

                return (
                  <div
                    key={loc.id}
                    className={`relative overflow-hidden rounded-3xl border-2 transition-all duration-300 ${
                      isFound
                        ? "border-emerald-500/50 bg-gray-900 shadow-xl"
                        : "border-white/5 bg-white/5 grayscale opacity-50 hover:opacity-80"
                    }`}
                  >
                    <div className="h-48 w-full relative">
                      <img
                        src={isFound ? item.photoUrl : loc.imageUrl}
                        alt={loc.name}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent"></div>
                      {!isFound && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-100 pointer-events-none">
                          <CircleHelp className="w-10 h-10 text-purple-300 mb-2 drop-shadow-[0_0_14px_rgba(220,150,255,0.9)] animate-pulse" />
                          <span className="text-[12px] font-black uppercase tracking-widest text-purple-200 drop-shadow-[0_0_10px_rgba(220,150,255,0.8)] animate-pulse">
                            À découvrir
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-black font-display text-white">
                          {loc.characterName}
                        </h3>
                        <span
                          className={`text-[10px] font-black uppercase tracking-widest ${rarityColor}`}
                        >
                          {loc.rarity}
                        </span>
                      </div>
                      {isFound ? (
                        <div className="space-y-3">
                          <p className="text-sm italic text-emerald-400 leading-tight">
                            "{item.quote}"
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                setShowViewer({
                                  isOpen: true,
                                  item,
                                  target: loc,
                                })
                              }
                              className="flex-1 py-2 bg-white/10 text-white text-[10px] font-black uppercase rounded-xl border border-white/10 hover:bg-white/20 transition-colors"
                            >
                              Détails
                            </button>
                            <button
                              onClick={() =>
                                downloadImage(item.photoUrl, loc.characterName)
                              }
                              className="p-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-400 transition-colors"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">
                          Destination : {loc.name}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {currentTab === "admin" && user?.role === "admin" && (
          <AdminPanel
            userLocation={userLocation}
            locations={locations}
            onAddLocation={async (l) => {
              const created = await locationService.create(l);
              setLocations([...locations, created]);
            }}
            onUpdateLocation={async (l) => {
              await locationService.update(l);
              setLocations(locations.map((x) => (x.id === l.id ? l : x)));
            }}
            onDeleteLocation={async (id) => {
              await locationService.delete(id);
              setLocations(locations.filter((x) => x.id !== id));
            }}
            onClose={() => setCurrentTab("map")}
          />
        )}
      </main>

      {appState === AppState.CAMERA && selectedTarget && (
        <CameraInterface
          target={selectedTarget}
          onClose={() => {
            setAppState(AppState.LIST);
            setSelectedTarget(null);
          }}
          onCapture={handleCapture}
        />
      )}

      {showViewer.isOpen && showViewer.item && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col">
          <div className="p-6 flex justify-between items-center bg-black/50 border-b border-white/10">
            <h3 className="font-display font-black text-xl text-white">
              {showViewer.target?.characterName}
            </h3>
            <button
              onClick={() => setShowViewer({ isOpen: false })}
              className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"
            >
              <X />
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6 overflow-y-auto">
            <img
              src={showViewer.item.photoUrl}
              className="max-w-full max-h-[70vh] rounded-3xl shadow-2xl border border-white/20 object-contain"
              alt="Full"
            />
            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl max-w-md w-full text-center shadow-2xl">
              <p className="text-pink-400 text-[10px] font-black uppercase tracking-widest mb-2">
                Réplique magique
              </p>
              <p className="text-lg font-display italic text-white leading-tight">
                "{showViewer.item.quote}"
              </p>
            </div>
          </div>
          <div className="p-8 grid grid-cols-2 gap-4 bg-black/50 border-t border-white/10">
            <button
              onClick={() =>
                downloadImage(
                  showViewer.item!.photoUrl,
                  showViewer.target?.characterName || "Toon"
                )
              }
              className="py-4 bg-white text-black font-black uppercase text-xs rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl"
            >
              <Download className="w-5 h-5" /> Enregistrer
            </button>
            <button
              onClick={() => setShowViewer({ isOpen: false })}
              className="py-4 bg-white/10 text-white font-bold uppercase text-xs rounded-2xl border border-white/20 active:scale-95 transition-all hover:bg-white/20"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
