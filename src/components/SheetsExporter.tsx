import React, { useState, useEffect } from "react";
import { 
  Copy, 
  Check, 
  FileCode, 
  Landmark, 
  Terminal, 
  Settings2, 
  Sliders, 
  ChevronRight,
  Cloud,
  CloudLightning,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  FileText,
  Clock,
  ExternalLink,
  ShieldAlert,
  FolderOpen,
  Plus,
  LogOut,
  Upload,
  Trash2,
  HelpCircle
} from "lucide-react";
import { MonthlyBudget } from "../types";
import { initAuth, googleSignIn, logout, auth } from "../firebase";
import { User } from "firebase/auth";

interface CodeFile {
  name: string;
  description: string;
  icon: React.ReactNode;
  code: string;
}

interface SheetsExporterProps {
  data?: MonthlyBudget[];
  onUpdateData?: (newData: MonthlyBudget[]) => void;
}

export default function SheetsExporter({ data = [], onUpdateData }: SheetsExporterProps) {
  const [activeFileIdx, setActiveFileIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  // Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Google Drive Folders State
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("root");
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [createFolderSuccess, setCreateFolderSuccess] = useState(false);

  // Spreadsheet/CSV Import States
  const [importMode, setImportMode] = useState<"CSV" | "SHEETS">("CSV");
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("");
  const [isLoadingSpreadsheet, setIsLoadingSpreadsheet] = useState(false);
  const [spreadsheetTitle, setSpreadsheetTitle] = useState("");
  const [spreadsheetSheets, setSpreadsheetSheets] = useState<string[]>([]);
  const [selectedSheetTab, setSelectedSheetTab] = useState("");
  const [isLoadingSheetData, setIsLoadingSheetData] = useState(false);
  
  // CSV / Parsed Row States
  const [rawParsedRows, setRawParsedRows] = useState<string[][]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);
  
  // Column Mappings (indexes of row columns)
  const [colMapping, setColMapping] = useState({
    description: -1,
    value: -1,
    month: -1,
    category: -1,
    status: -1,
  });

  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [appendMode, setAppendMode] = useState<"APPEND" | "REPLACE">("APPEND");
  const [showAllIssues, setShowAllIssues] = useState(false);

  // validationMemo
  const validationReport = React.useMemo(() => {
    if (rawParsedRows.length < 2) return null;

    const dataRows = rawParsedRows.slice(1);
    const rowIssues: { rowNumber: number; type: "error" | "warning"; field: string; value: string; message: string }[] = [];
    let validRows = 0;
    let ignoredRows = 0;

    const knownMonths = [
      "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
      "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
    ];

    dataRows.forEach((row, idx) => {
      const displayLine = idx + 2; // Header is line 1, data starts at line 2
      const desc = colMapping.description !== -1 ? (row[colMapping.description] || "").trim() : "";
      
      if (!desc) {
        rowIssues.push({
          rowNumber: displayLine,
          type: "warning",
          field: "Descrição",
          value: "",
          message: "Descrição vazia. Esta linha será pulada na importação."
        });
        ignoredRows++;
        return;
      }

      // 1. Validate value
      if (colMapping.value !== -1) {
        const rawVal = row[colMapping.value] || "";
        let cleanVal = rawVal.replace(/R\$\s*/gi, "").trim();
        if (cleanVal.includes(",") && cleanVal.includes(".")) {
          cleanVal = cleanVal.replace(/\./g, "").replace(",", ".");
        } else if (cleanVal.includes(",")) {
          cleanVal = cleanVal.replace(",", ".");
        }
        const parsedNum = parseFloat(cleanVal);
        if (isNaN(parsedNum)) {
          rowIssues.push({
            rowNumber: displayLine,
            type: "warning",
            field: "Valor",
            value: rawVal,
            message: `Valor '${rawVal}' não pôde ser convertido em número. Será importado como R$ 0,00.`
          });
        }
      }

      // 2. Validate month
      if (colMapping.month !== -1) {
        const rawMonth = row[colMapping.month] || "";
        const monthUpper = rawMonth.toString().trim().toUpperCase();
        const matchedMonth = knownMonths.find(m => monthUpper.includes(m) || m.includes(monthUpper));
        if (!matchedMonth) {
          rowIssues.push({
            rowNumber: displayLine,
            type: "warning",
            field: "Mês",
            value: rawMonth,
            message: `Mês '${rawMonth}' não coincide com nenhum mês padrão. Será importado para o mês de JANEIRO.`
          });
        }
      }

      // 3. Validate category
      if (colMapping.category !== -1) {
        const rawCat = (row[colMapping.category] || "").trim();
        if (!rawCat) {
          rowIssues.push({
            rowNumber: displayLine,
            type: "warning",
            field: "Categoria",
            value: "",
            message: "Categoria está vazia. Será classificada como 'Outros'."
          });
        } else {
          const catLower = rawCat.toLowerCase();
          const knownKeywords = ["morad", "casa", "alug", "cond", "cart", "créd", "cred", "visa", "master", "util", "luz", "agua", "água", "net", "telef", "gas", "gás", "edu", "fac", "cur", "escola", "pess", "lazer", "saud", "saúde", "comida", "emp", "divi", "banc", "finan"];
          const matchesKnown = knownKeywords.some(k => catLower.includes(k));
          if (!matchesKnown) {
            rowIssues.push({
              rowNumber: displayLine,
              type: "warning",
              field: "Categoria",
              value: rawCat,
              message: `Categoria '${rawCat}' não reconhecida pelo sistema de orçamentos. Será classificada sob 'Outros'.`
            });
          }
        }
      }

      validRows++;
    });

    const hasValueMapping = colMapping.value !== -1;
    const hasMonthMapping = colMapping.month !== -1;

    return {
      rowIssues,
      validRows,
      ignoredRows,
      hasValueMapping,
      hasMonthMapping,
      isPerfect: rowIssues.length === 0 && hasValueMapping && hasMonthMapping,
      hasWarnings: rowIssues.length > 0 || !hasValueMapping || !hasMonthMapping
    };
  }, [rawParsedRows, colMapping]);

  const [lastBackup, setLastBackup] = useState<{
    timestamp: string;
    format: string;
    fileId?: string;
  } | null>(() => {
    const saved = localStorage.getItem("bi_last_backup");
    return saved ? JSON.parse(saved) : null;
  });

  const [backupFormat, setBackupFormat] = useState<"CSV" | "PDF" | "BOTH">("CSV");
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupSuccess, setBackupSuccess] = useState(false);

  // Initialize Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, currentToken) => {
        setUser(currentUser);
        setToken(currentToken);
        if (currentToken) {
          setNeedsAuth(false);
          fetchFolders(currentToken);
        } else {
          setNeedsAuth(true);
        }
      },
      () => {
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch folders from Google Drive
  const fetchFolders = async (authToken: string | null) => {
    if (!authToken) {
      setNeedsAuth(true);
      return;
    }
    setIsLoadingFolders(true);
    try {
      const response = await fetch(
        "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id, name)&pageSize=100",
        {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      );
      if (response.ok) {
        const resData = await response.json();
        setFolders(resData.files || []);
        setNeedsAuth(false);
      } else {
        console.error("Erro ao listar pastas do Google Drive");
        if (response.status === 401 || response.status === 403) {
          setNeedsAuth(true);
        }
      }
    } catch (error) {
      console.error("Erro de conexão com API do Google Drive:", error);
    } finally {
      setIsLoadingFolders(false);
    }
  };

  // Google Sign In handler
  const handleLogin = async () => {
    setIsLoggingIn(true);
    setBackupError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
        fetchFolders(result.accessToken);
      }
    } catch (err: any) {
      console.error("Sign in failed:", err);
      setBackupError(err.message || "Ocorreu um erro ao conectar com o Google. Certifique-se de autorizar a permissão.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Sign out handler
  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setToken(null);
      setNeedsAuth(true);
      setFolders([]);
      setSelectedFolderId("root");
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  // Create new folder in Google Drive
  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !token) return;
    setIsCreatingFolder(true);
    setBackupError(null);
    setCreateFolderSuccess(false);

    try {
      const response = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: newFolderName.trim(),
          mimeType: "application/vnd.google-apps.folder"
        })
      });

      if (response.ok) {
        const newFolder = await response.json();
        setFolders(prev => [newFolder, ...prev]);
        setSelectedFolderId(newFolder.id);
        setNewFolderName("");
        setCreateFolderSuccess(true);
        setTimeout(() => setCreateFolderSuccess(false), 3000);
      } else {
        const errText = await response.text();
        throw new Error(errText || "Falha ao criar pasta no Google Drive");
      }
    } catch (err: any) {
      console.error(err);
      setBackupError(`Erro ao criar pasta: ${err.message}`);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const triggerBackup = async () => {
    if (!token) {
      setBackupError("Você precisa se autenticar com o Google primeiro.");
      return;
    }

    setIsBackingUp(true);
    setBackupError(null);
    setBackupSuccess(false);

    try {
      const idToken = await auth.currentUser?.getIdToken();

      const response = await fetch("/api/backup-drive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { "Authorization": `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({
          budgetData: data,
          format: backupFormat,
          folderId: selectedFolderId,
          accessToken: token
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || `Erro de rede: ${response.status}`);
      }

      const info = {
        timestamp: resData.timestamp || new Date().toISOString(),
        format: backupFormat,
        fileId: resData.driveFileId
      };

      localStorage.setItem("bi_last_backup", JSON.stringify(info));
      setLastBackup(info);
      setBackupSuccess(true);
    } catch (err: any) {
      console.error(err);
      setBackupError(err.message || "Ocorreu um erro desconhecido ao tentar enviar backup ao Google Drive.");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper function to guess column mapping indexes based on headers
  const autoGuessMappings = (headers: string[]) => {
    const mapping = {
      description: -1,
      value: -1,
      month: -1,
      category: -1,
      status: -1,
    };
    
    headers.forEach((h, idx) => {
      const lower = (h || "").toString().trim().toLowerCase();
      if (lower.includes("desc") || lower.includes("nome") || lower.includes("item") || lower.includes("credor") || lower.includes("conta")) {
        mapping.description = idx;
      } else if (lower.includes("val") || lower.includes("quant") || lower.includes("preço") || lower.includes("preco") || lower.includes("nominal")) {
        mapping.value = idx;
      } else if (lower.includes("mes") || lower.includes("mês") || lower.includes("data") || lower.includes("periodo") || lower.includes("período")) {
        mapping.month = idx;
      } else if (lower.includes("cat") || lower.includes("tipo") || lower.includes("grupo")) {
        mapping.category = idx;
      } else if (lower.includes("stat") || lower.includes("situac") || lower.includes("situaç") || lower.includes("pago")) {
        mapping.status = idx;
      }
    });

    // Fallbacks if not auto-detected
    if (mapping.description === -1 && headers.length > 0) mapping.description = 0;
    if (mapping.value === -1 && headers.length > 1) mapping.value = 1;
    if (mapping.month === -1 && headers.length > 2) mapping.month = 2;
    if (mapping.category === -1 && headers.length > 3) mapping.category = 3;
    if (mapping.status === -1 && headers.length > 4) mapping.status = 4;

    setColMapping(mapping);
  };

  // CSV loading using FileReader
  const handleCsvFileLoad = (file: File) => {
    setImportError(null);
    setImportSuccess(null);
    setCsvFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setImportError("Não foi possível ler o arquivo CSV.");
        return;
      }
      
      const lines = text.split(/\r?\n/);
      const parsedRows: string[][] = [];
      
      lines.forEach((line) => {
        if (!line.trim()) return;
        const delimiter = line.includes(";") ? ";" : ",";
        const columns = line.split(delimiter).map(col => {
          return col.trim().replace(/^["']|["']$/g, "").trim();
        });
        parsedRows.push(columns);
      });
      
      if (parsedRows.length === 0) {
        setImportError("Nenhum dado encontrado no arquivo CSV.");
        return;
      }
      
      setRawParsedRows(parsedRows);
      autoGuessMappings(parsedRows[0] || []);
    };
    
    reader.readAsText(file, "UTF-8");
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingCsv(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingCsv(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingCsv(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith(".csv") || file.type === "text/csv") {
        handleCsvFileLoad(file);
      } else {
        setImportError("Por favor, selecione um arquivo válido no formato CSV.");
      }
    }
  };

  // Fetch spreadsheet tabs and details from Google Sheets API
  const fetchSpreadsheetInfo = async () => {
    if (!token) {
      setImportError("Você precisa se autenticar com o Google primeiro.");
      return;
    }
    const match = spreadsheetUrl.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      setImportError("Link da planilha inválido. Certifique-se de colar o link completo da sua planilha Google.");
      return;
    }
    const spreadsheetId = match[1];
    setIsLoadingSpreadsheet(true);
    setImportError(null);
    setImportSuccess(null);
    setSpreadsheetTitle("");
    setSpreadsheetSheets([]);
    
    try {
      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties.title`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || "Erro ao conectar com a planilha. Certifique-se de que possui permissão de leitura.");
      }
      
      const resData = await response.json();
      setSpreadsheetTitle(resData.properties.title);
      const tabs = (resData.sheets || []).map((s: any) => s.properties.title);
      setSpreadsheetSheets(tabs);
      if (tabs.length > 0) {
        setSelectedSheetTab(tabs[0]);
      }
    } catch (err: any) {
      console.error(err);
      setImportError(err.message || "Erro de rede ao conectar à API do Google Sheets.");
    } finally {
      setIsLoadingSpreadsheet(false);
    }
  };

  // Fetch cells/grid values for the selected sheet tab
  const fetchSheetData = async () => {
    if (!token || !selectedSheetTab) return;
    const match = spreadsheetUrl.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) return;
    const spreadsheetId = match[1];
    setIsLoadingSheetData(true);
    setImportError(null);
    setImportSuccess(null);
    
    try {
      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(selectedSheetTab)}!A1:Z500`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error("Não foi possível carregar os dados das células desta aba.");
      }
      
      const resData = await response.json();
      if (!resData.values || resData.values.length === 0) {
        throw new Error("A aba selecionada não contém linhas ou dados.");
      }
      
      setRawParsedRows(resData.values);
      autoGuessMappings(resData.values[0] || []);
    } catch (err: any) {
      console.error(err);
      setImportError(err.message || "Erro de rede ao carregar os dados.");
    } finally {
      setIsLoadingSheetData(false);
    }
  };

  // Commit imported rows to parent state
  const commitImport = () => {
    if (rawParsedRows.length < 2) {
      setImportError("Não há linhas suficientes para importar.");
      return;
    }
    
    if (colMapping.description === -1) {
      setImportError("Por favor, selecione a coluna correspondente à Descrição.");
      return;
    }

    if (!onUpdateData) {
      setImportError("A função de atualização do aplicativo está indisponível.");
      return;
    }

    const dataRows = rawParsedRows.slice(1);
    const importedTransactions: any[] = [];
    
    dataRows.forEach((row, idx) => {
      // Validate index ranges
      const maxIdx = Math.max(colMapping.description, colMapping.value, colMapping.month, colMapping.category, colMapping.status);
      if (row.length <= maxIdx && row.length < colMapping.description) {
        return;
      }
      
      const rawDesc = row[colMapping.description] || "";
      if (!rawDesc.trim()) return; // skip row
      
      // Parse numerical value
      let numericValue = 0;
      let rawValStr = colMapping.value !== -1 ? row[colMapping.value] : "";
      if (rawValStr) {
        let cleanVal = rawValStr.replace(/R\$\s*/gi, "").trim();
        if (cleanVal.includes(",") && cleanVal.includes(".")) {
          cleanVal = cleanVal.replace(/\./g, "").replace(",", ".");
        } else if (cleanVal.includes(",")) {
          cleanVal = cleanVal.replace(",", ".");
        }
        const parsedNum = parseFloat(cleanVal);
        if (!isNaN(parsedNum)) {
          numericValue = parsedNum;
        }
      }
      
      // Value text formatting
      const formattedValueText = numericValue > 0 
        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(numericValue)
        : rawValStr || "---------";
        
      // Parse Month
      let rawMonth = colMapping.month !== -1 ? row[colMapping.month] : "JANEIRO";
      let monthUpper = (rawMonth || "").toString().trim().toUpperCase();
      const knownMonths = [
        "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
        "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
      ];
      let matchedMonth = knownMonths.find(m => monthUpper.includes(m) || m.includes(monthUpper)) || "JANEIRO";
      
      // Parse Category
      let rawCat = colMapping.category !== -1 ? row[colMapping.category] : "Outros";
      let matchedCat = "Outros";
      const catLower = (rawCat || "").toString().toLowerCase();
      if (catLower.includes("morad") || catLower.includes("casa") || catLower.includes("alug") || catLower.includes("cond")) {
        matchedCat = "Moradia";
      } else if (catLower.includes("cart") || catLower.includes("créd") || catLower.includes("cred") || catLower.includes("visa") || catLower.includes("master")) {
        matchedCat = "Cartão de Crédito";
      } else if (catLower.includes("util") || catLower.includes("luz") || catLower.includes("agua") || catLower.includes("água") || catLower.includes("net") || catLower.includes("telef") || catLower.includes("gas") || catLower.includes("gás")) {
        matchedCat = "Utilidades";
      } else if (catLower.includes("edu") || catLower.includes("fac") || catLower.includes("cur") || catLower.includes("escola")) {
        matchedCat = "Educação";
      } else if (catLower.includes("pess") || catLower.includes("lazer") || catLower.includes("saud") || catLower.includes("saúde") || catLower.includes("comida")) {
        matchedCat = "Pessoal";
      } else if (catLower.includes("emp") || catLower.includes("divi") || catLower.includes("banc") || catLower.includes("finan")) {
        matchedCat = "Empréstimos";
      }
      
      // Parse Status
      let rawStatus = colMapping.status !== -1 ? row[colMapping.status] : "FALTA PAGAR";
      let matchedStatus = "FALTA PAGAR";
      const statusLower = (rawStatus || "").toString().toLowerCase();
      if (statusLower.includes("pago") || statusLower.includes("quit") || statusLower.includes("liquid")) {
        if (statusLower.includes("cred") || statusLower.includes("créd")) {
          matchedStatus = "PAGO NO CREDITO";
        } else {
          matchedStatus = "PAGO";
        }
      } else if (statusLower.includes("prox") || statusLower.includes("próx")) {
        matchedStatus = "PROXIMO MES";
      } else if (statusLower.includes("zero") || statusLower.includes("isento")) {
        matchedStatus = "CUSTO ZERO";
      } else if (statusLower.includes("min")) {
        matchedStatus = "VALOR MINIMO";
      } else if (statusLower.includes("acordo") || statusLower.includes("parc")) {
        matchedStatus = "ACORDO";
      }
      
      importedTransactions.push({
        id: "LAN-IMP-" + Date.now() + "-" + Math.floor(Math.random() * 100000) + "-" + idx,
        month: matchedMonth,
        description: rawDesc.trim(),
        value: numericValue,
        valueText: formattedValueText,
        category: matchedCat,
        status: matchedStatus
      });
    });

    if (importedTransactions.length === 0) {
      setImportError("Não foi possível identificar lançamentos válidos com o mapeamento selecionado.");
      return;
    }

    let finalBudgetData: MonthlyBudget[] = [];

    if (appendMode === "REPLACE") {
      const monthsPresent = Array.from(new Set(importedTransactions.map(t => t.month)));
      finalBudgetData = monthsPresent.map(monthName => {
        const monthTxs = importedTransactions.filter(t => t.month === monthName);
        return {
          month: monthName,
          salary: 1550,
          ticketText: "ALELO",
          transactions: monthTxs
        };
      });
      
      const allMonths = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
      allMonths.forEach(m => {
        if (!finalBudgetData.find(b => b.month === m)) {
          finalBudgetData.push({
            month: m,
            salary: 1550,
            ticketText: "ALELO",
            transactions: []
          });
        }
      });
    } else {
      finalBudgetData = JSON.parse(JSON.stringify(data));
      
      importedTransactions.forEach(tx => {
        let monthBudget = finalBudgetData.find(m => m.month.toUpperCase() === tx.month.toUpperCase());
        if (!monthBudget) {
          monthBudget = {
            month: tx.month,
            salary: 1550,
            ticketText: "ALELO",
            transactions: []
          };
          finalBudgetData.push(monthBudget);
        }
        monthBudget.transactions.push(tx);
      });
    }

    const knownMonthsOrder = [
      "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
      "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
    ];
    finalBudgetData.sort((a, b) => {
      return knownMonthsOrder.indexOf(a.month.toUpperCase()) - knownMonthsOrder.indexOf(b.month.toUpperCase());
    });

    onUpdateData(finalBudgetData);
    setImportSuccess(`Sucesso! Importados ${importedTransactions.length} lançamentos da planilha diretamente para o aplicativo.`);
    
    // reset parser state
    setRawParsedRows([]);
    setCsvFileName("");
    setSpreadsheetTitle("");
    setSpreadsheetSheets([]);
  };

  const SCRIPTS: CodeFile[] = [
    {
      name: "Code.gs",
      description: "Ponto de entrada principal do sistema. Configura os menus e inicializa o sistema.",
      icon: <Terminal className="h-4 w-4" />,
      code: `/**
 * @OnlyCurrentDoc
 * SISTEMA FINANCEIRO DE GESTÃO INTELIGENTE - GOOGLE SHEETS
 * Desenvolvido para reestruturação financeira profissional.
 */

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('⚙️ Gestão Financeira Inteligente')
    .addItem('📊 Abrir Painel de BI', 'abrirPainelBI')
    .addSeparator()
    .addSubMenu(ui.createMenu('➕ Adicionar Registro')
      .addItem('📥 Adicionar Receita', 'inserirReceitaDialog')
      .addItem('📤 Adicionar Despesa', 'inserirDespesaDialog'))
    .addSubMenu(ui.createMenu('🛡️ Segurança')
      .addItem('🔒 Bloquear Fórmulas', 'protegerEstruturas')
      .addItem('🔓 Desbloquear Fórmulas', 'desprotegerEstruturas'))
    .addSeparator()
    .addItem('💾 Executar Backup de Segurança', 'backupPlanilha')
    .addItem('✉️ Enviar Relatório por E-mail', 'enviarRelatorioEmail')
    .addToUi();
}

function abrirPainelBI() {
  var html = HtmlService.createHtmlOutputFromFile('SidebarBI')
      .setTitle('BI - Controle Financeiro')
      .setWidth(300);
  SpreadsheetApp.getUi().showSidebar(html);
}
`
    },
    {
      name: "Dashboard.gs",
      description: "Calcula KPIs avançados e alimenta os gráficos dinâmicos de forma rápida.",
      icon: <Landmark className="h-4 w-4" />,
      code: `/**
 * Calcula os KPIs consolidados para exibição dinâmica.
 */
function calcularKPIsGlobais() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dbSheet = ss.getSheetByName('Banco de Dados');
  if (!dbSheet) return { totalReceitas: 0, totalDespesas: 0, saldoLiquido: 0 };
  
  var data = dbSheet.getDataRange().getValues();
  var totalReceitas = 0;
  var totalDespesas = 0;
  
  // Ignora cabeçalho (i = 1)
  for (var i = 1; i < data.length; i++) {
    var valor = parseFloat(data[i][2]); // Coluna C: Valor
    var tipo = data[i][5]; // Coluna F: Categoria/Tipo
    
    if (isNaN(valor)) continue;
    
    if (tipo === 'Receita') {
      totalReceitas += valor;
    } else {
      totalDespesas += valor;
    }
  }
  
  return {
    totalReceitas: totalReceitas,
    totalDespesas: totalDespesas,
    saldoLiquido: totalReceitas - totalDespesas,
    ratio: totalReceitas > 0 ? (totalDespesas / totalReceitas) * 100 : 0
  };
}
`
    },
    {
      name: "Functions.gs",
      description: "Fórmulas customizadas de alto desempenho criadas em Javascript V8.",
      icon: <Sliders className="h-4 w-4" />,
      code: `/**
 * Retorna o status de alerta de saúde com base no saldo líquido.
 * @param {number} saldo O valor da sobra ou déficit líquido.
 * @return {string} Indicador visual em semáforo.
 * @customfunction
 */
function BI_STATUS_SAUDE(saldo) {
  if (saldo < -1000) {
    return "🔴 RISCO CRÍTICO (DÉFICIT EXTREMO)";
  } else if (saldo < 0) {
    return "🟡 ALERTA FINANCEIRO (VERMELHO)";
  } else if (saldo === 0) {
    return "⚪ LIMITE EXATO (CUSTO ZERO)";
  } else {
    return "🟢 SAÚDE ESTÁVEL (SUPERÁVIT)";
  }
}

/**
 * Calcula os juros reais acumulados projetados para faturas não pagas.
 * @param {number} valor Valor principal da dívida.
 * @param {number} taxaJurosAnual Taxa de juros anual cobrada pelo banco em %.
 * @param {number} diasAtraso Quantidade de dias de vencimento.
 * @return {number} Juros projetados.
 * @customfunction
 */
function BI_JUROS_PROJETADOS(valor, taxaJurosAnual, diasAtraso) {
  if (valor <= 0 || diasAtraso <= 0) return 0;
  var taxaDiaria = (taxaJurosAnual / 100) / 365;
  return valor * Math.pow((1 + taxaDiaria), diasAtraso) - valor;
}
`
    },
    {
      name: "Automations.gs",
      description: "Gera IDs únicos de transações de forma automatizada e carimba datas no banco.",
      icon: <FileCode className="h-4 w-4" />,
      code: `/**
 * Automação de preenchimento automático de ID de Lançamento e Status.
 */
function executarAutomacaoLinhagem(e) {
  var sheet = e.source.getActiveSheet();
  if (sheet.getName() !== "Banco de Dados") return;
  
  var r = e.range;
  var row = r.getRow();
  var col = r.getColumn();
  
  // Se o usuário digitou uma nova descrição na coluna B, e o ID (coluna A) estiver vazio
  if (col === 2 && row > 1) {
    var idCell = sheet.getRange(row, 1);
    if (idCell.getValue() === "") {
      var prefix = "LAN-";
      var hash = Utilities.formatDate(new Date(), "GMT-3", "yyyyMMdd") + "-" + Math.floor(Math.random() * 900 + 100);
      idCell.setValue(prefix + hash);
    }
    
    // Auto-preencher data atual na coluna C se vazia
    var dataCell = sheet.getRange(row, 3);
    if (dataCell.getValue() === "") {
      dataCell.setValue(new Date());
    }
  }
}
`
    },
    {
      name: "Triggers.gs",
      description: "Associa as funções aos eventos do Google Sheets como edição em tempo real.",
      icon: <Settings2 className="h-4 w-4" />,
      code: `/**
 * Trigger simples de edição do Sheets que delega ações de segurança e automação.
 */
function onEdit(e) {
  if (!e) return;
  
  // Executa o auto-ID e preenchimento de datas
  try {
    executarAutomacaoLinhagem(e);
  } catch (err) {
    Logger.log("Erro na automação de linha: " + err.toString());
  }
}
`
    },
    {
      name: "Utils.gs",
      description: "Utilitários para backups preventivos no Google Drive e geração automática de PDF.",
      icon: <FileCode className="h-4 w-4" />,
      code: `/**
 * Cria uma cópia de backup automática da planilha atual em uma pasta específica do Google Drive.
 */
function backupPlanilha() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var file = DriveApp.getFileById(ss.getId());
  
  // Procura ou cria a pasta 'Backup_Financas'
  var folders = DriveApp.getFoldersByName('Backup_Financeiro_Planilha');
  var folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder('Backup_Financeiro_Planilha');
  }
  
  var timeStamp = Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd_HH-mm");
  var copyName = ss.getName() + "_BACKUP_" + timeStamp;
  file.makeCopy(copyName, folder);
  
  SpreadsheetApp.getUi().alert('💾 CÓPIA DE SEGURANÇA SALVA COM SUCESSO!\n\nSalvo na pasta "Backup_Financeiro_Planilha" no seu Google Drive com o nome: \\n' + copyName);
}
`
    }
  ];

  return (
    <div className="space-y-6" id="exporter-tab">
      
      {/* Google Drive Cloud Backup Automation Panel */}
      <div 
        id="drive-backup-panel" 
        className="p-6 bg-slate-900 rounded-3xl text-white border border-slate-800 shadow-lg relative overflow-hidden"
      >
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-36 h-36 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

        {needsAuth ? (
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 py-4">
            <div className="space-y-3 max-w-xl">
              <div className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-300 border border-amber-500/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                <AlertTriangle className="h-3.5 w-3.5" /> Conexão Necessária
              </div>
              <h2 className="text-xl font-bold font-display leading-tight">
                Vincule sua Conta do Google Drive
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Para ativar a exportação em PDF e automação de backups preventivos, conecte sua conta Google Workspace.
                <span className="block mt-1.5 text-slate-400 font-semibold">
                  🛡️ Segurança e Privacidade: Nosso sistema utiliza o escopo estrito de menor privilégio (<code className="font-mono text-indigo-300 font-bold">drive.file</code>), significando que o app só possui acesso aos arquivos e pastas criados por ele próprio.
                </span>
              </p>
            </div>

            <div className="shrink-0 w-full md:w-auto">
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="w-full md:w-auto px-6 py-3 bg-white text-slate-900 hover:bg-slate-50 font-bold rounded-2xl flex items-center justify-center gap-3 transition-all cursor-pointer shadow-md shadow-white/5 active:scale-98 disabled:opacity-75 disabled:cursor-wait"
              >
                {isLoggingIn ? (
                  <>
                    <RefreshCw className="h-5 w-5 animate-spin text-indigo-600" />
                    <span className="text-sm font-semibold text-slate-700">Conectando...</span>
                  </>
                ) : (
                  <>
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-5 w-5">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    </svg>
                    <span className="text-sm font-semibold">Entrar com o Google</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="relative z-10 space-y-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 border-b border-slate-800 pb-5">
              
              <div className="space-y-2 max-w-xl">
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    <CloudLightning className="h-3.5 w-3.5 text-emerald-400" /> Google Drive Ativo
                  </div>
                  {user && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{user.email}</span>
                      <button 
                        onClick={handleLogout}
                        title="Desconectar conta"
                        className="ml-1.5 p-0.5 text-slate-400 hover:text-rose-400 rounded-md transition-all cursor-pointer"
                      >
                        <LogOut className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
                
                <h2 className="text-lg font-bold font-display leading-tight">
                  Automação de Backup de Orçamento & BI
                </h2>
                <p className="text-xs text-slate-300">
                  Salve relatórios de auditoria financeira no seu Google Drive. Você pode escolher a pasta de destino ou criar uma nova diretamente abaixo.
                </p>
              </div>

              {/* Last Backup Indicator */}
              <div className="bg-slate-950/20 px-4 py-3 rounded-2xl border border-slate-800 flex items-center gap-3 shrink-0 max-w-sm">
                <Clock className="h-5 w-5 text-indigo-400 shrink-0" />
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Último Backup da Sessão</span>
                  {lastBackup ? (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[11px] font-bold text-emerald-400 font-mono">
                        {new Date(lastBackup.timestamp).toLocaleTimeString("pt-BR")}
                      </span>
                      <span className="text-[9px] bg-indigo-500/30 text-indigo-300 px-1.5 py-0.2 rounded font-bold uppercase font-mono">
                        {lastBackup.format === "BOTH" ? "CSV + PDF" : lastBackup.format}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-amber-400 italic font-medium">Nenhum backup realizado ainda.</span>
                  )}
                </div>
              </div>

            </div>

            {/* Folder Selection and Action Segment */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Folder Selector and Creator Section */}
              <div className="lg:col-span-7 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    1. Pasta de Destino no Google Drive
                  </label>
                  
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <FolderOpen className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <select
                        value={selectedFolderId}
                        onChange={(e) => {
                          setSelectedFolderId(e.target.value);
                          setBackupSuccess(false);
                        }}
                        disabled={isLoadingFolders}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer font-medium disabled:opacity-50"
                      >
                        <option value="root">Raiz do Google Drive (Meu Drive)</option>
                        {folders.map((f) => (
                          <option key={f.id} value={f.id}>
                            📁 {f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <button
                      onClick={() => token && fetchFolders(token)}
                      disabled={isLoadingFolders}
                      title="Atualizar lista de pastas"
                      className="p-2.5 bg-slate-950 border border-slate-800 hover:bg-slate-800 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`h-4.5 w-4.5 text-slate-400 ${isLoadingFolders ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </div>

                {/* Inline Folder Creator */}
                <div className="bg-slate-950/30 p-3.5 rounded-2xl border border-slate-800/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">
                      Criar Nova Pasta no Drive
                    </span>
                    {createFolderSuccess && (
                      <span className="text-[9px] text-emerald-400 font-bold animate-pulse">
                        Pasta criada e selecionada!
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Ex: Backups Planejador Financeiro"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      disabled={isCreatingFolder}
                      className="flex-1 px-3.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                    />
                    <button
                      onClick={handleCreateFolder}
                      disabled={isCreatingFolder || !newFolderName.trim()}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer text-white"
                    >
                      {isCreatingFolder ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                      Criar
                    </button>
                  </div>
                </div>

              </div>

              {/* Format selection and triggers */}
              <div className="lg:col-span-5 bg-slate-950/40 p-4 rounded-2xl border border-slate-800 w-full space-y-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    2. Formato do Arquivo
                  </span>
                  <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800" id="backup-format-select">
                    <button
                      type="button"
                      onClick={() => {
                        setBackupFormat("CSV");
                        setBackupSuccess(false);
                      }}
                      className={`text-[10px] font-bold py-1.5 rounded-md transition-all cursor-pointer ${
                        backupFormat === "CSV"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Planilha CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBackupFormat("PDF");
                        setBackupSuccess(false);
                      }}
                      className={`text-[10px] font-bold py-1.5 rounded-md transition-all cursor-pointer ${
                        backupFormat === "PDF"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Relatório PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBackupFormat("BOTH");
                        setBackupSuccess(false);
                      }}
                      className={`text-[10px] font-bold py-1.5 rounded-md transition-all cursor-pointer ${
                        backupFormat === "BOTH"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Ambos
                    </button>
                  </div>
                </div>

                <button
                  onClick={triggerBackup}
                  disabled={isBackingUp}
                  className={`w-full py-3 rounded-xl font-bold text-xs tracking-wide uppercase transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 ${
                    isBackingUp 
                      ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-wait" 
                      : "bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-slate-950 shadow-md shadow-emerald-500/10"
                  }`}
                >
                  {isBackingUp ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Salvando na Nuvem...
                    </>
                  ) : (
                    <>
                      <Cloud className="h-4 w-4" />
                      Exportar para o Drive
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Success Banner */}
        {backupSuccess && (
          <div className="mt-4 p-3.5 bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 rounded-xl text-xs flex items-center gap-2.5 animate-fade-in" id="backup-success-alert">
            <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400" />
            <div className="flex-1">
              <span className="font-bold">Backup concluído com sucesso no Google Drive!</span>
              <p className="text-[10px] text-emerald-400/80">
                Os arquivos ({backupFormat === "BOTH" ? "CSV + PDF" : backupFormat}) foram enviados para a pasta selecionada com marcadores cronológicos.
              </p>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {backupError && (
          <div className="mt-4 p-3.5 bg-rose-500/15 border border-rose-500/20 text-rose-300 rounded-xl text-xs flex items-center gap-2.5 animate-fade-in" id="backup-error-alert">
            <ShieldAlert className="h-5 w-5 shrink-0 text-rose-400" />
            <div className="flex-1">
              <span className="font-bold">Falha na operação de nuvem:</span>
              <p className="text-[10px] text-rose-400/80">{backupError}</p>
            </div>
          </div>
        )}

      </div>

      {/* 2. Import My Spreadsheet Data Section */}
      <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-xs space-y-6" id="import-spreadsheet-card">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 font-display">Adicionar & Importar Minha Planilha</h3>
              <p className="text-xs text-gray-500">Alimente o sistema carregando seu arquivo CSV local ou integrando diretamente com o Google Sheets.</p>
            </div>
          </div>
          
          <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
            <button
              onClick={() => {
                setImportMode("CSV");
                setRawParsedRows([]);
                setImportError(null);
                setImportSuccess(null);
              }}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                importMode === "CSV"
                  ? "bg-white text-indigo-600 shadow-2xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Arquivo CSV
            </button>
            <button
              onClick={() => {
                setImportMode("SHEETS");
                setRawParsedRows([]);
                setImportError(null);
                setImportSuccess(null);
              }}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                importMode === "SHEETS"
                  ? "bg-white text-indigo-600 shadow-2xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Google Sheets Link
            </button>
          </div>
        </div>

        {/* Error / Success banners */}
        {importError && (
          <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl text-xs flex items-center gap-2.5 animate-fade-in">
            <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0" />
            <div className="flex-1 font-medium">{importError}</div>
          </div>
        )}
        
        {importSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-xs flex items-center gap-2.5 animate-fade-in">
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="flex-1 font-medium">{importSuccess}</div>
          </div>
        )}

        {importMode === "CSV" ? (
          <div className="space-y-4">
            {/* CSV File Upload drag and drop */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                isDraggingCsv
                  ? "border-indigo-500 bg-indigo-50/50"
                  : "border-gray-200 hover:border-gray-300 bg-gray-50/30"
              }`}
              onClick={() => document.getElementById("csv-file-input")?.click()}
            >
              <input
                id="csv-file-input"
                type="file"
                accept=".csv"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleCsvFileLoad(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
                <Upload className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-700">
                  {csvFileName ? `Arquivo Selecionado: ${csvFileName}` : "Arraste seu arquivo CSV ou clique para navegar"}
                </p>
                <p className="text-[10px] text-gray-400 mt-1">
                  Suporta arquivos delimitados por vírgula ou ponto e vírgula (.csv)
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Google Sheets URL integration */}
            {needsAuth ? (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 text-amber-950 text-xs space-y-2">
                <p className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600" /> Conta Google Desconectada
                </p>
                <p className="text-amber-900/90 leading-relaxed">
                  Para importar planilhas diretamente da sua nuvem do Google Sheets, conecte-se na conta Google utilizando o painel <strong>"Vincule sua Conta do Google Drive"</strong> acima.
                </p>
              </div>
            ) : (
              <div className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-gray-100">
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">
                    Cole o link completo da sua Planilha do Google
                  </label>
                  <div className="flex gap-2 flex-col sm:flex-row">
                    <input
                      type="text"
                      placeholder="Ex: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5.../edit"
                      value={spreadsheetUrl}
                      onChange={(e) => {
                        setSpreadsheetUrl(e.target.value);
                        setRawParsedRows([]);
                        setSpreadsheetTitle("");
                      }}
                      className="flex-1 px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-2xs"
                    />
                    <button
                      onClick={fetchSpreadsheetInfo}
                      disabled={isLoadingSpreadsheet || !spreadsheetUrl.trim()}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer shadow-xs shrink-0"
                    >
                      {isLoadingSpreadsheet ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Verificar Planilha
                    </button>
                  </div>
                </div>

                {spreadsheetTitle && (
                  <div className="pt-2 space-y-4 border-t border-gray-200/50 animate-fade-in">
                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 px-3.5 py-2 rounded-xl border border-emerald-100 text-xs font-semibold">
                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Conectado à Planilha: <strong>{spreadsheetTitle}</strong></span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 font-bold uppercase block tracking-wider">
                          Selecione a Aba (Página)
                        </label>
                        <select
                          value={selectedSheetTab}
                          onChange={(e) => {
                            setSelectedSheetTab(e.target.value);
                            setRawParsedRows([]);
                          }}
                          className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {spreadsheetSheets.map((tab) => (
                            <option key={tab} value={tab}>
                              📄 {tab}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={fetchSheetData}
                        disabled={isLoadingSheetData || !selectedSheetTab}
                        className="w-full px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                      >
                        {isLoadingSheetData ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileSpreadsheet className="h-4 w-4" />
                        )}
                        Carregar Dados da Aba
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Mapper & Preview Segment */}
        {rawParsedRows.length > 0 && (
          <div className="border-t border-gray-100 pt-5 space-y-5 animate-fade-in" id="import-mapping-preview-section">
            <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100/50 space-y-4">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wide flex items-center gap-1.5">
                  <Sliders className="h-4 w-4 text-indigo-600" /> Mapeamento e Configuração de Colunas
                </h4>
                <p className="text-[11px] text-indigo-700/80 leading-relaxed">
                  Defina quais colunas da planilha de origem contêm as informações financeiras. Nós pré-selecionamos as colunas correspondentes de forma inteligente.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-gray-600 block uppercase">Descrição *</span>
                  <select
                    value={colMapping.description}
                    onChange={(e) => setColMapping(p => ({ ...p, description: parseInt(e.target.value) }))}
                    className="w-full px-2.5 py-2 bg-white border border-gray-200 rounded-lg text-xs"
                  >
                    <option value={-1}>-- Selecionar --</option>
                    {rawParsedRows[0]?.map((h, i) => (
                      <option key={i} value={i}>Col {i + 1}: {h || `[Sem Nome]`}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-gray-600 block uppercase">Valor Nominal</span>
                  <select
                    value={colMapping.value}
                    onChange={(e) => setColMapping(p => ({ ...p, value: parseInt(e.target.value) }))}
                    className="w-full px-2.5 py-2 bg-white border border-gray-200 rounded-lg text-xs"
                  >
                    <option value={-1}>-- Não importar / Vazio --</option>
                    {rawParsedRows[0]?.map((h, i) => (
                      <option key={i} value={i}>Col {i + 1}: {h || `[Sem Nome]`}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-gray-600 block uppercase">Mês</span>
                  <select
                    value={colMapping.month}
                    onChange={(e) => setColMapping(p => ({ ...p, month: parseInt(e.target.value) }))}
                    className="w-full px-2.5 py-2 bg-white border border-gray-200 rounded-lg text-xs"
                  >
                    <option value={-1}>-- Padrão (JANEIRO) --</option>
                    {rawParsedRows[0]?.map((h, i) => (
                      <option key={i} value={i}>Col {i + 1}: {h || `[Sem Nome]`}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-gray-600 block uppercase">Categoria / Tipo</span>
                  <select
                    value={colMapping.category}
                    onChange={(e) => setColMapping(p => ({ ...p, category: parseInt(e.target.value) }))}
                    className="w-full px-2.5 py-2 bg-white border border-gray-200 rounded-lg text-xs"
                  >
                    <option value={-1}>-- Padrão (Outros) --</option>
                    {rawParsedRows[0]?.map((h, i) => (
                      <option key={i} value={i}>Col {i + 1}: {h || `[Sem Nome]`}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 col-span-2 md:col-span-1">
                  <span className="text-[10px] font-bold text-gray-600 block uppercase">Status</span>
                  <select
                    value={colMapping.status}
                    onChange={(e) => setColMapping(p => ({ ...p, status: parseInt(e.target.value) }))}
                    className="w-full px-2.5 py-2 bg-white border border-gray-200 rounded-lg text-xs"
                  >
                    <option value={-1}>-- Padrão (Falta Pagar) --</option>
                    {rawParsedRows[0]?.map((h, i) => (
                      <option key={i} value={i}>Col {i + 1}: {h || `[Sem Nome]`}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Relatório de Validação de Formato */}
              {validationReport && (
                <div className="bg-white border border-gray-100 rounded-xl p-4.5 space-y-3.5 shadow-3xs" id="sheets-validation-report-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {validationReport.isPerfect ? (
                        <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
                          <CheckCircle className="h-4.5 w-4.5" />
                        </div>
                      ) : (
                        <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600">
                          <AlertTriangle className="h-4.5 w-4.5" />
                        </div>
                      )}
                      <div>
                        <h5 className="text-xs font-bold text-gray-900">Análise de Formato da Planilha</h5>
                        <p className="text-[10px] text-gray-500">
                          {validationReport.validRows} linhas válidas identificadas. {validationReport.ignoredRows > 0 && `${validationReport.ignoredRows} linhas vazias ignoradas.`}
                        </p>
                      </div>
                    </div>
                    {validationReport.hasWarnings && (
                      <button
                        onClick={() => setShowAllIssues(!showAllIssues)}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition-all cursor-pointer"
                      >
                        {showAllIssues ? "Ocultar Detalhes" : `Ver Detalhes (${validationReport.rowIssues.length})`}
                      </button>
                    )}
                  </div>

                  {/* Warning summary message */}
                  {validationReport.hasWarnings ? (
                    <div className="p-3 bg-amber-50/50 border border-amber-100/60 rounded-xl text-xs text-amber-900 leading-relaxed space-y-1">
                      <p className="font-bold flex items-center gap-1 text-amber-800 text-[11px]">
                        <AlertTriangle className="h-4 w-4 text-amber-600" /> Alguns alertas de formatação foram encontrados
                      </p>
                      <p className="text-[10px] text-amber-800/90">
                        O sistema tratará essas inconsistências de forma automática e segura usando valores padrões (ex. considerando valores ilegíveis como R$ 0,00 ou classificando categorias desconhecidas sob 'Outros').
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-50/30 border border-emerald-100/40 rounded-xl text-[11px] text-emerald-800 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      <span>Parabéns! Todos os dados estão no formato esperado (mês, valor, categoria e descrição válidos).</span>
                    </div>
                  )}

                  {/* List of details if showAllIssues is open */}
                  {showAllIssues && validationReport.rowIssues.length > 0 && (
                    <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-100 text-[10px] bg-slate-50">
                      {validationReport.rowIssues.map((issue, idx) => (
                        <div key={idx} className="p-2.5 flex items-start gap-2.5 hover:bg-white transition-all">
                          <span className="font-mono bg-gray-100 text-gray-500 font-bold px-1.5 py-0.5 rounded text-[9px] shrink-0">
                            Linha {issue.rowNumber}
                          </span>
                          <div className="space-y-0.5 flex-1">
                            <span className="font-semibold text-gray-700 capitalize">Campo: {issue.field}</span>
                            {issue.value && (
                              <span className="text-gray-400 font-mono block text-[9px]">Valor original: "{issue.value}"</span>
                            )}
                            <p className="text-gray-600 mt-0.5">{issue.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-indigo-100/30 pt-3.5">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-gray-600 block uppercase">Ação ao Importar</span>
                  <div className="flex bg-white border border-gray-200 rounded-lg p-0.5 gap-1">
                    <button
                      onClick={() => setAppendMode("APPEND")}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                        appendMode === "APPEND"
                          ? "bg-indigo-600 text-white shadow-2xs"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      Mesclar / Incrementar Lançamentos
                    </button>
                    <button
                      onClick={() => setAppendMode("REPLACE")}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                        appendMode === "REPLACE"
                          ? "bg-rose-600 text-white shadow-2xs"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      Substituir Planilha Completa
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 w-full sm:w-auto self-end">
                  <button
                    onClick={() => {
                      setRawParsedRows([]);
                      setCsvFileName("");
                      setSpreadsheetTitle("");
                      setSpreadsheetSheets([]);
                    }}
                    className="flex-1 sm:flex-none px-4 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Cancelar
                  </button>
                  <button
                    onClick={commitImport}
                    className="flex-1 sm:flex-none px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <CheckCircle className="h-4 w-4" /> Finalizar & Inserir Dados
                  </button>
                </div>
              </div>
            </div>

            {/* Preview of Parsed Rows */}
            <div className="space-y-2 border border-gray-100 rounded-2xl overflow-hidden">
              <div className="bg-gray-50/50 px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500 block uppercase tracking-wider">
                  Visualização Prévia da Importação (Primeiras 5 linhas)
                </span>
                <span className="text-[10px] font-mono text-gray-400 font-semibold bg-white border border-gray-100 px-1.5 py-0.2 rounded">
                  {rawParsedRows.length - 1} registros detectados
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-left text-gray-500">
                  <thead className="text-[10px] text-gray-700 uppercase bg-gray-50/30 border-b border-gray-100 font-bold">
                    <tr>
                      <th className="py-2.5 px-4 text-center w-12">#</th>
                      <th className="py-2.5 px-4">Descrição</th>
                      <th className="py-2.5 px-4 text-right">Valor Nominal</th>
                      <th className="py-2.5 px-4">Mês</th>
                      <th className="py-2.5 px-4">Categoria</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {rawParsedRows.slice(1, 6).map((row, rowIdx) => {
                      // Get mapped fields
                      const desc = colMapping.description !== -1 ? row[colMapping.description] || "" : `[Sem Mapeamento]`;
                      const val = colMapping.value !== -1 ? row[colMapping.value] || "R$ 0,00" : `R$ 0,00`;
                      const mth = colMapping.month !== -1 ? row[colMapping.month] || "JANEIRO" : `JANEIRO`;
                      const cat = colMapping.category !== -1 ? row[colMapping.category] || "Outros" : `Outros`;
                      const stat = colMapping.status !== -1 ? row[colMapping.status] || "Falta Pagar" : `Falta Pagar`;
                      
                      return (
                        <tr key={rowIdx} className="hover:bg-gray-50/50">
                          <td className="py-2 px-4 text-center text-gray-400 font-mono font-bold">{rowIdx + 1}</td>
                          <td className="py-2 px-4 text-gray-900 font-semibold">{desc}</td>
                          <td className="py-2 px-4 text-right font-mono font-bold text-gray-800">{val}</td>
                          <td className="py-2 px-4 text-gray-600 font-mono uppercase text-[10px] font-bold">{mth}</td>
                          <td className="py-2 px-4">
                            <span className="text-[9px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full font-bold">
                              {cat}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-center">
                            <span className="text-[9px] bg-gray-50 border border-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold uppercase">
                              {stat}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Introduction */}
      <div className="pt-2">
        <h2 className="text-xl font-display font-semibold text-gray-900">Blueprint do Google Sheets (BI Pro)</h2>
        <p className="text-xs text-gray-500">
          Transforme sua planilha em um painel profissional completo utilizando nossas fórmulas e scripts prontos para usar.
        </p>
      </div>

      {/* Modern Sheets Formulas Blueprint */}
      <div className="p-5 border border-indigo-50 bg-indigo-50/10 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold font-display text-gray-900 flex items-center gap-1.5">
          <FileCode className="h-5 w-5 text-indigo-600" />
          Fórmulas Modernas e Eficientes (ETAPA 9)
        </h3>
        <p className="text-xs text-gray-600 leading-relaxed">
          Substitua o PROCV repetitivo e as colunas redundantes por estas fórmulas avançadas e dinâmicas do Google Sheets. Elas mantêm seu navegador rápido e calculam dados em blocos automáticos:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <div className="p-4 rounded-xl bg-white border border-gray-100 space-y-2">
            <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold uppercase px-2 py-0.5 rounded-full font-mono">
              Soma Dinâmica com Filtro Inteligente
            </span>
            <code className="text-[11px] font-mono text-indigo-600 block bg-gray-50 p-2 rounded-md font-semibold select-all">
              {"=SUM(FILTER(VALORES; CONTROLE<>\"PROXIMO MES\"))"}
            </code>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              <strong>O que faz:</strong> Soma apenas os débitos que foram efetivamente quitados no mês corrente, ignorando as contas pendentes remetidas para o próximo período. Resolve o principal "ponto fraco" da planilha original.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-gray-100 space-y-2">
            <span className="text-[10px] bg-cyan-100 text-cyan-700 font-bold uppercase px-2 py-0.5 rounded-full font-mono">
              Consolidação de Dados por Query
            </span>
            <code className="text-[11px] font-mono text-cyan-600 block bg-gray-50 p-2 rounded-md font-semibold select-all">
              {"=QUERY(BancoDeDados!A:G; \"SELECT G, SUM(C) WHERE F='Despesa' GROUP BY G ORDER BY SUM(C) DESC LABEL SUM(C) 'Total' \"; 1)"}
            </code>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              <strong>O que faz:</strong> Cria instantaneamente um ranking de maiores despesas agrupadas por Categoria. Perfeito para alimentar tabelas de Top 10 e alimentar gráficos de BI sem precisar de PROCV.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-gray-100 space-y-2">
            <span className="text-[10px] bg-amber-100 text-amber-700 font-bold uppercase px-2 py-0.5 rounded-full font-mono">
              Busca com Segurança Avançada (XLOOKUP)
            </span>
            <code className="text-[11px] font-mono text-amber-600 block bg-gray-50 p-2 rounded-md font-semibold select-all">
              {"=XLOOKUP(A2; BancoDeDados!A:A; BancoDeDados!C:C; 0; 0)"}
            </code>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              <strong>O que faz:</strong> Encontra valores de faturas de forma linear de maneira 10 vezes mais rápida do que o PROCV clássico, retornando "0" por padrão caso não encontre o credor, evitando poluir as células com erros como <code>#N/A</code>.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-gray-100 space-y-2">
            <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold uppercase px-2 py-0.5 rounded-full font-mono">
              Otimização com Função LET
            </span>
            <code className="text-[11px] font-mono text-emerald-600 block bg-gray-50 p-2 rounded-md font-semibold select-all">
              {"=LET(SomaDebitos; SUM(B3:B20); Saldo; R$1550 - SomaDebitos; IF(Saldo < 0; \"⚠️ DÉFICIT\"; \"✅ OK\"))"}
            </code>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              <strong>O que faz:</strong> Armazena resultados de cálculos em variáveis nomeadas na célula para reutilizá-los na própria fórmula, reduzindo o processamento repetitivo do Google Sheets.
            </p>
          </div>

        </div>
      </div>

      {/* Google Apps Script Repository */}
      <div className="border border-gray-100 bg-white rounded-2xl overflow-hidden shadow-xs space-y-0">
        
        {/* Header bar */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-indigo-400" />
            <div>
              <h3 className="text-xs font-bold font-display uppercase tracking-wider">Repositório Google Apps Script (ETAPA 11)</h3>
              <p className="text-[10px] text-gray-400">Códigos completos prontos para uso na ferramenta Extensões &gt; Apps Script</p>
            </div>
          </div>

          <button
            onClick={() => handleCopy(SCRIPTS[activeFileIdx].code)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiado!" : "Copiar Arquivo"}
          </button>
        </div>

        {/* Workspace panel split */}
        <div className="grid grid-cols-1 md:grid-cols-4 min-h-[400px]">
          
          {/* File Lists sidebar */}
          <div className="border-r border-gray-100 bg-gray-50/50 p-2 space-y-1">
            {SCRIPTS.map((f, i) => (
              <button
                key={f.name}
                onClick={() => {
                  setActiveFileIdx(i);
                  setCopied(false);
                }}
                className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 transition-all text-xs cursor-pointer ${
                  i === activeFileIdx 
                    ? "bg-indigo-50 border border-indigo-100/50 text-indigo-700 font-bold" 
                    : "text-gray-600 hover:bg-gray-100/55 hover:text-gray-900"
                }`}
              >
                {f.icon}
                <span>{f.name}</span>
              </button>
            ))}
          </div>

          {/* Code Viewer */}
          <div className="md:col-span-3 p-4 flex flex-col bg-slate-950 font-mono text-xs text-indigo-100">
            <div className="border-b border-slate-800 pb-2 mb-3">
              <span className="text-[10px] text-gray-400 block uppercase tracking-wider font-semibold font-display">Descrição do módulo:</span>
              <p className="text-xs font-sans text-slate-300">{SCRIPTS[activeFileIdx].description}</p>
            </div>

            <pre className="flex-1 overflow-x-auto whitespace-pre p-2 bg-slate-950/80 rounded-md text-slate-200 select-all font-mono leading-relaxed select-text">
              {SCRIPTS[activeFileIdx].code}
            </pre>
          </div>

        </div>

      </div>

    </div>
  );
}
