import axios from "axios";
import { toast } from "sonner";

const defaultBackendUrl = `${window.location.protocol}//${window.location.hostname}:8000`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || defaultBackendUrl;

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

let isNetworkErrorShowing = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Erro de rede / timeout (sem response)
    if (!error.response) {
      if (!isNetworkErrorShowing) {
        isNetworkErrorShowing = true;
        toast.error("Sem conexão com o servidor. Verifique sua internet.");
        setTimeout(() => { isNetworkErrorShowing = false; }, 3000);
      }
      return Promise.reject(error);
    }

    const status = error.response?.status;

    if (status === 401) {
      const path = window.location.pathname;
      const isPublicRoute =
        path === "/" ||
        path === "/login" ||
        path === "/register" ||
        path === "/marketplace" ||
        path === "/esqueci-senha" ||
        path === "/redefinir-senha" ||
        path.startsWith("/ql/") ||
        path.startsWith("/p/") ||
        path.startsWith("/agendamento/") ||
        path === "/auth/callback";
      if (!isPublicRoute && !window.location.hash?.includes("session_id=")) {
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }

    // 429 — rate limit
    if (status === 429) {
      toast.error("Muitas tentativas. Aguarde alguns segundos e tente novamente.");
      return Promise.reject(error);
    }

    // 500+ — erro interno do servidor
    if (status >= 500) {
      toast.error("Algo deu errado no servidor. Tente novamente em instantes.");
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default api;
export { BACKEND_URL };
