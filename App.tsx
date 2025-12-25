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
import { Map, Trophy, Lock, LogOut, X, Download, Sparkles } from "lucide-react";

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
      const watchId = navigator.geolocation.watchPosition(
        (pos) =>
          setUserLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        null,
        { enableHighAccuracy: true }
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
      alert(error.message || "Erreur lors de la capture.");
      handleFinish();
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

  if (appState === AppState.ANALYZING) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#0f0518] flex flex-col items-center justify-center p-8 text-center">
        <div className="relative mb-8 flex items-center justify-center">
          <div className="absolute w-48 h-48 bg-purple-600/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="w-32 h-32 border-4 border-transparent border-t-purple-500 border-r-cyan-400 border-b-cyan-500 rounded-full animate-spin"></div>
          <Sparkles className="absolute w-12 h-12 text-cyan-300 fill-purple-500/30 animate-pulse drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
        </div>
        <h2 className="text-2xl font-display font-black text-white">
          La magie arrive...
        </h2>
        <p className="text-gray-400 text-sm mt-2">
          Votre Toon se matérialise dans la scène
        </p>
        <button
          onClick={handleFinish}
          className="mt-12 text-gray-500 underline text-xs uppercase tracking-widest"
        >
          Annuler la magie
        </button>
      </div>
    );
  }

  if (appState === AppState.RESULT && analysisResult) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#0f0518] flex flex-col overflow-y-auto">
        <div className="p-6 flex justify-between items-center bg-black/40 backdrop-blur-md sticky top-0 z-10">
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
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
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
              className="py-4 bg-white/10 border border-white/20 rounded-xl font-bold uppercase text-white flex items-center justify-center gap-2 active:scale-95 transition-all"
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
    <div className="min-h-screen bg-[#0f0518] text-white">
      <header className="sticky top-0 z-20 bg-[#0f0518]/90 backdrop-blur-lg border-b border-white/10 p-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <h1 className="text-xl font-display font-black tracking-tight">
            <span className="text-pink-500">TOON</span>HUNTER
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentTab("map")}
              className={`p-2 rounded-xl transition-all ${
                currentTab === "map"
                  ? "bg-white/10 text-pink-400"
                  : "text-gray-500"
              }`}
            >
              <Map className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentTab("collection")}
              className={`p-2 rounded-xl transition-all ${
                currentTab === "collection"
                  ? "bg-white/10 text-emerald-400"
                  : "text-gray-500"
              }`}
            >
              <Trophy className="w-5 h-5" />
            </button>
            {user?.role === "admin" && (
              <button
                onClick={() => setCurrentTab("admin")}
                className={`p-2 rounded-xl ${
                  currentTab === "admin"
                    ? "bg-white/10 text-red-400"
                    : "text-gray-500"
                }`}
              >
                <Lock className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-white transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 pb-24">
        {currentTab === "map" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-display font-black">
              Points de Capture
            </h2>
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
            <h2 className="text-2xl font-display font-black">
              Album des Trophées
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
                    className={`relative overflow-hidden rounded-2xl border-2 transition-all ${
                      isFound
                        ? "border-emerald-500 bg-gray-900 shadow-xl"
                        : "border-white/5 bg-white/5 grayscale opacity-40"
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
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <Lock className="w-8 h-8 text-gray-500 mb-2" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                            Mystère
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
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
                              className="flex-1 py-2 bg-white/10 text-white text-[10px] font-black uppercase rounded-lg border border-white/10"
                            >
                              Voir en grand
                            </button>
                            <button
                              onClick={() =>
                                downloadImage(item.photoUrl, loc.characterName)
                              }
                              className="p-2 bg-emerald-500 text-white rounded-lg"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">
                          Rendez-vous à {loc.name} pour le découvrir.
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
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col">
          <div className="p-6 flex justify-between items-center bg-black/50 border-b border-white/10">
            <h3 className="font-display font-black text-xl text-white">
              {showViewer.target?.characterName}
            </h3>
            <button
              onClick={() => setShowViewer({ isOpen: false })}
              className="p-2 bg-white/10 rounded-full text-white"
            >
              <X />
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
            <img
              src={showViewer.item.photoUrl}
              className="max-w-full max-h-[60vh] rounded-2xl shadow-2xl border border-white/20"
              alt="Full"
            />
            <div className="bg-white/5 border border-white/10 p-6 rounded-2xl max-w-md w-full text-center">
              <p className="text-pink-400 text-[10px] font-black uppercase tracking-widest mb-2">
                Sa réplique magique
              </p>
              <p className="text-lg font-display italic text-white leading-tight">
                "{showViewer.item.quote}"
              </p>
            </div>
          </div>
          <div className="p-8 grid grid-cols-2 gap-4">
            <button
              onClick={() =>
                downloadImage(
                  showViewer.item!.photoUrl,
                  showViewer.target?.characterName || "Toon"
                )
              }
              className="py-4 bg-white text-black font-black uppercase text-xs rounded-xl flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" /> Enregistrer
            </button>
            <button
              onClick={() => setShowViewer({ isOpen: false })}
              className="py-4 bg-white/10 text-white font-bold uppercase text-xs rounded-xl border border-white/20"
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
