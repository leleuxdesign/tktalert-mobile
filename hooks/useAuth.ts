import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trpc } from "@/lib/trpc";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

export interface AuthUser {
  id: number;
  email: string;
  role: "admin" | "user";
  subscriptionStatus: string;
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Load persisted token on mount
  useEffect(() => {
    (async () => {
      const [storedToken, storedUser] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY),
      ]);
      if (storedToken) setToken(storedToken);
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch {}
      }
      setLoading(false);
    })();
  }, []);

  const saveSession = useCallback(async (newToken: string, newUser: AuthUser) => {
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, newToken),
      AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser)),
    ]);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const clearSession = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(USER_KEY),
    ]);
    setToken(null);
    setUser(null);
  }, []);

  const isAuthenticated = !!token && !!user;
  const isAdmin = user?.role === "admin";
  const isSubscribed =
    user?.subscriptionStatus === "active" ||
    user?.subscriptionStatus === "trialing" ||
    user?.subscriptionStatus === "comped";

  return {
    token,
    user,
    loading,
    isAuthenticated,
    isAdmin,
    isSubscribed,
    saveSession,
    clearSession,
  };
}
