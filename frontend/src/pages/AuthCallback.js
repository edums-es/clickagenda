import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function AuthCallback() {
  const { googleAuth } = useAuth();
  const navigate = useNavigate();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Use useRef to prevent double processing under StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace("#", "?"));
    const sessionId = params.get("session_id");

    if (!sessionId) {
      toast.error("Erro na autenticacao");
      navigate("/login", { replace: true });
      return;
    }

    const processAuth = async () => {
      try {
        const data = await googleAuth(sessionId);
        toast.success(`Bem-vindo, ${data.user.name}!`);
        navigate("/dashboard", { replace: true, state: { user: data.user } });
      } catch (err) {
        toast.error("Erro ao processar login com Google");
        navigate("/login", { replace: true });
      }
    };

    processAuth();
  }, [googleAuth, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground text-sm">Autenticando...</p>
      </div>
    </div>
  );
}
