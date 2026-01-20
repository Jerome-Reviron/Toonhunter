export const parcService = {
  getAll: async () => {
    const response = await fetch("/api/parcs.php");
    const data = await response.json();

    if (!data.success) {
      throw new Error("Erreur lors du chargement des parcs");
    }

    return data.parcs;
  },

  create: async (parc: { name: string; logo: string; userId: number }) => {
    const response = await fetch("/api/parcs.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parc),
    });

    const data = await response.json();
    if (!data.success) throw new Error("Erreur création parc");
    return data.id;
  },

  update: async (parc: {
    id: number;
    name: string;
    logo: string;
    userId: number;
  }) => {
    const response = await fetch("/api/parcs.php", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parc),
    });

    const data = await response.json();
    if (!data.success) throw new Error("Erreur mise à jour parc");
  },

  delete: async (id: number, userId: number) => {
    const response = await fetch("/api/parcs.php", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, userId }),
    });

    const data = await response.json();
    if (!data.success) throw new Error("Erreur suppression parc");
  },
};
