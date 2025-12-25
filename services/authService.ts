import { User } from "../types";
import { API_CONFIG } from "../config";

const SESSION_KEY = "toonhunter_session";

export const authService = {
  getCurrentUser: (): User | null => {
    const sessionStr = localStorage.getItem(SESSION_KEY);
    return sessionStr ? JSON.parse(sessionStr) : null;
  },

  login: async (email: string, password: string): Promise<User> => {
    if (API_CONFIG.USE_MOCK_DATA) {
      await new Promise((r) => setTimeout(r, 800)); // Simuler latence
      const isAdmin = email.includes("admin");
      const user: User = {
        id: isAdmin ? "admin-1" : "user-" + Date.now(),
        pseudo: isAdmin ? "Admin" : email.split("@")[0],
        email: email,
        role: isAdmin ? "admin" : "user",
        isPaid: isAdmin,
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      return user;
    } else {
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/login.php`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || "Erreur de connexion");
        }
        const user = data.user;
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        return user;
      } catch (error: any) {
        throw new Error(error.message || "Erreur réseau. Vérifiez Laragon.");
      }
    }
  },

  register: async (
    pseudo: string,
    email: string,
    password: string
  ): Promise<void> => {
    if (API_CONFIG.USE_MOCK_DATA) {
      await new Promise((r) => setTimeout(r, 800));
      return;
    } else {
      const response = await fetch(`${API_CONFIG.BASE_URL}/register.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pseudo, email, password }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Erreur lors de l'inscription");
      }
    }
  },

  logout: () => {
    localStorage.removeItem(SESSION_KEY);
  },

  requestPasswordReset: async (email: string): Promise<string> => {
    await new Promise((r) => setTimeout(r, 500));
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  verifyResetCode: async (email: string, code: string): Promise<boolean> => {
    return true;
  },

  resetPassword: async (
    email: string,
    code: string,
    newPassword: string
  ): Promise<void> => {
    await new Promise((r) => setTimeout(r, 500));
  },
};
