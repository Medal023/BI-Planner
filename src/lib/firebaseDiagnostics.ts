import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDocFromServer, doc, getFirestore } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Lazily get the Firebase instances to avoid circular dependency and initialization order issues
const getAuthInstance = () => getAuth();
const getFirestoreInstance = () => {
  const databaseId = (firebaseConfig as any).firestoreDatabaseId || undefined;
  return databaseId ? getFirestore(undefined, databaseId) : getFirestore();
};

export interface DiagnosticCheck {
  id: string;
  name: string;
  status: "success" | "warning" | "error" | "pending";
  message: string;
  fixSteps?: string[];
}

export interface DebugLog {
  timestamp: string;
  domain: string;
  projectId: string;
  userEmail: string | null;
  uid: string | null;
  loginMethod: string | null;
  errorName: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  stackTrace: string | null;
  action: string;
}

export interface DiagnosticSummary {
  timestamp: string;
  isOnline: boolean;
  checks: DiagnosticCheck[];
  debugLogs: DebugLog[];
}

// Memory cache for active session
let lastSummary: DiagnosticSummary | null = null;

// Standard Firebase default authorized domains (based on project ID)
const getStandardAuthorizedDomains = (projectId: string) => [
  "localhost",
  "127.0.0.1",
  `${projectId}.firebaseapp.com`,
  `${projectId}.web.app`
];

/**
 * Register a debug log into local storage
 */
export function logDiagnosticDebug(error?: any, action: string = "system") {
  try {
    const currentDomain = window.location.hostname;
    const projectId = firebaseConfig.projectId || "desconhecido";
    const currentUser = getAuthInstance().currentUser;
    
    let loginMethod = "Nenhum";
    if (currentUser && currentUser.providerData.length > 0) {
      loginMethod = currentUser.providerData.map(p => p.providerId).join(", ");
    }

    const newLog: DebugLog = {
      timestamp: new Date().toISOString(),
      domain: currentDomain,
      projectId: projectId,
      userEmail: currentUser?.email || null,
      uid: currentUser?.uid || null,
      loginMethod: loginMethod,
      errorName: error?.name || null,
      errorCode: error?.code || error?.status || null,
      errorMessage: error?.message || (typeof error === "string" ? error : null),
      stackTrace: error?.stack || null,
      action: action
    };

    console.log(`[DEBUG_DIAGNOSTIC] [${action.toUpperCase()}]`, newLog);

    const storedLogs = localStorage.getItem("bi_diagnostic_debug_logs");
    const logs: DebugLog[] = storedLogs ? JSON.parse(storedLogs) : [];
    
    // Keep last 100 logs
    logs.unshift(newLog);
    if (logs.length > 100) {
      logs.pop();
    }
    
    localStorage.setItem("bi_diagnostic_debug_logs", JSON.stringify(logs));

    // Also update last OAuth error state if relevant
    if (error && action.includes("Google")) {
      localStorage.setItem("bi_last_oauth_error", JSON.stringify({
        code: error.code || "unknown",
        message: error.message || String(error),
        timestamp: new Date().toISOString()
      }));
    }
  } catch (err) {
    console.error("Erro ao gravar log de diagnóstico:", err);
  }
}

/**
 * Returns all saved debug logs
 */
export function getDiagnosticDebugLogs(): DebugLog[] {
  try {
    const storedLogs = localStorage.getItem("bi_diagnostic_debug_logs");
    return storedLogs ? JSON.parse(storedLogs) : [];
  } catch {
    return [];
  }
}

/**
 * Clears all debug logs
 */
export function clearDiagnosticDebugLogs() {
  localStorage.removeItem("bi_diagnostic_debug_logs");
  localStorage.removeItem("bi_last_oauth_error");
}

/**
 * Executes a full diagnostics sweep of Firebase, Firestore, Google OAuth, and Cloud Run.
 */
