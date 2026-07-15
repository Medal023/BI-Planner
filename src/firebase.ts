import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  getDocFromServer,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Use custom Firestore Database ID if specified in configuration
const databaseId = (firebaseConfig as any).firestoreDatabaseId || undefined;
export const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

// Google Auth Provider
export const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/drive.file");
provider.addScope("https://www.googleapis.com/auth/spreadsheets.readonly");
provider.setCustomParameters({
  prompt: "consent"
});

// Operations Type for Error Handler
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

// Error Interface
interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

// Global Custom Firestore Error Handler
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// No-op connection check - connection handled dynamically during runtime operations.

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (user.providerData.some(p => p.providerId === 'google.com') && !cachedAccessToken) {
        // For Google Auth we might wait for the manual sign-in to populate cachedAccessToken
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google
export const googleSignIn = async (): Promise<{ user: User; accessToken: string | null } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;
    
    // Save/Update user profile
    await saveUserProfile(result.user, "google.com");

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Google sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Register with Email
export const emailSignUp = async (nome: string, email: string, senha: string): Promise<User> => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, senha);
    
    // Update display name
    await updateProfile(result.user, { displayName: nome });
    
    // Send email verification
    await sendEmailVerification(result.user);
    
    // Save user profile in Firestore
    await saveUserProfile(result.user, "password", nome);

    return result.user;
  } catch (error: any) {
    console.error("Email signup error:", error);
    throw error;
  }
};

// Login with Email
export const emailSignIn = async (email: string, senha: string): Promise<User> => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, senha);
    
    // Update last login
    await updateLastLogin(result.user.uid);
    
    return result.user;
  } catch (error: any) {
    console.error("Email signin error:", error);
    throw error;
  }
};

// Re-send verification email
export const resendVerification = async (user: User): Promise<void> => {
  try {
    await sendEmailVerification(user);
  } catch (error: any) {
    console.error("Resend verification error:", error);
    throw error;
  }
};

// Password Recovery
export const recoverPassword = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    console.error("Password recovery error:", error);
    throw error;
  }
};

