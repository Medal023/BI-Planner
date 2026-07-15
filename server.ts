import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import firebaseConfig from "./firebase-applet-config.json";

dotenv.config();

const app = express();

// Sliding-window Rate Limiter Middleware (max 120 req/min per IP)
const rateLimitWindowMs = 60 * 1000;
const rateLimitMaxRequests = 120;
const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();

function rateLimiterMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown-ip";
  const now = Date.now();
  
  let record = ipRequestCounts.get(ip);
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + rateLimitWindowMs };
    ipRequestCounts.set(ip, record);
  } else {
    record.count++;
  }

  if (record.count > rateLimitMaxRequests) {
    return res.status(429).json({
      error: "Muitas requisições. Por favor, aguarde um minuto antes de tentar novamente (Rate Limit de 120 requisições/min excedido)."
    });
  }
  next();
}

app.use(rateLimiterMiddleware);

// Initialize Firebase Admin
let adminApp;
if (getApps().length === 0) {
  try {
    adminApp = initializeApp({
      projectId: firebaseConfig.projectId
    });
    console.log("Firebase Admin initialized successfully.");
  } catch (err: any) {
    console.error("Failed to initialize Firebase Admin:", err.message);
  }
} else {
  adminApp = getApp();
}

// Authentication Middleware to validate Firebase ID Tokens
export async function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Sessão inválida ou expirada. Por favor, faça login novamente." });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    
    // Attach decoded user info to the request
    (req as any).user = decodedToken;
    next();
  } catch (err: any) {
    console.error("Firebase ID Token verification failed:", err.message);
    res.status(401).json({ error: "Sessão inválida ou expirada. Por favor, faça login novamente." });
  }
}
const PORT = 3000;

app.use(express.json());

// Lazy-initialized Gemini Client
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in the environment. Please configure it in the Secrets panel (Settings > Secrets).");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Health Check API
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// AI Financial Advisor Endpoint
app.post("/api/advisor", authMiddleware, async (req, res) => {
  const { prompt, chatHistory, budgetData } = req.body;

  try {
    const ai = getGeminiClient();

    const systemInstruction = `Você é um especialista financeiro sênior, especialista em Google Sheets, BI, reorganização de dívidas e orçamento pessoal.
O usuário está enfrentando uma situação financeira CRÍTICA com base em sua planilha de orçamento de 2026.
Seus rendimentos mensais são de R$ 1.550,00, mas suas despesas fixas e faturas de cartão de crédito ultrapassam frequentemente R$ 3.000,00 a R$ 4.900,00 por mês, gerando um saldo líquido negativo acumulado altíssimo (sobra de -R$ 2.000,00 a -R$ 3.400,00).

Principais credores identificados:
- Bancos/Cartões: Banco Inter (faturas de R$ 600 a R$ 1.000), Mercado Pago, Nubank, Santander, Bradesco, Will Bank.
- Despesas de moradia: Aluguel/Casa Nova (R$ 250 a R$ 400), Água (R$ 77 a R$ 85), Energia, Claro, Internet (R$ 100).
- Outros compromissos: Faculdade (R$ 136,87), Banco do Brasil (BB), repasses para Amanda e Marcelo, Vivo.

Seu tom deve ser altamente profissional, empático, direto e focado em soluções estruturais, realistas e pragmáticas (como negociação de juros, consolidação de dívidas, bola de neve, ou corte de custos supérfluos).
Forneça insights claros com base no orçamento enviado. Se solicitado, ajude a formular cartas de negociação de dívida, fórmulas complexas para o Google Sheets (usando LET, QUERY, XLOOKUP, ARRAYFORMULA) ou conselhos de reorganização de fluxo de caixa.

Sempre responda em Português do Brasil com formatação elegante em Markdown.`;

    const contents = [];
    
    // Include budgetData in the prompt context if provided
    if (budgetData) {
      contents.push({
        role: "user",
        parts: [{ text: `Aqui estão os dados resumidos do meu orçamento para análise:\n${JSON.stringify(budgetData, null, 2)}` }]
      });
      contents.push({
        role: "model",
        parts: [{ text: "Entendido. Analisei os dados e percebo que há um sério descolamento entre as receitas de R$ 1.550,00 e os gastos mensais que chegam a quase R$ 5.000,00. Como posso ajudar você a reestruturar este cenário hoje?" }]
      });
    }

    // Include history if any
    if (chatHistory && Array.isArray(chatHistory)) {
      for (const msg of chatHistory) {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }]
        });
      }
    }

    // Add current prompt
    contents.push({
      role: "user",
      parts: [{ text: prompt }]
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ 
      error: error.message || "Ocorreu um erro interno ao processar sua solicitação no modelo de Inteligência Artificial."
    });
  }
});

