import React, { useState, useEffect } from "react";
import { IncomeProfile, ExtraIncome, IncomeHistoryEntry } from "../types";
import { User } from "firebase/auth";
import { 
  Wallet, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Clock, 
  Sparkles, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle,
  TrendingUp,
  RotateCcw,
  PlusCircle
} from "lucide-react";
import { saveUserIncomeProfile, loadUserIncomeProfile } from "../firebase";
import { syncManager } from "../lib/syncManager";

interface IncomeProfileComponentProps {
  user: User;
  onIncomeChanged: (newRendaTotal: number) => void;
}

const POPULAR_SOURCES = [
  "Freelancer",
  "Aluguel",
  "Investimentos",
  "Comissões",
  "13º Salário",
  "Bônus",
  "Outro"
];

export default function IncomeProfileComponent({ user, onIncomeChanged }: IncomeProfileComponentProps) {
  // Database state
  const [profile, setProfile] = useState<IncomeProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  
  // Form states
  const [salarioBase, setSalarioBase] = useState<number>(0);
  const [frequencia, setFrequencia] = useState<IncomeProfile["frequencia"]>("Mensal");
  const [rendasExtras, setRendasExtras] = useState<ExtraIncome[]>([]);

  // Add extra income form state
  const [newSourceName, setNewSourceName] = useState<string>("Freelancer");
  const [customSourceName, setCustomSourceName] = useState<string>("");
  const [newSourceValue, setNewSourceValue] = useState<string>("");

  // Editing extra income state
  const [editingExtraId, setEditingExtraId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [editingValue, setEditingValue] = useState<string>("");

  // Confirmation dialog state
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // Toasts
  const [toastSuccess, setToastSuccess] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);

  // Load profile from Firestore on mount/user change
  useEffect(() => {
    async function fetchProfile() {
      setLoading(true);
      try {
        const data = await loadUserIncomeProfile(user.uid);
        if (data) {
          const loadedProfile = data as IncomeProfile;
          setProfile(loadedProfile);
          setSalarioBase(loadedProfile.salarioBase);
          setFrequencia(loadedProfile.frequencia);
          setRendasExtras(loadedProfile.rendasExtras || []);
        } else {
          // Initialize empty profile
          const defaultProfile: IncomeProfile = {
            salarioBase: 1550.00, // Default starting salary matching template
            rendasExtras: [],
            rendaTotal: 1550.00,
            frequencia: "Mensal",
            ultimaAtualizacao: new Date().toISOString(),
            usuario: user.uid,
            historico: []
          };
          setProfile(defaultProfile);
          setSalarioBase(defaultProfile.salarioBase);
          setFrequencia(defaultProfile.frequencia);
          setRendasExtras(defaultProfile.rendasExtras);
        }
      } catch (err: any) {
        console.error("Erro ao carregar perfil de renda:", err);
        showToast("error", "Erro ao carregar perfil de renda do banco de dados.");
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [user.uid]);

  const showToast = (type: "success" | "error", message: string) => {
    if (type === "success") {
      setToastSuccess(message);
      setTimeout(() => setToastSuccess(null), 4000);
    } else {
      setToastError(message);
      setTimeout(() => setToastError(null), 4000);
    }
  };

  // Calculations
  const somaRendasExtras = rendasExtras.reduce((acc, curr) => acc + curr.valor, 0);
  const rendaTotalCalculada = salarioBase + somaRendasExtras;

  // Formatting helpers
  const formatBRL = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  // Add extra income handler
  const handleAddExtraIncome = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = newSourceName === "Outro" ? customSourceName.trim() : newSourceName;
    
    if (!finalName) {
      showToast("error", "Por favor, insira o nome da fonte de renda extra.");
      return;
    }

    const valNum = parseFloat(newSourceValue.replace(",", "."));
    if (isNaN(valNum) || valNum <= 0) {
      showToast("error", "O valor da renda extra deve ser um número positivo e maior que zero.");
      return;
    }

    const newItem: ExtraIncome = {
      id: `extra-${Date.now()}`,
      nome: finalName,
      valor: valNum
    };

    setRendasExtras([...rendasExtras, newItem]);
    setNewSourceValue("");
    setCustomSourceName("");
    showToast("success", `Renda extra "${finalName}" adicionada temporariamente. Salve o perfil para persistir.`);
  };

  // Delete extra income
  const handleDeleteExtraIncome = (id: string) => {
    const filtered = rendasExtras.filter(item => item.id !== id);
    setRendasExtras(filtered);
    showToast("success", "Renda extra removida temporariamente. Salve o perfil para persistir.");
  };

  // Start editing extra income
  const handleStartEditExtra = (item: ExtraIncome) => {
    setEditingExtraId(item.id);
    setEditingName(item.nome);
    setEditingValue(item.valor.toString());
  };

  // Save edited extra income
  const handleSaveEditExtra = () => {
    if (!editingName.trim()) {
      showToast("error", "O nome da renda extra não pode ser vazio.");
      return;
    }

    const valNum = parseFloat(editingValue.replace(",", "."));
    if (isNaN(valNum) || valNum <= 0) {
      showToast("error", "O valor da renda extra deve ser maior que zero.");
      return;
    }

    const updated = rendasExtras.map(item => {
      if (item.id === editingExtraId) {
        return { ...item, nome: editingName.trim(), valor: valNum };
      }
      return item;
    });

    setRendasExtras(updated);
    setEditingExtraId(null);
    showToast("success", "Renda extra atualizada temporariamente.");
  };

  // Prepare Save & open confirmation modal
  const handlePreSave = () => {
    // Validations
    if (salarioBase <= 0) {
      showToast("error", "O Salário Base deve ser um valor positivo e maior que zero.");
      return;
    }

    setShowConfirmModal(true);
  };

  // Confirm Save to Firestore
  const handleConfirmSave = async () => {
    setShowConfirmModal(false);
    setSaving(true);
    setSyncing(true);

    // DEBUG: Registra início do processo no Console de Depuração
    syncManager.addLog("info", "[PERFIL DE RENDA] Iniciando fluxo completo de persistência...", {
      salarioBase,
      somaRendasExtras,
      rendaTotalCalculada
    });

    try {
      // Passo 1: Validar usuário autenticado
      syncManager.addLog("info", "[PERFIL DE RENDA] Passo 1: Validando usuário autenticado...");
      if (!user) {
        showToast("error", "Erro de autenticação: Usuário não autenticado.");
        syncManager.addLog("error", "[PERFIL DE RENDA] Falha: Usuário nulo ou não autenticado.");
        return;
      }

      // Passo 2: Validar UID
      syncManager.addLog("info", `[PERFIL DE RENDA] Passo 2: Validando UID do usuário (${user.uid})...`);
      if (!user.uid || typeof user.uid !== "string" || user.uid.trim() === "") {
        showToast("error", "Erro de segurança: UID do usuário inválido ou inexistente.");
        syncManager.addLog("error", "[PERFIL DE RENDA] Falha: UID do usuário é inválido.");
        return;
      }

      // Passo 3 e 4: Validar e garantir a existência do documento do usuário
      syncManager.addLog("info", "[PERFIL DE RENDA] Passo 3 e 4: Validando e criando documentos base de forma resiliente...");

      const now = new Date();
      const previousTotal = profile?.rendaTotal ?? 0;
      
      // Passo 11: Registrar histórico
      syncManager.addLog("info", "[PERFIL DE RENDA] Passo 11: Formatando histórico de alterações de renda...");
      const historyEntry: IncomeHistoryEntry = {
        valorAnterior: previousTotal,
        novoValor: rendaTotalCalculada,
        data: now.toLocaleDateString("pt-BR"),
        hora: now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        usuario: user.email || user.uid,
        origem: "Ajuste de Perfil de Renda"
      };

      const updatedHistory = [historyEntry, ...(profile?.historico || [])].slice(0, 50); // limit to last 50 changes

      // Passo 5, 6, e 12: Salvar salário, renda extra e timestamp imutável
      syncManager.addLog("info", "[PERFIL DE RENDA] Passo 5, 6: Estruturando payload final de salário e rendas extras...");
      const newProfile: IncomeProfile = {
        salarioBase,
        rendasExtras,
        rendaTotal: rendaTotalCalculada,
        frequencia,
        ultimaAtualizacao: now.toISOString(),
        usuario: user.uid,
        historico: updatedHistory
      };

      // Executa a gravação orquestrada (inclui Retry, Sincronização offline e validação de regras)
      syncManager.addLog("info", "[PERFIL DE RENDA] Transmitindo dados para o banco de dados principal...");
      const result = await syncManager.executeSave("income", user.uid, newProfile, true);
      
      if (result.success) {
        setProfile(newProfile);
        
        // Passo 7, 8, 9: Atualizar Dashboard, Indicadores e Gráficos
        syncManager.addLog("success", "[PERFIL DE RENDA] Passo 7, 8, 9: Sincronizando novo teto orçamentário e recalculando painéis...");
        onIncomeChanged(rendaTotalCalculada);
        
        // Passo 10: Mostrar confirmação
        syncManager.addLog("success", "[PERFIL DE RENDA] Passo 10: Disparando notificação de sucesso!");
        showToast("success", "Perfil de renda e indicadores atualizados em tempo real na nuvem!");
      } else {
        showToast("error", result.message);
        syncManager.addLog("error", `[PERFIL DE RENDA] Gravação rejeitada: ${result.message}`);
      }
    } catch (err: any) {
      console.error("Erro ao salvar perfil de renda:", err);
      showToast("error", "Permissão negada pelo Firestore ou falha crítica de conexão.");
      syncManager.addLog("error", "[PERFIL DE RENDA] Exceção crítica disparada no salvamento.", {
        message: err?.message,
        stack: err?.stack
      });
    } finally {
      setSaving(false);
      setSyncing(false);
    }
  };

  // Restore previous saved base salary
  const handleRestorePrevious = () => {
    if (!profile || !profile.historico || profile.historico.length === 0) {
      showToast("error", "Não há histórico anterior para restaurar.");
      return;
    }

    const lastHistory = profile.historico[0];
    if (window.confirm(`Deseja restaurar a renda total anterior de ${formatBRL(lastHistory.valorAnterior)}?`)) {
      setSalarioBase(lastHistory.valorAnterior);
      showToast("success", `Valor de salário base redefinido para o valor anterior. Clique em Salvar para consolidar.`);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-12 shadow-3xs flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin" />
        <p className="text-xs text-gray-500 font-medium">Carregando Perfil de Renda...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" id="income-profile-view">
      
      {/* Toast Alerts */}
      {toastSuccess && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5 animate-slide-in text-xs font-semibold">
          <CheckCircle className="h-4.5 w-4.5 text-emerald-600" />
          <span>{toastSuccess}</span>
        </div>
      )}

      {toastError && (
        <div className="fixed bottom-5 right-5 z-50 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5 animate-slide-in text-xs font-semibold">
          <AlertCircle className="h-4.5 w-4.5 text-rose-600" />
          <span>{toastError}</span>
        </div>
      )}

      {/* Main Income Setup Card */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-3xs space-y-6">
        
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-gray-50 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 font-display flex items-center gap-2">
                Perfil de Renda Mensal
                {syncing && (
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 font-mono px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                    <RefreshCw className="h-3 w-3 animate-spin" /> Sincronizando
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Configure seus proventos e ganhos extras. Este montante será o pilar de todas as projeções, dashboards e taxas de endividamento.
              </p>
            </div>
          </div>

          {profile && profile.historico.length > 0 && (
            <button
              onClick={handleRestorePrevious}
              className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center gap-1.5 border border-gray-200"
              title="Restaurar para a renda total anterior registrada no histórico"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restaurar Anterior
            </button>
          )}
        </div>

        {/* Dynamic Calculator Overview Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 border border-slate-100 rounded-2xl p-5">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Salário Base Mensal</span>
            <span className="text-xl font-bold text-gray-800 block">{formatBRL(salarioBase)}</span>
          </div>
          <div className="space-y-1 border-t md:border-t-0 md:border-l border-slate-200/60 pt-3 md:pt-0 md:pl-5">
            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Soma das Rendas Extras</span>
            <span className="text-xl font-bold text-indigo-600 block">+ {formatBRL(somaRendasExtras)}</span>
          </div>
          <div className="space-y-1 border-t md:border-t-0 md:border-l border-slate-200/60 pt-3 md:pt-0 md:pl-5 bg-indigo-50/50 -m-5 p-5 rounded-r-2xl border-l-2 border-l-indigo-500">
            <span className="text-[10px] uppercase font-bold text-indigo-700 block tracking-wider flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-indigo-600" /> Renda Total Calculada
            </span>
            <span className="text-2xl font-black text-indigo-900 block">{formatBRL(rendaTotalCalculada)}</span>
          </div>
        </div>

        {/* Input Fields Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          
          {/* Base Salary setup */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider border-l-2 border-indigo-600 pl-2">
              Salário Principal
            </h3>
            
            <div className="space-y-3 bg-white border border-gray-100 rounded-xl p-4.5">
              <div>
                <label className="text-[10px] font-bold block mb-1 uppercase tracking-wide opacity-60">Valor do Salário Base (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">R$</span>
                  <input
                    type="text"
                    required
                    value={salarioBase === 0 ? "" : salarioBase}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.]/g, "");
                      setSalarioBase(parseFloat(val) || 0);
                    }}
                    placeholder="Ex: 3500.00"
                    className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 transition-all font-mono font-bold"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                  Digite apenas números e utilize ponto para separar os centavos se necessário (ex: 3500.00).
                </p>
              </div>

              <div>
                <label className="text-[10px] font-bold block mb-1 uppercase tracking-wide opacity-60">Frequência de Recebimento</label>
                <select
                  value={frequencia}
                  onChange={(e) => setFrequencia(e.target.value as any)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 transition-all cursor-pointer font-semibold"
                >
                  <option value="Mensal">Mensal</option>
                  <option value="Quinzenal">Quinzenal</option>
                  <option value="Semanal">Semanal</option>
                  <option value="Diário">Diário</option>
                  <option value="Personalizado">Personalizado</option>
                </select>
              </div>
            </div>
          </div>

          {/* Add extra income setup */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider border-l-2 border-indigo-600 pl-2">
              Outras Fontes de Renda Extras
            </h3>
            
            <form onSubmit={handleAddExtraIncome} className="space-y-3 bg-white border border-gray-100 rounded-xl p-4.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold block mb-1 uppercase tracking-wide opacity-60">Fonte de Renda</label>
                  <select
                    value={newSourceName}
                    onChange={(e) => setNewSourceName(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 transition-all cursor-pointer font-semibold"
                  >
                    {POPULAR_SOURCES.map((src) => (
                      <option key={src} value={src}>{src}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold block mb-1 uppercase tracking-wide opacity-60">Valor Adicional (R$)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">R$</span>
                    <input
                      type="text"
                      value={newSourceValue}
                      onChange={(e) => setNewSourceValue(e.target.value)}
                      placeholder="Ex: 500,00"
                      className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 transition-all font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {newSourceName === "Outro" && (
                <div className="animate-fade-in">
                  <label className="text-[10px] font-bold block mb-1 uppercase tracking-wide opacity-60">Nome Personalizado</label>
                  <input
                    type="text"
                    required
                    value={customSourceName}
                    onChange={(e) => setCustomSourceName(e.target.value)}
                    placeholder="Digite o nome da fonte extra"
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 transition-all"
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-indigo-200/50 mt-1"
              >
                <PlusCircle className="h-4 w-4" />
                Adicionar Nova Renda Extra
              </button>
            </form>
          </div>

        </div>

        {/* Extra Income sources list */}
        {rendasExtras.length > 0 && (
          <div className="border-t border-gray-100 pt-5 space-y-3">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Lista de Fontes Adicionais Cadastradas
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rendasExtras.map((item) => (
                <div 
                  key={item.id} 
                  className="flex items-center justify-between p-3 border border-gray-100 rounded-xl bg-gray-50/50 hover:border-indigo-100 transition-all"
                >
                  {editingExtraId === item.id ? (
                    <div className="flex-1 flex gap-2 items-center">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="text-xs px-2 py-1 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-indigo-500 flex-1"
                      />
                      <input
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        className="text-xs px-2 py-1 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-indigo-500 w-24 font-mono font-bold"
                      />
                      <button 
                        onClick={handleSaveEditExtra}
                        className="p-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 cursor-pointer"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button 
                        onClick={() => setEditingExtraId(null)}
                        className="p-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-gray-800 block">{item.nome}</span>
                        <span className="text-xs font-mono font-semibold text-indigo-600 block">{formatBRL(item.valor)}</span>
                      </div>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => handleStartEditExtra(item)}
                          className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all cursor-pointer border border-transparent hover:border-gray-100"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteExtraIncome(item.id)}
                          className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-white rounded-lg transition-all cursor-pointer border border-transparent hover:border-gray-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Global Action Trigger Button */}
        <div className="border-t border-gray-100 pt-5 flex justify-end">
          <button
            onClick={handlePreSave}
            disabled={saving}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-sm"
          >
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Alterar Salário & Salvar Perfil
              </>
            )}
          </button>
        </div>

      </div>

      {/* History log block */}
      {profile && profile.historico && profile.historico.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-3xs space-y-4">
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-indigo-600" />
            Histórico de Alterações de Renda (Trilha de Auditoria)
          </h3>
          <p className="text-xs text-gray-500">
            Registro oficial de todas as atualizações de proventos executadas sob este usuário autenticado.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] text-gray-400 uppercase tracking-wider font-bold">
                  <th className="py-2.5 pb-2">Data / Hora</th>
                  <th className="py-2.5 pb-2">Renda Anterior</th>
                  <th className="py-2.5 pb-2">Nova Renda Total</th>
                  <th className="py-2.5 pb-2">Diferença</th>
                  <th className="py-2.5 pb-2">Autor</th>
                  <th className="py-2.5 pb-2">Origem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs">
                {profile.historico.map((log, index) => {
                  const diff = log.novoValor - log.valorAnterior;
                  return (
                    <tr key={index} className="text-gray-700 hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 font-medium text-gray-500 whitespace-nowrap">
                        {log.data} <span className="text-[10px] text-gray-400 ml-1 font-mono">{log.hora}</span>
                      </td>
                      <td className="py-3 font-mono font-medium text-gray-400">
                        {formatBRL(log.valorAnterior)}
                      </td>
                      <td className="py-3 font-mono font-bold text-gray-900">
                        {formatBRL(log.novoValor)}
                      </td>
                      <td className={`py-3 font-mono font-bold ${diff >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {diff >= 0 ? `+${formatBRL(diff)}` : formatBRL(diff)}
                      </td>
                      <td className="py-3 text-gray-500 max-w-[120px] truncate" title={log.usuario}>
                        {log.usuario}
                      </td>
                      <td className="py-3">
                        <span className="text-[10px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                          {log.origem}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Dialog Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-gray-100 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-3 text-indigo-600">
              <Wallet className="h-6 w-6" />
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                Confirmação de Perfil de Renda
              </h3>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Deseja realmente alterar seu salário base e atualizar as fontes de renda?
            </p>

            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl space-y-1.5 text-xs text-indigo-950 font-medium">
              <div className="flex justify-between">
                <span>Salário Base:</span>
                <span className="font-bold">{formatBRL(salarioBase)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Ganhos Extras:</span>
                <span className="font-bold">+{formatBRL(somaRendasExtras)}</span>
              </div>
              <div className="flex justify-between border-t border-indigo-200/50 pt-1.5 text-indigo-900 font-bold">
                <span>Nova Renda Total:</span>
                <span className="font-black text-sm">{formatBRL(rendaTotalCalculada)}</span>
              </div>
            </div>

            <p className="text-[11px] text-gray-400">
              Esta ação recalculará e reajustará automaticamente todas as metas, limites de orçamento e indicadores de endividamento do sistema.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSave}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm shadow-indigo-500/10"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
