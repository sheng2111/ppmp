import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { login as apiLogin } from "../services/api";

interface AuthContextType {
  user: string | null;
  fullName: string | null; // ✅ add
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fullName, setFullName] = useState<string | null>(null); // ✅

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    const savedFullName = localStorage.getItem("full_name"); // ✅
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(savedUser);
    }
    if (savedFullName) setFullName(savedFullName); // ✅
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const res = await apiLogin(username, password);
    const { access_token } = res.data;
    localStorage.setItem("token", access_token);
    localStorage.setItem("user", username);
    setToken(access_token);
    setUser(username);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("full_name"); // ✅
    setToken(null);
    setUser(null);
    setFullName(null); // ✅
  };

  return (
    // ✅ add fullName to value
    <AuthContext.Provider
      value={{ user, fullName, token, isLoading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
