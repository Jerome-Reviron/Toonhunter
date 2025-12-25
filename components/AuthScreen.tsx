import React, { useState, useEffect } from "react";
import { User } from "../types";
import { authService } from "../services/authService";
import {
  LogIn,
  UserPlus,
  Mail,
  Lock,
  User as UserIcon,
  AlertCircle,
  ArrowLeft,
  KeyRound,
  Timer,
  CheckCircle,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";

interface AuthScreenProps {
  onLoginSuccess: (user: User) => void;
}

type AuthView = "LOGIN" | "REGISTER" | "FORGOT_PASSWORD";
type ForgotStep = "EMAIL" | "CODE" | "NEW_PASSWORD";

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [view, setView] = useState<AuthView>("LOGIN");
  const [error, setError] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pseudo, setPseudo] = useState("");

  // États pour la visibilité des mots de passe
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [forgotStep, setForgotStep] = useState<ForgotStep>("EMAIL");
  const [resetCode, setResetCode] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (timeLeft > 0) {
      const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timerId);
    }
  }, [timeLeft]);

  const validatePassword = (pwd: string) => {
    const regex =
      /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    return regex.test(pwd);
  };

  const validateEmail = (mail: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(mail);
  };

  const resetState = () => {
    setError("");
    setSuccessMsg("");
    setPassword("");
    setConfirmPassword("");
    setResetCode("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await authService.login(email, password);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      if (!pseudo || !email || !password || !confirmPassword)
        throw new Error("Tous les champs sont requis.");
      if (!validateEmail(email)) throw new Error("Format d'email invalide.");
      if (password !== confirmPassword)
        throw new Error("Les mots de passe ne correspondent pas.");
      if (!validatePassword(password))
        throw new Error(
          "Le mot de passe doit contenir 8 caractères, 1 majuscule, 1 chiffre et 1 caractère spécial."
        );

      await authService.register(pseudo, email, password);

      setSuccessMsg("Compte créé avec succès ! Connectez-vous.");
      setView("LOGIN");
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (forgotStep === "EMAIL") {
        if (!validateEmail(email)) throw new Error("Email invalide.");
        const codeSent = await authService.requestPasswordReset(email);
        alert(`[SIMULATION EMAIL]\nCode: ${codeSent}`);
        setForgotStep("CODE");
        setTimeLeft(60);
      } else if (forgotStep === "CODE") {
        const isValid = await authService.verifyResetCode(email, resetCode);
        if (isValid) setForgotStep("NEW_PASSWORD");
      } else if (forgotStep === "NEW_PASSWORD") {
        if (password !== confirmPassword)
          throw new Error("Mots de passe différents.");
        if (!validatePassword(password))
          throw new Error("Mot de passe trop faible.");
        await authService.resetPassword(email, resetCode, password);
        setSuccessMsg("Mot de passe réinitialisé !");
        setView("LOGIN");
        resetState();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0518] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 right-0 w-80 h-80 bg-pink-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-display font-black tracking-tight text-white mb-2">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-500">
              TOON
            </span>
            HUNTER
          </h1>
          <p className="text-gray-400">
            {view === "LOGIN" && "Connectez-vous pour capturer vos Toons !"}
            {view === "REGISTER" && "Rejoignez la guilde"}
            {view === "FORGOT_PASSWORD" && "Récupération de compte"}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-3 mb-6 flex items-center gap-2 text-red-200 text-sm animate-pulse">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/50 rounded-xl p-3 mb-6 flex items-center gap-2 text-emerald-200 text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            {successMsg}
          </div>
        )}

        {view === "LOGIN" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/20 rounded-xl py-3 pl-10 pr-4 text-white focus:border-pink-500 focus:outline-none transition-colors"
                  placeholder="hello@exemple.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">
                  Mot de passe
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setView("FORGOT_PASSWORD");
                    setForgotStep("EMAIL");
                    resetState();
                  }}
                  className="text-xs text-pink-400 hover:text-pink-300"
                >
                  Oublié ?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/20 rounded-xl py-3 pl-10 pr-12 text-white focus:border-pink-500 focus:outline-none transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-500 hover:text-pink-400 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 mt-4 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" /> Se Connecter
                </>
              )}
            </button>

            <div className="mt-4 pt-4 border-t border-white/10 text-center">
              <button
                type="button"
                onClick={() => {
                  setView("REGISTER");
                  resetState();
                }}
                className="text-gray-400 hover:text-white text-sm font-medium"
              >
                Pas encore de compte ?{" "}
                <span className="text-pink-400 underline">Créer un compte</span>
              </button>
            </div>
          </form>
        )}

        {view === "REGISTER" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">
                Pseudo
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={pseudo}
                  onChange={(e) => setPseudo(e.target.value)}
                  className="w-full bg-black/40 border border-white/20 rounded-xl py-3 pl-10 pr-4 text-white focus:border-pink-500 focus:outline-none"
                  placeholder="Hunter"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/20 rounded-xl py-3 pl-10 pr-4 text-white focus:border-pink-500 focus:outline-none"
                  placeholder="email@exemple.com"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/20 rounded-xl py-3 pl-10 pr-12 text-white focus:border-pink-500 focus:outline-none"
                  placeholder="1Maj, 1Chiffre, 1Special"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-500 hover:text-pink-400 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">
                Confirmer
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/20 rounded-xl py-3 pl-10 pr-12 text-white focus:border-pink-500 focus:outline-none"
                  placeholder="Confirmer"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-gray-500 hover:text-pink-400 transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 mt-4 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-5 h-5" /> S'inscrire
                </>
              )}
            </button>
            <div className="mt-4 pt-4 border-t border-white/10 text-center">
              <button
                type="button"
                onClick={() => {
                  setView("LOGIN");
                  resetState();
                }}
                className="text-gray-400 hover:text-white text-sm font-medium"
              >
                Déjà un compte ?{" "}
                <span className="text-pink-400 underline">Se connecter</span>
              </button>
            </div>
          </form>
        )}

        {view === "FORGOT_PASSWORD" && (
          <form onSubmit={handleForgotFlow} className="space-y-6">
            {forgotStep === "EMAIL" && (
              <div className="space-y-2">
                <p className="text-sm text-gray-300 mb-4">
                  Entrez votre email pour recevoir un code.
                </p>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black/40 border border-white/20 rounded-xl py-3 pl-10 pr-4 text-white focus:border-pink-500 focus:outline-none"
                    placeholder="Votre email"
                  />
                </div>
              </div>
            )}
            {forgotStep === "CODE" && (
              <div className="space-y-2">
                <p className="text-sm text-gray-300">
                  Code envoyé à <b>{email}</b>
                </p>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    className="w-full bg-black/40 border border-white/20 rounded-xl py-3 pl-10 pr-4 text-white tracking-widest text-center font-mono font-bold text-xl focus:border-pink-500 focus:outline-none"
                    placeholder="000000"
                    maxLength={6}
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-orange-400 justify-center">
                  <Timer className="w-3 h-3" /> {timeLeft}s
                </div>
              </div>
            )}
            {forgotStep === "NEW_PASSWORD" && (
              <div className="space-y-4">
                <p className="text-sm text-gray-300">Nouveau mot de passe.</p>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/40 border border-white/20 rounded-xl py-3 pl-10 pr-12 text-white focus:border-pink-500 focus:outline-none"
                    placeholder="Nouveau mot de passe"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-500 hover:text-pink-400 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-black/40 border border-white/20 rounded-xl py-3 pl-10 pr-12 text-white focus:border-pink-500 focus:outline-none"
                    placeholder="Confirmer"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-gray-500 hover:text-pink-400 transition-colors"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setView("LOGIN");
                  resetState();
                }}
                className="px-4 bg-white/10 rounded-xl hover:bg-white/20 transition text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-4 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : forgotStep === "EMAIL" ? (
                  "Envoyer"
                ) : forgotStep === "CODE" ? (
                  "Vérifier"
                ) : (
                  "Sauvegarder"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
