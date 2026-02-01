export const parcService = {
  getAll: async () => {
    const response = await fetch("/api/parcs.php", {
      credentials: "include",
    });

    if (response.status === 401) {
      window.location.href = "/login";
      return [];
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error("Erreur lors du chargement des parcs");
    }

    return data.parcs;
  },

  create: async (parc: { name: string; logo: string; userId: number }) => {
    const response = await fetch("/api/parcs.php", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parc),
    });

    if (response.status === 401) {
      window.location.href = "/login";
      return Promise.reject("SESSION_EXPIRED");
    }

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
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parc),
    });

    if (response.status === 401) {
      window.location.href = "/login";
      return Promise.reject("SESSION_EXPIRED");
    }

    const data = await response.json();
    if (!data.success) throw new Error("Erreur mise à jour parc");
  },

  delete: async (id: number, userId: number) => {
    const response = await fetch("/api/parcs.php", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, userId }),
    });

    if (response.status === 401) {
      window.location.href = "/login";
      return false;
    }

    const data = await response.json();
    if (!data.success) throw new Error("Erreur suppression parc");
  },
};
