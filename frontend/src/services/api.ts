import axios from "axios";
import { PPMP, PPMPItem } from "../types/ppmp";

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://192.168.2.2:8000",
});

// Attach JWT token to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --- Auth ---
export const login = (username: string, password: string) => {
  const formData = new URLSearchParams();
  formData.append("username", username);
  formData.append("password", password);

  return API.post("/auth/login", formData, {
    // ← use API not axios
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
};
export const register = (username: string, password: string) =>
  API.post("/auth/register", { username, password });

// --- PPMP ---
export const getPPMPs = () => API.get<PPMP[]>("/ppmp");
export const getPPMP = (id: number) => API.get<PPMP>(`/ppmp/${id}`);
export const createPPMP = (data: PPMP) => API.post<PPMP>("/ppmp", data);
export const updatePPMP = (id: number, data: PPMP) =>
  API.put<PPMP>(`/ppmp/${id}`, data);
export const deletePPMP = (id: number) => API.delete(`/ppmp/${id}`);

// --- Items ---
export const addItem = (ppmpId: number, item: PPMPItem) =>
  API.post<PPMPItem>(`/ppmp/${ppmpId}/items`, item);
export const updateItem = (ppmpId: number, itemId: number, item: PPMPItem) =>
  API.put<PPMPItem>(`/ppmp/${ppmpId}/items/${itemId}`, item);
export const deleteItem = (ppmpId: number, itemId: number) =>
  API.delete(`/ppmp/${ppmpId}/items/${itemId}`);

// --- Export ---
export const exportExcel = (id: number) =>
  API.get(`/ppmp/${id}/export/excel`, { responseType: "blob" });
export const exportPDF = (id: number) =>
  API.get(`/ppmp/${id}/export/pdf`, { responseType: "blob" });

export default API;
