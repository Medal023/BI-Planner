import React, { useState, useEffect } from "react";
import { 
  runFirebaseDiagnostics, 
  getDiagnosticDebugLogs, 
  clearDiagnosticDebugLogs, 
  logDiagnosticDebug,
  DiagnosticCheck, 
  DebugLog,
  DiagnosticSummary
} from "../lib/firebaseDiagnostics";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Terminal, 
  Globe, 
  ShieldCheck, 
  Bug, 
  Trash2, 
  ExternalLink, 
  ListChecks, 
  ChevronDown, 
  ChevronUp, 
  Cpu, 
  FileText,
  Key,
  Info
} from "lucide-react";

export default function FirebaseDiagnosticsPanel() {
  const [summary, setSummary] = useState<DiagnosticSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"status" | "logs">("status");
  const [expandedCheckId, setExpandedCheckId] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleRunDiagnostics = async () => {
    setLoading(true);
    try {
      const result = await runFirebaseDiagnostics();
      setSummary(result);
      showToast("Varredura de diagnóstico concluída com sucesso!");
    } catch (err: any) {
      console.error(err);
      showToast(`Erro durante varredura: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleRunDiagnostics();
  }, []);

  const handleClearLogs = () => {
    clearDiagnosticDebugLogs();
    if (summary) {
      setSummary({
        ...summary,
        debugLogs: []
      });
    }
    showToast("Histórico de logs de depuração apagado.");
  };

  // Generate actionable troubleshooting checklist based on failures
  const getActionableChecklist = (checks: DiagnosticCheck[]): string[] => {
    const checklist: string[] = [];
    const currentDomain = window.location.hostname;

    checks.forEach(check => {
      if (check.status === "error" || check.status === "warning") {
        if (check.id === "domain_authorized") {
          checklist.push(`Adicionar o domínio atual ("${currentDomain}") em Firebase Console > Authentication > Settings > Authorized domains.`);
        }
        if (check.id === "oauth_consent") {
          checklist.push(`Adicionar a sua conta Google como Usuário de Teste (Test User) no painel Google Cloud Console > APIs & Services > OAuth consent screen.`);
          checklist.push("Publicar a Tela de Consentimento OAuth (passar de 'Testing' para 'In Production') quando o aplicativo for para produção.");
        }
        if (check.id === "google_login") {
          checklist.push("Ativar o provedor Google Sign-In no painel do Firebase Console > Authentication > Sign-in method.");
        }
        if (check.id === "email_password") {
          checklist.push("Ativar o provedor de Email/Senha no painel do Firebase Console > Authentication > Sign-in method.");
        }
        if (check.id === "phone_auth") {
          checklist.push("Ativar o provedor de Autenticação por Telefone (SMS) no Firebase Console.");
        }
        if (check.id === "firestore_avail") {
          checklist.push("Verificar se as regras do Firestore (firestore.rules) estão publicadas e corretas.");
          checklist.push("Garantir que a instância de banco do Firestore com ID configurado foi provisionada.");
        }
        if (check.id === "firebase_init") {
          checklist.push("Configurar as credenciais do Firebase em 'firebase-applet-config.json'.");
        }
      }
    });

    return checklist;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-500 shrink-0" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />;
      default:
        return <RefreshCw className="h-5 w-5 text-gray-400 animate-spin shrink-0" />;
    }
  };

  const currentHostname = window.location.hostname;
  const checklist = summary ? getActionableChecklist(summary.checks) : [];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl text-slate-100 font-sans" id="firebase-diagnostics-card">
      {/* Toast banner */}
      {toast && (
        <div className="bg-indigo-600 text-white px-4 py-2 text-xs text-center font-semibold animate-pulse border-b border-indigo-500 flex items-center justify-center gap-2">
          <Info className="h-4 w-4" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header Panel */}
      <div className="p-6 bg-slate-900/90 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-indigo-400" />
            <h2 className="text-xl font-bold tracking-tight text-white font-display">
              Diagnóstico do Ambiente Firebase & OAuth
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Auditoria em tempo real de conexão, provedores de autenticação, consentimento do Google e acessibilidade da API.
          </p>
        </div>

        <button
          onClick={handleRunDiagnostics}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Verificando..." : "Executar Diagnóstico"}
        </button>
      </div>

      {/* Internal Environment Overview Banner */}
      <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1.5 text-slate-300">
          <Globe className="h-4 w-4 text-slate-500" />
          <span className="font-semibold text-slate-400">Domínio Atual:</span>
          <span className="font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">{currentHostname}</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-300">
          <Cpu className="h-4 w-4 text-slate-500" />
          <span className="font-semibold text-slate-400">Estado de Rede:</span>
          <span className={`font-semibold ${summary?.isOnline ? "text-emerald-400" : "text-red-400"}`}>
            {summary?.isOnline ? "CONECTADO (ONLINE)" : "DESCONECTADO (OFFLINE)"}
          </span>
        </div>
      </div>

      {/* Navigation Subtabs */}
      <div className="flex border-b border-slate-800 bg-slate-950/40 text-xs">
        <button
          onClick={() => setActiveTab("status")}
          className={`flex-1 sm:flex-none px-6 py-3 text-center font-bold tracking-wide uppercase transition-all cursor-pointer border-b-2 ${
            activeTab === "status" 
              ? "border-indigo-500 text-indigo-400 bg-slate-900/30" 
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <ListChecks className="h-4 w-4" />
            Checagens de Status ({summary?.checks.length || 0})
          </span>
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`flex-1 sm:flex-none px-6 py-3 text-center font-bold tracking-wide uppercase transition-all cursor-pointer border-b-2 ${
            activeTab === "logs" 
              ? "border-indigo-500 text-indigo-400 bg-slate-900/30" 
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Terminal className="h-4 w-4" />
            Logs de Depuração ({summary?.debugLogs.length || 0})
          </span>
        </button>
      </div>

      {/* Primary Panels */}
      <div className="p-6">
        {activeTab === "status" && (
          <div className="space-y-6">
            
            {/* Checks Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {summary?.checks.map((check) => {
                const isExpanded = expandedCheckId === check.id;
                const hasIssues = check.status === "error" || check.status === "warning";
                
                return (
                  <div 
                    key={check.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      check.status === "success" 
                        ? "bg-slate-900/40 border-slate-800/80 hover:border-slate-800" 
                        : check.status === "error"
                        ? "bg-red-950/10 border-red-900/40 hover:border-red-900/60"
                        : "bg-amber-950/10 border-amber-900/40 hover:border-amber-900/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{getStatusIcon(check.status)}</div>
                        <div>
                          <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                            {check.name}
                            {check.status === "success" && (
                              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-normal">
                                OK
                              </span>
                            )}
                          </h4>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                            {check.message}
                          </p>
                        </div>
                      </div>
                      
                      {hasIssues && (
                        <button
                          onClick={() => setExpandedCheckId(isExpanded ? null : check.id)}
                          className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-all cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      )}
                    </div>

                    {/* Expandable Fix steps */}
                    {isExpanded && check.fixSteps && (
                      <div className="mt-4 p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 text-xs animate-fade-in">
                        <p className="font-semibold text-amber-400 mb-2 flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Como corrigir este problema:
                        </p>
                        <ol className="list-decimal pl-4 space-y-1.5 text-slate-300">
                          {check.fixSteps.map((step, idx) => (
                            <li key={idx} className="leading-relaxed">
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Actionable Solution Checklist Card */}
            {checklist.length > 0 && (
              <div className="p-5 bg-gradient-to-br from-indigo-950/20 to-indigo-900/5 border border-indigo-500/20 rounded-2xl animate-fade-in">
                <div className="flex items-center gap-2 text-indigo-400 mb-3">
                  <ListChecks className="h-5 w-5" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">
                    Plano de Ação para Correção de Erros
                  </h3>
                </div>
                <p className="text-xs text-slate-300 mb-4">
                  O sistema de inteligência detectou configurações pendentes ou incorretas. Siga o passo a passo abaixo no seu painel para normalizar a operação do SaaS:
                </p>
                <div className="space-y-3">
                  {checklist.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800/60">
                      <div className="h-5 w-5 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="text-xs text-slate-200 font-sans leading-relaxed">
                        {item}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Systems Operational Card */}
            {checklist.length === 0 && summary && (
              <div className="p-6 bg-emerald-950/10 border border-emerald-500/20 rounded-2xl text-center">
                <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white font-display">Tudo operacional!</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                  Todos os módulos de autenticação, conexão de dados Firestore, rotas de API no Cloud Run e domínios foram verificados e estão operando a 100%.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "logs" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Fila de logs gerados em tempo real (DEBUG)</span>
              <button
                onClick={handleClearLogs}
                disabled={!summary?.debugLogs || summary.debugLogs.length === 0}
                className="text-[10px] hover:text-red-400 disabled:opacity-30 disabled:hover:text-slate-500 transition-all flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpar Logs
              </button>
            </div>

            {(!summary?.debugLogs || summary.debugLogs.length === 0) ? (
              <div className="h-48 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center p-4 text-slate-500 gap-2">
                <Terminal className="h-8 w-8 text-slate-700 animate-pulse" />
                <span className="text-xs">Nenhum log de diagnóstico gerado nesta sessão.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {summary.debugLogs.map((log: DebugLog, idx) => {
                  const isExpanded = expandedLogId === `${log.timestamp}-${idx}`;
                  const hasError = !!log.errorMessage || !!log.errorCode;
                  
                  return (
                    <div 
                      key={idx}
                      className={`border rounded-xl p-3.5 transition-all text-xs font-mono leading-relaxed ${
                        hasError 
                          ? "bg-red-950/5 border-red-950/40 hover:border-red-900/50" 
                          : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-[10px]">
                            <span className="text-slate-500">
                              {new Date(log.timestamp).toLocaleTimeString("pt-BR")}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full font-bold font-sans uppercase tracking-wider text-[8px] ${
                              hasError 
                                ? "bg-red-500/10 text-red-400" 
                                : "bg-emerald-500/10 text-emerald-400"
                            }`}>
                              {log.action}
                            </span>
                            <span className="text-slate-500">
                              Projeto: {log.projectId}
                            </span>
                          </div>
                          
                          <div className="text-slate-300 flex items-center gap-1.5 font-semibold text-xs font-sans">
                            {hasError ? (
                              <span className="text-red-400">Falha detectada</span>
                            ) : (
                              <span className="text-emerald-400">Sucesso</span>
                            )}
                            <span className="text-slate-500 font-mono">({log.domain})</span>
                          </div>

                          {log.errorMessage && (
                            <p className="text-red-400 bg-red-950/30 p-2 rounded border border-red-900/30 font-mono text-[11px] break-all max-w-full">
                              Code: {log.errorCode || "N/A"} | {log.errorMessage}
                            </p>
                          )}
                        </div>

                        {(log.stackTrace || log.uid) && (
                          <button
                            onClick={() => setExpandedLogId(isExpanded ? null : `${log.timestamp}-${idx}`)}
                            className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-all cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="mt-3.5 pt-3.5 border-t border-slate-800/80 text-[10px] text-slate-400 space-y-2 animate-fade-in">
                          {log.uid && (
                            <div>
                              <span className="font-bold text-slate-500">USER UID:</span> {log.uid} 
                              {log.userEmail && <span className="text-slate-500"> ({log.userEmail})</span>}
                            </div>
                          )}
                          {log.loginMethod && (
                            <div>
                              <span className="font-bold text-slate-500">METHOD:</span> {log.loginMethod}
                            </div>
                          )}
                          {log.stackTrace && (
                            <div className="space-y-1">
                              <span className="font-bold text-slate-500 block">STACK TRACE:</span>
                              <pre className="bg-slate-950/95 p-3 rounded border border-slate-800 text-[9px] text-slate-500 overflow-x-auto break-words whitespace-pre-wrap leading-tight">
                                {log.stackTrace}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
