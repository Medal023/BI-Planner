import { auth, db, saveUserBudgetData, saveUserIncomeProfile, updateUserPreferences } from "../firebase";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

export interface SyncLog {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
  detail?: any;
}

export interface QueueItem {
  id: string;
  type: "budget" | "income" | "prefs";
  uid: string;
  data: any;
  timestamp: string;
  attempts: number;
}

export interface SyncState {
  isOnline: boolean;
  isFirestoreAvailable: boolean;
  isTokenValid: boolean;
  isConfigMatched: boolean;
  isSyncing: boolean;
  syncStatus: "synced" | "syncing" | "offline" | "error";
  queueLength: number;
  logs: SyncLog[];
}

type Subscriber = (state: SyncState) => void;

class SyncManager {
  private subscribers: Set<Subscriber> = new Set();
  private isOnline: boolean = navigator.onLine;
  private isFirestoreAvailable: boolean = true;
  private isTokenValid: boolean = true;
  private isConfigMatched: boolean = true;
  private isSyncing: boolean = false;
  private syncStatus: "synced" | "syncing" | "offline" | "error" = "synced";
  private queue: QueueItem[] = [];
  private logs: SyncLog[] = [];
  private maxRetries = 3;

  constructor() {
    this.loadQueue();
    this.addLog("info", "Motor de Sincronização Inteligente Inicializado", {
      projectId: firebaseConfig.projectId,
      isOnline: this.isOnline
    });

    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.handleConnectionChange(true));
      window.addEventListener("offline", () => this.handleConnectionChange(false));
    }

    // Periodically run quick health checks
    setInterval(() => this.runHealthCheck(), 60000);
    this.runHealthCheck();
  }

  // Subscribe to state changes
  public subscribe(sub: Subscriber): () => void {
    this.subscribers.add(sub);
    sub(this.getState());
    return () => {
      this.subscribers.delete(sub);
    };
  }

  private notify() {
    const state = this.getState();
    this.subscribers.forEach((sub) => sub(state));
  }

  public getState(): SyncState {
    return {
      isOnline: this.isOnline,
      isFirestoreAvailable: this.isFirestoreAvailable,
      isTokenValid: this.isTokenValid,
      isConfigMatched: this.isConfigMatched,
      isSyncing: this.isSyncing,
      syncStatus: this.syncStatus,
      queueLength: this.queue.length,
      logs: [...this.logs]
    };
  }

  // Add highly detailed console & visual logs
  public addLog(level: "info" | "warn" | "error" | "success", message: string, detail?: any) {
    const newLog: SyncLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      level,
      message,
      detail: detail ? JSON.parse(JSON.stringify(detail)) : undefined
    };

    // Keep logs size bounded (e.g., max 100 logs)
    this.logs = [newLog, ...this.logs].slice(0, 100);
    
    // Console log with appropriate style
    const color = level === "success" ? "color: #10B981; font-weight: bold;" :
                  level === "error" ? "color: #EF4444; font-weight: bold;" :
                  level === "warn" ? "color: #F59E0B; font-weight: bold;" : "color: #3B82F6;";
    console.log(`%c[SyncEngine] [${level.toUpperCase()}] ${message}`, color, detail || "");

    this.notify();
  }

  // Handle network status transitions
  private handleConnectionChange(online: boolean) {
    this.isOnline = online;
    if (online) {
      this.addLog("success", "Conexão com a Internet Restabelecida. Iniciando sincronização da fila offline...");
      this.flushQueue();
    } else {
      this.syncStatus = "offline";
      this.addLog("warn", "Sem conexão de rede disponível. Todas as gravações serão guardadas localmente.");
    }
    this.notify();
  }

  // Save offline queue to localStorage
  private saveQueue() {
    localStorage.setItem("bi_offline_queue_2026", JSON.stringify(this.queue));
    this.notify();
  }

  // Load offline queue from localStorage
  private loadQueue() {
    try {
      const stored = localStorage.getItem("bi_offline_queue_2026");
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (e) {
      console.error("Falha ao recuperar fila offline:", e);
    }
  }

  // Verify full diagnostics and user document state
  public async diagnose(): Promise<{
    isOnline: boolean;
    isFirestoreAvailable: boolean;
    isTokenValid: boolean;
    isConfigMatched: boolean;
    userState: string;
    errors: string[];
  }> {
    const errors: string[] = [];
    const status = {
      isOnline: navigator.onLine,
      isFirestoreAvailable: true,
      isTokenValid: true,
      isConfigMatched: true,
      userState: "Não autenticado",
      errors
    };

    // 1. Connection check
    this.isOnline = status.isOnline;
    if (!status.isOnline) {
      errors.push("Sem conexão ativa de internet.");
    }

    // 2. Project ID match verification
    try {
      const configProj = firebaseConfig.projectId;
      if (!configProj) {
        status.isConfigMatched = false;
        errors.push("Projeto Firebase não está definido na configuração.");
      }
      this.isConfigMatched = status.isConfigMatched;
    } catch (err) {
      status.isConfigMatched = false;
      errors.push("Falha ao verificar arquivo de configuração do Firebase.");
    }

    // 3. User Authentication & Token Check
    const currentUser = auth.currentUser;
    if (!currentUser) {
      status.userState = "Sessão offline / Usuário convidado";
    } else {
      status.userState = `Autenticado: ${currentUser.email} (${currentUser.uid})`;
      try {
        // Refresh token to verify validity
        const token = await currentUser.getIdToken(true);
        status.isTokenValid = !!token;
        this.isTokenValid = true;
      } catch (tokenErr) {
        status.isTokenValid = false;
        this.isTokenValid = false;
        errors.push("Token de autenticação expirado ou inválido.");
      }
    }

    // 4. Firestore Availability Check
    if (currentUser && status.isOnline && status.isTokenValid) {
      try {
        const userDocRef = doc(db, "users", currentUser.uid);
        // Fast test fetch with metadata cache bypass if possible
        const docSnap = await getDoc(userDocRef);
        status.isFirestoreAvailable = true;
        this.isFirestoreAvailable = true;

        // Self-Healing: Auto-create user document if it's missing in Cloud
        if (!docSnap.exists() && currentUser.uid !== "demo_user_2026") {
          this.addLog("warn", "Documento de perfil do usuário não encontrado na nuvem. Criando automaticamente...");
          const profilePayload = {
            uid: currentUser.uid,
            nome: currentUser.displayName || "Usuário",
            email: currentUser.email || "",
            telefone: currentUser.phoneNumber || "",
            foto: currentUser.photoURL || "",
            provedor_login: currentUser.providerData?.[0]?.providerId || "password",
            email_verificado: currentUser.emailVerified,
            data_criacao: new Date().toISOString(),
            ultimo_login: new Date().toISOString(),
            status: "active",
            perfil: "user",
            preferencias: { theme: "light" }
          };
          await setDoc(userDocRef, profilePayload);
          this.addLog("success", "O documento do usuário foi criado automaticamente no Firestore.");
        }
      } catch (firestoreErr: any) {
        status.isFirestoreAvailable = false;
        this.isFirestoreAvailable = false;
        errors.push(`Firestore inacessível: ${firestoreErr.message}`);
      }
    }

    this.notify();
    return status;
  }

  // Periodic lightweight health checks
  private async runHealthCheck() {
    this.isOnline = navigator.onLine;
    if (this.isOnline && auth.currentUser && auth.currentUser.uid !== "demo_user_2026") {
      try {
        const userDocRef = doc(db, "users", auth.currentUser.uid);
        await getDoc(userDocRef);
        this.isFirestoreAvailable = true;
        this.isTokenValid = true;
      } catch (e) {
        // Don't log full stack trace here to avoid polluting console, just track state
        this.isFirestoreAvailable = false;
      }
    }
    this.notify();
  }

  // Clean translation of Firebase error codes to friendly Portuguese notifications
  public parseFirestoreError(error: any): { code: string; message: string; isTransient: boolean } {
    const errMsg = error?.message || String(error);
    const code = error?.code || "unknown";

    let friendlyMessage = "Erro desconhecido ao sincronizar com o banco de dados.";
    let isTransient = false;

    // Check code or message substrings
    if (code === "permission-denied" || errMsg.toLowerCase().includes("permission") || errMsg.toLowerCase().includes("insufficient")) {
      friendlyMessage = "Permissão negada pelo Firestore. Suas regras de segurança não permitem esta gravação. Verifique se seu perfil de usuário está ativo ou se você está tentando gravar dados de outro usuário.";
      isTransient = false;
    } else if (code === "unauthenticated" || errMsg.toLowerCase().includes("unauthenticated")) {
      friendlyMessage = "Você não está autenticado ou sua sessão expirou. Por favor, realize o login novamente.";
      isTransient = false;
    } else if (code === "unavailable" || errMsg.toLowerCase().includes("unavailable") || errMsg.toLowerCase().includes("offline")) {
      friendlyMessage = "O serviço do Firestore está temporariamente indisponível. Seus dados foram salvos localmente e serão sincronizados assim que o serviço retornar.";
      isTransient = true;
    } else if (code === "network-request-failed" || errMsg.toLowerCase().includes("network") || errMsg.toLowerCase().includes("failed-precondition")) {
      friendlyMessage = "Sem conexão com a internet ou erro de rede temporário. A alteração foi salva localmente e sincronizará em breve.";
      isTransient = true;
    } else if (code === "deadline-exceeded") {
      friendlyMessage = "O tempo limite da operação foi excedido pelo Firestore. O sistema tentará novamente em segundo plano.";
      isTransient = true;
    } else if (code === "not-found") {
      friendlyMessage = "O documento ou coleção solicitado não foi encontrado no banco de dados.";
      isTransient = false;
    } else if (code === "invalid-argument") {
      friendlyMessage = "Argumento ou formato de dados inválido enviado ao Firestore. Os dados foram rejeitados por integridade.";
      isTransient = false;
    } else if (code === "resource-exhausted") {
      friendlyMessage = "Cota de requisições do Firestore excedida para hoje. As operações permanecerão salvas localmente até a liberação de limites.";
      isTransient = true;
    } else if (code === "internal") {
      friendlyMessage = "Erro interno do servidor do Firebase. Sincronização agendada para repetição automática.";
      isTransient = true;
    }

    return { code, message: friendlyMessage, isTransient };
  }

  // Smart Save Orchestrator supporting queueing and auto-retry
  public async executeSave(
    type: "budget" | "income" | "prefs",
    uid: string,
    data: any,
    manualTrigger: boolean = false
  ): Promise<{ success: boolean; message: string; fromCache: boolean }> {
    const startTime = Date.now();
    const isDemo = uid === "demo_user_2026";

    this.addLog("info", `Iniciando gravação de [${type.toUpperCase()}] para UID: ${uid}`, {
      isDemoUser: isDemo,
      isOnline: this.isOnline,
      payloadSize: JSON.stringify(data).length
    });

    // 1. Data Validation Check
    if (!data || (Array.isArray(data) && data.length === 0)) {
      this.addLog("warn", `Gravação rejeitada: Dados de [${type}] vazios ou inválidos.`);
      return { success: false, message: "Dados vazios ou inválidos. Gravação cancelada.", fromCache: false };
    }

    // 2. Demo user bypass to localStorage
    if (isDemo) {
      if (type === "budget") {
        localStorage.setItem("bi_budget_data_2026", JSON.stringify(data));
      } else if (type === "income") {
        localStorage.setItem(`bi_income_profile_${uid}`, JSON.stringify(data));
      } else {
        localStorage.setItem(`bi_prefs_${uid}`, JSON.stringify(data));
      }

      this.addLog("success", `Gravado localmente com sucesso (Usuário Convidado/Demo)`, {
        elapsedMs: Date.now() - startTime
      });
      return { success: true, message: "Dados salvos localmente com sucesso.", fromCache: true };
    }

    // 3. Offline queuing if completely offline
    if (!this.isOnline) {
      this.queueOperation(type, uid, data);
      this.addLog("warn", `Fila offline: Gravação de [${type}] guardada no cache local. Conexão inativa.`);
      return {
        success: true,
        message: "Sem conexão com a internet. Seus dados foram salvos offline e serão transmitidos em breve.",
        fromCache: true
      };
    }

    // 4. Diagnostic pre-check before writing
    this.isSyncing = true;
    this.syncStatus = "syncing";
    this.notify();

    let attempt = 0;
    let delay = 1000;

    while (attempt < this.maxRetries) {
      try {
        attempt++;
        this.addLog("info", `Tentativa ${attempt} de ${this.maxRetries} para gravar no Firestore...`);

        // Check authentication token freshness dynamically
        const tokenCheck = await auth.currentUser?.getIdToken();
        if (!tokenCheck) {
          throw { code: "unauthenticated", message: "User is unauthenticated." };
        }

        // Auto-healing user profile guarantee
        if (attempt === 1) {
          const userDocRef = doc(db, "users", uid);
          const userSnap = await getDoc(userDocRef);
          if (!userSnap.exists()) {
            this.addLog("warn", "Garantindo documento base de usuário ausente...");
            await setDoc(userDocRef, {
              uid,
              nome: auth.currentUser?.displayName || "Usuário",
              email: auth.currentUser?.email || "",
              provedor_login: auth.currentUser?.providerData?.[0]?.providerId || "password",
              email_verificado: auth.currentUser?.emailVerified || false,
              data_criacao: new Date().toISOString(),
              ultimo_login: new Date().toISOString(),
              status: "active",
              perfil: "user"
            });
            this.addLog("success", "O documento do usuário foi criado automaticamente.");
          }
        }

        // Execute raw call
        if (type === "budget") {
          await saveUserBudgetData(uid, data);
        } else if (type === "income") {
          await saveUserIncomeProfile(uid, data);
        } else if (type === "prefs") {
          await updateUserPreferences(uid, data);
        }

        const duration = Date.now() - startTime;
        this.addLog("success", `Sincronização concluída com sucesso para [${type}]`, {
          durationMs: duration,
          attempt,
          uid
        });

        this.isSyncing = false;
        this.syncStatus = "synced";
        this.isFirestoreAvailable = true;
        this.notify();

        return { success: true, message: "Dados salvos com sucesso.", fromCache: false };

      } catch (err: any) {
        const errorInfo = this.parseFirestoreError(err);
        this.addLog("warn", `Tentativa ${attempt} falhou: ${errorInfo.message}`, {
          rawError: err,
          code: errorInfo.code,
          stack: err?.stack
        });

        // If permanent error (e.g., rules permission denied), do not retry and do not queue offline
        if (!errorInfo.isTransient) {
          this.isSyncing = false;
          this.syncStatus = "error";
          this.notify();
          return { success: false, message: errorInfo.message, fromCache: false };
        }

        // Exponential backoff delay
        if (attempt < this.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 1.5;
        }
      }
    }

    // Retries exhausted
    this.isSyncing = false;
    this.syncStatus = "error";
    this.queueOperation(type, uid, data);
    this.notify();

    return {
      success: false,
      message: "Falha temporária de comunicação. Os dados foram salvos offline e o sistema tentará reenviar em instantes.",
      fromCache: true
    };
  }

  // Add items to offline persistence queue
  private queueOperation(type: "budget" | "income" | "prefs", uid: string, data: any) {
    // Check if we already have a pending operation of the same type to override it
    const existingIndex = this.queue.findIndex((q) => q.type === type && q.uid === uid);
    const newItem: QueueItem = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      uid,
      data,
      timestamp: new Date().toISOString(),
      attempts: 0
    };

    if (existingIndex > -1) {
      this.queue[existingIndex] = newItem;
    } else {
      this.queue.push(newItem);
    }

    this.saveQueue();
    this.addLog("info", `Operação de [${type}] adicionada à fila offline.`);
  }

  // Process all queued writes
  public async flushQueue() {
    if (this.queue.length === 0) return;
    if (!this.isOnline) {
      this.addLog("warn", "Flush abortado: Dispositivo offline.");
      return;
    }

    this.isSyncing = true;
    this.syncStatus = "syncing";
    this.notify();

    this.addLog("info", `Processando fila offline (${this.queue.length} pendentes)...`);
    const activeQueue = [...this.queue];

    for (const item of activeQueue) {
      try {
        const result = await this.executeSave(item.type, item.uid, item.data, false);
        if (result.success && !result.fromCache) {
          // Successfully transmitted, remove from queue
          this.queue = this.queue.filter((q) => q.id !== item.id);
          this.saveQueue();
        } else {
          // Unsuccessful or permanently rejected
          const idx = this.queue.findIndex((q) => q.id === item.id);
          if (idx > -1) {
            this.queue[idx].attempts++;
            if (this.queue[idx].attempts >= 5) {
              // Purge persistently failing items to avoid lock
              this.addLog("error", `Lançamento offline de [${item.type}] excedeu tentativas e foi descartado para manter consistência.`);
              this.queue = this.queue.filter((q) => q.id !== item.id);
              this.saveQueue();
            }
          }
        }
      } catch (flushErr) {
        console.error("Erro ao flushar item:", flushErr);
      }
    }

    this.isSyncing = false;
    this.syncStatus = this.queue.length === 0 ? "synced" : "error";
    this.notify();
  }

  // Restore database to defaults after performing a backup and deleting user data
  public async restoreDatabase(
    uid: string,
    onProgress: (percent: number, message: string) => void
  ): Promise<{ success: boolean; message: string }> {
    const startTime = Date.now();
    this.addLog("info", `[RESTAURAR BANCO DE DADOS] Iniciando restauração completa para o usuário ${uid}...`);
    onProgress(5, "Verificando autenticação e permissões...");

    // 1. Validar autenticação e Token do Firebase
    const currentUser = auth.currentUser;
    if (!currentUser) {
      this.addLog("error", "[RESTAURAR BANCO DE DADOS] Falha: Usuário não autenticado.");
      return { success: false, message: "Usuário não autenticado. Por favor, faça login novamente." };
    }
    if (currentUser.uid !== uid) {
      this.addLog("error", "[RESTAURAR BANCO DE DADOS] Falha de Segurança: UID do usuário logado não corresponde ao UID solicitado.");
      return { success: false, message: "Erro de segurança: UID inválido ou inconsistente." };
    }

    try {
      this.addLog("info", "[RESTAURAR BANCO DE DADOS] Validando token de autenticação...");
      const idToken = await currentUser.getIdToken(true);
      if (!idToken) {
        throw new Error("unauthenticated");
      }
    } catch (tokenErr: any) {
      this.addLog("error", "[RESTAURAR BANCO DE DADOS] Token inválido ou expirado.", tokenErr);
      return { success: false, message: "Seu login expirou. Por favor, reconecte sua conta antes de continuar." };
    }

    onProgress(15, "Iniciando backup preventivo de segurança...");
    
    // 2. Realizar Backup Automático
    let budgetBackup: any = null;
    let incomeBackup: any = null;

    try {
      this.addLog("info", "[RESTAURAR BANCO DE DADOS] Carregando dados de planejamento para o backup...");
      const budgetSnap = await getDoc(doc(db, "users", uid, "budget", "data"));
      if (budgetSnap.exists()) {
        budgetBackup = budgetSnap.data();
      } else {
        // Fallback para localStorage
        const localBudgetData = localStorage.getItem("bi_budget_data_2026");
        if (localBudgetData) {
          budgetBackup = { data: localBudgetData, updatedAt: new Date().toISOString() };
        }
      }
    } catch (e) {
      this.addLog("warn", "[RESTAURAR BANCO DE DADOS] Falha ao carregar orçamento do Firestore. Buscando do cache local...");
      const localBudgetData = localStorage.getItem("bi_budget_data_2026");
      if (localBudgetData) {
        budgetBackup = { data: localBudgetData, updatedAt: new Date().toISOString() };
      }
    }

    try {
      this.addLog("info", "[RESTAURAR BANCO DE DADOS] Carregando perfil de renda para o backup...");
      const incomeSnap = await getDoc(doc(db, "income_profile", uid));
      if (incomeSnap.exists()) {
        incomeBackup = incomeSnap.data();
      }
    } catch (e) {
      this.addLog("warn", "[RESTAURAR BANCO DE DADOS] Falha ao ler perfil de renda do Firestore.");
    }

    const timestampISO = new Date().toISOString();
    // Substituir caracteres que podem causar problemas em IDs de documentos
    const docIdTimestamp = timestampISO.replace(/[:.]/g, "-");

    const backupPayload = {
      uid,
      timestamp: timestampISO,
      budgetData: budgetBackup,
      incomeProfile: incomeBackup,
      categories: null,
      goals: null,
      settings: null,
      dashboard: null,
      history: null,
      metadata: {
        restoredAt: timestampISO,
        restorationTriggered: true,
        version: "1.0.0"
      }
    };

    try {
      this.addLog("info", `[RESTAURAR BANCO DE DADOS] Salvando snapshot em backup/${uid}/history/${docIdTimestamp}...`);
      await setDoc(doc(db, "backup", uid, "history", docIdTimestamp), backupPayload);
      this.addLog("success", "[RESTAURAR BANCO DE DADOS] Backup concluído e persistido com sucesso.");
    } catch (backupErr: any) {
      this.addLog("error", "[RESTAURAR BANCO DE DADOS] Falha crítica ao criar backup. Operação abortada por segurança.", backupErr);
      return { success: false, message: "Erro ao realizar backup de segurança. A restauração foi cancelada para proteger seus dados." };
    }

    onProgress(40, "Processando remoção segura de dados...");

    // 3. Exclusão de Coleções / Documentos do Usuário
    const pathsToDelete = [
      { name: "users/{UID}", ref: doc(db, "users", uid) },
      { name: "users/{UID}/budget/data", ref: doc(db, "users", uid, "budget", "data") },
      { name: "income_profile/{UID}", ref: doc(db, "income_profile", uid) },
      { name: "transactions/{UID}", ref: doc(db, "transactions", uid) },
      { name: "categories/{UID}", ref: doc(db, "categories", uid) },
      { name: "goals/{UID}", ref: doc(db, "goals", uid) },
      { name: "settings/{UID}", ref: doc(db, "settings", uid) },
      { name: "dashboard/{UID}", ref: doc(db, "dashboard", uid) },
      { name: "history/{UID}", ref: doc(db, "history", uid) },
      { name: "notifications/{UID}", ref: doc(db, "notifications", uid) }
    ];

    let deletedCount = 0;
    for (let i = 0; i < pathsToDelete.length; i++) {
      const item = pathsToDelete[i];
      const stepPercent = 40 + Math.floor((i / pathsToDelete.length) * 30);
      onProgress(stepPercent, `Excluindo dados de ${item.name}...`);
      
      try {
        this.addLog("info", `[RESTAURAR BANCO DE DADOS] Excluindo documento: ${item.name}...`);
        await deleteDoc(item.ref);
        deletedCount++;
      } catch (delErr: any) {
        const errorInfo = this.parseFirestoreError(delErr);
        this.addLog("warn", `[RESTAURAR BANCO DE DADOS] Falha ao excluir opcional ${item.name}: ${errorInfo.message}`, {
          code: errorInfo.code,
          message: delErr?.message
        });
        // Se for um erro crítico de falta de conexão ou indisponibilidade, ou permission-denied impeditiva:
        if (errorInfo.code === "permission-denied") {
          return { success: false, message: "Permissão negada pelo Firestore para remover dados." };
        }
      }
    }

    onProgress(75, "Recriando estruturas de dados padrão...");

    // 4. Restauração Completa de Dados Padrão
    try {
      // Recriar users/{UID}
      this.addLog("info", "[RESTAURAR BANCO DE DADOS] Restaurando documento de perfil de usuário...");
      const profilePayload = {
        uid,
        nome: currentUser.displayName || "Usuário",
        email: currentUser.email || "",
        telefone: currentUser.phoneNumber || "",
        foto: currentUser.photoURL || "",
        provedor_login: currentUser.providerData?.[0]?.providerId || "password",
        email_verificado: currentUser.emailVerified,
        data_criacao: new Date().toISOString(),
        ultimo_login: new Date().toISOString(),
        status: "active",
        perfil: "user",
        preferencias: { theme: "light" }
      };
      await setDoc(doc(db, "users", uid), profilePayload);

      // Recriar perfil de renda padrão: Salário Base R$ 0,00, Rendas Extras [], historico []
      this.addLog("info", "[RESTAURAR BANCO DE DADOS] Restaurando perfil de renda padrão...");
      const defaultIncomeProfile = {
        salarioBase: 0,
        rendasExtras: [],
        rendaTotal: 0,
        frequencia: "Mensal",
        ultimaAtualizacao: new Date().toISOString(),
        usuario: uid,
        historico: []
      };
      await setDoc(doc(db, "income_profile", uid), defaultIncomeProfile);

      onProgress(90, "Restaurando planejamento financeiro padrão...");

      // Limpar cache local do localStorage
      localStorage.removeItem("bi_budget_data_2026");
      localStorage.removeItem(`bi_income_profile_${uid}`);

      this.addLog("success", "[RESTAURAR BANCO DE DADOS] Banco de dados restaurado com sucesso para os padrões originais.", {
        elapsedMs: Date.now() - startTime,
        deletedCount
      });

      onProgress(100, "Banco de dados restaurado com sucesso!");
      return { success: true, message: "Banco de dados restaurado com sucesso." };

    } catch (restoreErr: any) {
      this.addLog("error", "[RESTAURAR BANCO DE DADOS] Falha crítica ao reconstruir estruturas padrão.", restoreErr);
      return { success: false, message: "Falha na reconstrução das coleções padrão do Firebase." };
    }
  }

  // Completely delete all user data from Firestore and clean up local caches
  public async deleteAllUserData(
    uid: string,
    onProgress: (percent: number, message: string) => void
  ): Promise<{ success: boolean; message: string }> {
    const startTime = Date.now();
    this.addLog("info", `[EXCLUIR TODOS OS DADOS] Iniciando remoção completa dos dados para o usuário ${uid}...`);
    onProgress(5, "Verificando autenticação e permissões...");

    // 1. Validar autenticação e Token do Firebase
    const currentUser = auth.currentUser;
    if (!currentUser) {
      this.addLog("error", "[EXCLUIR TODOS OS DADOS] Falha: Usuário não autenticado.");
      return { success: false, message: "Usuário não autenticado. Por favor, conecte-se novamente." };
    }
    if (currentUser.uid !== uid) {
      this.addLog("error", "[EXCLUIR TODOS OS DADOS] Falha de Segurança: UID do usuário logado não corresponde ao solicitado.");
      return { success: false, message: "Erro de segurança: inconsistência no identificador do usuário." };
    }

    try {
      this.addLog("info", "[EXCLUIR TODOS OS DADOS] Validando token de autenticação...");
      const idToken = await currentUser.getIdToken(true);
      if (!idToken) {
        throw new Error("unauthenticated");
      }
    } catch (tokenErr: any) {
      this.addLog("error", "[EXCLUIR TODOS OS DADOS] Token inválido ou expirado.", tokenErr);
      return { success: false, message: "Sessão expirada. reconecte para confirmar a identidade." };
    }

    onProgress(15, "Preparando lista de exclusão...");

    // 2. Definir caminhos no Firestore associados ao UID do usuário
    const pathsToDelete = [
      { name: "users/{UID}/budget/data", ref: doc(db, "users", uid, "budget", "data") },
      { name: "users/{UID}", ref: doc(db, "users", uid) },
      { name: "income_profile/{UID}", ref: doc(db, "income_profile", uid) },
      { name: "transactions/{UID}", ref: doc(db, "transactions", uid) },
      { name: "categories/{UID}", ref: doc(db, "categories", uid) },
      { name: "goals/{UID}", ref: doc(db, "goals", uid) },
      { name: "settings/{UID}", ref: doc(db, "settings", uid) },
      { name: "dashboard/{UID}", ref: doc(db, "dashboard", uid) },
      { name: "history/{UID}", ref: doc(db, "history", uid) },
      { name: "notifications/{UID}", ref: doc(db, "notifications", uid) }
    ];

    let deletedCount = 0;
    for (let i = 0; i < pathsToDelete.length; i++) {
      const item = pathsToDelete[i];
      const stepPercent = 15 + Math.floor((i / pathsToDelete.length) * 70);
      onProgress(stepPercent, `Excluindo dados de ${item.name}...`);
      
      try {
        this.addLog("info", `[EXCLUIR TODOS OS DADOS] Excluindo documento: ${item.name}...`);
        await deleteDoc(item.ref);
        deletedCount++;
      } catch (delErr: any) {
        const errorInfo = this.parseFirestoreError(delErr);
        this.addLog("error", `[EXCLUIR TODOS OS DADOS] Erro ao excluir ${item.name}: ${errorInfo.message}`, {
          code: errorInfo.code,
          message: delErr?.message
        });
        console.error(`[Excluir Dados] Falha ao remover ${item.name}:`, delErr);
        
        // Tratamento individual para erros específicos do Firestore
        if (errorInfo.code === "permission-denied") {
          return { success: false, message: "permission-denied: Permissão negada pelo banco de dados." };
        } else if (errorInfo.code === "unauthenticated") {
          return { success: false, message: "unauthenticated: Sessão inválida ou expirada." };
        } else if (errorInfo.code === "network-request-failed") {
          return { success: false, message: "network-request-failed: Falha de conexão com a rede." };
        } else if (errorInfo.code === "unavailable") {
          return { success: false, message: "unavailable: Serviço Firestore temporariamente indisponível." };
        } else if (errorInfo.code === "internal") {
          return { success: false, message: "internal: Erro interno no servidor Firestore." };
        } else if (errorInfo.code === "timeout" || errorInfo.code === "deadline-exceeded") {
          return { success: false, message: "timeout: Tempo limite da requisição excedido." };
        } else if (errorInfo.code === "not-found") {
          // Ignorar silenciosamente conforme o requisito
          continue;
        }
      }
    }

    onProgress(90, "Limpando caches locais e IndexedDB...");

    // 3. Limpar caches locais, LocalStorage, SessionStorage e IndexedDB
    try {
      localStorage.clear();
      sessionStorage.clear();

      if (window.indexedDB) {
        const dbs = await window.indexedDB.databases?.();
        if (dbs) {
          for (const dbInfo of dbs) {
            if (dbInfo.name) {
              window.indexedDB.deleteDatabase(dbInfo.name);
            }
          }
        }
      }

      if (window.caches) {
        const cacheKeys = await window.caches.keys();
        for (const key of cacheKeys) {
          await window.caches.delete(key);
        }
      }
    } catch (cacheErr) {
      this.addLog("warn", "[EXCLUIR TODOS OS DADOS] Falha não fatal ao limpar caches locais.", cacheErr);
      console.warn("Falha ao limpar caches locais:", cacheErr);
    }

    this.addLog("success", "[EXCLUIR TODOS OS DADOS] Exclusão completa concluída com sucesso.", {
      elapsedMs: Date.now() - startTime,
      deletedCount
    });

    onProgress(100, "Todos os seus dados foram excluídos com sucesso.");
    return { success: true, message: "Todos os seus dados foram excluídos com sucesso." };
  }

  // Clear log history
  public clearLogs() {
    this.logs = [];
    this.notify();
  }
}

export const syncManager = new SyncManager();
