import axios from "axios";

const defaultBackendUrl = `${window.location.protocol}//${window.location.hostname}:8000`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || defaultBackendUrl;

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const path = window.location.pathname;
      const isPublicRoute =
        path === "/" ||
        path === "/login" ||
        path === "/register" ||
        path === "/marketplace" ||
        path.startsWith("/ql/") ||
        path.startsWith("/p/") ||
        path.startsWith("/agendamento/") ||
        path === "/auth/callback";
      if (!isPublicRoute && !window.location.hash?.includes("session_id=")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
export { BACKEND_URL };
