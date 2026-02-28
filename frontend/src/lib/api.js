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
      const isAuthRoute = window.location.pathname === "/login" || 
                          window.location.pathname === "/register" ||
                          window.location.pathname === "/";
      if (!isAuthRoute && !window.location.hash?.includes("session_id=")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
export { BACKEND_URL };
