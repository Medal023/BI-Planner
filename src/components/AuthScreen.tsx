import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { 
  Mail, 
  Lock, 
  User as UserIcon, 
  Phone, 
  ShieldCheck, 
  ArrowLeft, 
  Sparkles, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2,
  TableProperties,
  Sun,
  Moon,
  ChevronDown
} from "lucide-react";
import { 
  emailSignUp, 
  emailSignIn, 
  googleSignIn, 
  recoverPassword, 
  setupRecaptcha, 
  sendSmsOtp, 
  resendVerification,
  auth
} from "../firebase";
import { User, ConfirmationResult } from "firebase/auth";
import { logDiagnosticDebug, runFirebaseDiagnostics } from "../lib/firebaseDiagnostics";

interface AuthScreenProps {
  onAuthSuccess: (user: User) => void;
}

type AuthMode = "login" | "register" | "phone" | "otp" | "forgot" | "verification";

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  
  // General Form Inputs
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  
  // Phone Inputs
  const [countryCode, setCountryCode] = useState("+55");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeErrorCode, setActiveErrorCode] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showGoogleHelp, setShowGoogleHelp] = useState(false);

  // Verification Polling / Reload
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Refs
  const recaptchaVerifierRef = useRef<any>(null);

  // Trigger Cooldown timer for email re-send
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Handle Firebase user verification flow
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentUser(user);
        // If login provider is password and email is not verified, force verification screen
        const isPasswordProvider = user.providerData.some(p => p.providerId === 'password');
        if (isPasswordProvider && !user.emailVerified) {
          setMode("verification");
        } else {
          onAuthSuccess(user);
        }
      } else {
        setCurrentUser(null);
      }
    });
    return unsubscribe;
  }, [onAuthSuccess]);

  // Handle password strength calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, text: "Muito Fraca", color: "bg-gray-200", width: "w-0" };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    
    if (score <= 1) return { score, text: "Fraca", color: "bg-red-500", width: "w-1/4" };
    if (score === 2) return { score, text: "Regular", color: "bg-orange-400", width: "w-1/2" };
    if (score === 3) return { score, text: "Boa", color: "bg-indigo-400", width: "w-3/4" };
    return { score, text: "Excelente", color: "bg-emerald-500", width: "w-full" };
  };

  const strength = getPasswordStrength(password);

  // Sanitize Inputs helper
  const sanitize = (val: string) => val.trim();

  // Validate Email
  const validateEmail = (mail: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail);
  };

  // 1. Google Sign-In
  const handleGoogleSignIn = async () => {
    setError(null);
    setActiveErrorCode(null);
    setLoading(true);
    try {
      // 1. Pre-check: Internet connection
      if (!window.navigator.onLine) {
        throw { code: "auth/network-request-failed", message: "Sem conexão com a internet. Verifique sua rede." };
      }

      // 2. Pre-check: Firebase & Provider availability
      const { auth, provider } = await import("../firebase");
      if (!auth) {
        throw { code: "auth/operation-not-supported-in-this-environment", message: "Serviço de autenticação do Firebase indisponível." };
      }
      if (!provider) {
        throw { code: "auth/invalid-client-id", message: "Provedor Google Sign-In não foi devidamente configurado." };
      }

      // 3. Pre-check: Already authenticated?
      if (auth.currentUser) {
        console.warn("Usuário já autenticado. Atualizando sessão...");
      }

      // Log start of popup flow
      console.log("Iniciando popup de autenticação Google...");
      
      // 4. Trigger authenticating popup
      const result = await googleSignIn();
      
      if (result && result.user) {
        // Trigger user document creation / check-and-create in Firestore
        const { saveUserProfile } = await import("../firebase");
        await saveUserProfile(result.user, "google.com");
        
        console.log("Login Google concluído com sucesso para o usuário:", result.user.uid);
        onAuthSuccess(result.user);
      }
    } catch (err: any) {
      console.error("Erro capturado no fluxo Google Sign-In:", err);
      
      // Log to diagnostic engine
      logDiagnosticDebug(err, "Google Login");
      runFirebaseDiagnostics().catch(() => {});

      const code = err.code || "";
      const message = err.message || "";
      
      let mappedErrorMsg = "Erro ao autenticar com o Google.";
      let matchedCode = "unknown";

      if (code === "auth/user-cancelled" || message.includes("user-cancelled") || message.includes("cancelled") || message.includes("IdP denied access")) {
        matchedCode = "auth/user-cancelled";
        mappedErrorMsg = "Login cancelado pelo usuário. Caso tenha fechado a janela do Google ou recusado a permissão, tente novamente.";
      } else if (code === "auth/popup-closed-by-user" || message.includes("popup-closed-by-user") || message.includes("closed-by-user")) {
        matchedCode = "popup_closed_by_user";
        mappedErrorMsg = "A janela de autenticação foi fechada antes da conclusão.";
      } else if (code === "auth/popup-blocked" || message.includes("popup-blocked") || message.includes("popup_blocked")) {
        matchedCode = "popup_blocked";
        mappedErrorMsg = "O navegador bloqueou a janela de login. Por favor, permita pop-ups para o domínio da aplicação.";
      } else if (code === "auth/unauthorized-domain" || code === "auth/unauthorized-client" || message.includes("unauthorized-domain") || message.includes("unauthorized_domain") || message.includes("unauthorized-client")) {
        matchedCode = "unauthorized-domain";
        mappedErrorMsg = "O domínio atual ainda não está autorizado no Firebase.";
      } else if (code === "auth/access-denied" || message.includes("access-denied") || message.includes("access_denied")) {
        matchedCode = "access_denied";
        mappedErrorMsg = "O acesso foi negado durante a autenticação Google.";
      } else if (code === "auth/network-request-failed" || message.includes("network-request-failed") || message.includes("network_request_failed")) {
        matchedCode = "network-request-failed";
        mappedErrorMsg = "Falha de rede ao conectar com os servidores do Google. Verifique sua conexão.";
      } else if (code === "auth/operation-not-supported-in-this-environment" || message.includes("operation-not-supported-in-this-environment")) {
        matchedCode = "operation-not-supported-in-this-environment";
        mappedErrorMsg = "Esta operação de login não é suportada neste ambiente de execução.";
      } else if (code === "auth/invalid-api-key" || message.includes("invalid-api-key") || message.includes("invalid_api_key")) {
        matchedCode = "invalid-api-key";
        mappedErrorMsg = "Chave de API inválida configurada para o projeto Firebase.";
      } else if (code === "auth/invalid-client-id" || message.includes("invalid-client-id") || message.includes("invalid_client_id")) {
        matchedCode = "invalid-client-id";
        mappedErrorMsg = "ID do cliente OAuth inválido configurado para o projeto Firebase.";
      } else if (code === "auth/internal-error" || message.includes("internal-error")) {
        matchedCode = "internal-error";
        mappedErrorMsg = "Erro interno no servidor do Firebase Authentication. Tente novamente.";
      } else {
        matchedCode = "unknown";
        mappedErrorMsg = err.message || "Erro desconhecido ao tentar autenticar com o Google.";
      }

      setActiveErrorCode(matchedCode);
      setError(mappedErrorMsg);
    } finally {
      setLoading(false);
    }
  };

  // 2. Register Email/Password Account
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanNome = sanitize(nome);
    const cleanEmail = sanitize(email);

    if (!cleanNome) {
      setError("Por favor, informe seu nome completo.");
      return;
    }
    if (!validateEmail(cleanEmail)) {
      setError("Por favor, insira um e-mail válido.");
      return;
    }
    if (password.length < 8) {
      setError("A senha deve conter no mínimo 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      // Set persistence based on checkbox
      if (!rememberMe) {
        // Firebase handles default persistence (local). We will handle optional custom sessions inside App.tsx
      }
      await emailSignUp(cleanNome, cleanEmail, password);
      setSuccess("Conta criada com sucesso! Enviamos um e-mail de confirmação.");
      setMode("verification");
    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") {
        setError("Este e-mail já está sendo utilizado por outra conta.");
      } else if (err.code === "auth/operation-not-allowed") {
        setError("O cadastro por e-mail/senha não está habilitado no Console do Firebase. Ative 'E-mail/Senha' em 'Authentication > Sign-in method' para continuar.");
      } else {
        setError(err.message || "Ocorreu um erro ao criar a conta.");
      }
    } finally {
      setLoading(false);
    }
  };

  // 3. Login Email/Password Account
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanEmail = sanitize(email);
    if (!validateEmail(cleanEmail)) {
      setError("Por favor, insira um e-mail válido.");
      return;
    }
    if (!password) {
      setError("Por favor, digite sua senha.");
      return;
    }

    setLoading(true);
    try {
      const loggedUser = await emailSignIn(cleanEmail, password);
      
      // If email isn't verified, hold them on verification screen
      if (!loggedUser.emailVerified) {
        setMode("verification");
      } else {
        onAuthSuccess(loggedUser);
      }
    } catch (err: any) {
      if (err.code === "auth/wrong-password" || err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        setError("E-mail ou senha inválidos.");
      } else if (err.code === "auth/operation-not-allowed") {
        setError("O login por e-mail/senha não está habilitado no Console do Firebase. Ative 'E-mail/Senha' em 'Authentication > Sign-in method' para continuar.");
      } else {
        setError(err.message || "Erro ao realizar o login.");
      }
    } finally {
      setLoading(false);
    }
  };

  // 4. Password Recovery
  const handlePasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanEmail = sanitize(email);
    if (!validateEmail(cleanEmail)) {
      setError("Por favor, insira um e-mail válido.");
      return;
    }

    setLoading(true);
    try {
      await recoverPassword(cleanEmail);
      setSuccess("Link para redefinição de senha enviado para " + cleanEmail);
      setTimeout(() => {
        setMode("login");
        setSuccess(null);
      }, 5000);
    } catch (err: any) {
      setError(err.message || "Erro ao enviar e-mail de redefinição.");
    } finally {
      setLoading(false);
    }
  };

  // 5. Send Phone OTP
  const handleSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanPhone = sanitize(phone).replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 8) {
      setError("Por favor, informe um número de telefone celular válido.");
      return;
    }

    const fullPhoneNumber = `${countryCode}${cleanPhone}`;

    setLoading(true);
    try {
      // Setup hidden recaptcha verifier
      const verifier = setupRecaptcha("recaptcha-container");
      recaptchaVerifierRef.current = verifier;

      const confirmResult = await sendSmsOtp(fullPhoneNumber, verifier);
      setConfirmationResult(confirmResult);
      setSuccess("Código de verificação enviado com sucesso!");
      setMode("otp");
    } catch (err: any) {
      if (err.code === "auth/operation-not-allowed") {
        setError("O login por SMS/Telefone não está habilitado no Console do Firebase. Ative 'Telefone' em 'Authentication > Sign-in method' para prosseguir.");
      } else {
        setError(err.message || "Erro ao enviar o código SMS. Verifique o número.");
      }
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
      }
    } finally {
      setLoading(false);
    }
  };

  // 6. Confirm OTP code
  const handleConfirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanCode = sanitize(otpCode);
    if (cleanCode.length !== 6) {
      setError("O código OTP deve ter exatamente 6 dígitos.");
      return;
    }

    if (!confirmationResult) {
      setError("Sessão expirada. Por favor, envie o SMS novamente.");
      setMode("phone");
      return;
    }

    setLoading(true);
    try {
      const result = await confirmationResult.confirm(cleanCode);
      if (result.user) {
        // Create user document in Firestore on phone login
        const { saveUserProfile } = await import("../firebase");
        await saveUserProfile(result.user, "phone");
        onAuthSuccess(result.user);
      }
    } catch (err: any) {
      setError("Código incorreto ou expirado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // 7. Check/Reload User Email Verification status
  const handleCheckEmailVerification = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      if (currentUser) {
        await currentUser.reload();
        const refreshedUser = auth.currentUser;
        if (refreshedUser?.emailVerified) {
          setSuccess("E-mail verificado com sucesso! Redirecionando...");
          setTimeout(() => {
            onAuthSuccess(refreshedUser);
          }, 1500);
        } else {
          setError("O e-mail ainda não foi verificado. Por favor, verifique sua caixa de entrada e spam.");
        }
      }
    } catch (err: any) {
      setError("Erro ao verificar status. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // 8. Re-send Email Verification Link
  const handleResendVerificationMail = async () => {
    if (!currentUser) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await resendVerification(currentUser);
      setSuccess("Novo link de verificação enviado com sucesso!");
      setResendCooldown(60); // 1 minute cooldown
    } catch (err: any) {
      setError("Aguarde um momento antes de solicitar outro reenvio.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col justify-between transition-colors duration-300 ${theme === "dark" ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"}`}>
      
      {/* Top Header Row with Theme Switcher and Logo */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-gray-100/10 backdrop-blur-xs">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-xs">
            <TableProperties className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold font-display uppercase tracking-wider">BI Planner Pro</span>
        </div>
        
        {/* Theme Switch */}
        <button
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          className={`p-2 rounded-xl border transition-all duration-200 cursor-pointer ${
            theme === "dark" 
              ? "bg-slate-900 border-slate-800 text-indigo-400 hover:text-indigo-300" 
              : "bg-white border-gray-200 text-gray-500 hover:text-gray-900"
          }`}
          title={theme === "light" ? "Ativar Modo Escuro" : "Ativar Modo Claro"}
        >
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
      </header>

      {/* Main Form Center Column */}
      <main className="flex-1 flex items-center justify-center p-4">
        
        {/* reCAPTCHA Invisible Element */}
        <div id="recaptcha-container" className="hidden"></div>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className={`w-full max-w-md p-8 rounded-3xl shadow-xl border transition-all duration-300 ${
            theme === "dark" 
              ? "bg-slate-900/90 border-slate-800" 
              : "bg-white border-gray-100"
          }`}
        >
          
          {/* Logo Brand Icon */}
          <div className="flex flex-col items-center text-center space-y-2 mb-8">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
              <Sparkles className="h-6 w-6 animate-pulse" />
            </div>
            
            {mode === "login" && (
              <>
                <h2 className="text-xl font-bold font-display tracking-tight">Boas-vindas ao BI Planner Pro</h2>
                <p className="text-xs text-gray-400">Faça login para gerenciar sua planilha de forma inteligente</p>
              </>
            )}
            {mode === "register" && (
              <>
                <h2 className="text-xl font-bold font-display tracking-tight">Crie sua Conta Grátis</h2>
                <p className="text-xs text-gray-400">Inscreva-se em segundos com seus dados básicos</p>
              </>
            )}
            {mode === "phone" && (
              <>
                <h2 className="text-xl font-bold font-display tracking-tight">Login por Celular / SMS</h2>
                <p className="text-xs text-gray-400">Acesse sua conta instantaneamente via código de verificação</p>
              </>
            )}
            {mode === "otp" && (
              <>
                <h2 className="text-xl font-bold font-display tracking-tight">Insira o Código SMS</h2>
                <p className="text-xs text-gray-400">Enviamos um código OTP de 6 dígitos ao seu aparelho</p>
              </>
            )}
            {mode === "forgot" && (
              <>
                <h2 className="text-xl font-bold font-display tracking-tight">Recuperar sua Senha</h2>
                <p className="text-xs text-gray-400">Enviaremos um link de redefinição seguro para seu e-mail</p>
              </>
            )}
            {mode === "verification" && (
              <>
                <h2 className="text-xl font-bold font-display tracking-tight">Verifique seu E-mail</h2>
                <p className="text-xs text-gray-400">Sua conta foi criada! Ative-a para prosseguir</p>
              </>
            )}
          </div>

          {/* Feedback Banners */}
          {error && (
            <div className="p-4 mb-5 rounded-2xl text-xs flex flex-col gap-3 items-start animate-shake border border-rose-100 bg-rose-50/75 text-rose-800 shadow-3xs w-full">
              <div className="flex gap-2.5 items-start">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 text-rose-600 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold block text-rose-900">Erro na Autenticação</span>
                  <p className="text-rose-700 leading-relaxed text-[11px]">{error}</p>
                </div>
              </div>

              {/* MAPPED ACTIONS & HELPER INSTRUCTIONS */}
              
              {/* Case 1: popup_closed_by_user */}
              {activeErrorCode === "popup_closed_by_user" && (
                <div className="w-full pt-1">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer shadow-xs text-[11px]"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Tentar Novamente
                  </button>
                </div>
              )}

              {/* Case 2: popup_blocked */}
              {activeErrorCode === "popup_blocked" && (
                <div className="w-full p-2.5 bg-rose-100/30 rounded-lg border border-rose-200/50 space-y-1 text-[10px] text-rose-900 leading-relaxed">
                  <span className="font-bold text-rose-950">Como habilitar pop-ups:</span>
                  <ul className="list-disc pl-3.5 space-y-1 text-rose-700">
                    <li>Clique no ícone de pop-up bloqueado na barra de endereço do navegador.</li>
                    <li>Selecione <strong>"Sempre permitir pop-ups de {window.location.hostname}"</strong>.</li>
                    <li>Clique em Concluir e tente fazer o login novamente.</li>
                  </ul>
                </div>
              )}

              {/* Case 3: unauthorized-domain */}
              {activeErrorCode === "unauthorized-domain" && (
                <div className="w-full space-y-2">
                  <div className="p-2.5 bg-rose-100/30 rounded-lg border border-rose-200/50 space-y-1 text-[10px] text-rose-900 font-mono">
                    <p className="font-semibold text-rose-950">Domínio a adicionar:</p>
                    <code className="bg-white border border-rose-200/80 px-1.5 py-0.5 rounded text-rose-800 block truncate select-all">{window.location.hostname}</code>
                  </div>
                  <div className="space-y-1.5 text-[10px] text-rose-700">
                    <span className="font-bold text-rose-950">Instruções para adicionar no Firebase:</span>
                    <ol className="list-decimal pl-3.5 space-y-1 leading-relaxed">
                      <li>Acesse o <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="underline font-bold text-indigo-700 hover:text-indigo-800">Console do Firebase</a> e entre no seu projeto.</li>
                      <li>Vá em <strong>Authentication</strong> → guia <strong>Settings</strong> → seção <strong>Authorized Domains</strong>.</li>
                      <li>Clique em <strong>"Add Domain"</strong> e adicione o domínio exibido acima.</li>
                    </ol>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.hostname);
                      alert("Domínio copiado para a área de transferência: " + window.location.hostname);
                    }}
                    className="w-full py-2 px-3 bg-white hover:bg-rose-100/50 border border-rose-200 text-rose-800 font-bold rounded-lg transition-all text-center cursor-pointer text-[10px]"
                  >
                    Copiar Domínio
                  </button>
                </div>
              )}

              {/* Case 4: access_denied */}
              {activeErrorCode === "access_denied" && (
                <div className="w-full p-2.5 bg-rose-100/30 rounded-lg border border-rose-200/50 space-y-1.5 text-[10px] text-rose-900 leading-relaxed">
                  <span className="font-bold text-rose-950 block">Verifique as seguintes configurações:</span>
                  <ul className="list-disc pl-3.5 space-y-1 text-rose-700">
                    <li><strong>OAuth Consent Screen:</strong> Verifique se a tela de permissões de consentimento do Google Cloud Console está publicada ou configurada como "In Testing".</li>
                    <li><strong>Usuário de Teste:</strong> Caso esteja em "Testing", certifique-se de que o seu e-mail do Google foi explicitamente adicionado na lista de <strong>Test Users</strong> do Google OAuth.</li>
                    <li><strong>Conta Google:</strong> Escolha a conta Google correspondente ou altere o status para "Production" no Console do Google Cloud.</li>
                  </ul>
                </div>
              )}

              <div className="w-full border-t border-rose-200/50 pt-2.5 flex flex-col gap-1.5">
                <p className="text-[9px] text-rose-500 font-medium">Não é o administrador do Firebase ou deseja testar agora?</p>
                <button
                  type="button"
                  onClick={() => {
                    const demoUser = {
                      uid: "demo_user_2026",
                      displayName: "Usuário Convidado",
                      email: "demo@biplannerpro.com",
                      photoURL: null,
                      phoneNumber: "+5511999999999",
                      providerData: [{ providerId: "password", uid: "demo_user_2026", displayName: "Usuário Convidado", email: "demo@biplannerpro.com", phoneNumber: "+5511999999999", photoURL: null }],
                      emailVerified: true,
                      metadata: {
                        creationTime: new Date().toISOString(),
                        lastSignInTime: new Date().toISOString()
                      },
                      reload: async () => {},
                      getIdToken: async () => "demo-token"
                    } as any;
                    onAuthSuccess(demoUser);
                  }}
                  className="w-full text-center text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 py-2 px-3 rounded-lg shadow-xs transition-all cursor-pointer"
                >
                  Ignorar & Entrar em Modo de Demonstração (Local)
                </button>
              </div>
            </div>
          )}

          {success && (
            <div className="p-3 mb-5 rounded-xl text-xs flex gap-2 items-start border border-emerald-100 bg-emerald-50 text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* VIEW: LOGIN */}
          {mode === "login" && (
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div>
                <label className="text-xs font-bold block mb-1.5 uppercase tracking-wide opacity-80">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nome@empresa.com"
                    className={`w-full text-xs pl-10 pr-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all ${
                      theme === "dark" 
                        ? "bg-slate-800/80 border-slate-700 text-slate-100 focus:border-indigo-500" 
                        : "bg-slate-50 border-gray-200 text-gray-900 focus:border-indigo-500"
                    }`}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide opacity-80">Senha</label>
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-xs text-indigo-500 hover:text-indigo-400 font-semibold cursor-pointer"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full text-xs pl-10 pr-10 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all ${
                      theme === "dark" 
                        ? "bg-slate-800/80 border-slate-700 text-slate-100 focus:border-indigo-500" 
                        : "bg-slate-50 border-gray-200 text-gray-900 focus:border-indigo-500"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Keep Signed In Checkbox */}
              <div className="flex items-center justify-between py-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded-md border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs font-medium opacity-80 select-none">Permanecer conectado</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Entrar"}
              </button>

              <div className="relative flex items-center justify-center my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100/10"></div>
                </div>
                <span className={`relative px-4 text-[10px] uppercase font-bold tracking-widest ${theme === "dark" ? "bg-slate-900" : "bg-white"} opacity-50`}>ou continue com</span>
              </div>

              {/* Google OAuth & Phone login buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className={`py-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    theme === "dark" 
                      ? "border-slate-800 bg-slate-800/40 hover:bg-slate-800 text-slate-100" 
                      : "border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.6c-.28 1.5-1.12 2.76-2.38 3.61v3h3.83c2.25-2.07 3.69-5.11 3.69-8.46z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.83-3c-1.07.72-2.44 1.16-4.13 1.16-3.18 0-5.88-2.15-6.84-5.04H1.31v3.1A11.977 11.977 0 0012 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.16 14.21A7.16 7.16 0 014.8 12c0-.77.13-1.52.36-2.21V6.69H1.31A11.966 11.966 0 000 12c0 1.92.45 3.74 1.31 5.31l3.85-3.1z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.22 0 12 0 7.31 0 3.3 2.69 1.31 6.69l3.85 3.1c.96-2.89 3.66-5.04 6.84-5.04z"
                    />
                  </svg>
                  Google
                </button>

                <button
                  type="button"
                  onClick={() => setMode("phone")}
                  disabled={loading}
                  className={`py-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    theme === "dark" 
                      ? "border-slate-800 bg-slate-800/40 hover:bg-slate-800 text-slate-100" 
                      : "border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <Phone className="h-4 w-4" />
                  SMS
                </button>
              </div>

              {/* Google OAuth Troubleshooting Accordion */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowGoogleHelp(!showGoogleHelp)}
                  className="w-full text-center text-[10px] text-indigo-500 hover:text-indigo-400 font-semibold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>Por que diz "O Google não verificou este app"?</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${showGoogleHelp ? "rotate-180" : ""}`} />
                </button>
                
                {showGoogleHelp && (
                  <div className={`mt-3 p-4 rounded-xl text-[11px] text-left space-y-2 border ${
                    theme === "dark"
                      ? "bg-slate-950/80 border-slate-800 text-slate-300"
                      : "bg-slate-50 border-gray-100 text-gray-600"
                  }`}>
                    <p className="font-bold text-xs flex items-center gap-1 text-indigo-500">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-indigo-600" /> Entendendo a homologação Google
                    </p>
                    <p>
                      Esta mensagem ocorre porque o projeto OAuth está em modo <strong>"Em testes"</strong> ou aguarda verificação oficial do domínio de hospedagem do app.
                    </p>
                    <div className="space-y-2 pt-1">
                      <p className="font-bold">Como resolver ou testar:</p>
                      <ol className="list-decimal pl-4 space-y-1.5">
                        <li>
                          Acesse o <strong>Google Cloud Console</strong> &gt; <em>APIs e Serviços</em> &gt; <em>Tela de consentimento OAuth</em>.
                        </li>
                        <li>
                          Selecione o projeto <strong>studied-stock-306704</strong>.
                        </li>
                        <li>
                          Na seção <strong>Usuários de teste</strong>, adicione seu e-mail de login do Google (ex: <em>alisonvitoriomedal@gmail.com</em>) para permitir o login mesmo antes do app ser verificado.
                        </li>
                        <li>
                          Para publicar o app para todos, mude o status de publicação de <strong>"Em testes"</strong> para <strong>"Em produção"</strong>.
                        </li>
                        <li>
                          Garanta que os seguintes domínios estejam cadastrados na lista de <strong>Domínios Autorizados</strong> no console do Firebase (<em>Authentication &gt; Configurações &gt; Domínios Autorizados</em>):
                          <ul className="list-disc pl-4 mt-1 font-mono text-[9px] break-all select-all space-y-0.5 text-indigo-600">
                            <li>localhost</li>
                            <li>studied-stock-306704.firebaseapp.com</li>
                            <li>studied-stock-306704.web.app</li>
                            <li>ais-dev-nwt7tvztogbo6jhsfgkosu-365222383049.us-east5.run.app</li>
                            <li>ais-pre-nwt7tvztogbo6jhsfgkosu-365222383049.us-east5.run.app</li>
                          </ul>
                        </li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-center pt-4">
                <span className="text-xs opacity-75">Não tem uma conta? </span>
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className="text-xs text-indigo-500 hover:text-indigo-400 font-bold cursor-pointer"
                >
                  Cadastre-se
                </button>
              </div>

              <div className="text-center pt-3 mt-3 border-t border-gray-100/10">
                <button
                  type="button"
                  onClick={() => {
                    const demoUser = {
                      uid: "demo_user_2026",
                      displayName: "Usuário Convidado",
                      email: "demo@biplannerpro.com",
                      photoURL: null,
                      phoneNumber: "+5511999999999",
                      providerData: [{ providerId: "password", uid: "demo_user_2026", displayName: "Usuário Convidado", email: "demo@biplannerpro.com", phoneNumber: "+5511999999999", photoURL: null }],
                      emailVerified: true,
                      metadata: {
                        creationTime: new Date().toISOString(),
                        lastSignInTime: new Date().toISOString()
                      },
                      reload: async () => {},
                      getIdToken: async () => "demo-token"
                    } as any;
                    onAuthSuccess(demoUser);
                  }}
                  className="text-xs text-amber-500 hover:text-amber-400 font-semibold flex items-center justify-center gap-1.5 mx-auto py-1.5 px-3 rounded-lg border border-amber-500/20 hover:border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 cursor-pointer transition-all"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Entrar como Convidado (Modo Demonstrativo)
                </button>
              </div>
            </form>
          )}

          {/* VIEW: REGISTER */}
          {mode === "register" && (
            <form onSubmit={handleEmailSignUp} className="space-y-4">
              <div>
                <label className="text-xs font-bold block mb-1.5 uppercase tracking-wide opacity-80">Nome Completo</label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome"
                    className={`w-full text-xs pl-10 pr-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all ${
                      theme === "dark" 
                        ? "bg-slate-800/80 border-slate-700 text-slate-100 focus:border-indigo-500" 
                        : "bg-slate-50 border-gray-200 text-gray-900 focus:border-indigo-500"
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold block mb-1.5 uppercase tracking-wide opacity-80">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nome@empresa.com"
                    className={`w-full text-xs pl-10 pr-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all ${
                      theme === "dark" 
                        ? "bg-slate-800/80 border-slate-700 text-slate-100 focus:border-indigo-500" 
                        : "bg-slate-50 border-gray-200 text-gray-900 focus:border-indigo-500"
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold block mb-1.5 uppercase tracking-wide opacity-80">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="No mínimo 8 caracteres"
                    className={`w-full text-xs pl-10 pr-10 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all ${
                      theme === "dark" 
                        ? "bg-slate-800/80 border-slate-700 text-slate-100 focus:border-indigo-500" 
                        : "bg-slate-50 border-gray-200 text-gray-900 focus:border-indigo-500"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                
                {/* Real-time Password Strength Meter */}
                {password && (
                  <div className="mt-2 space-y-1 animate-fade-in">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="opacity-60">Força da senha:</span>
                      <span className={strength.color.replace("bg-", "text-")}>{strength.text}</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full ${strength.color} ${strength.width} transition-all duration-300`} />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold block mb-1.5 uppercase tracking-wide opacity-80">Confirmar Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita sua senha"
                    className={`w-full text-xs pl-10 pr-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all ${
                      theme === "dark" 
                        ? "bg-slate-800/80 border-slate-700 text-slate-100 focus:border-indigo-500" 
                        : "bg-slate-50 border-gray-200 text-gray-900 focus:border-indigo-500"
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Criar Minha Conta"}
              </button>

              <div className="relative flex items-center justify-center my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100/10"></div>
                </div>
                <span className={`relative px-4 text-[10px] uppercase font-bold tracking-widest ${theme === "dark" ? "bg-slate-900" : "bg-white"} opacity-50`}>ou continue com</span>
              </div>

              {/* Google Sign-up Option */}
              <div>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className={`w-full py-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    theme === "dark" 
                      ? "border-slate-800 bg-slate-800/40 hover:bg-slate-800 text-slate-100" 
                      : "border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.6c-.28 1.5-1.12 2.76-2.38 3.61v3h3.83c2.25-2.07 3.69-5.11 3.69-8.46z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.83-3c-1.07.72-2.44 1.16-4.13 1.16-3.18 0-5.88-2.15-6.84-5.04H1.31v3.1A11.977 11.977 0 0012 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.16 14.21A7.16 7.16 0 014.8 12c0-.77.13-1.52.36-2.21V6.69H1.31A11.966 11.966 0 000 12c0 1.92.45 3.74 1.31 5.31l3.85-3.1z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.22 0 12 0 7.31 0 3.3 2.69 1.31 6.69l3.85 3.1c.96-2.89 3.66-5.04 6.84-5.04z"
                    />
                  </svg>
                  Cadastrar com Google
                </button>
              </div>

              <div className="text-center pt-4">
                <span className="text-xs opacity-75">Já possui conta? </span>
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="text-xs text-indigo-500 hover:text-indigo-400 font-bold cursor-pointer"
                >
                  Faça login
                </button>
              </div>

              <div className="text-center pt-3 mt-3 border-t border-gray-100/10">
                <button
                  type="button"
                  onClick={() => {
                    const demoUser = {
                      uid: "demo_user_2026",
                      displayName: "Usuário Convidado",
                      email: "demo@biplannerpro.com",
                      photoURL: null,
                      phoneNumber: "+5511999999999",
                      providerData: [{ providerId: "password", uid: "demo_user_2026", displayName: "Usuário Convidado", email: "demo@biplannerpro.com", phoneNumber: "+5511999999999", photoURL: null }],
                      emailVerified: true,
                      metadata: {
                        creationTime: new Date().toISOString(),
                        lastSignInTime: new Date().toISOString()
                      },
                      reload: async () => {},
                      getIdToken: async () => "demo-token"
                    } as any;
                    onAuthSuccess(demoUser);
                  }}
                  className="text-xs text-amber-500 hover:text-amber-400 font-semibold flex items-center justify-center gap-1.5 mx-auto py-1.5 px-3 rounded-lg border border-amber-500/20 hover:border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 cursor-pointer transition-all"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Entrar como Convidado (Modo Demonstrativo)
                </button>
              </div>
            </form>
          )}

          {/* VIEW: FORGOT PASSWORD */}
          {mode === "forgot" && (
            <form onSubmit={handlePasswordRecovery} className="space-y-4">
              <div>
                <label className="text-xs font-bold block mb-1.5 uppercase tracking-wide opacity-80">E-mail Cadastrado</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nome@empresa.com"
                    className={`w-full text-xs pl-10 pr-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all ${
                      theme === "dark" 
                        ? "bg-slate-800/80 border-slate-700 text-slate-100 focus:border-indigo-500" 
                        : "bg-slate-50 border-gray-200 text-gray-900 focus:border-indigo-500"
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Enviar E-mail de Recuperação"}
              </button>

              <button
                type="button"
                onClick={() => setMode("login")}
                className="w-full py-3 text-xs font-bold text-gray-500 hover:text-gray-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar ao Login
              </button>
            </form>
          )}

          {/* VIEW: PHONE AUTHENTICATION */}
          {mode === "phone" && (
            <form onSubmit={handleSendPhoneOtp} className="space-y-4">
              <div>
                <label className="text-xs font-bold block mb-1.5 uppercase tracking-wide opacity-80">Seu Celular</label>
                <div className="flex gap-2">
                  <div className="relative shrink-0 w-24">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className={`w-full text-xs pl-3 pr-8 py-3 rounded-xl border outline-none appearance-none font-medium cursor-pointer ${
                        theme === "dark" 
                          ? "bg-slate-800 border-slate-700 text-slate-100 focus:border-indigo-500" 
                          : "bg-slate-50 border-gray-200 text-gray-900 focus:border-indigo-500"
                      }`}
                    >
                      <option value="+55">🇧🇷 +55</option>
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+351">🇵🇹 +351</option>
                      <option value="+34">🇪🇸 +34</option>
                      <option value="+54">🇦🇷 +54</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 opacity-50 pointer-events-none" />
                  </div>

                  <div className="relative flex-1">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className={`w-full text-xs pl-10 pr-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all ${
                        theme === "dark" 
                          ? "bg-slate-800/80 border-slate-700 text-slate-100 focus:border-indigo-500" 
                          : "bg-slate-50 border-gray-200 text-gray-900 focus:border-indigo-500"
                      }`}
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Enviar Código por SMS"}
              </button>

              <button
                type="button"
                onClick={() => setMode("login")}
                className="w-full py-3 text-xs font-bold text-gray-500 hover:text-gray-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar ao Login
              </button>
            </form>
          )}

          {/* VIEW: CONFIRM OTP CODE */}
          {mode === "otp" && (
            <form onSubmit={handleConfirmOtp} className="space-y-4">
              <div>
                <label className="text-xs font-bold block mb-1.5 uppercase tracking-wide opacity-80">Código de Verificação</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="Digite os 6 dígitos"
                    className={`w-full text-xs pl-10 pr-4 py-3 rounded-xl border tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all font-mono text-center font-bold ${
                      theme === "dark" 
                        ? "bg-slate-800/80 border-slate-700 text-slate-100 focus:border-indigo-500" 
                        : "bg-slate-50 border-gray-200 text-gray-900 focus:border-indigo-500"
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Verificar & Acessar"}
              </button>

              <button
                type="button"
                onClick={() => setMode("phone")}
                className="w-full py-3 text-xs font-bold text-gray-500 hover:text-gray-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                Reenviar SMS
              </button>
            </form>
          )}

          {/* VIEW: EMAIL VERIFICATION MANAGE */}
          {mode === "verification" && (
            <div className="space-y-5 text-center">
              <div className="p-4 bg-indigo-50 border border-indigo-100 text-indigo-800 rounded-2xl flex flex-col items-center gap-2 text-xs">
                <Mail className="h-8 w-8 text-indigo-600 animate-bounce" />
                <span className="font-bold">E-mail de confirmação enviado!</span>
                <p className="text-gray-600 leading-relaxed max-w-sm mt-1">
                  Enviamos um link de verificação para o e-mail: <strong>{currentUser?.email}</strong>. Por favor, confirme o e-mail antes de efetuar o primeiro acesso.
                </p>
              </div>

              <button
                onClick={handleCheckEmailVerification}
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Já verifiquei meu e-mail"}
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleResendVerificationMail}
                  disabled={loading || resendCooldown > 0}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    resendCooldown > 0
                      ? "opacity-50 cursor-not-allowed bg-transparent text-gray-400"
                      : theme === "dark" 
                        ? "border-slate-800 bg-slate-800/40 hover:bg-slate-800 text-slate-100" 
                        : "border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  {resendCooldown > 0 ? `Aguarde (${resendCooldown}s)` : "Reenviar Link"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    auth.signOut();
                    setMode("login");
                    setError(null);
                    setSuccess(null);
                  }}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    theme === "dark" 
                      ? "border-slate-800 bg-slate-800/40 hover:bg-slate-800 text-slate-100" 
                      : "border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  Voltar ao Login
                </button>
              </div>
            </div>
          )}

        </motion.div>
      </main>

      {/* Global Simple Footer */}
      <footer className="py-4 text-center text-[10px] text-gray-400/80 border-t border-gray-100/10">
        <div className="max-w-7xl mx-auto px-4">
          Financial Dashboard &copy; 2026. Todos os direitos reservados.
        </div>
      </footer>

    </div>
  );
}
