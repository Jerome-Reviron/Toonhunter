import React, { useEffect, useState } from "react";
import { parcService } from "../services/parcService";
import { Parc } from "../types";

interface ParcSelectorProps {
  onSelectParc: (parcId: number) => void;
}

const ParcSelector: React.FC<ParcSelectorProps> = ({ onSelectParc }) => {
  const [parcs, setParcs] = useState<Parc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadParcs = async () => {
      try {
        const data = await parcService.getAll();
        setParcs(data);
      } catch (err) {
        console.error("Erreur chargement parcs", err);
      } finally {
        setLoading(false);
      }
    };

    loadParcs();
  }, []);

  const handleSelect = (id: number) => {
    localStorage.setItem("selected_parc_id", id.toString());
    onSelectParc(id);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0518] text-white">
        <p className="text-lg animate-pulse">Chargement des parcs...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0518] text-white p-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-black font-display text-center mb-8">
          Quel parc allez-vous visiter aujourd’hui ?
        </h1>

        <div className="grid grid-cols-1 gap-6">
          {parcs.map((parc) => (
            <button
              key={parc.id}
              onClick={() => handleSelect(parc.id)}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col items-center gap-4 hover:bg-white/10 hover:border-pink-500/40 transition-all shadow-lg"
            >
              <div className="w-28 h-28 rounded-xl overflow-hidden">
                <img
                  src={parc.logo}
                  alt={parc.name}
                  className="w-full h-full object-contain"
                />
              </div>

              <p className="text-lg font-bold">{parc.name}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ParcSelector;