// CSV Generator Helper
function generateCSV(data: any[]): string {
  const headers = ["Mes", "Salario_Liquido", "Ticket_Refeicao", "ID_Transacao", "Descricao", "Valor_Nominal", "Texto_Valor", "Status", "Categoria"];
  const rows = [headers.join(",")];
  
  for (const monthData of data) {
    const month = monthData.month || "";
    const salary = monthData.salary || 0;
    const ticket = monthData.ticketText || "";
    
    if (!monthData.transactions || monthData.transactions.length === 0) {
      rows.push([
        `"${month}"`,
        salary,
        `"${ticket}"`,
        "", "", "", "", "", ""
      ].join(","));
    } else {
      for (const t of monthData.transactions) {
        const id = t.id || "";
        const desc = (t.description || "").replace(/"/g, '""');
        const value = t.value || 0;
        const valText = (t.valueText || "").replace(/"/g, '""');
        const status = (t.status || "").replace(/"/g, '""');
        const cat = (t.category || "").replace(/"/g, '""');
        
        rows.push([
          `"${month}"`,
          salary,
          `"${ticket}"`,
          `"${id}"`,
          `"${desc}"`,
          value,
          `"${valText}"`,
          `"${status}"`,
          `"${cat}"`
        ].join(","));
      }
    }
  }
  return rows.join("\n");
}

// Text/Markdown Audit Report Generator
function generateTextReport(data: any[]): string {
  let report = "========================================================================\n";
  report += "          RELATÓRIO DE AUDITORIA E BACKUP FINANCEIRO SAAS - 2026\n";
  report += `          Gerado em: ${new Date().toLocaleString("pt-BR")}\n`;
  report += "========================================================================\n\n";
  
  let totalAnualSalario = 0;
  let totalAnualDespesas = 0;
  
  for (const m of data) {
    report += `\nMÊS: ${m.month.toUpperCase()} ------------------------------------\n`;
    report += `Salário Líquido Lançado: R$ ${m.salary.toFixed(2)}\n`;
    if (m.ticketText) report += `Ticket Alimentação: ${m.ticketText}\n`;
    
    let totalDespesasMes = 0;
    report += "\nTRANSAÇÕES / CONTAS DETALHADAS:\n";
    report += "ID              | Descrição            | Categoria            | Valor      | Status\n";
    report += "------------------------------------------------------------------------\n";
    
    if (!m.transactions || m.transactions.length === 0) {
      report += "Nenhuma transação lançada para este mês.\n";
    } else {
      for (const t of m.transactions) {
        const id = (t.id || "").padEnd(15).substring(0, 15);
        const desc = (t.description || "").padEnd(20).substring(0, 20);
        const cat = (t.category || "").padEnd(20).substring(0, 20);
        const val = `R$ ${t.value.toFixed(2)}`.padEnd(10);
        const status = t.status || "";
        report += `${id} | ${desc} | ${cat} | ${val} | ${status}\n`;
        totalDespesasMes += Math.abs(t.value);
      }
    }
    
    const sobra = m.salary - totalDespesasMes;
    report += "------------------------------------------------------------------------\n";
    report += `Total Receita: R$ ${m.salary.toFixed(2)} | Total Despesa: R$ ${totalDespesasMes.toFixed(2)}\n`;
    report += `Saldo do Mês (Sobra): R$ ${sobra.toFixed(2)} (${sobra >= 0 ? "SUPERÁVIT" : "DÉFICIT CRÍTICO"})\n`;
    report += "------------------------------------------------------------------------\n";
    
    totalAnualSalario += m.salary;
    totalAnualDespesas += totalDespesasMes;
  }
  
  report += "\n\n========================================================================\n";
  report += "                      BALANÇO ANUAL CONSOLIDADO\n";
  report += "========================================================================\n";
  report += `Receita Total Projetada (Anual): R$ ${totalAnualSalario.toFixed(2)}\n`;
  report += `Despesa Total Projetada (Anual): R$ ${totalAnualDespesas.toFixed(2)}\n`;
  const balancoGeral = totalAnualSalario - totalAnualDespesas;
  report += `Saldo Geral Consolidado: R$ ${balancoGeral.toFixed(2)} (${balancoGeral >= 0 ? "SAÚDE ESTÁVEL" : "RISCO CRÍTICO"})\n`;
  report += "========================================================================\n";
  return report;
}

// Google Drive File Creation via Multipart Upload
async function uploadToDrive(token: string, fileName: string, content: string, mimeType: string, folderId?: string) {
  const boundary = "foo_bar_baz_boundary";
  const metadata: any = {
    name: fileName,
    mimeType: mimeType,
  };
  if (folderId && folderId !== "root") {
    metadata.parents = [folderId];
  }

  const multipartBody = 
    `\n--${boundary}\n` +
    `Content-Type: application/json; charset=UTF-8\n\n` +
    JSON.stringify(metadata) +
    `\n--${boundary}\n` +
    `Content-Type: ${mimeType}\n\n` +
    content +
    `\n--${boundary}--\n`;

  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erro na API do Google Drive (${response.status}): ${errText}`);
  }

  return await response.json();
}

// Automated Backup Endpoint for Google Drive (CSV/PDF)
app.post("/api/backup-drive", authMiddleware, async (req, res) => {
  const { budgetData, format, folderId, accessToken } = req.body;
  const authHeader = req.headers.authorization || req.headers["x-goog-auth-token"] || accessToken;

  if (!authHeader) {
    return res.status(401).json({
      error: "Autorização do Google Drive não encontrada. Por favor, conecte sua conta Google Workspace para autorizar."
    });
  }

  let token = "";
  if (typeof authHeader === "string") {
    token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
  }

  if (!token) {
    return res.status(401).json({
      error: "Token de autorização do Google inválido ou ausente."
    });
  }

  try {
    const timestamp = new Date().toISOString().replace(/T/, "_").replace(/\..+/, "").replace(/:/g, "-");
    let result;

    if (format === "CSV" || format === "BOTH") {
      const csvContent = generateCSV(budgetData);
      const csvFileName = `SaaS_Backup_Financeiro_${timestamp}.csv`;
      result = await uploadToDrive(token, csvFileName, csvContent, "text/csv", folderId);
    }

    if (format === "PDF" || format === "BOTH") {
      const txtContent = generateTextReport(budgetData);
      const pdfFileName = `SaaS_Relatorio_Financeiro_${timestamp}.pdf`; 
      result = await uploadToDrive(token, pdfFileName, txtContent, "text/plain", folderId);
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      fileName: format === "BOTH" ? "CSV e PDF" : (format === "CSV" ? "CSV" : "PDF"),
      driveFileId: result?.id || "N/D"
    });
  } catch (error: any) {
    console.error("Backup to Google Drive error:", error);
    res.status(500).json({
      error: error.message || "Erro desconhecido ao tentar fazer upload do backup no Google Drive."
    });
  }
});

// Setup Vite or Static File Serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
