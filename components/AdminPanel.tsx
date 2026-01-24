import React, { useState, useEffect, useRef } from "react";
import { LocationTarget, Coordinates, Parc } from "../types";
import { parcService } from "../services/parcService";
import { locationService } from "../services/locationService";
import {
  MapPin,
  Save,
  Wand2,
  Crosshair,
  Upload,
  Edit,
  Trash2,
  X,
  Star,
  Ruler,
  ImageIcon,
  Loader2,
} from "lucide-react";

interface AdminPanelProps {
  userLocation: Coordinates | null;
  locations: LocationTarget[];
  selectedParcId: number | null;
  onAddLocation: (location: LocationTarget) => Promise<void>;
  onUpdateLocation: (location: LocationTarget) => Promise<void>;
  onDeleteLocation: (id: string | number) => Promise<void>;
  onClose: () => void;
  userId: number | string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  userLocation,
  locations,
  selectedParcId,
  onAddLocation,
  onUpdateLocation,
  onDeleteLocation,
  onClose,
  userId,
}) => {
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [saving, setSaving] = useState(false); // Loading state

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [characterName, setCharacterName] = useState("");
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [keywords, setKeywords] = useState("");
  const [imageBase64, setImageBase64] = useState<string>("");
  const [rarity, setRarity] = useState<"Commune" | "Rare" | "Légendaire">(
    "Commune",
  );
  const [radius, setRadius] = useState<number>(50);
  const [promptContext, setPromptContext] = useState("");
  const [free, setFree] = useState<boolean>(false);
  const [parcs, setParcs] = useState<Parc[]>([]);
  const [parcId, setParcId] = useState<number | null>(null);
  const [editingParcId, setEditingParcId] = useState<number | null>(null);
  const [parcName, setParcName] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoBase64, setLogoBase64] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!promptContext && !editingId) {
      setPromptContext(
        "A friendly 3D CGI LION with a golden mane. He is standing BEHIND the human subject, peeking over their shoulder. The person blocks part of the lion's body. Realistic fur, bright eyes, Pixar style. NOT a monster, but a Lion.",
      );
    }
  }, []);

  useEffect(() => {
    const fetchParcs = async () => {
      try {
        const data = await parcService.getAll();
        setParcs(data);
      } catch (err) {
        console.error("Erreur chargement parcs", err);
      }
    };
    fetchParcs();
  }, []);

  useEffect(() => {
    if (userLocation && !lat && !lng && !editingId) {
      setLat(userLocation.latitude.toFixed(7));
      setLng(userLocation.longitude.toFixed(7));
    }
  }, [userLocation, lat, lng, editingId]);

  const generateSmartPrompt = (charName: string) => {
    if (!charName) return;
    const cleanName = charName.trim().toUpperCase();
    const smartTemplate = `A friendly 3D CGI ${cleanName} with realistic textures. It is standing BEHIND the human subject, peeking over their shoulder. The person BLOCKS part of the character's body (Occlusion). Pixar style, soft lighting, 8k resolution.`;
    setPromptContext(smartTemplate);
  };

  useEffect(() => {
    if (!editingId && characterName.length > 2) {
      const timeoutId = setTimeout(
        () => generateSmartPrompt(characterName),
        500,
      );
      return () => clearTimeout(timeoutId);
    }
  }, [characterName, editingId]);

  const useCurrentLocation = () => {
    if (userLocation) {
      setLat(userLocation.latitude.toFixed(7));
      setLng(userLocation.longitude.toFixed(7));
    } else {
      alert("Position GPS non détectée. Vérifiez vos permissions.");
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_SIZE = 300;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          setLogoBase64(canvas.toDataURL("image/png"));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_SIZE = 500;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          setImageBase64(canvas.toDataURL("image/jpeg", 0.7));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditClick = (loc: LocationTarget) => {
    setEditingId(loc.id);
    setName(loc.name);
    setDescription(loc.description || "");
    setCharacterName(loc.characterName);
    setLat(loc.coordinates.latitude.toString());
    setLng(loc.coordinates.longitude.toString());
    setKeywords(loc.validationKeywords || "");
    setPromptContext(loc.promptContext);
    setImageBase64(loc.imageUrl);
    setRarity(loc.rarity);
    setRadius(loc.radiusMeters || 50);
    setFree(Boolean(loc.free));
    setParcId(loc.parc_id ?? null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetParcForm = () => {
    setEditingParcId(null);
    setParcName("");
    setLogoBase64("");
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setCharacterName("");
    setKeywords("");
    setImageBase64("");
    setRarity("Commune");
    setRadius(50);
    setFree(false);
    setParcId(null);
    generateSmartPrompt("CHARACTER");
    if (userLocation) {
      setLat(userLocation.latitude.toFixed(7));
      setLng(userLocation.longitude.toFixed(7));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !characterName || !lat || !lng) {
      alert("Veuillez remplir les champs obligatoires (*)");
      return;
    }
    setSaving(true);

    const locationData = {
      id: editingId || Date.now().toString(),
      userId,
      name,
      description,
      coordinates: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
      radiusMeters: radius,
      characterName,
      promptContext,
      validationKeywords: keywords || "building, structure, place",
      imageUrl:
        imageBase64 ||
        "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60",
      rarity,
      free,
      parc_id: parcId,
    };

    try {
      if (editingId) {
        await onUpdateLocation(locationData);
        alert("Point de capture mis à jour !");
        resetForm();
      } else {
        await onAddLocation(locationData);
        alert("Nouveau point de capture créé !");
      }
    } catch (err) {
      alert("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string | number) => {
    if (window.confirm("Supprimer ce point de capture ?")) {
      setSaving(true);
      await onDeleteLocation(id);
      setSaving(false);
    }
  };

  const RarityButton = ({
    r,
    color,
    label,
  }: {
    r: "Commune" | "Rare" | "Légendaire";
    color: string;
    label: string;
  }) => (
    <button
      type="button"
      onClick={() => setRarity(r)}
      className={`flex-1 py-3 px-2 rounded-xl border-2 font-bold text-sm transition-all flex flex-col items-center gap-1 ${
        rarity === r
          ? `${color} bg-white/10 shadow-lg scale-105`
          : "border-white/10 text-gray-400 hover:bg-white/5"
      }`}
    >
      <Star className={`w-4 h-4 ${rarity === r ? "fill-current" : ""}`} />{" "}
      {label}
    </button>
  );

  const countForSelectedParc = locations.filter(
    (loc) => selectedParcId !== null && loc.parc_id === selectedParcId,
  ).length;

  return (
    <div className="min-h-screen bg-[#0f0518] p-6 pb-24 text-white">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-500/20 rounded-xl">
              <Wand2 className="w-8 h-8 text-red-400" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-black">Admin Panel</h2>
              <p className="text-gray-400 text-sm">
                {editingId ? "Modifier" : "Nouveau point de capture"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white/10 rounded-full hover:bg-white/20"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* --------------------------------------------------------- */}
        {/* SECTION : Gestion des Parcs */}
        {/* --------------------------------------------------------- */}
        <div className="space-y-4 p-5 bg-white/5 rounded-2xl border border-white/10 mb-6">
          <h3 className="font-bold text-blue-400 uppercase text-xs tracking-wider flex items-center gap-2">
            <Star className="w-4 h-4" /> Gestion des parcs
          </h3>

          {/* Formulaire ajout / édition */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();

              if (!parcName) {
                alert("Nom du parc obligatoire");
                return;
              }

              if (editingParcId) {
                await parcService.update({
                  id: editingParcId,
                  name: parcName,
                  logo: logoBase64,
                  userId: Number(userId),
                });

                setParcs(
                  parcs.map((p) =>
                    p.id === editingParcId
                      ? { ...p, name: parcName, logo: logoBase64 }
                      : p,
                  ),
                );
              } else {
                const newId = await parcService.create({
                  name: parcName,
                  logo: logoBase64,
                  userId: Number(userId),
                });

                setParcs([
                  ...parcs,
                  { id: newId, name: parcName, logo: logoBase64 },
                ]);
              }

              setEditingParcId(null);
              setParcName("");
              setLogoBase64("");
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium mb-1">
                Nom du parc
              </label>
              <input
                type="text"
                placeholder="Ex: Parc des Étoiles"
                value={parcName}
                onChange={(e) => setParcName(e.target.value)}
                className="w-full bg-black/40 border border-white/20 rounded-lg p-3 focus:border-pink-500 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Logo du parc
              </label>

              <input
                type="file"
                accept="image/*"
                ref={logoInputRef}
                onChange={handleLogoUpload}
                className="hidden"
              />

              <div
                onClick={() => logoInputRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 hover:border-pink-500/50 transition-colors overflow-hidden relative"
              >
                {logoBase64 ? (
                  <img
                    src={logoBase64}
                    alt="Logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-500 mb-2" />
                    <span className="text-xs text-gray-400">
                      Cliquez pour uploader
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-4">
              {editingParcId && (
                <button
                  type="button"
                  onClick={resetParcForm}
                  className="px-6 py-4 bg-gray-700 rounded-xl font-bold text-gray-300 hover:bg-gray-600 transition"
                >
                  Annuler
                </button>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2 flex items-center justify-center gap-2 rounded-xl font-black text-white bg-gradient-to-r from-pink-500 to-orange-500 hover:opacity-90 transition"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingParcId ? "Modifier" : "Créer le parc"}
                  </>
                )}
              </button>
            </div>
          </form>

          {/* --------------------------------------------------------- */}
          {/* SECTION : Parcs existants */}
          {/* --------------------------------------------------------- */}
          <div className="mt-10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Parcs existants
              </h3>
              <span className="text-xs font-normal text-gray-500 bg-black/30 px-2 py-1 rounded-full">
                {parcs.length}
              </span>
            </div>

            <div className="border-t border-white/10 pt-4 space-y-3">
              {parcs.map((p) => (
                <div
                  key={p.id}
                  className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between group hover:border-purple-500/50 transition-colors"
                >
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div className="w-12 h-12 rounded-lg bg-gray-800 flex-shrink-0 overflow-hidden relative">
                      {p.logo ? (
                        <img
                          src={p.logo}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-white/30 mx-auto my-auto" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <h4 className="font-bold text-white truncate">
                        {p.name}
                      </h4>
                      {/* Tu peux ajouter une description ou un badge ici si tu veux */}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingParcId(p.id);
                        setParcName(p.name);
                        setLogoBase64(p.logo || "");
                      }}
                      className="p-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm("Supprimer ce parc ?")) return;
                        await parcService.delete(p.id, Number(userId));
                        setParcs(parcs.filter((x) => x.id !== p.id));
                      }}
                      className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4 p-5 bg-white/5 rounded-2xl border border-white/10">
            <h3 className="font-bold text-pink-400 uppercase text-xs tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Localisation
            </h3>
            <div>
              <label className="block text-sm font-medium mb-1">
                Nom du lieu
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Fontaine du Parc..."
                className="w-full bg-black/40 border border-white/20 rounded-lg p-3 focus:border-pink-500 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description du lieu..."
                rows={3}
                className="w-full bg-black/40 border border-white/20 rounded-lg p-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Parc associé
              </label>

              <select
                value={parcId ?? ""}
                onChange={(e) =>
                  setParcId(
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                className="w-full bg-black/40 border border-white/20 rounded-lg p-3 text-sm"
              >
                <option value="">Aucun parc</option>
                {parcs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="w-full bg-black/40 border border-white/20 rounded-lg p-3 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="w-full bg-black/40 border border-white/20 rounded-lg p-3 font-mono text-sm"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={useCurrentLocation}
              className="w-full py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Crosshair className="w-4 h-4" /> Utiliser ma position
            </button>
            <div className="pt-2">
              <label className="flex items-center justify-between text-sm font-medium mb-2">
                <span className="flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-pink-400" /> Rayon de capture
                </span>
                <span className="text-pink-400 font-bold bg-pink-500/10 px-2 py-0.5 rounded">
                  {radius} m
                </span>
              </label>
              <input
                type="range"
                min="10"
                max="1000"
                step="10"
                value={radius}
                onChange={(e) => setRadius(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Image de référence
              </label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                className="hidden"
                accept="image/*"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 hover:border-pink-500/50 transition-colors overflow-hidden relative"
              >
                {imageBase64 ? (
                  <img
                    src={imageBase64}
                    className="w-full h-full object-cover"
                    alt="Preview"
                  />
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-500 mb-2" />
                    <span className="text-xs text-gray-400">
                      Cliquez pour uploader
                    </span>
                  </>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Mots-clés de validation (IA)
              </label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="Ex: tasse, mug, table"
                className="w-full bg-black/40 border border-white/20 rounded-lg p-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Accès au point
              </label>

              <div className="flex items-center gap-4 bg-black/40 border border-white/20 rounded-lg p-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="free"
                    checked={free === true}
                    onChange={() => setFree(true)}
                    className="accent-pink-500"
                  />
                  <span className="text-sm">Gratuit</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="free"
                    checked={free === false}
                    onChange={() => setFree(false)}
                    className="accent-pink-500"
                  />
                  <span className="text-sm">Payant</span>
                </label>
              </div>
            </div>
            <div className="flex gap-4">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-4 bg-gray-700 rounded-xl font-bold text-gray-300 hover:bg-gray-600 transition"
                >
                  Annuler
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2 flex items-center justify-center gap-2 rounded-xl font-black text-white bg-gradient-to-r from-pink-500 to-orange-500 hover:opacity-90 transition"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />{" "}
                    {editingId ? "Modifier" : "Créer le point"}
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-4 p-5 bg-white/5 rounded-2xl border border-white/10">
            <h3 className="font-bold text-purple-400 uppercase text-xs tracking-wider flex items-center gap-2">
              <Wand2 className="w-4 h-4" /> Personnage 3D
            </h3>
            <div>
              <label className="block text-sm font-medium mb-1">
                Nom du Personnage
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  placeholder="Ex: Mickey..."
                  className="flex-1 bg-black/40 border border-white/20 rounded-lg p-3 focus:border-purple-500 focus:outline-none transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Rareté de la rencontre
              </label>
              <div className="flex gap-2">
                <RarityButton
                  r="Commune"
                  color="border-blue-500 text-blue-400"
                  label="Commun"
                />
                <RarityButton
                  r="Rare"
                  color="border-purple-500 text-purple-400"
                  label="Rare"
                />
                <RarityButton
                  r="Légendaire"
                  color="border-amber-400 text-amber-400"
                  label="Légendaire"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Prompt de Génération (IA)
              </label>
              <textarea
                rows={4}
                value={promptContext}
                onChange={(e) => setPromptContext(e.target.value)}
                className="w-full bg-black/40 border border-white/20 rounded-lg p-3 text-sm text-gray-300 leading-relaxed font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">
                Généré automatiquement, mais modifiable.
              </p>
            </div>
          </div>
        </form>

        <div className="mt-12 border-t border-white/10 pt-8">
          <h3 className="text-xl font-display font-bold mb-6 flex items-center gap-2">
            Points de capture existants{" "}
            <span className="text-xs font-normal text-gray-500 bg-black/30 px-2 py-1 rounded-full">
              {countForSelectedParc}
            </span>
          </h3>
          <div className="space-y-4">
            {[...locations]
              .sort((a, b) => {
                const aIsOther =
                  selectedParcId !== null && a.parc_id !== selectedParcId;
                const bIsOther =
                  selectedParcId !== null && b.parc_id !== selectedParcId;
                return Number(aIsOther) - Number(bIsOther);
              })
              .map((loc) => {
                const badgeColor =
                  loc.rarity === "Légendaire"
                    ? "text-amber-400"
                    : loc.rarity === "Rare"
                      ? "text-purple-400"
                      : "text-blue-400";

                // 🔥 Détection : ce point n'appartient PAS au parc sélectionné
                const isOtherParc =
                  selectedParcId !== null && loc.parc_id !== selectedParcId;

                return (
                  <div
                    key={loc.id}
                    className={`bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between group hover:border-purple-500/50 transition-colors ${
                      isOtherParc ? "grayscale opacity-50 hover:opacity-80" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4 overflow-hidden">
                      <div className="w-12 h-12 rounded-lg bg-gray-800 flex-shrink-0 overflow-hidden relative">
                        <img
                          src={loc.imageUrl}
                          alt={loc.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white truncate">
                            {loc.characterName}
                          </h4>
                          <Star
                            className={`w-3 h-3 ${badgeColor} fill-current`}
                          />
                        </div>
                        <p className="text-xs text-white/80 mb-1 truncate">
                          {loc.name}
                        </p>
                        <p className="text-xs text-gray-400 mb-1 truncate">
                          {loc.description}
                        </p>
                        <p
                          className={`text-xs font-bold ${
                            loc.free ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {loc.free ? "Gratuit" : "Payant"}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditClick(loc)}
                        className="p-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(loc.id)}
                        disabled={saving}
                        className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
};
