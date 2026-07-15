import React, { useState, useEffect, useRef } from "react";
import { MonthlyBudget, IncomeProfile } from "./types";
import { INITIAL_BUDGET_DATA } from "./data";
import BIDashboard from "./components/BIDashboard";
import BudgetGrid from "./components/BudgetGrid";
import FinancialAdvisor from "./components/FinancialAdvisor";
import SheetsExporter from "./components/SheetsExporter";
import AuthScreen from "./components/AuthScreen";
import IncomeProfileComponent from "./components/IncomeProfileComponent";
import FirebaseDiagnosticsPanel from "./components/FirebaseDiagnosticsPanel";
import { runFirebaseDiagnostics } from "./lib/firebaseDiagnostics";
import { syncManager } from "./lib/syncManager";
import DevConsole from "./components/DevConsole";
import { 
  auth, 
  initAuth, 
  logout, 
  saveUserBudgetData, 
  loadUserBudgetData,
  loadUserIncomeProfile,
  db,
  ensureAllCollectionsInitialized,
  recoverPassword
} from "./firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { User, updateProfile } from "firebase/auth";
import { 
  LayoutDashboard, 
  TableProperties, 
  Bot, 
  FileCode, 
  BookOpen, 
  Sparkles, 
  HelpCircle,
  Settings,
  Trash2,
  LogOut,
  User as UserIcon,
  Clock,
  Shield,
  Phone,
  Mail,
  ChevronDown,
  Lock,
  Eye,
  EyeOff,
  Activity,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Wallet,
  X
} from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"dashboard" | "grid" | "settings">("dashboard");
  const [activeSettingsTab, setActiveSettingsTab] = useState<"sheets" | "advisor" | "guide" | "general" | "income" | "diagnostics">("sheets");
  const [budgetData, setBudgetData] = useState<MonthlyBudget[]>([]);
  const [incomeProfile, setIncomeProfile] = useState<IncomeProfile | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [domainBannerDismissed, setDomainBannerDismissed] = useState(() => {
    return localStorage.getItem("bi_domain_banner_dismissed") === "true";
  });

  // Sync Toast & State
  const [syncToast, setSyncToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [syncState, setSyncState] = useState(syncManager.getState());

  const showSyncToast = (type: "success" | "error" | "info", message: string) => {
    setSyncToast({ type, message });
    setTimeout(() => {
      setSyncToast(prev => prev?.message === message ? null : prev);
    }, 5000);
  };

  // Subscribe to SyncManager
  useEffect(() => {
    const unsubscribe = syncManager.subscribe((state) => {
      setSyncState(state);
      setSyncing(state.isSyncing);
      setOfflineMode(!state.isOnline || state.syncStatus === "offline");
    });
    return unsubscribe;
  }, []);

  // Run automatic diagnostics sweep on application start
  useEffect(() => {
    runFirebaseDiagnostics().catch(err => {
      console.warn("Falha ao rodar diagnóstico de inicialização:", err);
    });
  }, []);

  // Inactivity Auto-Logout Settings (default 15 mins)
  const [inactivityTimeout, setInactivityTimeout] = useState<number>(() => {
    const saved = localStorage.getItem("bi_inactivity_timeout");
    return saved ? parseInt(saved, 10) : 15; // default 15 minutes
  });

  // UI States
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Profile Edit states
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password change inside profile modal
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState<string | null>(null);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);

  // Restore Database Modal States
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restoreProgressPercent, setRestoreProgressPercent] = useState(0);
  const [restoreProgressMessage, setRestoreProgressMessage] = useState("");
  const [restoreStatus, setRestoreStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [restoreErrorMessage, setRestoreErrorMessage] = useState("");

  // Delete All Data Modal States
  const [isDeleteDataModalOpen, setIsDeleteDataModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"backup_prompt" | "confirm" | "extra_confirm" | "choose_option" | "running" | "success" | "error">("backup_prompt");
  const [deleteProgressPercent, setDeleteProgressPercent] = useState(0);
  const [deleteProgressMessage, setDeleteProgressMessage] = useState("");
  const [deleteErrorMessage, setDeleteErrorMessage] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteCountdown, setDeleteCountdown] = useState(5);
  const [deleteAccountOption, setDeleteAccountOption] = useState<"keep" | "delete">("keep");

  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Deletion Button Countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isDeleteDataModalOpen && deleteStep === "confirm" && deleteCountdown > 0) {
      timer = setTimeout(() => {
        setDeleteCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [isDeleteDataModalOpen, deleteStep, deleteCountdown]);

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = initAuth(
      async (loggedInUser) => {
        // Double check email verification for password provider
        const isPasswordProvider = loggedInUser.providerData.some(p => p.providerId === 'password');
        if (isPasswordProvider && !loggedInUser.emailVerified) {
          setUser(null);
          setAuthLoading(false);
          return;
        }

        setUser(loggedInUser);
        setProfileName(loggedInUser.displayName || "");
        setProfilePhone(loggedInUser.phoneNumber || "");
        setAuthLoading(false);

        // Ensure all 11 required collections exist and are initialized
        ensureAllCollectionsInitialized(loggedInUser.uid, loggedInUser.displayName || undefined, loggedInUser.email || undefined).catch(e => {
          console.warn("Falha ao inicializar coleções padrão do Firestore:", e);
        });

        // Fetch user specific budget data from Firestore
        setSyncing(true);
        try {
          // Attempt to load from cloud database
          const cloudData = await loadUserBudgetData(loggedInUser.uid);
          if (cloudData && cloudData.length > 0) {
            setBudgetData(cloudData);
            localStorage.setItem("bi_budget_data_2026", JSON.stringify(cloudData));
          } else {
            // No cloud data yet, check if local storage has any custom entries
            const localCached = localStorage.getItem("bi_budget_data_2026");
            if (localCached) {
              const parsed = JSON.parse(localCached);
              setBudgetData(parsed);
              // Save to Firestore for future
              try {
                await saveUserBudgetData(loggedInUser.uid, parsed);
              } catch (saveErr) {
                console.warn("Falha ao salvar dados iniciais no Firestore:", saveErr);
              }
            } else {
              setBudgetData(INITIAL_BUDGET_DATA);
              try {
                await saveUserBudgetData(loggedInUser.uid, INITIAL_BUDGET_DATA);
              } catch (saveErr) {
                console.warn("Falha ao salvar dados iniciais no Firestore:", saveErr);
              }
            }
          }
          setOfflineMode(false);
        } catch (err) {
          console.error("Erro ao sincronizar dados com Firestore:", err);
          setOfflineMode(true);
          // Fallback to local storage instead of resetting to template
          const localCached = localStorage.getItem("bi_budget_data_2026");
          if (localCached) {
            try {
              setBudgetData(JSON.parse(localCached));
            } catch (parseErr) {
              setBudgetData(INITIAL_BUDGET_DATA);
            }
          } else {
            setBudgetData(INITIAL_BUDGET_DATA);
          }
        } finally {
          setSyncing(false);
        }

        // Fetch additional profile fields from Firestore users collection if available
        try {
          const userDocSnap = await getDoc(doc(db, "users", loggedInUser.uid));
          if (userDocSnap.exists()) {
            const extraData = userDocSnap.data();
            if (extraData.telefone) {
              setProfilePhone(extraData.telefone);
            }
          }
        } catch (e) {
          console.error("Erro ao carregar detalhes adicionais de usuário:", e);
        }

        // Fetch user income profile
        try {
          const pData = await loadUserIncomeProfile(loggedInUser.uid);
          if (pData) {
            setIncomeProfile(pData as IncomeProfile);
          }
        } catch (e) {
          console.error("Erro ao carregar perfil de renda inicial:", e);
        }
      },
      () => {
        setUser(null);
        setAuthLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-Logout due to Inactivity mechanism
  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (inactivityTimeout > 0 && user) {
      inactivityTimerRef.current = setTimeout(() => {
        handleLogout();
        alert("Sua sessão expirou devido à inatividade de " + inactivityTimeout + " minutos. Por favor, faça login novamente para garantir a segurança dos seus dados.");
      }, inactivityTimeout * 60 * 1000);
    }
  };

  useEffect(() => {
    if (!user || inactivityTimeout === 0) {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      return;
    }

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    const handleActivity = () => resetInactivityTimer();

    events.forEach(event => window.addEventListener(event, handleActivity));
    resetInactivityTimer();

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [user, inactivityTimeout]);

  // Handle updating budget data
  const handleUpdateData = async (newData: MonthlyBudget[]) => {
    setBudgetData(newData);
    localStorage.setItem("bi_budget_data_2026", JSON.stringify(newData));
    
    // Save to Firestore for durable cloud persistence
    if (user) {
      try {
        setSyncing(true);
        const result = await syncManager.executeSave("budget", user.uid, newData, false);
        if (result.success) {
          setOfflineMode(result.fromCache);
          if (!result.fromCache) {
            showSyncToast("success", "Dados de planejamento salvos e sincronizados com a nuvem!");
          } else {
            showSyncToast("info", "Modo Offline: Alterações salvas localmente e guardadas para sincronização.");
          }
        } else {
          setOfflineMode(true);
          showSyncToast("error", result.message);
        }
      } catch (err: any) {
        console.error("Falha ao salvar dados de orçamento na nuvem:", err);
        setOfflineMode(true);
        showSyncToast("error", "Erro crítico ao tentar sincronizar o planejamento.");
      } finally {
        setSyncing(false);
      }
    }
  };

  // Handle income profile changes
  const handleIncomeProfileChanged = async (newRendaTotal: number) => {
    if (!user) return;
    try {
      const pData = await loadUserIncomeProfile(user.uid);
      if (pData) {
        setIncomeProfile(pData as IncomeProfile);
      }
      
      // Update salary for all months in budgetData to use the new total income
      const updatedData = budgetData.map(m => ({
        ...m,
        salary: newRendaTotal
      }));
      await handleUpdateData(updatedData);
    } catch (err) {
      console.error("Erro ao sincronizar novo perfil de renda com orçamento:", err);
    }
  };

  // Handle restoring budget data to default template
  const handleResetData = async () => {
    if (!user) {
      showSyncToast("error", "Usuário não autenticado.");
      return;
    }

    // Garante que o modal mude para o status "running" quando a restauração é acionada
    setRestoreStatus("running");
    setRestoreProgressPercent(5);
    setRestoreProgressMessage("Iniciando processo...");
    setRestoreErrorMessage("");

    try {
      // Executa a restauração robusta e inteligente do SyncManager
      const result = await syncManager.restoreDatabase(user.uid, (percent, msg) => {
        setRestoreProgressPercent(percent);
        setRestoreProgressMessage(msg);
      });

      if (result.success) {
        // Redefine as variáveis globais de estado de forma imediata e resiliente
        // Para o budget padrão, garantindo salário zero por mês conforme especificado
        const zeroSalaryBudgetData = INITIAL_BUDGET_DATA.map(m => ({
          ...m,
          salary: 0
        }));

        setBudgetData(zeroSalaryBudgetData);
        localStorage.setItem("bi_budget_data_2026", JSON.stringify(zeroSalaryBudgetData));

        // Define perfil de renda localmente como zerado
        const clearedIncome: IncomeProfile = {
          salarioBase: 0,
          rendasExtras: [],
          rendaTotal: 0,
          frequencia: "Mensal",
          ultimaAtualizacao: new Date().toISOString(),
          usuario: user.uid,
          historico: []
        };
        setIncomeProfile(clearedIncome);
        localStorage.setItem(`bi_income_profile_${user.uid}`, JSON.stringify(clearedIncome));

        // Salva também o budgetData inicial zerado no Firestore de forma assíncrona
        await syncManager.executeSave("budget", user.uid, zeroSalaryBudgetData, false);

        setRestoreStatus("success");
        setRestoreProgressPercent(100);
        setRestoreProgressMessage("Banco de dados restaurado com sucesso para os padrões originais!");
        showSyncToast("success", "Banco de dados restaurado com sucesso.");
      } else {
        setRestoreStatus("error");
        setRestoreErrorMessage(result.message);
        showSyncToast("error", result.message);
      }
    } catch (err: any) {
      console.error("Erro durante restauração:", err);
      setRestoreStatus("error");
      setRestoreErrorMessage(err?.message || "Ocorreu um erro inesperado durante a restauração.");
      showSyncToast("error", "Ocorreu um erro interno ao restaurar o banco.");
    }
  };

  // Generates and downloads a JSON backup of the user data
  const handleDownloadBackup = () => {
    try {
      if (!user) {
        showSyncToast("error", "Usuário não autenticado para gerar backup.");
        return;
      }

      const backupObj = {
        app: "Gestão Financeira Inteligente",
        version: "2.0.0",
        exportDate: new Date().toISOString(),
        user: {
          uid: user.uid,
          email: user.email,
          name: user.displayName
        },
        budgetData: budgetData,
        incomeProfile: incomeProfile
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `backup_gestofinanceira_${user.uid}_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      showSyncToast("success", "Backup de segurança baixado com sucesso!");
    } catch (err) {
      console.error("Erro ao gerar backup de download:", err);
      showSyncToast("error", "Não foi possível gerar o arquivo de backup.");
    }
  };

  // Performs a complete and secure deletion of all user data
  const handleDeleteAllData = async () => {
    if (!user) {
      showSyncToast("error", "Usuário não autenticado.");
      return;
    }

    setDeleteStep("running");
    setDeleteProgressPercent(10);
    setDeleteProgressMessage("Iniciando a remoção total...");
    setDeleteErrorMessage("");

    try {
      // Execute database-wide user data purge
      const result = await syncManager.deleteAllUserData(user.uid, (percent, msg) => {
        setDeleteProgressPercent(percent);
        setDeleteProgressMessage(msg);
      });

      if (result.success) {
        // Redefine as variáveis locais do aplicativo
        const clearedBudget = INITIAL_BUDGET_DATA.map(m => ({
          ...m,
          salary: 0,
          transactions: []
        }));
        setBudgetData(clearedBudget);
        localStorage.removeItem("bi_budget_data_2026");

        const clearedIncome: IncomeProfile = {
          salarioBase: 0,
          rendasExtras: [],
          rendaTotal: 0,
          frequencia: "Mensal",
          ultimaAtualizacao: new Date().toISOString(),
          usuario: user.uid,
          historico: []
        };
        setIncomeProfile(clearedIncome);
        localStorage.removeItem(`bi_income_profile_${user.uid}`);

        // Option 1: Keep the account clean but logged in
        if (deleteAccountOption === "keep") {
          setDeleteStep("success");
          setDeleteProgressPercent(100);
          showSyncToast("success", "Todos os seus dados foram excluídos com sucesso.");
        } else {
          // Option 2: Remove the account itself from Firebase Authentication
          setDeleteProgressPercent(95);
          setDeleteProgressMessage("Removendo conta de autenticação...");
          
          try {
            const currentUser = auth.currentUser;
            if (currentUser) {
              await currentUser.delete();
            }
            
            showSyncToast("success", "Sua conta foi removida com sucesso.");
            setDeleteStep("success");
            setDeleteProgressPercent(100);
            
            // Log out cleanly and go back to registration screen
            setUser(null);
            await logout();
          } catch (authErr: any) {
            console.error("Erro ao excluir conta auth do Firebase:", authErr);
            if (authErr?.code === "auth/requires-recent-login") {
              setDeleteStep("error");
              setDeleteErrorMessage("Seus dados pessoais e tabelas já foram 100% excluídos e limpos de forma irreversível. Porém, a remoção do login do Firebase exige reautenticação recente. Por favor, deslogue, logue de novo e refaça a operação se quiser deletar a credencial.");
              showSyncToast("error", "Credenciais requerem login recente.");
            } else {
              setDeleteStep("error");
              setDeleteErrorMessage(`Seus dados do banco foram limpos com sucesso. Contudo, ocorreu um erro ao deletar as credenciais de login: ${authErr?.message || String(authErr)}`);
              showSyncToast("error", "Falha ao remover credenciais.");
            }
          }
        }
      } else {
        setDeleteStep("error");
        // Friendly translations of specific deletion errors
        let errorMsg = result.message;
        if (result.message.includes("permission-denied")) {
          errorMsg = "permission-denied: Permissão negada pelas regras de segurança do Firestore.";
        } else if (result.message.includes("unauthenticated")) {
          errorMsg = "unauthenticated: Você precisa estar autenticado de forma recente para realizar essa ação.";
        } else if (result.message.includes("network-request-failed")) {
          errorMsg = "network-request-failed: Conexão de rede falhou. Verifique sua conexão e tente novamente.";
        } else if (result.message.includes("unavailable")) {
          errorMsg = "unavailable: O banco de dados Firestore está temporariamente indisponível.";
        } else if (result.message.includes("internal")) {
          errorMsg = "internal: Erro interno no servidor do banco de dados.";
        } else if (result.message.includes("timeout")) {
          errorMsg = "timeout: Tempo limite da operação excedido. Tente novamente.";
        } else if (result.message.includes("not-found")) {
          errorMsg = "not-found: O documento ou recurso solicitado não foi encontrado.";
        }
        setDeleteErrorMessage(errorMsg);
        showSyncToast("error", errorMsg);
      }
    } catch (err: any) {
      console.error("Erro interno durante processo de remoção total:", err);
      setDeleteStep("error");
      setDeleteErrorMessage(err?.message || "Ocorreu um erro inesperado ao excluir seus dados.");
      showSyncToast("error", "Erro ao executar a exclusão total.");
    }
  };

  // Handle Logout Action
  const handleLogout = async () => {
    setIsDropdownOpen(false);
    setUser(null);
    setBudgetData([]);
    localStorage.removeItem("bi_budget_data_2026");
    await logout();
  };

  // Handle Profile Update Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileSuccess(null);
    setProfileError(null);
    setProfileSaving(true);

    try {
      // 1. Update Auth DisplayName
      await updateProfile(user, { displayName: profileName });
      
      // 2. Update Firestore users doc
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        nome: profileName,
        telefone: profilePhone
      });

      setProfileSuccess("Perfil atualizado com sucesso!");
      setTimeout(() => setProfileSuccess(null), 3000);
    } catch (err: any) {
      setProfileError("Erro ao atualizar o perfil: " + (err.message || err));
    } finally {
      setProfileSaving(false);
    }
  };

  // Handle password change directly in profile
  const handleChangePassword = async () => {
    if (!auth.currentUser) return;
    setPasswordChangeSuccess(null);
    setPasswordChangeError(null);
    setPasswordChangeLoading(true);

    try {
      const { updatePassword } = await import("firebase/auth");
      await updatePassword(auth.currentUser, newPassword);
      setPasswordChangeSuccess("Senha alterada com sucesso!");
      setNewPassword("");
      setTimeout(() => setPasswordChangeSuccess(null), 4000);
    } catch (err: any) {
      console.error("Erro ao alterar senha:", err);
      if (err.code === "auth/requires-recent-login") {
        setPasswordChangeError("Para alterar a senha, você precisa ter feito login recentemente. Por favor, deslogue, logue novamente e refaça a operação.");
      } else {
        setPasswordChangeError(err.message || "Erro ao atualizar senha.");
      }
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  // Handle requesting password reset email
  const handleRequestPasswordReset = async () => {
    if (!user || !user.email) return;
    setPasswordChangeSuccess(null);
    setPasswordChangeError(null);
    setPasswordChangeLoading(true);

    try {
      await recoverPassword(user.email);
      setPasswordChangeSuccess("Link de redefinição de senha enviado para seu e-mail!");
      setTimeout(() => setPasswordChangeSuccess(null), 4000);
    } catch (err: any) {
      setPasswordChangeError(err.message || "Erro ao solicitar redefinição.");
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  // Handle Inactivity Timeout change in settings
  const handleTimeoutChange = (minutes: number) => {
    setInactivityTimeout(minutes);
    localStorage.setItem("bi_inactivity_timeout", minutes.toString());
  };

  // Format creation and login date nicely
  const formatDateString = (isoString?: string) => {
    if (!isoString) return "Não disponível";
    try {
      return new Date(isoString).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      return isoString;
    }
  };

  // Loading screen during initial authentication resolve
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 font-sans">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-gray-800">Verificando sessão...</h3>
            <p className="text-[10px] text-gray-400 font-mono">Conectando ao Firebase Security Suite</p>
          </div>
        </div>
      </div>
    );
  }

  // REDIRECT TO LOGIN: If user is not authenticated, force AuthScreen
  if (!user) {
    return <AuthScreen onAuthSuccess={(authenticatedUser) => setUser(authenticatedUser)} />;
  }

  const userInitials = user.displayName ? user.displayName.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase() : user.email?.charAt(0).toUpperCase() || "U";
  const authProvider = user.providerData[0]?.providerId === "google.com" ? "Google" : (user.providerData[0]?.providerId === "phone" ? "SMS/Telefone" : "E-mail/Senha");

  const currentHostname = window.location.hostname;
  const isCloudRun = currentHostname.endsWith(".run.app");
  const isStandardDomain = currentHostname === "localhost" || 
                           currentHostname === "127.0.0.1" || 
                           currentHostname.endsWith(".firebaseapp.com") || 
                           currentHostname.endsWith(".web.app") || 
                           currentHostname.endsWith(".local");

  const handleDismissDomainBanner = () => {
    localStorage.setItem("bi_domain_banner_dismissed", "true");
    setDomainBannerDismissed(true);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-gray-800 font-sans antialiased flex flex-col selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* 1. Global Navigation Top Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Branding / Title */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                <TableProperties className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-sm font-bold font-display tracking-tight text-gray-900">BI Planner Pro</h1>
                  <span className="text-[10px] bg-red-100 text-red-800 font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                    Déficit Alert
                  </span>
                  {syncing && (
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wide animate-pulse">
                      Nuvem Sync
                    </span>
                  )}
                  {offlineMode && (
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded-xs uppercase tracking-wide" title="Trabalhando offline. Dados salvos localmente.">
                      Modo Offline
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-400">Análise Financeira & Gerador de Google Sheets</p>
              </div>
            </div>

            {/* Main Tabs Navigation */}
            <nav className="hidden md:flex space-x-1">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === "dashboard" 
                    ? "bg-indigo-50 text-indigo-600" 
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                Painel de BI
              </button>

              <button
                onClick={() => setActiveTab("grid")}
                className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === "grid" 
                    ? "bg-indigo-50 text-indigo-600" 
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <TableProperties className="h-4 w-4" />
                Lançamentos (Planilha)
              </button>

              <button
                onClick={() => setActiveTab("settings")}
                className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === "settings" 
                    ? "bg-indigo-50 text-indigo-600" 
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <Settings className="h-4 w-4" />
                Configurações
              </button>
            </nav>

            {/* User Session Controller Dropdown */}
            <div className="relative flex items-center gap-3" ref={dropdownRef}>
              
              {/* Desktop Salário base badge */}
              <div className="hidden lg:flex items-center gap-3 font-mono text-[11px] font-bold text-gray-500 border-r border-gray-100 pr-4">
                <span>Salário base: <strong className="text-emerald-600">R$ 1.550,00</strong></span>
              </div>

              {/* User Dropdown Action Trigger */}
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2.5 p-1.5 hover:bg-gray-50 rounded-xl transition-all cursor-pointer border border-transparent hover:border-gray-100"
              >
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName || "Avatar"} 
                    className="w-8 h-8 rounded-full border border-gray-200/50 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 bg-indigo-100 text-indigo-700 font-bold rounded-full flex items-center justify-center text-xs">
                    {userInitials}
                  </div>
                )}
                
                <div className="hidden md:flex flex-col items-start text-left">
                  <span className="text-xs font-bold text-gray-900 truncate max-w-[120px]">
                    {user.displayName || "Usuário"}
                  </span>
                  <span className="text-[9px] text-gray-400 font-mono font-medium tracking-wide">
                    {authProvider}
                  </span>
                </div>
                <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {/* DROPDOWN MENU */}
              {isDropdownOpen && (
                <div className="absolute right-0 top-14 w-56 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 z-50 animate-fade-in font-sans">
                  <div className="px-4 py-3 border-b border-gray-50">
                    <p className="text-xs font-bold text-gray-900 truncate">{user.displayName || "Usuário"}</p>
                    <p className="text-[10px] text-gray-400 truncate">{user.email || "Sem e-mail"}</p>
                  </div>
                  
                  <div className="p-1.5">
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setIsProfileOpen(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <UserIcon className="h-4 w-4 text-indigo-500" />
                      Meu Perfil
                    </button>

                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setActiveTab("settings");
                        setActiveSettingsTab("general");
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Settings className="h-4 w-4 text-indigo-500" />
                      Configurações
                    </button>
                  </div>

                  <div className="border-t border-gray-50 p-1.5">
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Sair da Conta
                    </button>
                  </div>
                </div>
              )}

            </div>

          </div>
        </div>
      </header>

      {/* Mobile Navigation bar */}
      <div className="md:hidden flex items-center justify-around bg-white border-b border-gray-100 p-2 overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold flex flex-col items-center gap-1 shrink-0 ${
            activeTab === "dashboard" ? "bg-indigo-50 text-indigo-600" : "text-gray-500"
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab("grid")}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold flex flex-col items-center gap-1 shrink-0 ${
            activeTab === "grid" ? "bg-indigo-50 text-indigo-600" : "text-gray-500"
          }`}
        >
          <TableProperties className="h-4 w-4" />
          Lançamentos
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold flex flex-col items-center gap-1 shrink-0 ${
            activeTab === "settings" ? "bg-indigo-50 text-indigo-600" : "text-gray-500"
          }`}
        >
          <Settings className="h-4 w-4" />
          Configurações
        </button>
      </div>

      {/* 2. Main Body Workspace area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {isCloudRun && !domainBannerDismissed && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs shadow-3xs animate-fade-in" id="admin-domain-warning">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-xl mt-0.5 shrink-0">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-amber-900">
                  Aviso para o Administrador (Ambiente Cloud Run)
                </p>
                <p className="text-amber-700 leading-relaxed">
                  Para que o login social com o Google funcione corretamente, certifique-se de adicionar o domínio atual no painel do Firebase:
                </p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="font-semibold text-amber-800">Domínio detectado:</span>
                  <code className="bg-white border border-amber-200 px-2 py-0.5 rounded font-mono text-[10px] select-all text-amber-900">
                    {currentHostname}
                  </code>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 self-end sm:self-center">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(currentHostname);
                  alert("Domínio copiado: " + currentHostname);
                }}
                className="flex-1 sm:flex-none px-3 py-1.5 bg-white border border-amber-200 hover:bg-amber-100 text-amber-800 font-bold rounded-lg transition-all text-[11px] flex items-center justify-center gap-1 cursor-pointer"
              >
                Copiar Domínio
              </button>
              <button
                onClick={() => {
                  setActiveTab("settings");
                  setActiveSettingsTab("diagnostics");
                }}
                className="flex-1 sm:flex-none px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-all text-[11px] flex items-center justify-center gap-1 cursor-pointer"
              >
                Abrir Diagnóstico
              </button>
              <button
                onClick={handleDismissDomainBanner}
                className="px-2 py-1.5 text-amber-600 hover:text-amber-800 font-semibold rounded transition-all text-[11px] cursor-pointer"
              >
                Dispensar
              </button>
            </div>
          </div>
        )}
        
        {activeTab === "dashboard" && (
          <BIDashboard 
            data={budgetData} 
            incomeProfile={incomeProfile} 
            onUpdateData={handleUpdateData}
            user={user}
          />
        )}

        {activeTab === "grid" && (
          <BudgetGrid 
            data={budgetData} 
            onUpdateData={handleUpdateData} 
            onResetData={handleResetData} 
          />
        )}

        {activeTab === "settings" && (
          <div className="flex flex-col lg:flex-row gap-6 animate-fade-in" id="settings-tab">
            {/* Left Sidebar for settings navigation */}
            <div className="w-full lg:w-64 shrink-0 space-y-2">
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-3xs">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-3 px-2">Ajustes & Suporte</p>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => setActiveSettingsTab("sheets")}
                    className={`px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                      activeSettingsTab === "sheets"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <FileCode className="h-4 w-4" />
                    Scripts & Fórmulas
                  </button>

                  <button
                    onClick={() => setActiveSettingsTab("advisor")}
                    className={`px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                      activeSettingsTab === "advisor"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <Bot className="h-4 w-4" />
                    Consultor de IA
                  </button>

                  <button
                    onClick={() => setActiveSettingsTab("guide")}
                    className={`px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                      activeSettingsTab === "guide"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <BookOpen className="h-4 w-4" />
                    Guia de Implantação
                  </button>

                  <button
                    onClick={() => setActiveSettingsTab("general")}
                    className={`px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                      activeSettingsTab === "general"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <Settings className="h-4 w-4" />
                    Configurações Gerais
                  </button>

                  <button
                    onClick={() => setActiveSettingsTab("income")}
                    className={`px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                      activeSettingsTab === "income"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Wallet className="h-4 w-4" />
                      <span>Perfil de Renda</span>
                    </div>
                    <span className="text-[9px] bg-emerald-500 text-white font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider scale-90">
                      Nova
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveSettingsTab("diagnostics")}
                    className={`px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                      activeSettingsTab === "diagnostics"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Activity className="h-4 w-4 text-rose-500" />
                      <span>Diagnóstico Firebase</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Main Panel for sub-views */}
            <div className="flex-1 min-w-0 space-y-6">
              {activeSettingsTab === "sheets" && (
                <div className="space-y-6">
                  <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-3xs">
                    <h2 className="text-base font-bold text-gray-900 font-display">Scripts & Fórmulas de Integração</h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Importe seus dados usando arquivos CSV, URLs diretas do Google Sheets ou utilize as macros de Apps Script geradas de forma dinâmica.
                    </p>
                  </div>
                  <SheetsExporter data={budgetData} onUpdateData={handleUpdateData} />
                </div>
              )}

              {activeSettingsTab === "advisor" && (
                <div className="space-y-6">
                  <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-3xs">
                    <h2 className="text-base font-bold text-gray-900 font-display">Consultor Financeiro de IA</h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Insights avançados gerados com inteligência artificial para otimização do fluxo de caixa e equilíbrio do déficit.
                    </p>
                  </div>
                  <FinancialAdvisor data={budgetData} />
                </div>
              )}

              {activeSettingsTab === "guide" && (
                <div className="space-y-6 animate-fade-in" id="guide-tab">
                  <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-3xs">
                    <h2 className="text-base font-bold text-gray-900 font-display">Documentação & Manual de Implantação</h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Siga este guia simples e prático para reproduzir esta estrutura e design profissional no seu Google Sheets corporativo.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Column 1 & 2: Steps to deploy */}
                    <div className="xl:col-span-2 space-y-6">
                      <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-xs space-y-4">
                        <h3 className="text-sm font-bold font-display text-gray-900 flex items-center gap-1.5">
                          <Sparkles className="h-4 w-4 text-indigo-600" />
                          Como Estruturar as Abas da Sua Nova Planilha
                        </h3>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          A planilha original continha informações desordenadas misturadas com anotações e logins. Para que ela opere como um software corporativo limpo, estruture seu Google Sheets com estas abas:
                        </p>

                        <div className="space-y-3.5">
                          <div className="flex gap-3">
                            <div className="bg-indigo-50 text-indigo-600 w-5 h-5 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0">
                              1
                            </div>
                            <div className="text-xs space-y-1">
                              <span className="font-bold text-gray-900 block">📊 Dashboard (Visão do Usuário):</span>
                              <p className="text-gray-500 leading-relaxed">
                                Aba limpa de visualização executiva contendo cartões de KPIs de saldo, total gasto e status. Use gráficos de barras e pizza nativos vinculados às fórmulas da aba <code>Indicadores</code>.
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <div className="bg-indigo-50 text-indigo-600 w-5 h-5 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0">
                              2
                            </div>
                            <div className="text-xs space-y-1">
                              <span className="font-bold text-gray-900 block">🗄️ Banco de Dados (Tabela Plana):</span>
                              <p className="text-gray-500 leading-relaxed">
                                Onde todos os registros entram linearmente. Crie colunas idênticas: <code>[ID_Lancamento]</code>, <code>[Mes]</code>, <code>[Data]</code>, <code>[Credor]</code>, <code>[Valor]</code>, <code>[Categoria]</code>, <code>[Status]</code>, <code>[Observacoes]</code>.
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <div className="bg-indigo-50 text-indigo-600 w-5 h-5 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0">
                              3
                            </div>
                            <div className="text-xs space-y-1">
                              <span className="font-bold text-gray-900 block">⚡ Indicadores (Aba de Apoio):</span>
                              <p className="text-gray-500 leading-relaxed">
                                Aba oculta (clique com o botão direito e selecione "Ocultar aba") que processa as fórmulas como <code>QUERY</code>, <code>FILTER</code> e <code>LET</code> para alimentar o Dashboard principal sem poluir visualmente a visão do usuário.
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <div className="bg-indigo-50 text-indigo-600 w-5 h-5 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0">
                              4
                            </div>
                            <div className="text-xs space-y-1">
                              <span className="font-bold text-gray-900 block">🔑 Configurações:</span>
                              <p className="text-gray-500 leading-relaxed">
                                Lista de Categorias válidas para preenchimento de caixa de seleção suspensa e metas de teto de gastos por área.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-xs space-y-3">
                        <h3 className="text-sm font-bold font-display text-gray-900 flex items-center gap-1.5">
                          <HelpCircle className="h-4 w-4 text-indigo-600" />
                          Como Adicionar os Scripts Automáticos
                        </h3>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          Siga o passo a passo para colar o código Apps Script que geramos na aba de fórmulas:
                        </p>
                        <ol className="list-decimal pl-5 space-y-2 text-xs text-gray-500">
                          <li>No painel superior do seu Google Sheets, clique em <strong>Extensões &gt; Apps Script</strong>.</li>
                          <li>No menu lateral esquerdo do painel do Apps Script, clique no ícone "+" ao lado de Arquivos para criar novos arquivos JavaScript.</li>
                          <li>Crie cada um dos arquivos com o nome idêntico (ex: <code>Code.gs</code>, <code>Dashboard.gs</code>, <code>Utils.gs</code>).</li>
                          <li>Copie o código correspondente aqui no nosso aplicativo e cole dentro de cada arquivo do editor do Sheets.</li>
                          <li>Clique no ícone de <strong>Salvar (Disquete)</strong> no painel superior.</li>
                          <li>Atualize a página do seu Google Sheets. O novo menu suspenso <strong>⚙️ Gestão Financeira Inteligente</strong> aparecerá na barra superior em 5 segundos!</li>
                        </ol>
                      </div>
                    </div>

                    {/* Design Guidelines Sidebar */}
                    <div className="space-y-6">
                      <div className="p-5 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-xs space-y-4">
                        <h3 className="text-xs font-bold font-display uppercase tracking-wider text-indigo-300">Regras de Design de Planilhas</h3>
                        <div className="space-y-3.5 text-xs">
                          <div>
                            <span className="font-bold text-slate-100 block">Palette de Cores Padronizada:</span>
                            <p className="text-slate-400 mt-0.5">Use fundos brancos ou off-white (<code>#F8FAFC</code>). Alertas críticos em vermelho suave (<code>#FEF2F2</code> com texto <code>#991B1B</code>). Botões em azul/azul escuro corporativo.</p>
                          </div>
                          <div>
                            <span className="font-bold text-slate-100 block">Fontes Elegantes:</span>
                            <p className="text-slate-400 mt-0.5">Mude a fonte padrão da planilha para <strong>Inter</strong> ou <strong>Calibri</strong>. Use tamanhos estruturados: 14pt (Negrito) para Títulos, 11pt para dados e 10pt (Itálico/Cinza) para notas secundárias.</p>
                          </div>
                          <div>
                            <span className="font-bold text-slate-100 block">Oculte as Linhas de Grade:</span>
                            <p className="text-slate-400 mt-0.5">Vá em <strong>Ver &gt; Mostrar &gt; Desmarcar Linhas de Grade</strong> no Google Sheets para criar uma interface clean e focada em cartões (efeito software).</p>
                          </div>
                          <div>
                            <span className="font-bold text-slate-100 block">Formatação Condicional Semáforo:</span>
                            <p className="text-slate-400 mt-0.5">Defina formatação condicional nas células de status: Texto igual a 'PAGO' fica verde pastel. Texto igual a 'FALTA PAGAR' ou devedor fica vermelho pastel.</p>
                          </div>
                        </div>
                      </div>

                      <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-xs space-y-3">
                        <h3 className="text-xs font-bold font-display uppercase tracking-wider text-indigo-600">Segurança & Performance</h3>
                        <div className="space-y-3 text-xs text-gray-600 leading-relaxed">
                          <p>
                            <strong>Proteja as células de fórmulas:</strong> No Google Sheets, selecione o intervalo onde residem as faturas ou a aba de Indicadores, clique com o botão direito e selecione <strong>Ver mais ações da célula &gt; Proteger intervalo</strong>.
                          </p>
                          <p>
                            Isso evita que faturas automáticas sejam subscritas manualmente pelo usuário, preservando a coerência e os históricos de cálculo ao longo do tempo.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsTab === "general" && (
                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-3xs space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 font-display">Preferências & Segurança da Conta</h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Gerencie as preferências de segurança, sessão de inatividade do usuário e opções de restauração de dados.
                    </p>
                  </div>

                  {/* Security Inactivity Timeout Settings */}
                  <div className="border-t border-gray-100 pt-6 space-y-4">
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-indigo-600" />
                      Sessão por Inatividade (Inactivity Auto-Logout)
                    </h3>
                    <p className="text-xs text-gray-500 max-w-xl">
                      Para sua segurança, defina um período de inatividade (sem movimentação de mouse ou teclado). Após esse tempo, o aplicativo deslogará sua conta automaticamente.
                    </p>
                    <div className="flex flex-wrap gap-2.5 max-w-md pt-1.5">
                      {[5, 15, 30, 60, 0].map((minutes) => (
                        <button
                          key={minutes}
                          onClick={() => handleTimeoutChange(minutes)}
                          className={`px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all border ${
                            inactivityTimeout === minutes
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                              : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          {minutes === 0 ? "Desativado" : `${minutes} minutos`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-6 space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4.5 bg-rose-50 border border-rose-100 rounded-2xl gap-4">
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wide">Redefinir Dados do Planejador</h4>
                        <p className="text-[11px] text-rose-700/80 leading-relaxed max-w-xl">
                          Esta ação irá apagar permanentemente todos os lançamentos personalizados deste usuário no banco de dados em nuvem e restaurará o orçamento padrão original de 2026. Esta ação é irreversível.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setRestoreStatus("idle");
                          setRestoreProgressPercent(0);
                          setRestoreProgressMessage("");
                          setIsRestoreModalOpen(true);
                        }}
                        className="px-4.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0 self-end sm:self-center"
                      >
                        <Trash2 className="h-4 w-4" />
                        Restaurar Banco de Dados
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-6 space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4.5 bg-red-50 border border-red-100 rounded-2xl gap-4">
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-red-900 uppercase tracking-wide">EXCLUIR TODOS OS DADOS</h4>
                        <p className="text-[11px] text-red-700/80 leading-relaxed max-w-xl">
                          Esta ação removerá permanentemente todos os seus dados pessoais, lançamentos, perfil financeiro, categorias, metas, histórico e configurações armazenadas na nuvem. Esta ação é irreversível.
                        </p>
                      </div>
                      <button
                        id="btn-delete-all-data"
                        onClick={() => {
                          setDeleteStep("backup_prompt");
                          setDeleteConfirmText("");
                          setDeleteCountdown(5);
                          setDeleteAccountOption("keep");
                          setIsDeleteDataModalOpen(true);
                        }}
                        className="px-4.5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0 self-end sm:self-center"
                      >
                        <Trash2 className="h-4 w-4" />
                        Excluir Todos os Dados
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsTab === "income" && user && (
                <IncomeProfileComponent 
                  user={user} 
                  onIncomeChanged={handleIncomeProfileChanged} 
                />
              )}

              {activeSettingsTab === "diagnostics" && (
                <FirebaseDiagnosticsPanel />
              )}
            </div>
          </div>
        )}

      </main>

      {/* Profile Details and Edit Modal */}
      {isProfileOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans text-gray-800">
          <div className="bg-white rounded-3xl border border-gray-100 max-w-md w-full p-6 shadow-2xl relative">
            
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-5">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-indigo-600" />
                Perfil do Usuário Protegido
              </h3>
              <button 
                onClick={() => {
                  setIsProfileOpen(false);
                  setProfileSuccess(null);
                  setProfileError(null);
                }} 
                className="text-gray-400 hover:text-gray-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {profileSuccess && (
              <div className="p-3 mb-4 rounded-xl text-xs flex gap-2 items-center border border-emerald-100 bg-emerald-50 text-emerald-800">
                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div className="p-3 mb-4 rounded-xl text-xs flex gap-2 items-center border border-rose-100 bg-rose-50 text-rose-800">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              
              {/* Photo Display */}
              <div className="flex flex-col items-center mb-5">
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName || "Avatar"} 
                    className="w-16 h-16 rounded-full border-2 border-indigo-100 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-700 font-bold rounded-full flex items-center justify-center text-lg shadow-inner">
                    {userInitials}
                  </div>
                )}
                <span className="text-[10px] text-gray-400 mt-2 font-mono uppercase tracking-widest bg-gray-50 px-2 py-0.5 rounded-sm border border-gray-100">
                  ID: {user.uid.substring(0, 8)}...
                </span>
              </div>

              {/* Immutable Email */}
              <div>
                <label className="text-[10px] font-bold block mb-1 uppercase tracking-wide opacity-60">E-mail Corporativo</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="email"
                    disabled
                    value={user.email || ""}
                    className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-gray-400 outline-none cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Editable Name */}
              <div>
                <label className="text-[10px] font-bold block mb-1 uppercase tracking-wide opacity-60">Nome Completo</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 transition-all"
                  />
                </div>
              </div>

              {/* Editable Phone */}
              <div>
                <label className="text-[10px] font-bold block mb-1 uppercase tracking-wide opacity-60">Número de Telefone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="tel"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    placeholder="Ex: +55 (11) 99999-9999"
                    className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 transition-all"
                  />
                </div>
              </div>

              {/* Metadata Stats */}
              <div className="bg-gray-50 rounded-2xl p-3.5 space-y-2 text-[10px] font-mono text-gray-500 border border-gray-100/50">
                <div className="flex justify-between">
                  <span>MÉTODO DE LOGIN:</span>
                  <span className="font-bold text-gray-700 uppercase">{authProvider}</span>
                </div>
                <div className="flex justify-between">
                  <span>E-MAIL VERIFICADO:</span>
                  <span className={`font-bold uppercase ${user.emailVerified ? "text-emerald-600" : "text-amber-500"}`}>
                    {user.emailVerified ? "CONFIRMADO ✓" : "PENDENTE ✕"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>CADASTRADO EM:</span>
                  <span className="font-bold text-gray-700">{formatDateString(user.metadata.creationTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span>ÚLTIMO LOGADO:</span>
                  <span className="font-bold text-gray-700">{formatDateString(user.metadata.lastSignInTime)}</span>
                </div>
              </div>

              {/* Expandable Password Section */}
              <div className="border-t border-gray-100 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsChangingPassword(!isChangingPassword);
                    setPasswordChangeSuccess(null);
                    setPasswordChangeError(null);
                  }}
                  className="w-full flex items-center justify-between text-[11px] font-bold text-gray-500 uppercase tracking-wide py-1 hover:text-gray-900 transition-colors cursor-pointer"
                >
                  <span>🔐 Alterar Minha Senha</span>
                  <span className="text-xs">{isChangingPassword ? "▲" : "▼"}</span>
                </button>

                {isChangingPassword && (
                  <div className="mt-3 space-y-3.5 bg-gray-50 p-3.5 rounded-2xl border border-gray-100 animate-fade-in">
                    {passwordChangeSuccess && (
                      <div className="p-2.5 rounded-lg text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-100 flex items-center gap-1.5 font-medium">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                        <span>{passwordChangeSuccess}</span>
                      </div>
                    )}
                    {passwordChangeError && (
                      <div className="p-2.5 rounded-lg text-[10px] bg-rose-50 text-rose-800 border border-rose-100 flex items-center gap-1.5 font-medium">
                        <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                        <span>{passwordChangeError}</span>
                      </div>
                    )}

                    {(() => {
                      const providerId = user.providerData[0]?.providerId || "password";
                      return providerId === "password" ? (
                        <div className="space-y-3">
                          <div>
                            <label className="text-[9px] font-bold block mb-1 uppercase tracking-wide opacity-60">Nova Senha</label>
                            <input
                              type="password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Mínimo 8 caracteres"
                              className="w-full text-xs px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-all"
                            />
                          </div>
                          <button
                            type="button"
                            disabled={passwordChangeLoading || newPassword.length < 8}
                            onClick={handleChangePassword}
                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold rounded-xl text-[10px] transition-all cursor-pointer flex items-center justify-center gap-1"
                          >
                            {passwordChangeLoading ? "Atualizando..." : "Confirmar Nova Senha"}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-[10px] text-gray-500 leading-relaxed">
                            Sua conta está conectada usando o provedor <strong>{authProvider.toUpperCase()}</strong>.
                          </p>
                          {providerId === "google.com" ? (
                            <p className="text-[9px] text-gray-400">
                              A senha é gerenciada diretamente pelo Google. Não é possível alterá-la por aqui.
                            </p>
                          ) : (
                            <button
                              type="button"
                              disabled={passwordChangeLoading}
                              onClick={handleRequestPasswordReset}
                              className="w-full py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-[10px] transition-all cursor-pointer flex items-center justify-center gap-1"
                            >
                              {passwordChangeLoading ? "Enviando..." : "Enviar E-mail de Redefinição de Senha"}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Account Deletion and Logout options inside the modal */}
              <div className="border-t border-gray-100 pt-4 mt-2 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    setIsDeleteDataModalOpen(true);
                    setDeleteStep("backup_prompt");
                  }}
                  className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-rose-200/40 transition-all cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir Minha Conta & Dados
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    handleLogout();
                  }}
                  className="w-full py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-gray-200/50 transition-all cursor-pointer"
                >
                  <LogOut className="h-4 w-4 text-gray-500" />
                  Sair da Conta (Logout)
                </button>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    setProfileSuccess(null);
                    setProfileError(null);
                  }}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {profileSaving ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Global Simple Footer */}
      <footer className="bg-white border-t border-gray-100 py-4 text-center text-[10px] text-gray-400">
        <div className="max-w-7xl mx-auto px-4">
          Financial Dashboard &copy; 2026. Todos os códigos e fórmulas gerados cumprem com os requisitos do Google Sheets V8 Engine.
        </div>
      </footer>

      {/* Dynamic Sync Toast */}
      {syncToast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4.5 py-3 rounded-2xl shadow-2xl border backdrop-blur-md animate-fade-in ${
          syncToast.type === "success" 
            ? "bg-emerald-50 border-emerald-200/60 text-emerald-900" 
            : syncToast.type === "error"
            ? "bg-rose-50 border-rose-200/60 text-rose-900"
            : "bg-indigo-50 border-indigo-200/60 text-indigo-900"
        }`}>
          {syncToast.type === "success" && <CheckCircle className="h-4.5 w-4.5 text-emerald-600 flex-shrink-0" />}
          {syncToast.type === "error" && <AlertCircle className="h-4.5 w-4.5 text-rose-600 flex-shrink-0" />}
          {syncToast.type === "info" && <Activity className="h-4.5 w-4.5 text-indigo-600 flex-shrink-0" />}
          <div className="text-xs font-sans leading-tight font-medium">
            {syncToast.message}
          </div>
          <button 
            onClick={() => setSyncToast(null)} 
            className="p-1 hover:bg-black/5 rounded-lg text-gray-400 hover:text-gray-600 cursor-pointer transition-all"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Restore Database Full Flow Modal */}
      {isRestoreModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans text-gray-800">
          <div className="bg-white rounded-3xl border border-gray-100 max-w-md w-full p-6 shadow-2xl relative">
            
            {/* 1. Confirmação Prévia */}
            {restoreStatus === "idle" && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                    <Trash2 className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Restaurar Banco de Dados
                  </h3>
                </div>
                
                <p className="text-xs text-gray-600 leading-relaxed">
                  Todos os lançamentos, categorias, metas, perfil de renda, configurações e dados personalizados serão apagados permanentemente. Deseja continuar?
                </p>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setIsRestoreModalOpen(false)}
                    className="flex-1 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleResetData}
                    className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                  >
                    Restaurar
                  </button>
                </div>
              </div>
            )}

            {/* 2. Executando Restauração (Loading + Barra de Progresso) */}
            {restoreStatus === "running" && (
              <div className="space-y-6 py-4 text-center">
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-600"></div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-gray-900">Restaurando Banco de Dados...</h4>
                  <p className="text-xs text-rose-600 font-medium animate-pulse">{restoreProgressMessage}</p>
                </div>

                {/* Progress Bar Container */}
                <div className="space-y-1">
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-rose-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${restoreProgressPercent}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                    <span>Progresso</span>
                    <span>{restoreProgressPercent}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Sucesso */}
            {restoreStatus === "success" && (
              <div className="space-y-5 text-center py-4">
                <div className="flex justify-center">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full">
                    <CheckCircle className="h-10 w-10" />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Sucesso!</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Banco de dados restaurado com sucesso.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      setIsRestoreModalOpen(false);
                      setRestoreStatus("idle");
                      setActiveTab("dashboard");
                    }}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                  >
                    Voltar ao Dashboard
                  </button>
                </div>
              </div>
            )}

            {/* 4. Erro */}
            {restoreStatus === "error" && (
              <div className="space-y-5 text-center py-4">
                <div className="flex justify-center">
                  <div className="p-3 bg-rose-50 text-rose-600 rounded-full">
                    <AlertCircle className="h-10 w-10" />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Falha na Restauração</h4>
                  <p className="text-xs text-rose-700 font-medium leading-relaxed font-mono break-words">
                    {restoreErrorMessage}
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setIsRestoreModalOpen(false);
                      setRestoreStatus("idle");
                    }}
                    className="flex-1 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                  >
                    Fechar
                  </button>
                  <button
                    onClick={handleResetData}
                    className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                  >
                    Tentar Novamente
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Excluir Todos os Dados Full Flow Modal */}
      {isDeleteDataModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans text-gray-800">
          <div className="bg-white rounded-3xl border border-gray-100 max-w-md w-full p-6 shadow-2xl relative">
            
            {/* ETAPA 1: Pergunta do Backup */}
            {deleteStep === "backup_prompt" && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Backup de Segurança
                  </h3>
                </div>
                
                <p className="text-xs text-gray-600 leading-relaxed">
                  Deseja gerar e baixar um backup dos seus dados financeiros (JSON) antes de excluí-los permanentemente da nuvem?
                </p>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={() => {
                      handleDownloadBackup();
                      setDeleteCountdown(5);
                      setDeleteStep("confirm");
                    }}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer text-center flex items-center justify-center gap-2 font-display"
                  >
                    Sim, gerar backup
                  </button>
                  <button
                    onClick={() => {
                      setDeleteCountdown(5);
                      setDeleteStep("confirm");
                    }}
                    className="w-full py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                  >
                    Não, excluir mesmo assim
                  </button>
                  <button
                    onClick={() => setIsDeleteDataModalOpen(false)}
                    className="w-full py-2.5 text-xs text-gray-400 hover:text-gray-600 transition-all cursor-pointer text-center"
                  >
                    Cancelar Operação
                  </button>
                </div>
              </div>
            )}

            {/* ETAPA 2: Confirmação Principal (Mensagem com Countdown de 5s) */}
            {deleteStep === "confirm" && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                  <div className="p-2 bg-red-50 text-red-600 rounded-xl">
                    <Trash2 className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Excluir Todos os Dados
                  </h3>
                </div>
                
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[11px] text-red-800 leading-relaxed">
                  Esta ação excluirá permanentemente todos os seus dados da aplicação. Você perderá lançamentos, categorias, metas, perfil de renda, configurações e histórico. Esta operação não poderá ser desfeita.
                </div>

                {deleteCountdown > 0 ? (
                  <p className="text-[11px] text-center text-gray-500 italic">
                    Aguarde {deleteCountdown} segundos para confirmar...
                  </p>
                ) : (
                  <p className="text-[11px] text-center text-emerald-600 font-bold">
                    Confirmação liberada para prosseguir.
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setIsDeleteDataModalOpen(false)}
                    className="flex-1 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={deleteCountdown > 0}
                    onClick={() => setDeleteStep("extra_confirm")}
                    className={`flex-1 py-3 text-white rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                      deleteCountdown > 0 
                        ? "bg-gray-300 cursor-not-allowed text-gray-500" 
                        : "bg-red-600 hover:bg-red-700 shadow-sm"
                    }`}
                  >
                    Excluir Permanentemente
                  </button>
                </div>
              </div>
            )}

            {/* ETAPA 3: Confirmação Extra com digitação "EXCLUIR" */}
            {deleteStep === "extra_confirm" && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                  <div className="p-2 bg-red-50 text-red-600 rounded-xl">
                    <Lock className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Confirmação Extra
                  </h3>
                </div>
                
                <p className="text-xs text-gray-600 leading-relaxed">
                  Para evitar exclusões acidentais, digite exatamente o termo <strong className="text-red-600 font-mono text-xs">EXCLUIR</strong> na caixa de texto abaixo:
                </p>

                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Digite EXCLUIR"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all text-center font-mono font-bold text-sm tracking-widest text-red-600 uppercase"
                />

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setDeleteStep("confirm")}
                    className="flex-1 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                  >
                    Voltar
                  </button>
                  <button
                    disabled={deleteConfirmText !== "EXCLUIR"}
                    onClick={() => setDeleteStep("choose_option")}
                    className={`flex-1 py-3 text-white rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                      deleteConfirmText !== "EXCLUIR"
                        ? "bg-gray-300 cursor-not-allowed text-gray-500"
                        : "bg-red-600 hover:bg-red-700 shadow-sm"
                    }`}
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            )}

            {/* ETAPA 4: Escolha de Destino da Conta */}
            {deleteStep === "choose_option" && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                  <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                    <UserIcon className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Opções da Conta
                  </h3>
                </div>
                
                <p className="text-xs text-gray-600 leading-relaxed">
                  Selecione o destino de sua conta após todos os dados serem limpos do Firestore:
                </p>

                <div className="space-y-3">
                  <button 
                    type="button"
                    onClick={() => setDeleteAccountOption("keep")}
                    className={`w-full flex items-start text-left gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      deleteAccountOption === "keep"
                        ? "border-indigo-500 bg-indigo-50/50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="acc_option" 
                      checked={deleteAccountOption === "keep"}
                      onChange={() => setDeleteAccountOption("keep")}
                      className="mt-1"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-gray-900 block">Opção 1: Manter a conta de acesso ativa</span>
                      <span className="text-[10px] text-gray-500 block leading-normal font-normal">
                        Sua conta no Firebase Auth continuará existindo, porém estará totalmente limpa e sem nenhum histórico ou lançamento.
                      </span>
                    </div>
                  </button>

                  <button 
                    type="button"
                    onClick={() => setDeleteAccountOption("delete")}
                    className={`w-full flex items-start text-left gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      deleteAccountOption === "delete"
                        ? "border-red-500 bg-red-50/50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="acc_option" 
                      checked={deleteAccountOption === "delete"}
                      onChange={() => setDeleteAccountOption("delete")}
                      className="mt-1"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-gray-900 block">Opção 2: Excluir também o meu login</span>
                      <span className="text-[10px] text-gray-500 block leading-normal font-normal">
                        Sua conta será totalmente deletada do Firebase Authentication e você será desconectado permanentemente.
                      </span>
                    </div>
                  </button>
                </div>

                <div className="flex gap-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => setDeleteStep("extra_confirm")}
                    className="flex-1 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleDeleteAllData}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer text-center shadow-sm"
                  >
                    Executar Exclusão
                  </button>
                </div>
              </div>
            )}

            {/* ETAPA 5: Executando Exclusão (Loading + Progresso) */}
            {deleteStep === "running" && (
              <div className="space-y-6 py-4 text-center">
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-gray-900">Excluindo permanentemente...</h4>
                  <p className="text-xs text-red-600 font-medium animate-pulse">{deleteProgressMessage}</p>
                </div>

                {/* Progress Bar Container */}
                <div className="space-y-1">
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-red-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${deleteProgressPercent}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                    <span>Progresso</span>
                    <span>{deleteProgressPercent}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* ETAPA 6: Sucesso */}
            {deleteStep === "success" && (
              <div className="space-y-5 text-center py-4">
                <div className="flex justify-center">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full">
                    <CheckCircle className="h-10 w-10" />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Processo Concluído!</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {deleteAccountOption === "delete" 
                      ? "Sua conta foi removida com sucesso."
                      : "Todos os seus dados foram excluídos com sucesso."}
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      setIsDeleteDataModalOpen(false);
                      setDeleteStep("backup_prompt");
                      setActiveTab("dashboard");
                    }}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            )}

            {/* ETAPA 7: Erro */}
            {deleteStep === "error" && (
              <div className="space-y-5 text-center py-4">
                <div className="flex justify-center">
                  <div className="p-3 bg-red-50 text-red-600 rounded-full">
                    <AlertCircle className="h-10 w-10" />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Falha na Operação</h4>
                  <p className="text-xs text-red-700 font-medium leading-relaxed font-mono break-words text-left bg-red-50 p-3 rounded-xl border border-red-100">
                    {deleteErrorMessage}
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setIsDeleteDataModalOpen(false);
                      setDeleteStep("backup_prompt");
                    }}
                    className="flex-1 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                  >
                    Fechar
                  </button>
                  <button
                    onClick={handleDeleteAllData}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                  >
                    Tentar Novamente
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Floating Developer Debugging Console */}
      <DevConsole />

    </div>
  );
}