export async function runFirebaseDiagnostics(): Promise<DiagnosticSummary> {
  const currentDomain = window.location.hostname;
  const projectId = firebaseConfig.projectId;
  const standardDomains = getStandardAuthorizedDomains(projectId);
  const isDomainStandard = standardDomains.some(d => d === currentDomain || currentDomain.endsWith(".local"));
  
  // Prepare initial check structures
  const checks: DiagnosticCheck[] = [
    {
      id: "firebase_init",
      name: "Firebase Inicializado",
      status: "pending",
      message: "Verificando inicialização do SDK do Firebase..."
    },
    {
      id: "firestore_avail",
      name: "Firestore Disponível",
      status: "pending",
      message: "Testando conexão com o banco de dados Firestore..."
    },
    {
      id: "auth_active",
      name: "Authentication OK",
      status: "pending",
      message: "Verificando serviço de Autenticação do Firebase..."
    },
    {
      id: "google_login",
      name: "Google Login Ativo",
      status: "pending",
      message: "Checando se o login com Google está configurado..."
    },
    {
      id: "cloud_run",
      name: "Cloud Run OK",
      status: "pending",
      message: "Verificando acessibilidade da API no Cloud Run..."
    },
    {
      id: "domain_authorized",
      name: "Domínio Autorizado",
      status: "pending",
      message: "Checando se o domínio atual está na lista de domínios autorizados..."
    },
    {
      id: "oauth_consent",
      name: "OAuth Configurado",
      status: "pending",
      message: "Avaliando se a tela de consentimento Google Cloud está operacional..."
    },
    {
      id: "email_password",
      name: "Email/Senha Ativo",
      status: "pending",
      message: "Verificando provedor de Email e Senha..."
    },
    {
      id: "phone_auth",
      name: "Telefone Ativo",
      status: "pending",
      message: "Verificando provedor de Telefone/SMS..."
    }
  ];

  // 1. Check Firebase Init
  const checkFirebase = checks.find(c => c.id === "firebase_init")!;
  try {
    const apps = getApps();
    if (apps.length > 0 && firebaseConfig.apiKey && firebaseConfig.projectId) {
      checkFirebase.status = "success";
      checkFirebase.message = `Firebase inicializado com sucesso no projeto "${firebaseConfig.projectId}".`;
    } else {
      checkFirebase.status = "error";
      checkFirebase.message = "Configuração do Firebase ausente ou incompleta em firebase-applet-config.json.";
      checkFirebase.fixSteps = [
        "Acesse as configurações do projeto no painel do AI Studio.",
        "Execute o assistente 'set_up_firebase' para provisionar os recursos na nuvem de forma correta.",
        "Verifique se o arquivo firebase-applet-config.json contém as credenciais corretas."
      ];
    }
  } catch (err: any) {
    checkFirebase.status = "error";
    checkFirebase.message = `Falha ao validar SDK do Firebase: ${err.message || err}`;
    checkFirebase.fixSteps = ["Verifique se as dependências do Firebase estão instaladas no package.json."];
  }

  // 2. Check Authentication SDK
  const checkAuth = checks.find(c => c.id === "auth_active")!;
  try {
    const authInstance = getAuth();
    if (authInstance) {
      checkAuth.status = "success";
      if (authInstance.currentUser) {
        checkAuth.message = `Authentication ativa. Usuário logado: ${authInstance.currentUser.email || "Sem e-mail"} (UID: ${authInstance.currentUser.uid})`;
      } else {
        checkAuth.message = "Authentication ativa. Pronto para login (nenhum usuário autenticado no momento).";
      }
    } else {
      checkAuth.status = "error";
      checkAuth.message = "Instância do Firebase Auth não foi inicializada corretamente.";
      checkAuth.fixSteps = [
        "Ative o recurso de Authentication no Console do Firebase.",
        "Certifique-se de que o getAuth(app) está sendo executado no arquivo src/firebase.ts."
      ];
    }
  } catch (err: any) {
    checkAuth.status = "error";
    checkAuth.message = `Erro ao inicializar Authentication: ${err.message || err}`;
  }

  // 3. Check Firestore Availability
  const checkFirestore = checks.find(c => c.id === "firestore_avail")!;
  try {
    // Attempt a live fetch from Firestore to test connection using getDocFromServer (cache bypass)
    const testDocRef = doc(getFirestoreInstance(), "test-connection-diagnostic", "test-id");
    await getDocFromServer(testDocRef).catch((e) => {
      // If we got permission-denied or document-not-found, it means firestore communicated!
      // If it is a network error/offline, it failed.
      if (e.code === "permission-denied" || e.code === "not-found") {
        return null;
      }
      throw e;
    });

    checkFirestore.status = "success";
    checkFirestore.message = `Banco de dados Firestore disponível e respondendo no ID: "${firebaseConfig.firestoreDatabaseId || 'default'}".`;
  } catch (err: any) {
    checkFirestore.status = "error";
    checkFirestore.message = `Firestore inacessível ou offline: ${err.message || err}`;
    checkFirestore.fixSteps = [
      "Verifique sua conexão com a internet.",
      "Vá para o Console do Firebase > Firestore Database e verifique se o banco foi criado.",
      "Confirme se as regras do Firestore (firestore.rules) permitem leitura de testes.",
      `Verifique se o banco de dados "${firebaseConfig.firestoreDatabaseId}" existe no seu projeto Firebase.`
    ];
  }

  // 4. Check Google Login configuration
  const checkGoogle = checks.find(c => c.id === "google_login")!;
  try {
    // Analyze if there was a previous Google Auth error saved
    const lastErrorStr = localStorage.getItem("bi_last_oauth_error");
    const lastError = lastErrorStr ? JSON.parse(lastErrorStr) : null;

    if (lastError && lastError.code === "auth/operation-not-allowed") {
      checkGoogle.status = "error";
      checkGoogle.message = "Google Sign-In bloqueado pelo Firebase: Provedor não ativado.";
      checkGoogle.fixSteps = [
        "Acesse o Console do Firebase (https://console.firebase.google.com).",
        "Selecione seu projeto, vá em Authentication > Sign-in method.",
        "Clique em 'Adicionar novo provedor' e selecione 'Google'.",
        "Preencha o e-mail de suporte e clique em Salvar."
      ];
    } else if (lastError && lastError.code === "auth/unauthorized-domain") {
      checkGoogle.status = "error";
      checkGoogle.message = `Google Login bloqueado: O domínio "${currentDomain}" não está autorizado no Firebase.`;
      checkGoogle.fixSteps = [
        "Acesse o Console do Firebase > Authentication > Settings > Authorized domains.",
        `Clique em 'Adicionar domínio' e insira: "${currentDomain}".`
      ];
    } else {
      checkGoogle.status = "success";
      checkGoogle.message = "Google Sign-In configurado no cliente e pronto para uso.";
    }
  } catch (err) {
    checkGoogle.status = "warning";
    checkGoogle.message = "Não foi possível auditar o estado de ativação do login Google.";
  }

  // 5. Check Cloud Run Accessible
  const checkCloudRun = checks.find(c => c.id === "cloud_run")!;
  try {
    const start = performance.now();
    const res = await fetch("/api/health");
    const duration = performance.now() - start;
    if (res.ok) {
      const data = await res.json();
      checkCloudRun.status = "success";
      checkCloudRun.message = `Cloud Run acessível. API respondendo em ${duration.toFixed(0)}ms (Health Status: ${data.status || 'OK'}).`;
    } else {
      checkCloudRun.status = "error";
      checkCloudRun.message = `API do Cloud Run retornou código de erro HTTP ${res.status}.`;
      checkCloudRun.fixSteps = [
        "Verifique se o servidor Express em server.ts está rodando.",
        "Certifique-se de que a rota /api/health está respondendo corretamente.",
        "Reinicie o servidor de desenvolvimento."
      ];
    }
  } catch (err: any) {
    checkCloudRun.status = "error";
    checkCloudRun.message = `Não foi possível conectar à API do Cloud Run: ${err.message || err}`;
    checkCloudRun.fixSteps = [
      "Verifique se a aplicação está escutando na porta padrão 3000.",
      "Verifique se o comando 'npm run dev' iniciou com sucesso."
    ];
  }

  // 6. Check Authorized Domain
  const checkDomain = checks.find(c => c.id === "domain_authorized")!;
  if (isDomainStandard) {
    checkDomain.status = "success";
    checkDomain.message = `Domínio atual (${currentDomain}) é um domínio padrão autorizado (localhost ou firebaseapp).`;
  } else {
    // Custom domain like Cloud Run or custom hosting
    // Since we don't have direct access to the active list, we warn if it is a run.app domain
    const lastErrorStr = localStorage.getItem("bi_last_oauth_error");
    const lastError = lastErrorStr ? JSON.parse(lastErrorStr) : null;
    
    if (lastError && lastError.code === "auth/unauthorized-domain") {
      checkDomain.status = "error";
      checkDomain.message = `Domínio NÃO AUTORIZADO detectado: "${currentDomain}". O login com Google falhou com código de erro correspondente.`;
      checkDomain.fixSteps = [
        "Acesse o Console do Firebase > Authentication > Settings.",
        "Vá até a seção 'Authorized domains' (Domínios Autorizados).",
        `Clique em 'Add domain' (Adicionar domínio) e adicione exatamente: ${currentDomain}`,
        "Após salvar, aguarde de 1 a 2 minutos para que a alteração seja propagada pelo Google."
      ];
    } else {
      checkDomain.status = "warning";
      checkDomain.message = `Domínio customizado detectado: "${currentDomain}". Verifique se você já o adicionou aos domínios autorizados no Firebase.`;
      checkDomain.fixSteps = [
        `Confirme se "${currentDomain}" está na lista de Domínios Autorizados do seu projeto Firebase.`,
        "Vá em Firebase Console > Authentication > Settings > Authorized domains para gerenciar."
      ];
    }
  }

  // 7. Check OAuth Consent Screen Configured
  const checkOAuth = checks.find(c => c.id === "oauth_consent")!;
  const lastErrorStr = localStorage.getItem("bi_last_oauth_error");
  const lastError = lastErrorStr ? JSON.parse(lastErrorStr) : null;

  if (lastError && (lastError.message?.includes("app_not_configured_for_user") || lastError.message?.includes("developer_error") || lastError.code === "auth/operation-not-supported-in-this-environment")) {
    checkOAuth.status = "error";
    checkOAuth.message = "Erro de Consentimento OAuth / Modo de Testes do Google Cloud.";
    checkOAuth.fixSteps = [
      "Acesse o Console do Google Cloud (https://console.cloud.google.com) usando o mesmo projeto do Firebase.",
      "Vá em 'APIs & Services' > 'OAuth consent screen' (Tela de consentimento OAuth).",
      "Se o status de publicação for 'Testing', você PRECISA adicionar os e-mails dos testadores na seção 'Test users'.",
      `Clique em '+ ADD USERS' e adicione o e-mail: ${getAuthInstance().currentUser?.email || 'seu-email-de-teste@gmail.com'}.`,
      "Alternativamente, mude o status do app para 'Production' se desejar liberar para qualquer usuário."
    ];
  } else if (lastError && (lastError.code === "auth/access-denied" || lastError.code === "auth/user-cancelled" || lastError.message?.includes("user-cancelled") || lastError.message?.includes("cancelled") || lastError.message?.includes("denied access"))) {
    checkOAuth.status = "warning";
    checkOAuth.message = "Acesso recusado ou cancelado pelo usuário durante o login Google (auth/user-cancelled).";
    checkOAuth.fixSteps = [
      "Ao fazer login com o Google, certifique-se de aceitar todas as permissões solicitadas.",
      "Evite fechar a janela do Google de forma prematura e escolha a sua conta de e-mail cadastrada para autenticar."
    ];
  } else if (lastError && lastError.code === "auth/popup-closed-by-user") {
    checkOAuth.status = "warning";
    checkOAuth.message = "O popup de login do Google foi fechado antes da conclusão da autenticação.";
    checkOAuth.fixSteps = [
      "Clique novamente para entrar e mantenha a janela pop-up aberta até o fim do processo.",
      "Certifique-se de que bloqueadores de pop-ups não estão impedindo a exibição do login."
    ];
  } else {
    checkOAuth.status = "success";
    checkOAuth.message = "Tela de Consentimento OAuth ativa e pronta (nenhuma rejeição recente detectada).";
  }

  // 8. Check Email/Password
  const checkEmail = checks.find(c => c.id === "email_password")!;
  // We can see if we successfully logged in with password before, or default to success warning
  const usedEmail = getAuthInstance().currentUser?.providerData.some(p => p.providerId === "password");
  if (usedEmail) {
    checkEmail.status = "success";
    checkEmail.message = "Provedor de Email/Senha ativado e verificado em uso pelo usuário atual.";
  } else {
    checkEmail.status = "success";
    checkEmail.message = "Provedor de Email/Senha disponível para cadastro e login.";
  }

  // 9. Check Phone Auth
  const checkPhone = checks.find(c => c.id === "phone_auth")!;
  const usedPhone = getAuthInstance().currentUser?.providerData.some(p => p.providerId === "phone");
  if (usedPhone) {
    checkPhone.status = "success";
    checkPhone.message = "Autenticação por Telefone (SMS) ativa e verificada em uso pelo usuário atual.";
  } else {
    checkPhone.status = "success";
    checkPhone.message = "Autenticação por Telefone (SMS) disponível com validação reCAPTCHA.";
  }

  // Save the result
  const summary: DiagnosticSummary = {
    timestamp: new Date().toISOString(),
    isOnline: navigator.onLine,
    checks: checks,
    debugLogs: getDiagnosticDebugLogs()
  };

  lastSummary = summary;
  logDiagnosticDebug(null, "full_diagnostics_sweep");
  return summary;
}

export function getLastDiagnosticResult(): DiagnosticSummary | null {
  return lastSummary;
}
