import React, { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";
import { signInWithGoogle } from "@/lib/firebaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMe(); }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (data.token) localStorage.setItem("tredev_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const loginWithGoogle = async () => {
    const idToken = await signInWithGoogle();
    const { data } = await api.post("/auth/google", { id_token: idToken });
    if (data.token) localStorage.setItem("tredev_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (email, password) => {
    // No auto-login here — the account isn't usable until the emailed OTP is verified.
    // Name is collected afterwards via completeProfile(), once the code is confirmed.
    const { data } = await api.post("/auth/register", { email, password });
    return data;
  };

  const resendVerification = async (email, password) => {
    const { data } = await api.post("/auth/resend-verification", { email, password });
    return data;
  };

  const verifyOtp = async (email, code) => {
    const { data } = await api.post("/auth/verify-otp", { email, code });
    return data;
  };

  const completeProfile = async (name, phone) => {
    const { data } = await api.post("/auth/complete-profile", { name, phone: phone || null });
    setUser(data.user);
    return data.user;
  };

  const loginWithPhone = async (idToken, extra) => {
    const { data } = await api.post("/auth/phone", { id_token: idToken, ...extra });
    if (data.token) localStorage.setItem("tredev_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("tredev_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, loginWithPhone, register, resendVerification, verifyOtp, completeProfile, logout, refresh: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