// Phone Authentication setup Recaptcha
export const setupRecaptcha = (containerId: string): RecaptchaVerifier => {
  try {
    if ((window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier.clear();
    }
    const verifier = new RecaptchaVerifier(auth, containerId, {
      size: "invisible",
      callback: () => {
        // reCAPTCHA solved, direct phone auth triggered.
      }
    });
    (window as any).recaptchaVerifier = verifier;
    return verifier;
  } catch (error: any) {
    console.error("Recaptcha setup error:", error);
    throw error;
  }
};

// Send OTP SMS
export const sendSmsOtp = async (phoneNumber: string, appVerifier: RecaptchaVerifier): Promise<ConfirmationResult> => {
  try {
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
    return confirmationResult;
  } catch (error: any) {
    console.error("SMS OTP error:", error);
    throw error;
  }
};

// Helper to detect if the user is a local/demo user or if authentication is not ready on the server side
const isDemoUser = (uid: string) => {
  return uid === "demo_user_2026" || !auth.currentUser;
};

// Save User Profile to Firestore
export const saveUserProfile = async (user: User, providerId: string, customName?: string) => {
  if (isDemoUser(user.uid)) {
    return;
  }
  const userPath = `users/${user.uid}`;
  try {
    const userDocRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userDocRef);
    
    const profilePayload = {
      // Requested English keys:
      uid: user.uid,
      nome: customName || user.displayName || "Usuário",
      email: user.email || "",
      foto: user.photoURL || "",
      provider: providerId,
      emailVerified: user.emailVerified,
      createdAt: docSnap.exists() ? (docSnap.data().createdAt || docSnap.data().data_criacao || new Date().toISOString()) : new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      status: "active",

      // Legacy Portuguese keys to prevent backward compatibility issues:
      telefone: user.phoneNumber || "",
      provedor_login: providerId,
      email_verificado: user.emailVerified,
      data_criacao: docSnap.exists() ? (docSnap.data().data_criacao || new Date().toISOString()) : new Date().toISOString(),
      ultimo_login: new Date().toISOString(),
      perfil: "user",
      preferencias: docSnap.exists() ? docSnap.data().preferencias || {} : { theme: "light" }
    };

    await setDoc(userDocRef, profilePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
};

// Update last login timestamp in Firestore
export const updateLastLogin = async (uid: string) => {
  if (isDemoUser(uid)) {
    return;
  }
  const userPath = `users/${uid}`;
  try {
    const userDocRef = doc(db, "users", uid);
    await updateDoc(userDocRef, {
      ultimo_login: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      email_verificado: auth.currentUser?.emailVerified || false,
      emailVerified: auth.currentUser?.emailVerified || false
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
};

// Get user preferences
export const getUserPreferences = async (uid: string) => {
  if (isDemoUser(uid)) {
    const cached = localStorage.getItem(`bi_prefs_${uid}`);
    return cached ? JSON.parse(cached) : {};
  }
  const userPath = `users/${uid}`;
  try {
    const userDocRef = doc(db, "users", uid);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return docSnap.data().preferencias || {};
    }
    return {};
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }
};

// Update user preferences
export const updateUserPreferences = async (uid: string, prefs: any) => {
  if (isDemoUser(uid)) {
    localStorage.setItem(`bi_prefs_${uid}`, JSON.stringify(prefs));
    return;
  }
  const userPath = `users/${uid}`;
  try {
    const userDocRef = doc(db, "users", uid);
    await updateDoc(userDocRef, { preferencias: prefs });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
};

// Save User Budget Data to Firestore
export const saveUserBudgetData = async (uid: string, data: any) => {
  if (isDemoUser(uid)) {
    localStorage.setItem("bi_budget_data_2026", JSON.stringify(data));
    return;
  }
  const budgetPath = `users/${uid}/budget/data`;
  try {
    const budgetDocRef = doc(db, "users", uid, "budget", "data");
    await setDoc(budgetDocRef, {
      userId: uid,
      data: JSON.stringify(data),
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, budgetPath);
  }
};

// Load User Budget Data from Firestore
export const loadUserBudgetData = async (uid: string) => {
  if (isDemoUser(uid)) {
    const cached = localStorage.getItem("bi_budget_data_2026");
    return cached ? JSON.parse(cached) : null;
  }
  const budgetPath = `users/${uid}/budget/data`;
  try {
    const budgetDocRef = doc(db, "users", uid, "budget", "data");
    const docSnap = await getDoc(budgetDocRef);
    if (docSnap.exists()) {
      const payload = docSnap.data();
      return JSON.parse(payload.data);
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, budgetPath);
  }
};

// Save User Income Profile to Firestore
export const saveUserIncomeProfile = async (uid: string, profile: any) => {
  if (isDemoUser(uid)) {
    localStorage.setItem(`bi_income_profile_${uid}`, JSON.stringify(profile));
    return;
  }
  const profilePath = `income_profile/${uid}`;
  try {
    const profileDocRef = doc(db, "income_profile", uid);
    await setDoc(profileDocRef, profile);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }
};

// Load User Income Profile from Firestore
export const loadUserIncomeProfile = async (uid: string) => {
  if (isDemoUser(uid)) {
    const cached = localStorage.getItem(`bi_income_profile_${uid}`);
    return cached ? JSON.parse(cached) : null;
  }
  const profilePath = `income_profile/${uid}`;
  try {
    const profileDocRef = doc(db, "income_profile", uid);
    const docSnap = await getDoc(profileDocRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, profilePath);
  }
};

// Get current cached access token
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

// Sign out
export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

// Auto-initialize all 11 required collections for the user on signup/login
export const ensureAllCollectionsInitialized = async (uid: string, userDisplayName?: string, userEmail?: string) => {
  if (isDemoUser(uid)) return;
  const now = new Date().toISOString();

  const collections = [
    {
      ref: doc(db, "users", uid),
      default: {
        uid,
        nome: userDisplayName || auth.currentUser?.displayName || "Usuário",
        email: userEmail || auth.currentUser?.email || "",
        foto: auth.currentUser?.photoURL || "",
        provedor_login: auth.currentUser?.providerData?.[0]?.providerId || "password",
        email_verificado: auth.currentUser?.emailVerified || false,
        data_criacao: now,
        ultimo_login: now,
        status: "active",
        perfil: "user",
        preferencias: { theme: "light" }
      }
    },
    {
      ref: doc(db, "users", uid, "budget", "data"),
      default: {
        userId: uid,
        data: JSON.stringify([]),
        updatedAt: now
      }
    },
    {
      ref: doc(db, "income_profile", uid),
      default: {
        usuario: uid,
        salarioBase: 1550,
        rendasExtras: [],
        rendaTotal: 1550,
        frequencia: "Mensal",
        ultimaAtualizacao: now,
        historico: []
      }
    },
    {
      ref: doc(db, "transactions", uid),
      default: {
        uid,
        list: [],
        updatedAt: now
      }
    },
    {
      ref: doc(db, "categories", uid),
      default: {
        uid,
        items: ["Aluguel", "Energia", "Água", "Internet", "Claro", "Banco Inter", "Mercado Pago", "Nubank", "Santander", "Bradesco", "Will Bank", "Faculdade", "Amanda", "Marcelo", "Vivo", "Outros"],
        updatedAt: now
      }
    },
    {
      ref: doc(db, "goals", uid),
      default: {
        uid,
        list: [],
        updatedAt: now
      }
    },
    {
      ref: doc(db, "notifications", uid),
      default: {
        uid,
        list: [{
          id: "welcome",
          title: "Bem-vindo!",
          message: "Sua conta BI Planner Pro foi ativada com sucesso.",
          read: false,
          createdAt: now
        }],
        updatedAt: now
      }
    },
    {
      ref: doc(db, "history", uid),
      default: {
        uid,
        list: [{
          action: "signup",
          description: "Perfil de usuário e coleções inicializadas com sucesso.",
          timestamp: now
        }],
        updatedAt: now
      }
    },
    {
      ref: doc(db, "support", uid),
      default: {
        uid,
        list: [],
        updatedAt: now
      }
    },
    {
      ref: doc(db, "settings", uid),
      default: {
        uid,
        theme: "light",
        language: "pt-BR",
        notificationsEnabled: true,
        inactivityTimeout: 15,
        updatedAt: now
      }
    },
    {
      ref: doc(db, "dashboard", uid),
      default: {
        uid,
        layout: "default",
        widgets: ["kpi_saldo", "kpi_despesas", "chart_mensal", "advisor_widget"],
        updatedAt: now
      }
    }
  ];

  for (const col of collections) {
    try {
      const snap = await getDoc(col.ref);
      if (!snap.exists()) {
        await setDoc(col.ref, col.default);
        console.log(`[Initialize] Created collection document: ${col.ref.path}`);
      }
    } catch (err) {
      console.warn(`[Initialize] Failed to create document for ${col.ref.path}:`, err);
    }
  }
};

