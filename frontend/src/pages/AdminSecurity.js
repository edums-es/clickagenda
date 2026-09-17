import { useEffect, useState } from "react";
import api from "@/lib/api";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function AdminSecurity() {
  const [status, setStatus] = useState(null);
  useEffect(() => { api.get("/admin/security/status").then((res) => setStatus(res.data)).catch(() => toast.error("Não foi possível carregar o status de segurança.")); }, []);
  if (!status) return <div className="p-8 text-sm text-muted-foreground">Carregando segurança...</div>;
  const checks = [["Storage de imagens", status.storage_ready ? "Ativo" : "Pendente"], ["Estrutura comercial", status.commercial_schema_ready ? "Migração 0002 aplicada" : "Migração 0002 pendente"], ["CORS", status.cors_configured ? "Configurado" : "Local / pendente"], ["Allowlist superadmin", status.superadmin_allowlist ? "Configurada" : "Pendente"], ["Limite de login", status.auth_rate_limit], ["Limite de reservas", status.booking_rate_limit], ["Sessão", status.session_cookie]];
  return <div className="max-w-3xl mx-auto space-y-7"><div><p className="text-xs font-black uppercase tracking-widest text-primary">Governança</p><h1 className="text-3xl font-black font-heading">Segurança da plataforma</h1><p className="mt-2 text-muted-foreground">Ambiente atual: <strong className="capitalize">{status.environment}</strong>.</p></div><section className="rounded-3xl border bg-white overflow-hidden">{checks.map(([label, value]) => <div key={label} className="p-5 border-b last:border-0 flex items-start justify-between gap-5"><div className="flex gap-3"><ShieldCheck className="h-5 w-5 text-primary mt-0.5"/><span className="font-bold text-sm">{label}</span></div><span className="text-right text-sm text-slate-500 max-w-xs">{value}</span></div>)}</section><p className="text-xs text-muted-foreground">Em produção, configure CORS e HTTPS antes de abrir o sistema ao público.</p></div>;
}
