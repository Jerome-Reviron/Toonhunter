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
      await new Promise((r) => setTimeout(r, 800));
      const isAdmin = email.includes("admin") || email.includes("jrinstitut");
      const user: User = {
        id: isAdmin ? 1 : Date.now(),
        pseudo: isAdmin ? "Jerome" : email.split("@")[0],
        email: email,
        role: isAdmin ? "admin" : "user",
        isPaid: true,
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
        if (!data.success) {
          throw new Error(data.message || "Email ou mot de passe incorrect.");
        }
        const user = data.user;
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        return user;
      } catch (error: any) {
        throw new Error(
          error.message || "Impossible de contacter le serveur Laragon."
        );
      }
    }
  },

  register: async (
    pseudo: string,
    email: string,
    password: string
  ): Promise<void> => {
    const response = await fetch(`${API_CONFIG.BASE_URL}/register.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pseudo, email, password }),
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || "Erreur lors de l'inscription.");
    }
  },

  // --------------------------------------------------------------------
  // 🔐 MOT DE PASSE OUBLIÉ — NOUVELLE VERSION SÉCURISÉE
  // --------------------------------------------------------------------

  // Ancienne version mockée (conservée pour historique)
  /*
  requestPasswordReset: async (email: string): Promise<string> => {
    if (API_CONFIG.USE_MOCK_DATA) {
      await new Promise((r) => setTimeout(r, 500));
      return "123456"; // Simulates sending a code via email
    }
    return "123456";
  },
  */

  requestPasswordReset: async (email: string): Promise<void> => {
    const response = await fetch(`${API_CONFIG.BASE_URL}/forgot-password.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || "Impossible d'envoyer le code.");
    }

    // 🔒 Sécurité B : on ne renvoie jamais le code au frontend
    return;
  },

  // Ancienne version mockée (conservée pour historique)
  /*
  verifyResetCode: async (email: string, code: string): Promise<boolean> => {
    if (API_CONFIG.USE_MOCK_DATA) {
      await new Promise((r) => setTimeout(r, 500));
      return code === "123456";
    }
    return code === "123456";
  },
  */

  verifyResetCode: async (email: string, code: string): Promise<boolean> => {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/verify-reset-code.php`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      }
    );

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || "Code incorrect ou expiré.");
    }

    return true;
  },

  // Ancienne version mockée (conservée pour historique)
  /*
  resetPassword: async (
    email: string,
    code: string,
    password: string
  ): Promise<void> => {
    if (API_CONFIG.USE_MOCK_DATA) {
      await new Promise((r) => setTimeout(r, 800));
      return;
    }
  },
  */

  resetPassword: async (
    email: string,
    code: string,
    password: string
  ): Promise<void> => {
    const response = await fetch(`${API_CONFIG.BASE_URL}/reset-password.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, password }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(
        data.message || "Impossible de réinitialiser le mot de passe."
      );
    }
  },

  logout: () => {
    localStorage.removeItem(SESSION_KEY);
  },
};
