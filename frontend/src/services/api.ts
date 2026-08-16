import axios from "axios";
import { supabase } from "../lib/supabase";

<<<<<<< HEAD
const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://192.168.3.12:8000",
=======
const getBaseURL = () => {
  if (window.location.hostname === "localhost") {
    return "http://localhost:8000";
  }
  return `http://${window.location.hostname}:8000`;
};

const api = axios.create({
  baseURL: getBaseURL(),
  headers: { "Content-Type": "application/json" },
>>>>>>> real
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
