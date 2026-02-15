import React, { useState, useEffect } from "react";
import { parcService } from "../services/parcService";
import { Parc } from "../types";
import { ChartNoAxesCombined, X, LayoutDashboard, Star } from "lucide-react";

interface StatsDashboardProps {
  onBack: () => void;
}

export const StatsDashboard: React.FC<StatsDashboardProps> = ({ onBack }) => {
  const [parcs, setParcs] = useState<Parc[]>([]);
  const [selectedParc, setSelectedParc] = useState("all");
  const [period, setPeriod] = useState("day");

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Charger les parcs
  useEffect(() => {
    const loadParcs = async () => {
      const data = await parcService.getAll();
      setParcs(data);
    };
    loadParcs();
  }, []);

  // Charger les stats
  const loadStats = async () => {
    setLoading(true);

    try {
      const response = await fetch(
        `/api/stats.php?parc_id=${selectedParc}&period=${period}`,
        { credentials: "include" },
      );

      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
      } else {
        console.error("Erreur stats:", data);
      }
    } catch (error) {
      console.error("Erreur réseau stats:", error);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadStats();
  }, [selectedParc, period]);

  const periodLabels: Record<string, string> = {
    day: "Jour",
    week: "Semaine",
    month: "Mois",
    year: "Année",
  };

  return (
    <div className="space-y-6">
      {/* Bouton retour */}
      <button
        onClick={onBack}
        className="mt-4 mb-6 w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-black shadow-lg active:scale-95 transition flex items-center justify-center gap-2"
      >
        <LayoutDashboard className="w-5 h-5" />
        <span>Admin Panel</span>
      </button>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500/20 rounded-xl">
            <ChartNoAxesCombined className="w-8 h-8 text-pink-400" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-black">Statistiques</h2>
            <p className="text-gray-400 text-sm">Vue analytique</p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="p-2 bg-white/10 rounded-full hover:bg-white/20"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Filtres */}
      <div className="space-y-4 p-4 bg-white/5 rounded-2xl border border-white/10">
        <h3 className="font-bold text-blue-400 uppercase text-xs tracking-wider flex items-center gap-2">
          <Star className="w-4 h-4" /> Option des données
        </h3>

        {/* Parc */}
        <div>
          <label className="block text-sm font-medium mb-1">Parc</label>
          <select
            value={selectedParc}
            onChange={(e) => setSelectedParc(e.target.value)}
            className="w-full bg-black/40 border border-white/20 rounded-lg p-3 text-sm"
          >
            <option value="all">Tous les parcs (global)</option>
            {parcs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Période */}
        <div>
          <label className="block text-sm font-medium mb-1">Période</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "day", label: "Jour" },
              { id: "week", label: "Semaine" },
              { id: "month", label: "Mois" },
              { id: "year", label: "Année" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`py-2 rounded-lg text-sm font-bold transition whitespace-normal leading-tight text-center ${
                  period === p.id
                    ? "bg-pink-500 text-white"
                    : "bg-white/10 text-gray-300 hover:bg-white/20"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-white">
          Chiffres ({periodLabels[period]})
        </h3>

        {/* Grille des métriques */}
        <div className="grid grid-cols-2 gap-4">
          {/* Total users */}
          <StatCard
            label="Utilisateurs inscrits"
            value={stats?.totalUsers}
            loading={loading}
          />

          {/* New users */}
          <StatCard
            label="Nouveaux utilisateurs"
            value={stats?.newUsers}
            loading={loading}
          />

          {/* Active users */}
          <StatCard
            label="Utilisateurs actifs"
            value={stats?.activeUsers}
            loading={loading}
          />

          {/* Captures totales */}
          <StatCard
            label="Captures totales"
            value={stats?.totalCaptures}
            loading={loading}
          />

          {/* Free */}
          <StatCard
            label="Captures gratuites"
            value={stats?.freeCaptures}
            loading={loading}
          />

          {/* Premium */}
          <StatCard
            label="Captures premium"
            value={stats?.premiumCaptures}
            loading={loading}
          />

          {/* Captures uniques */}
          <StatCard
            label="Captures uniques"
            value={stats?.uniqueCaptures}
            loading={loading}
          />

          {/* Moyenne captures / user */}
          <StatCard
            label="Moy. captures / utilisateur"
            value={stats?.avgCapturesPerUser?.toFixed(2)}
            loading={loading}
          />

          {/* Moyenne free / user */}
          <StatCard
            label="Moy. gratuites / utilisateur"
            value={stats?.avgFreePerUser?.toFixed(2)}
            loading={loading}
          />

          {/* Moyenne premium / user */}
          <StatCard
            label="Moy. premium / utilisateur"
            value={stats?.avgPremiumPerUser?.toFixed(2)}
            loading={loading}
          />

          {/* Conversion */}
          <StatCard
            label="Taux de conversion"
            value={`${(stats?.conversionRate * 100).toFixed(1)} %`}
            loading={loading}
          />

          {/* CA */}
          <StatCard
            label="Chiffre d'affaires (€)"
            value={(stats?.revenueCents / 100).toFixed(2)}
            loading={loading}
          />

          {/* Utilisateurs payants */}
          <StatCard
            label="Utilisateurs payants"
            value={stats?.payingUsers}
            loading={loading}
          />
        </div>

        {/* Top locations */}
        <div className="bg-white/5 p-4 rounded-xl border border-white/10">
          <h4 className="text-lg font-bold mb-3">Top 5 des locations</h4>

          {loading && <p className="text-gray-400">Chargement…</p>}

          {!loading && stats?.topLocations?.length === 0 && (
            <p className="text-gray-400">Aucune donnée</p>
          )}

          {!loading &&
            stats?.topLocations?.map((loc: any, index: number) => (
              <div
                key={index}
                className="flex justify-between py-1 border-b border-white/10"
              >
                <span>{loc.label ?? `Location #${loc.location_id}`}</span>
                <span className="font-bold">{loc.total}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

/* Petit composant réutilisable */
const StatCard = ({
  label,
  value,
  loading,
}: {
  label: string;
  value: any;
  loading: boolean;
}) => (
  <div className="bg-white/5 p-4 rounded-xl border border-white/10">
    <p className="text-sm text-gray-400">{label}</p>
    <p className="text-2xl font-black text-white">
      {loading ? "…" : (value ?? "—")}
    </p>
  </div>
);
