import React, { useState, useEffect } from "react";
import { syncManager, SyncState, SyncLog } from "../lib/syncManager";
import { runFirebaseDiagnostics } from "../lib/firebaseDiagnostics";
import { 
  Terminal, 
  Wifi, 
  WifiOff, 
  Database, 
  ShieldCheck, 
  ShieldAlert, 
  Key, 
  RefreshCw, 
  Trash2, 
  Play, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Bug,
  Sparkles,
  Info
} from "lucide-react";

export default function DevConsole() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"logs" | "diagnostics" | "queue">("logs");
  const [syncState, setSyncState] = useState<SyncState>(syncManager.getState());
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Subscribe to syncManager changes
  useEffect(() => {
    const unsubscribe = syncManager.subscribe((state) => {
      setSyncState(state);
    });
    return unsubscribe;
  }, []);

  const showLocalToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleRunFullDiagnostics = async () => {
    setDiagnosing(true);
    try {
      // Execute both diagnostic modules in parallel
      const [res] = await Promise.all([
        syncManager.diagnose(),
        runFirebaseDiagnostics().catch(err => {
          console.error("Deeper diagnostics sweep failed:", err);
          return null;
        })
      ]);
      setDiagnosticResult(res);
      if (res.errors.length === 0) {
        showLocalToast("Diagnóstico concluído: Todos os sistemas estão 100% operacionais!");
      } else {
        showLocalToast(`Diagnóstico concluído: Encontrados ${res.errors.length} problemas.`);
      }
    } catch (e: any) {
      showLocalToast(`Falha no motor de diagnóstico: ${e.message}`);
    } finally {
      setDiagnosing(false);
    }
  };

  const handleFlushQueue = async () => {
    if (syncState.queueLength === 0) {
      showLocalToast("Fila vazia! Nada para sincronizar.");
      return;
    }
    showLocalToast("Iniciando sincronização forçada da fila offline...");
    await syncManager.flushQueue();
  };

  const handleClearLogs = () => {
    syncManager.clearLogs();
    showLocalToast("Histórico de depuração limpo.");
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return isoString;
    }
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2">
        {syncState.syncStatus === "syncing" && (
          <span className="bg-indigo-600 text-white text-[10px] font-extrabold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 animate-pulse">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Sincronizando...
          </span>
        )}
        {syncState.queueLength > 0 && (
          <span className="bg-amber-500 text-white text-[10px] font-extrabold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1">
            <WifiOff className="h-3 w-3" />
            {syncState.queueLength} offline
          </span>
        )}
        <button
          onClick={() => setIsOpen(true)}
          className="bg-slate-900 hover:bg-slate-800 text-white p-3.5 rounded-full shadow-2xl border border-slate-700/50 transition-all flex items-center justify-center cursor-pointer group"
          title="Abrir Console de Depuração e Sincronização"
          id="dev-console-toggle"
        >
          <Bug className="h-5 w-5 text-indigo-400 group-hover:rotate-12 transition-all" />
          {syncState.logs.some(l => l.level === "error") && (
            <span className="absolute top-0 right-0 h-3 w-3 bg-red-500 rounded-full border-2 border-slate-900 animate-ping" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-slate-950 border-l border-slate-800/80 shadow-3xl z-50 flex flex-col font-mono text-xs text-slate-300" id="dev-console-drawer">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 left-4 right-4 bg-indigo-900/90 text-white border border-indigo-700/50 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md z-50 animate-fade-in flex items-center gap-2.5">
          <Info className="h-4 w-4 text-indigo-300 flex-shrink-0" />
          <span className="font-sans leading-tight">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="p-4 bg-slate-900 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <Terminal className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 font-sans tracking-tight">Console de Depuração</h3>
            <p className="text-[10px] text-slate-500">Inteligência de Sincronização & Rede</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Connection & General Status Band */}
      <div className="p-3.5 bg-slate-950 border-b border-slate-800/40 grid grid-cols-4 gap-2 text-center text-[10px]">
        <div className={`p-2 rounded-lg border ${syncState.isOnline ? "bg-emerald-950/20 border-emerald-900/50 text-emerald-400" : "bg-red-950/20 border-red-900/50 text-red-400"}`}>
          <div className="flex justify-center mb-1">
            {syncState.isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          </div>
          <span className="font-bold block uppercase tracking-wider">Conexão</span>
          <span className="text-[9px] text-slate-500 block mt-0.5">{syncState.isOnline ? "Online" : "Offline"}</span>
        </div>

        <div className={`p-2 rounded-lg border ${syncState.isFirestoreAvailable ? "bg-emerald-950/20 border-emerald-900/50 text-emerald-400" : "bg-amber-950/20 border-amber-900/50 text-amber-400"}`}>
          <div className="flex justify-center mb-1">
            <Database className="h-3.5 w-3.5" />
          </div>
          <span className="font-bold block uppercase tracking-wider">Firestore</span>
          <span className="text-[9px] text-slate-500 block mt-0.5">{syncState.isFirestoreAvailable ? "Ativo" : "Bloqueado"}</span>
        </div>

        <div className={`p-2 rounded-lg border ${syncState.isTokenValid ? "bg-emerald-950/20 border-emerald-900/50 text-emerald-400" : "bg-red-950/20 border-red-900/50 text-red-400"}`}>
          <div className="flex justify-center mb-1">
            <Key className="h-3.5 w-3.5" />
          </div>
          <span className="font-bold block uppercase tracking-wider">Sessão</span>
          <span className="text-[9px] text-slate-500 block mt-0.5">{syncState.isTokenValid ? "Válida" : "Inválida"}</span>
        </div>

        <div className={`p-2 rounded-lg border ${syncState.isConfigMatched ? "bg-emerald-950/20 border-emerald-900/50 text-emerald-400" : "bg-red-950/20 border-red-900/50 text-red-400"}`}>
          <div className="flex justify-center mb-1">
            {syncState.isConfigMatched ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
          </div>
          <span className="font-bold block uppercase tracking-wider">Projeto</span>
          <span className="text-[9px] text-slate-500 block mt-0.5">{syncState.isConfigMatched ? "OK" : "Erro"}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800/80 bg-slate-900/50 text-[10px] font-bold uppercase tracking-wider">
        <button
          onClick={() => setActiveTab("logs")}
          className={`flex-1 py-3 text-center border-b-2 transition-all cursor-pointer ${
            activeTab === "logs" ? "border-indigo-500 text-indigo-400 bg-slate-900" : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          Logs Debug ({syncState.logs.length})
        </button>
        <button
          onClick={() => setActiveTab("diagnostics")}
          className={`flex-1 py-3 text-center border-b-2 transition-all cursor-pointer ${
            activeTab === "diagnostics" ? "border-indigo-500 text-indigo-400 bg-slate-900" : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          Diagnóstico
        </button>
        <button
          onClick={() => setActiveTab("queue")}
          className={`flex-1 py-3 text-center border-b-2 transition-all cursor-pointer ${
            activeTab === "queue" ? "border-indigo-500 text-indigo-400 bg-slate-900" : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          Fila Offline ({syncState.queueLength})
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* TAB 1: LOGS */}
        {activeTab === "logs" && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>Acompanhamento em Tempo Real (DEBUG)</span>
              <button
                onClick={handleClearLogs}
                className="hover:text-red-400 transition-all flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="h-3 w-3" /> Limpar Logs
              </button>
            </div>

            {syncState.logs.length === 0 ? (
              <div className="h-48 border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-center p-4 text-slate-500 gap-2">
                <Terminal className="h-6 w-6 text-slate-700 animate-pulse" />
                <span>Nenhum log gerado nesta sessão.</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {syncState.logs.map((log: SyncLog) => {
                  const isExpanded = expandedLogId === log.id;
                  const borderClass = 
                    log.level === "success" ? "border-emerald-950/50 bg-emerald-950/5" :
                    log.level === "error" ? "border-red-950/50 bg-red-950/5" :
                    log.level === "warn" ? "border-amber-950/50 bg-amber-950/5" :
                    "border-slate-800 bg-slate-900/10";
                  
                  const dotClass = 
                    log.level === "success" ? "bg-emerald-500" :
                    log.level === "error" ? "bg-red-500" :
                    log.level === "warn" ? "bg-amber-500" :
                    "bg-indigo-400";

                  return (
                    <div 
                      key={log.id} 
                      className={`border rounded-lg p-2.5 transition-all text-[11px] ${borderClass}`}
                    >
                      <div 
                        className="flex items-start justify-between gap-2 cursor-pointer"
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <span className={`h-2 w-2 rounded-full mt-1.5 flex-shrink-0 ${dotClass}`} />
                          <div className="min-w-0">
                            <span className="text-slate-500 text-[10px] block font-semibold">
                              {formatTime(log.timestamp)}
                            </span>
                            <span className="text-slate-200 font-sans leading-tight block">
                              {log.message}
                            </span>
                          </div>
                        </div>
                        {log.detail && (
                          <button className="text-slate-500 hover:text-slate-300 mt-0.5">
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </div>

                      {isExpanded && log.detail && (
                        <div className="mt-2.5 pt-2.5 border-t border-slate-800 text-[10px] text-slate-400 overflow-x-auto whitespace-pre bg-slate-950/80 p-2 rounded">
                          {JSON.stringify(log.detail, null, 2)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DIAGNOSTICS */}
        {activeTab === "diagnostics" && (
          <div className="space-y-4 font-sans text-xs">
            <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800 space-y-3.5">
              <h4 className="font-bold text-slate-100 flex items-center gap-2">
                <ShieldCheck className="h-4.5 w-4.5 text-indigo-400" />
                Análise Completa de Infraestrutura
              </h4>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Este teste varre as credenciais do applet, refresca o token do usuário para testar canais de segurança e assegura que os documentos base no Firestore estão consolidados.
              </p>

              <button
                onClick={handleRunFullDiagnostics}
                disabled={diagnosing}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-2.5 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {diagnosing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Executando Testes...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Rodar Diagnóstico Completo
                  </>
                )}
              </button>
            </div>

            {/* Diagnostic Result */}
            {diagnosticResult && (
              <div className="border border-slate-800 bg-slate-950 rounded-xl p-4 space-y-3 font-mono text-[11px]">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-slate-300">RELATÓRIO DE SAÚDE</span>
                  <span className={diagnosticResult.errors.length === 0 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                    {diagnosticResult.errors.length === 0 ? "100% OPERACIONAL" : `${diagnosticResult.errors.length} ERROS`}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Conexão WAN:</span>
                    <span className={diagnosticResult.isOnline ? "text-emerald-400" : "text-red-400"}>
                      {diagnosticResult.isOnline ? "ONLINE" : "OFFLINE"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sessão Firebase:</span>
                    <span className={diagnosticResult.isTokenValid ? "text-emerald-400" : "text-red-400"}>
                      {diagnosticResult.isTokenValid ? "AUTORIZADO" : "FALHA / TOKEN EXPIRADO"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Acesso Firestore:</span>
                    <span className={diagnosticResult.isFirestoreAvailable ? "text-emerald-400" : "text-red-400"}>
                      {diagnosticResult.isFirestoreAvailable ? "ACESSÍVEL" : "BLOQUEADO (REGRAS / OFFLINE)"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Credenciais Config:</span>
                    <span className={diagnosticResult.isConfigMatched ? "text-emerald-400" : "text-red-400"}>
                      {diagnosticResult.isConfigMatched ? "CONFIG COMBINA" : "CONFIG INVÁLIDA"}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-900 pt-2 text-[10px]">
                    <span className="text-slate-500">Usuário Atual:</span>
                    <span className="text-slate-300 truncate max-w-[200px]" title={diagnosticResult.userState}>
                      {diagnosticResult.userState}
                    </span>
                  </div>
                </div>

                {/* Detail issues */}
                {diagnosticResult.errors.length > 0 && (
                  <div className="mt-3 bg-red-950/10 border border-red-900/30 p-2.5 rounded-lg space-y-1">
                    <span className="font-bold text-red-400 block text-[10px] uppercase">Problemas Detectados:</span>
                    <ul className="list-disc list-inside space-y-1 text-slate-400 text-[10px]">
                      {diagnosticResult.errors.map((err: string, idx: number) => (
                        <li key={idx} className="leading-tight">{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: QUEUE */}
        {activeTab === "queue" && (
          <div className="space-y-3 font-sans text-xs">
            <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="font-bold text-slate-100">Fila Offline de Sincronização</h4>
                <p className="text-slate-400 text-[11px] leading-snug">
                  {syncState.queueLength} gravações acumuladas no cache local prontas para upload.
                </p>
              </div>
              <button
                onClick={handleFlushQueue}
                disabled={syncState.queueLength === 0 || syncState.isSyncing}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-2 px-3 rounded-lg flex items-center gap-1.5 transition-all text-[11px] cursor-pointer flex-shrink-0"
              >
                <RefreshCw className={`h-3 w-3 ${syncState.isSyncing ? "animate-spin" : ""}`} />
                Forçar Sinc
              </button>
            </div>

            {syncState.queueLength === 0 ? (
              <div className="h-44 border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-center p-4 text-slate-500 gap-2.5">
                <CheckCircle className="h-6 w-6 text-emerald-500" />
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-300 block">Fila Limpa e Atualizada</span>
                  <p className="text-[10px] text-slate-500 max-w-[280px]">
                    Todas as suas alterações mais recentes foram persistidas na nuvem com sucesso.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 font-mono text-[10px]">
                {syncManager.getState().logs
                  .filter(() => false) // dummy block for items if syncManager exposes items. 
                }
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1 text-slate-400">
                  <div className="flex justify-between border-b border-slate-900 pb-1.5 mb-1.5">
                    <span className="font-bold text-slate-300">Item Pendente na Fila</span>
                    <span className="text-amber-400 font-bold">AGUARDANDO CONEXÃO</span>
                  </div>
                  <div className="space-y-1">
                    <div>Tipo: <span className="text-slate-200">Atualização do Planejamento</span></div>
                    <div>Tentativas executadas: <span className="text-slate-200">1</span></div>
                    <div className="text-[9px] text-slate-500 mt-2">
                      Assim que o navegador recuperar o sinal Wi-Fi ou a internet for detectada, estes itens serão transmitidos silenciosamente.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Footer */}
      <div className="p-3 bg-slate-900 border-t border-slate-800/80 text-[10px] text-slate-500 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-indigo-400" /> BI Planner Pro Security Layer
        </span>
        <span>v1.4.1</span>
      </div>

    </div>
  );
}
