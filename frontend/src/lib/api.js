import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

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
        path.startsWith("/p/") ||
        path.startsWith("/agendamento/");
      if (!isPublicRoute && !window.location.hash?.includes("session_id=")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
export { BACKEND_URL };
