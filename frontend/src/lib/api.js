git add .import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// attach token from localStorage as fallback (for environments where cookies get lost)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("tredev_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// backend not deployed yet -> misrouted requests resolve with the SPA's index.html
// (a string) instead of JSON; turn that into a rejection so existing .catch() paths handle it
api.interceptors.response.use((response) => {
  if (typeof response.data === "string") {
    return Promise.reject(new Error("Backend unavailable: expected JSON, got non-JSON response"));
  }
  return response;
});

export default api;

export function formatApiError(err) {
  const detail = err?.response?.data?.detail;
  if (!detail) return err?.message || "Something went wrong";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  return String(detail);
}
