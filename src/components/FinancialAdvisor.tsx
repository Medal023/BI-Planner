import React, { useState, useEffect, useRef } from "react";
import { MonthlyBudget, AdvisorMessage } from "../types";
import { auth } from "../firebase";
import { 
  Send, 
  Sparkles, 
  Bot, 
  User, 
  MessageSquare, 
  AlertTriangle, 
  TrendingDown, 
  Coins, 
  FileText,
  Wrench,
  BadgeAlert,
  HelpCircle,
  Clock,
  ChevronRight
} from "lucide-react";

interface FinancialAdvisorProps {
  data: MonthlyBudget[];
}

export default function FinancialAdvisor({ data }: FinancialAdvisorProps) {
  const [messages, setMessages] = useState<AdvisorMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Olá! Sou seu **Coaching Financeiro com Inteligência Artificial**.\n\nAnalisei os dados de sua planilha e identifiquei um **déficit estrutural crítico** (você ganha R$ 1.550,00, mas suas despesas mensais chegam perto de R$ 5.000,00 devido às faturas acumuladas de cartões).\n\nPosso ajudar você com as seguintes soluções:\n1. **Dicas Práticas para sair do vermelho**.\n2. **Gerar uma Carta de Renegociação de Dívidas** (Banco Inter, Will, Bradesco, etc.).\n3. **Simular Plano Bola de Neve (Snowball)** para liquidar credores mais rápidos.\n4. **Fórmulas Avançadas** para automatizar seu controle financeiro.\n\nComo gostaria de começar? Clique em uma das sugestões abaixo ou digite sua dúvida!",
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto Scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const budgetSummary = React.useMemo(() => {
    const totalSalary = data.reduce((acc, curr) => acc + curr.salary, 0);
    const avgSalary = totalSalary / data.length;
    let totalExpenses = 0;
    const creditorAmounts: Record<string, number> = {};

    data.forEach(m => {
      m.transactions.forEach(t => {
        const val = Math.abs(t.value);
        totalExpenses += val;
        const desc = t.description.toUpperCase().trim();
        creditorAmounts[desc] = (creditorAmounts[desc] || 0) + val;
      });
    });

    const topCreditors = Object.keys(creditorAmounts)
      .map(name => ({ name, total: creditorAmounts[name] }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      avgSalary,
      avgExpenses: totalExpenses / data.length,
      netTotal: totalSalary - totalExpenses,
      topCreditors
    };
  }, [data]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputMessage;
    if (!textToSend.trim() || loading) return;

    const userMsg: AdvisorMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!customText) setInputMessage("");
    setLoading(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();

      const response = await fetch("/api/advisor", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(idToken ? { "Authorization": `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({
          prompt: textToSend,
          chatHistory: messages.slice(-10), // send last 10 messages for context
          budgetData: budgetSummary
        })
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Ocorreu um erro ao chamar o AI Advisor.");
      }

      const assistantMsg: AdvisorMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: json.text,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (error: any) {
      console.error(error);
      const errorMsg: AdvisorMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `⚠️ **Erro ao conectar com a Inteligência Artificial:** ${error.message}\n\n*Certifique-se de configurar a variável \`GEMINI_API_KEY\` na aba lateral de Configurações/Secrets.*`,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const PRESETS = [
    { label: "Sair do Vermelho", text: "Me dê um plano de ação prático em 3 passos com base nas minhas contas para eu sair do vermelho este ano.", icon: <Coins className="h-4 w-4" /> },
    { label: "Modelo de Carta Banco Inter", text: "Escreva uma proposta formal de renegociação de saldo devedor de cartão de crédito para o Banco Inter, pedindo retirada de juros e parcelamento flat compatível com meu rendimento de R$ 1.550,00.", icon: <FileText className="h-4 w-4" /> },
    { label: "Estratégia Bola de Neve", text: "Como ficaria a simulação de quitação de dívidas pelo método Bola de Neve (pagar credores menores primeiro) para Amanda, Marcelo, Bradesco e Faculdade?", icon: <TrendingDown className="h-4 w-4" /> },
    { label: "Ajuda com Fórmulas Sheets", text: "Me dê uma fórmula inteligente do Google Sheets usando LET e FILTER para calcular o saldo de faturas vencidas apenas do mês atual.", icon: <Wrench className="h-4 w-4" /> }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="advisor-tab">
      
      {/* Diagnostics (Etapa 1: Análise completa da planilha) */}
      <div className="lg:col-span-1 space-y-6">
        
        <div className="p-5 border border-red-100 bg-white shadow-xs rounded-2xl space-y-4">
          <div className="flex items-center gap-2 text-red-600">
            <BadgeAlert className="h-5 w-5" />
            <h3 className="text-sm font-bold font-display uppercase tracking-wide">Laudo Técnico da Planilha (ETAPA 1)</h3>
          </div>

          <div className="space-y-3 text-xs leading-relaxed text-gray-600">
            <div>
              <span className="font-bold text-gray-800 block">🎯 Finalidade do Orçamento:</span>
              <p>Controle de fluxo de caixa pessoal com monitoramento de faturas de cartão de crédito e despesas domésticas.</p>
            </div>

            <div>
              <span className="font-bold text-gray-800 block">🛑 Principais Pontos Fracos:</span>
              <ul className="list-disc pl-4 space-y-1 mt-1">
                <li>
                  <strong className="text-red-600">Déficit Crítico Crônico:</strong> O rendimento de R$ 1.550,00 é completamente consumido por despesas básicas. A diferença é jogada nos cartões (Inter, Nubank, Bradesco) que geram faturas cumulativas exponenciais.
                </li>
                <li>
                  <strong className="text-amber-600">Distorção no Somatório:</strong> A planilha original soma faturas com status "PROXIMO MES" ou "PAGO NO CREDITO" na despesa do mês atual, causando duplicidade de valores e saldo falso.
                </li>
                <li>
                  <strong className="text-amber-600">Falta de Padronização:</strong> Dados como "renovação", "********" e "--------" dificultam filtros numéricos ou uso de inteligência analítica de dados (BI).
                </li>
              </ul>
            </div>

            <div>
              <span className="font-bold text-gray-800 block">💡 Sugestão de Nova Arquitetura de Planilha (BI):</span>
              <p>Separar as bases de dados em Tabelas Planas com colunas estritas: <code>Data</code>, <code>Credor</code>, <code>Valor</code>, <code>Status</code>, <code>Categoria</code>. Criar uma aba exclusiva para parâmetros e outra para Dashboards dinâmicos com formulas eficientes.</p>
            </div>
          </div>
        </div>

        {/* Quick Tips Box */}
        <div className="p-5 border border-indigo-100 bg-indigo-50/20 rounded-2xl space-y-3 text-xs">
          <h4 className="font-bold text-indigo-900 font-display flex items-center gap-1.5">
            <HelpCircle className="h-4 w-4 text-indigo-600" />
            Você sabia?
          </h4>
          <p className="text-indigo-950/80 leading-relaxed">
            Utilizar a fórmula <code>=QUERY()</code> ou o novo <code>=LET()</code> no Google Sheets poupa memória RAM do navegador e evita travamentos que acontecem ao arrastar PROCV por milhares de linhas!
          </p>
        </div>

      </div>

      {/* AI Chat Room */}
      <div className="lg:col-span-2 flex flex-col h-[600px] border border-gray-100 bg-white rounded-2xl shadow-xs overflow-hidden">
        
        {/* Chat Header */}
        <div className="p-4 border-b border-gray-100 bg-slate-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg animate-pulse">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xs font-bold font-display uppercase tracking-wider">AI Financial Advisor</h3>
              <span className="text-[10px] text-indigo-200 block">Gemini 3.5-Flash Ativo</span>
            </div>
          </div>
          <span className="text-[10px] bg-indigo-500/30 px-2 py-0.5 rounded-full font-mono font-semibold">
            Contexto: 12 meses
          </span>
        </div>

        {/* Messages Screen */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex gap-3 max-w-[85%] ${msg.role === "user" ? "ml-auto flex-row-reverse" : ""}`}
            >
              <div className={`p-2 rounded-lg h-8 w-8 flex items-center justify-center shrink-0 ${
                msg.role === "user" ? "bg-indigo-100 text-indigo-600" : "bg-slate-900 text-indigo-400"
              }`}>
                {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              
              <div className={`p-3 rounded-2xl space-y-1 shadow-2xs ${
                msg.role === "user" 
                  ? "bg-indigo-600 text-white rounded-tr-none" 
                  : "bg-white border border-gray-200/60 text-gray-800 rounded-tl-none"
              }`}>
                <div className="text-xs leading-relaxed whitespace-pre-wrap font-sans">
                  {/* Simplistic renderer for markdown formatting without react-markdown overhead */}
                  {formatMarkdown(msg.content)}
                </div>
                <span className={`text-[9px] block text-right font-mono ${msg.role === "user" ? "text-indigo-200" : "text-gray-400"}`}>
                  {msg.timestamp}
                </span>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 max-w-[80%] animate-pulse">
              <div className="p-2 bg-slate-900 text-indigo-400 rounded-lg h-8 w-8 flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
              <div className="p-4 bg-white border border-gray-100 rounded-2xl rounded-tl-none text-xs text-gray-400 font-medium">
                Analisando dados do orçamento de 2026 e formulando sugestões de reestruturação...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Preset suggestions */}
        <div className="p-3 border-t border-gray-100 bg-white flex items-center gap-2 overflow-x-auto scrollbar-none">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handleSendMessage(preset.text)}
              className="text-[10px] font-semibold text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 rounded-full px-3 py-1.5 flex items-center gap-1 transition-all shrink-0 cursor-pointer"
            >
              {preset.icon}
              {preset.label}
            </button>
          ))}
        </div>

        {/* Input box */}
        <div className="p-3 border-t border-gray-100 bg-white flex gap-2 items-center">
          <input
            type="text"
            placeholder="Pergunte ao consultor financeiro (Ex: Como reduzir despesas?)"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            className="flex-1 px-4 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-sans"
            disabled={loading}
          />
          <button
            onClick={() => handleSendMessage()}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-xs flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            disabled={loading}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

      </div>

    </div>
  );
}

// Basic robust client-side formatting for bullet points, bold tags and highlights
function formatMarkdown(text: string) {
  // Convert standard **text** into JSX styled structures dynamically
  const lines = text.split("\n");
  return lines.map((line, i) => {
    let content = line;
    let isHeading = false;
    let isBullet = false;

    if (line.startsWith("### ")) {
      content = line.replace("### ", "");
      isHeading = true;
    } else if (line.startsWith("## ")) {
      content = line.replace("## ", "");
      isHeading = true;
    } else if (line.startsWith("1. ") || line.startsWith("2. ") || line.startsWith("3. ") || line.startsWith("4. ") || line.startsWith("- ") || line.startsWith("* ")) {
      isBullet = true;
    }

    // Bold tags replacement
    const parts = [];
    let currentText = content;
    const regex = /\*\*(.*?)\*\*/g;
    let match;
    let lastIndex = 0;

    while ((match = regex.exec(currentText)) !== null) {
      if (match.index > lastIndex) {
        parts.push(currentText.substring(lastIndex, match.index));
      }
      parts.push(<strong key={match.index} className="font-bold underline decoration-indigo-400 decoration-2">{match[1]}</strong>);
      lastIndex = regex.lastIndex;
    }
    
    if (lastIndex < currentText.length) {
      parts.push(currentText.substring(lastIndex));
    }

    if (isHeading) {
      return (
        <h4 key={i} className="text-sm font-bold text-slate-900 mt-3 mb-1.5 flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 text-indigo-500" />
          {parts.length > 0 ? parts : content}
        </h4>
      );
    }

    if (isBullet) {
      return (
        <div key={i} className="pl-4 py-0.5 text-xs text-gray-700 flex items-start gap-1.5">
          <span className="text-indigo-500 font-bold shrink-0 mt-0.5">•</span>
          <span>{parts.length > 0 ? parts : content}</span>
        </div>
      );
    }

    return (
      <p key={i} className="min-h-[1rem] leading-relaxed text-xs">
        {parts.length > 0 ? parts : content}
      </p>
    );
  });
}
