import axios from "axios";
import { supabase } from "../lib/supabase";

const getBaseURL = () => {
  if (window.location.hostname === "localhost") {
    return "http://localhost:8000";
  }
  return `http://${window.location.hostname}:8000`;
};
// TESTING 1 2 3
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

export default api;
