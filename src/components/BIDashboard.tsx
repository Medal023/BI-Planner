import React, { useState, useMemo, useEffect } from "react";
import { MonthlyBudget, BudgetTransaction, IncomeProfile } from "../types";
import BudgetAlertCard from "./BudgetAlertCard";
import CreditorsList from "./CreditorsList";
import { 
  ResponsiveContainer, 
  ComposedChart, 
  BarChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area
} from "recharts";
import { 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle, 
  DollarSign, 
  Calendar, 
  CreditCard, 
  CheckCircle, 
  Clock, 
  ShieldAlert, 
  Sparkles,
  Info,
  Sliders,
  Settings,
  Check,
  X,
  AlertCircle,
  LayoutDashboard,
  Wallet,
  PlusCircle,
  Trash2,
  Plus
} from "lucide-react";
import { db } from "../firebase";
import { doc, getDoc, collection, addDoc } from "firebase/firestore";

interface BIDashboardProps {
  data: MonthlyBudget[];
  incomeProfile?: IncomeProfile | null;
  onUpdateData?: (updated: MonthlyBudget[]) => void;
  user?: any;
}

/**
 * Calcula a variância percentual entre o valor realizado e o planejado.
 * Fórmula: Variância = (Realizado - Planejado) / Planejado * 100
 */
export function calculatePercentageVariance(realized: number, planned: number): number {
  if (planned === 0) {
    return realized > 0 ? 100 : 0;
  }
  return ((realized - planned) / planned) * 100;
}

/**
 * Obtém o nome do mês atual em português, em maiúsculas (ex: "JUNHO").
 */
export function getPortugueseCurrentMonth(): string {
  const months = [
    "JANEIRO",
    "FEVEREIRO",
    "MARÇO",
    "ABRIL",
    "MAIO",
    "JUNHO",
    "JULHO",
    "AGOSTO",
    "SETEMBRO",
    "OUTUBRO",
    "NOVEMBRO",
    "DEZEMBRO"
  ];
  return months[new Date().getMonth()];
}

const CATEGORY_COLORS = {
  "Moradia": "#4F46E5",       // Indigo
  "Cartão de Crédito": "#EF4444", // Red
  "Utilidades": "#06B6D4",    // Cyan
  "Educação": "#F59E0B",      // Amber
  "Pessoal": "#10B981",       // Emerald
  "Empréstimos": "#8B5CF6",   // Purple
  "Outros": "#6B7280"         // Gray
};

const STATUS_COLORS: Record<string, string> = {
  "PAGO": "#10B981",
  "PAGO NO CREDITO": "#3B82F6",
  "PAGO POR AMANDA": "#6EE7B7",
  "CUSTO ZERO": "#6B7280",
  "PROXIMO MES": "#F59E0B",
  "FALTA PAGAR": "#EF4444",
  "VALOR MINIMO": "#F59E0B",
  "ACORDO": "#8B5CF6"
};

const defaultCategories = [
  "Alimentação",
  "Moradia",
  "Transporte",
  "Saúde",
  "Educação",
  "Lazer",
  "Compras",
  "Assinaturas",
  "Investimentos",
  "Contas Fixas",
  "Impostos",
  "Pets",
  "Viagens",
  "Outros"
];

const getMonthNamePortuguese = (date: Date): string => {
  const months = [
    "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
    "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
  ];
  return months[date.getMonth()];
};

export default function BIDashboard({ data, incomeProfile, onUpdateData, user }: BIDashboardProps) {
  // Quick Expense States
  const [expenseValueText, setExpenseValueText] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [expenseLocal, setExpenseLocal] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [expensePaymentMethod, setExpensePaymentMethod] = useState("Pix");
  const [expenseIsParcelled, setExpenseIsParcelled] = useState(false);
  const [expenseInstallments, setExpenseInstallments] = useState(2);
  const [expenseValuePerInstallment, setExpenseValuePerInstallment] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");
  
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [categoriesList, setCategoriesList] = useState<string[]>(defaultCategories);

  // Local Toast notification state
  const [localToast, setLocalToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const triggerToast = (type: "success" | "error", message: string) => {
    setLocalToast({ type, message });
    setTimeout(() => {
      setLocalToast(prev => prev?.message === message ? null : prev);
    }, 4000);
  };

  // Keyboard shortcut handlers for form container
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleClearExpenseFields();
    }
  };

  const handleClearExpenseFields = () => {
    setExpenseValueText("");
    setExpenseLocal("");
    setExpenseDescription("");
    setExpenseDate(new Date().toISOString().split("T")[0]);
    setExpensePaymentMethod("Pix");
    setExpenseIsParcelled(false);
    setExpenseInstallments(2);
    setExpenseValuePerInstallment("");
    setExpenseNotes("");
    triggerToast("success", "Campos limpos com sucesso.");
  };

  // Dynamically calculate installment value
  useEffect(() => {
    if (expenseIsParcelled) {
      const numericVal = parseFloat(expenseValueText.replace(/\./g, "").replace(",", ".")) || 0;
      const calculatedVal = numericVal / expenseInstallments;
      if (calculatedVal > 0) {
        setExpenseValuePerInstallment(
          calculatedVal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        );
      } else {
        setExpenseValuePerInstallment("");
      }
    }
  }, [expenseValueText, expenseInstallments, expenseIsParcelled]);

  // Handle custom categories fetching
  useEffect(() => {
    const loadCategories = async () => {
      if (!user || !user.uid) {
        setCategoriesList(defaultCategories);
        return;
      }
      try {
        const catDocRef = doc(db, "categories", user.uid);
        const catSnap = await getDoc(catDocRef);
        if (catSnap.exists()) {
          const catData = catSnap.data();
          if (catData && Array.isArray(catData.categories)) {
            setCategoriesList(catData.categories);
          } else if (catData && Array.isArray(catData.items)) {
            setCategoriesList(catData.items);
          } else {
            setCategoriesList(defaultCategories);
          }
        } else {
          setCategoriesList(defaultCategories);
        }
      } catch (err) {
        console.warn("Erro ao buscar categorias do Firestore:", err);
        setCategoriesList(defaultCategories);
      }
    };
    loadCategories();
  }, [user]);

  // Set default category when categories list loads
  useEffect(() => {
    if (categoriesList.length > 0 && !expenseCategory) {
      setExpenseCategory(categoriesList[0]);
    }
  }, [categoriesList, expenseCategory]);

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value === "") {
      setExpenseValueText("");
      return;
    }
    const numValue = parseFloat(value) / 100;
    setExpenseValueText(numValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  const handleAddExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const numericValue = parseFloat(expenseValueText.replace(/\./g, "").replace(",", ".")) || 0;
    
    if (numericValue <= 0) {
      triggerToast("error", "O valor da despesa deve ser maior que zero.");
      return;
    }
    if (!expenseCategory) {
      triggerToast("error", "Selecione uma categoria.");
      return;
    }
    if (!expenseDescription.trim()) {
      triggerToast("error", "Preencha a descrição da despesa.");
      return;
    }

    setIsSavingExpense(true);

    try {
      const generatedTransactions: any[] = [];
      const localBudgetTransactions: BudgetTransaction[] = [];

      const initialDate = new Date(expenseDate + "T12:00:00");

      if (expenseIsParcelled) {
        const installmentsVal = parseFloat(expenseValuePerInstallment.replace(/\./g, "").replace(",", ".")) || 0;
        if (installmentsVal <= 0) {
          triggerToast("error", "Valor da parcela inválido.");
          setIsSavingExpense(false);
          return;
        }

        for (let i = 1; i <= expenseInstallments; i++) {
          const parcelDate = new Date(initialDate);
          parcelDate.setMonth(initialDate.getMonth() + i - 1);
          
          const parcelMonthName = getMonthNamePortuguese(parcelDate);
          const parcelId = `parcel-${Date.now()}-${i}`;
          const parcelDescription = `${expenseDescription} (${i}/${expenseInstallments})`;

          localBudgetTransactions.push({
            id: parcelId,
            month: parcelMonthName,
            description: parcelDescription,
            value: installmentsVal,
            valueText: `R$ ${installmentsVal.toFixed(2).replace(".", ",")}`,
            status: "FALTA PAGAR",
            category: expenseCategory as any
          });

          generatedTransactions.push({
            uid: user?.uid || "demo-user",
            tipo: "despesa",
            valor: installmentsVal,
            categoria: expenseCategory,
            local: expenseLocal,
            descricao: parcelDescription,
            formaPagamento: expensePaymentMethod,
            parcelado: true,
            quantidadeParcelas: expenseInstallments,
            numeroParcela: i,
            data: parcelDate.toISOString().split('T')[0],
            observacoes: expenseNotes,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      } else {
        const singleMonthName = getMonthNamePortuguese(initialDate);
        const singleId = `quick-${Date.now()}`;

        localBudgetTransactions.push({
          id: singleId,
          month: singleMonthName,
          description: expenseDescription,
          value: numericValue,
          valueText: `R$ ${numericValue.toFixed(2).replace(".", ",")}`,
          status: "FALTA PAGAR",
          category: expenseCategory as any
        });

        generatedTransactions.push({
          uid: user?.uid || "demo-user",
          tipo: "despesa",
          valor: numericValue,
          categoria: expenseCategory,
          local: expenseLocal,
          descricao: expenseDescription,
          formaPagamento: expensePaymentMethod,
          parcelado: false,
          quantidadeParcelas: 1,
          numeroParcela: 1,
          data: expenseDate,
          observacoes: expenseNotes,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      if (user && user.uid && user.uid !== "demo-user") {
        const transactionsCol = collection(db, "transactions");
        for (const tx of generatedTransactions) {
          await addDoc(transactionsCol, tx);
        }
      }

      const updatedBudgetData = data.map(m => {
        const newTxsForMonth = localBudgetTransactions.filter(t => t.month === m.month);
        if (newTxsForMonth.length > 0) {
          return {
            ...m,
            transactions: [...newTxsForMonth, ...m.transactions]
          };
        }
        return m;
      });

      if (onUpdateData) {
        await onUpdateData(updatedBudgetData);
      } else {
        localStorage.setItem("bi_budget_data_2026", JSON.stringify(updatedBudgetData));
      }

      const historyLog = {
        usuario: user?.email || "Usuário Demo",
        uid: user?.uid || "demo-user",
        data: new Date().toLocaleDateString("pt-BR"),
        hora: new Date().toLocaleTimeString("pt-BR"),
        valor: numericValue,
        categoria: expenseCategory,
        local: expenseLocal,
        descricao: expenseDescription,
        formaDePagamento: expensePaymentMethod,
        origem: "Dashboard"
      };
      
      const currentHistory = JSON.parse(localStorage.getItem(`bi_history_log_${user?.uid || "demo-user"}`) || "[]");
      localStorage.setItem(`bi_history_log_${user?.uid || "demo-user"}`, JSON.stringify([historyLog, ...currentHistory]));

      setExpenseValueText("");
      setExpenseLocal("");
      setExpenseDescription("");
      setExpenseIsParcelled(false);
      setExpenseInstallments(2);
      setExpenseValuePerInstallment("");
      setExpenseNotes("");
      
      triggerToast("success", "Despesa adicionada com sucesso!");
    } catch (err: any) {
      console.error("Erro ao salvar despesa rápida:", err);
      triggerToast("error", `Não foi possível salvar a despesa: ${err?.message || err}`);
    } finally {
      setIsSavingExpense(false);
    }
  };

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const currentMonthName = getPortugueseCurrentMonth();
    const exists = data.some(m => m.month.toUpperCase() === currentMonthName);
    return exists ? currentMonthName : (data[0]?.month || "TODOS");
  });
  const [selectedCategory, setSelectedCategory] = useState<string>("TODAS");
  const [dashboardView, setDashboardView] = useState<"overview" | "creditors">("overview");

  const DEFAULT_LIMITS: Record<string, number> = {
    "Moradia": 300,
    "Cartão de Crédito": 1800,
    "Utilidades": 250,
    "Educação": 150,
    "Pessoal": 400,
    "Empréstimos": 200,
    "Outros": 300
  };

  const [limits, setLimits] = useState<Record<string, number>>(() => {
    const cached = localStorage.getItem("bi_budget_limits_2026");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        // fallback
      }
    }
    return DEFAULT_LIMITS;
  });

  const [tempLimits, setTempLimits] = useState<Record<string, number>>({ ...limits });
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Memos for Income Profile Integration
  const somaExtras = useMemo(() => {
    if (!incomeProfile || !incomeProfile.rendasExtras) return 0;
    return incomeProfile.rendasExtras.reduce((acc, curr) => acc + curr.valor, 0);
  }, [incomeProfile]);

  const chartHistoryData = useMemo(() => {
    if (!incomeProfile || !incomeProfile.historico || incomeProfile.historico.length === 0) {
      return [];
    }
    return [...incomeProfile.historico].reverse().map((h) => ({
      date: h.data,
      "Renda Total": h.novoValor,
      "Salário Base": incomeProfile.salarioBase,
      "Ganhos Extras": h.novoValor - incomeProfile.salarioBase
    }));
  }, [incomeProfile]);

  // Keep temp limits in sync when config is toggled
  useEffect(() => {
    if (isConfigOpen) {
      setTempLimits({ ...limits });
    }
  }, [isConfigOpen, limits]);

  const handleSaveLimits = () => {
    setLimits(tempLimits);
    localStorage.setItem("bi_budget_limits_2026", JSON.stringify(tempLimits));
    setIsConfigOpen(false);
  };

  // 1b. Variance Analysis for all categories
  const categoryVarianceData = useMemo(() => {
    const realizedMap: Record<string, number> = {
      "Moradia": 0,
      "Cartão de Crédito": 0,
      "Utilidades": 0,
      "Educação": 0,
      "Pessoal": 0,
      "Empréstimos": 0,
      "Outros": 0
    };

    let monthsCount = 0;
    const monthsSet = new Set<string>();

    data.forEach(m => {
      monthsSet.add(m.month);
      const isTargetMonth = selectedMonth === "TODOS" || m.month === selectedMonth;
      if (isTargetMonth) {
        m.transactions.forEach(t => {
          const val = Math.abs(t.value);
          realizedMap[t.category] = (realizedMap[t.category] || 0) + val;
        });
      }
    });

    monthsCount = selectedMonth === "TODOS" ? monthsSet.size : 1;
    if (monthsCount === 0) monthsCount = 1;

    const categories = Object.keys(realizedMap) as Array<keyof typeof realizedMap>;
    
    return categories.map(cat => {
      const totalRealized = realizedMap[cat] || 0;
      // Get monthly average if "TODOS" is selected, otherwise get the total realized for that month
      const realized = selectedMonth === "TODOS" ? (totalRealized / monthsCount) : totalRealized;
      const planned = limits[cat] ?? DEFAULT_LIMITS[cat] ?? 0;
      
      const variance = realized - planned;
      const variancePct = calculatePercentageVariance(realized, planned);
      const pctConsumed = planned > 0 ? (realized / planned) * 100 : (realized > 0 ? 100 : 0);

      let status: "EXCEDIDO" | "ALERTA" | "SOB_CONTROLE" = "SOB_CONTROLE";
      if (realized > planned) {
        status = "EXCEDIDO";
      } else if (realized >= planned * 0.8) {
        status = "ALERTA";
      }

      return {
        category: cat,
        planned,
        realized,
        variance,
        variancePct,
        pctConsumed,
        status
      };
    });
  }, [data, selectedMonth, limits]);

  // 1. Calculations & Metrics
  const metrics = useMemo(() => {
    let totalTransactionsCount = 0;
    let totalSalary = 0;
    let totalExpenses = 0;
    let totalPaid = 0;
    let totalPending = 0;
    const uniqueCreditors = new Set<string>();

    data.forEach(m => {
      if (selectedMonth === "TODOS" || m.month === selectedMonth) {
        totalSalary += m.salary;
        m.transactions.forEach(t => {
          if (selectedCategory === "TODAS" || t.category === selectedCategory) {
            totalTransactionsCount++;
            totalExpenses += Math.abs(t.value);
            uniqueCreditors.add(t.description.toUpperCase().trim());

            const statusUpper = t.status.toUpperCase();
            if (statusUpper.startsWith("PAGO") || statusUpper === "CUSTO ZERO") {
              totalPaid += Math.abs(t.value);
            } else {
              totalPending += Math.abs(t.value);
            }
          }
        });
      }
    });

    const netSobra = totalSalary - totalExpenses;
    const debtRatio = totalSalary > 0 ? (totalExpenses / totalSalary) * 100 : 0;

    return {
      totalTransactionsCount,
      totalSalary,
      totalExpenses,
      totalPaid,
      totalPending,
      netSobra,
      debtRatio,
      creditorsCount: uniqueCreditors.size
    };
  }, [data, selectedMonth, selectedCategory]);

  // 2. Chart Data: Monthly comparison of salary vs expenses
  const monthlyChartData = useMemo(() => {
    return data.map(m => {
      const sumExpenses = m.transactions.reduce((acc, curr) => acc + Math.abs(curr.value), 0);
      return {
        month: m.month,
        "Rendimento (Salário)": m.salary,
        "Despesas Totais": sumExpenses,
        "Déficit": sumExpenses - m.salary
      };
    });
  }, [data]);

  // 3. Chart Data: Expense Categories
  const categoryChartData = useMemo(() => {
    const categoriesMap: Record<string, number> = {};
    
    data.forEach(m => {
      if (selectedMonth === "TODOS" || m.month === selectedMonth) {
        m.transactions.forEach(t => {
          if (selectedCategory === "TODAS" || t.category === selectedCategory) {
            categoriesMap[t.category] = (categoriesMap[t.category] || 0) + Math.abs(t.value);
          }
        });
      }
    });

    return Object.keys(categoriesMap).map(cat => ({
      name: cat,
      value: parseFloat(categoriesMap[cat].toFixed(2))
    })).sort((a, b) => b.value - a.value);
  }, [data, selectedMonth, selectedCategory]);

  // 4. Chart Data: Top 10 Creditors / Expense Items
  const topCreditorsData = useMemo(() => {
    const creditorsMap: Record<string, number> = {};

    data.forEach(m => {
      if (selectedMonth === "TODOS" || m.month === selectedMonth) {
        m.transactions.forEach(t => {
          if (selectedCategory === "TODAS" || t.category === selectedCategory) {
            const desc = t.description.trim().toUpperCase();
            creditorsMap[desc] = (creditorsMap[desc] || 0) + Math.abs(t.value);
          }
        });
      }
    });

    return Object.keys(creditorsMap).map(desc => ({
      name: desc,
      value: parseFloat(creditorsMap[desc].toFixed(2))
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
  }, [data, selectedMonth, selectedCategory]);

  // 5. Status distribution
  const statusSummary = useMemo(() => {
    const statusMap: Record<string, number> = {};
    let total = 0;

    data.forEach(m => {
      if (selectedMonth === "TODOS" || m.month === selectedMonth) {
        m.transactions.forEach(t => {
          if (selectedCategory === "TODAS" || t.category === selectedCategory) {
            statusMap[t.status] = (statusMap[t.status] || 0) + 1;
            total++;
          }
        });
      }
    });

    return Object.keys(statusMap).map(status => ({
      status,
      count: statusMap[status],
      percentage: total > 0 ? (statusMap[status] / total) * 100 : 0
    })).sort((a, b) => b.count - a.count);
  }, [data, selectedMonth, selectedCategory]);

  // Alert Threshold Level
  const alertStatus = useMemo(() => {
    if (metrics.debtRatio > 150) {
      return {
        level: "CRÍTICO",
        message: `Risco de insolvência altíssimo! Suas despesas ultrapassam seus rendimentos em ${(metrics.debtRatio - 100).toFixed(0)}%. O acúmulo de juros de faturas rotativas como as do Inter e Bradesco criará uma bola de neve incontrolável.`,
        bg: "bg-red-50 border-red-200 text-red-800",
        icon: <ShieldAlert className="h-6 w-6 text-red-600" />
      };
    } else if (metrics.debtRatio > 100) {
      return {
        level: "ALERTA",
        message: "Seu orçamento está no vermelho! Despesas superam a receita líquida mensal de R$ 1.550,00. É necessário cortar custos ou fazer acordos imediatamente.",
        bg: "bg-amber-50 border-amber-200 text-amber-800",
        icon: <AlertTriangle className="h-6 w-6 text-amber-600" />
      };
    } else {
      return {
        level: "ESTÁVEL",
        message: "Suas despesas cabem no salário. Certifique-se de guardar uma reserva de emergência para imprevistos.",
        bg: "bg-emerald-50 border-emerald-200 text-emerald-800",
        icon: <CheckCircle className="h-6 w-6 text-emerald-600" />
      };
    }
  }, [metrics.debtRatio]);

  return (
    <div className="space-y-6" id="dashboard-tab">
      
      {/* 0. View Selector Sub-Tabs */}
      <div className="flex border-b border-gray-100 bg-white p-2.5 rounded-xl border border-gray-100 shadow-xs justify-between items-center flex-wrap gap-2" id="dashboard-view-tabs">
        <div className="flex gap-1.5">
          <button
            onClick={() => setDashboardView("overview")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              dashboardView === "overview"
                ? "bg-indigo-600 text-white shadow-xs shadow-indigo-500/10 font-extrabold"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <LayoutDashboard className="h-4.5 w-4.5" />
            Visão Geral & Indicadores BI
          </button>
          <button
            onClick={() => setDashboardView("creditors")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              dashboardView === "creditors"
                ? "bg-indigo-600 text-white shadow-xs shadow-indigo-500/10 font-extrabold"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <CreditCard className="h-4.5 w-4.5" />
            Contas & Credores (Visão Específica)
          </button>
        </div>
        <div className="text-[10px] text-gray-400 font-medium font-mono hidden sm:block">
          Modo de Visualização do Dashboard
        </div>
      </div>

      {dashboardView === "overview" ? (
        <>
          {/* 1. Header Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-gray-100 bg-white shadow-xs">
        <div>
          <h2 className="text-xl font-display font-semibold text-gray-900">Dashboard de Inteligência Financeira</h2>
          <p className="text-xs text-gray-500">Business Intelligence & Indicadores de Saúde Financeira</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Month Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Mês:
            </span>
            <div className="relative flex items-center">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-xs font-medium bg-gray-50 border border-gray-200 rounded-lg pl-2.5 pr-8 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
                id="filter-month"
              >
                <option value="TODOS">Todos os Meses (Anual)</option>
                {data.map(m => (
                  <option key={m.month} value={m.month}>
                    {m.month} {m.month.toUpperCase() === getPortugueseCurrentMonth() ? "⭐" : ""}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>
            {selectedMonth.toUpperCase() === getPortugueseCurrentMonth() && (
              <span className="text-[9px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse whitespace-nowrap">
                Mês Atual
              </span>
            )}
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
              <CreditCard className="h-3.5 w-3.5" /> Categoria:
            </span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs font-medium bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              id="filter-category"
            >
              <option value="TODAS">Todas as Categorias</option>
              <option value="Moradia">Moradia</option>
              <option value="Cartão de Crédito">Cartões de Crédito</option>
              <option value="Utilidades">Utilidades (Contas Fixas)</option>
              <option value="Educação">Educação</option>
              <option value="Pessoal">Pessoal / Familiares</option>
              <option value="Empréstimos">Empréstimos</option>
              <option value="Outros">Outros</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Critical Alert Banner */}
      <div className={`p-4 rounded-xl border flex gap-3 items-start animate-fade-in ${alertStatus.bg}`}>
        {alertStatus.icon}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold font-display uppercase tracking-wider">{alertStatus.level}</span>
            <span className="text-xs bg-black/10 px-2 py-0.5 rounded-full font-semibold">
              Endividamento: {metrics.debtRatio.toFixed(1)}%
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed">{alertStatus.message}</p>
        </div>
      </div>

      {/* 3. KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI: Receitas */}
        <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-gray-500 block">
              {selectedMonth !== "TODOS" ? "Receitas do Mês" : "Receitas (Anual)"}
            </span>
            <span className="text-lg font-bold text-gray-900 block font-sans">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                metrics.totalSalary
              )}
            </span>
            <span className="text-[10px] text-gray-400 block font-mono">
              Salário Líquido
            </span>
          </div>
        </div>

        {/* KPI: Despesas */}
        <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-lg bg-red-50 text-red-600">
            <TrendingDown className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-gray-500 block">
              Total de Despesas
            </span>
            <span className="text-lg font-bold text-red-600 block font-sans">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                metrics.totalExpenses
              )}
            </span>
            <span className="text-[10px] text-gray-400 block font-mono">
              Calculado das Contas
            </span>
          </div>
        </div>

        {/* KPI: Saldo Sobra */}
        <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-xs flex items-center gap-4">
          <div className={`p-3 rounded-lg ${metrics.netSobra >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
            {metrics.netSobra >= 0 ? <TrendingUp className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
          </div>
          <div>
            <span className="text-xs text-gray-500 block">
              Saldo Líquido / Sobra
            </span>
            <span className={`text-lg font-bold block font-sans ${metrics.netSobra >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                metrics.netSobra
              )}
            </span>
            <span className="text-[10px] text-gray-400 block font-mono">
              Diferença Líquida
            </span>
          </div>
        </div>

        {/* KPI: Credores & Eficiência */}
        <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-lg bg-indigo-50 text-indigo-600">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-gray-500 block">
              Contas & Credores
            </span>
            <span className="text-lg font-bold text-gray-900 block font-sans">
              {metrics.creditorsCount} credores
            </span>
            <span className="text-[10px] text-gray-400 block font-mono">
              {metrics.totalTransactionsCount} contas lançadas
            </span>
          </div>
        </div>

      </div>

      {/* CARD: Lançamento Rápido de Despesas */}
      <div 
        className="bg-white border border-gray-100 rounded-2xl p-6 shadow-3xs space-y-5 animate-fade-in"
        onKeyDown={handleKeyDown}
        tabIndex={0}
        id="quick-expense-card"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-50 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-950 font-display flex items-center gap-2">
                💳 Lançamento Rápido de Despesas
              </h3>
              <p className="text-xs text-gray-500">
                Adicione despesas diretamente ao seu fluxo financeiro com sincronização instantânea em nuvem.
              </p>
            </div>
          </div>
          <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-1 rounded-full font-bold uppercase tracking-wider self-start sm:self-auto">
            Novo Módulo
          </span>
        </div>

        <form onSubmit={handleAddExpenseSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Valor */}
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-semibold block">
                Valor (R$) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">R$</span>
                <input
                  type="text"
                  placeholder="0,00"
                  value={expenseValueText}
                  onChange={handleValueChange}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-1 focus:ring-rose-500 focus:border-rose-500 font-mono text-gray-900 font-bold"
                  required
                />
              </div>
            </div>

            {/* Categoria */}
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-semibold block">
                Categoria <span className="text-rose-500">*</span>
              </label>
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-1 focus:ring-rose-500 focus:border-rose-500 text-gray-900"
                required
              >
                {categoriesList.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Local */}
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-semibold block">Local</label>
              <input
                type="text"
                placeholder="Ex: Supermercado, Amazon"
                value={expenseLocal}
                onChange={(e) => setExpenseLocal(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-1 focus:ring-rose-500 focus:border-rose-500 text-gray-900"
              />
            </div>

            {/* Descrição */}
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-semibold block">
                Descrição <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Compra do mês, Lanche"
                value={expenseDescription}
                onChange={(e) => setExpenseDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-1 focus:ring-rose-500 focus:border-rose-500 text-gray-900"
                required
              />
            </div>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Data */}
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-semibold block">
                Data <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-1 focus:ring-rose-500 focus:border-rose-500 text-gray-900 font-mono"
                required
              />
            </div>

            {/* Forma de Pagamento */}
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-semibold block">Forma de Pagamento</label>
              <select
                value={expensePaymentMethod}
                onChange={(e) => setExpensePaymentMethod(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-1 focus:ring-rose-500 focus:border-rose-500 text-gray-900"
              >
                <option value="Pix">Pix</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Cartão de Débito">Cartão de Débito</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Boleto">Boleto</option>
                <option value="Transferência">Transferência</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            {/* Observações */}
            <div className="sm:col-span-2 space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-semibold block">Observações (Opcional)</label>
              <input
                type="text"
                placeholder="Detalhes adicionais sobre a compra..."
                value={expenseNotes}
                onChange={(e) => setExpenseNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-1 focus:ring-rose-500 focus:border-rose-500 text-gray-900"
              />
            </div>

          </div>

          {/* Parcelamento Section */}
          <div className="pt-2 border-t border-gray-50">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="expenseIsParcelled"
                checked={expenseIsParcelled}
                onChange={(e) => setExpenseIsParcelled(e.target.checked)}
                className="rounded border-gray-300 text-rose-600 focus:ring-rose-500 h-4 w-4"
              />
              <label htmlFor="expenseIsParcelled" className="text-xs font-semibold text-gray-700 select-none cursor-pointer">
                Compra Parcelada
              </label>
            </div>

            {expenseIsParcelled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3 p-3 bg-rose-50/40 rounded-xl border border-rose-100/50 animate-fade-in">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase font-semibold block">Qtd. de Parcelas</label>
                  <input
                    type="number"
                    min="2"
                    max="120"
                    value={expenseInstallments}
                    onChange={(e) => setExpenseInstallments(Math.max(2, parseInt(e.target.value) || 2))}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-rose-500 focus:border-rose-500 text-gray-900 font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase font-semibold block">Valor por Parcela</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">R$</span>
                    <input
                      type="text"
                      value={expenseValuePerInstallment}
                      readOnly
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-100/80 border border-gray-200 rounded-lg text-gray-600 font-mono font-bold cursor-not-allowed select-none"
                    />
                  </div>
                </div>

                <div className="space-y-1 sm:col-span-2 flex flex-col justify-end">
                  <span className="text-[10px] text-gray-400 font-medium block leading-relaxed">
                    * Serão gerados lançamentos automáticos com status <strong className="text-rose-600 font-semibold">FALTA PAGAR</strong> nas planilhas dos meses subsequentes.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-gray-100">
            <div className="text-[10px] text-gray-400 text-center sm:text-left">
              Dica: pressione <kbd className="px-1.5 py-0.5 bg-gray-100 rounded-md border font-sans font-bold">ESC</kbd> para limpar ou <kbd className="px-1.5 py-0.5 bg-gray-100 rounded-md border font-sans font-bold">Enter</kbd> para salvar.
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleClearExpenseFields}
                className="px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition duration-150"
              >
                Limpar Campos
              </button>
              <button
                type="submit"
                disabled={isSavingExpense}
                className="w-full sm:w-auto px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs hover:shadow-md transition duration-150"
              >
                {isSavingExpense ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Salvando na Nuvem...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Adicionar Despesa
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Local Toast Portal */}
        {localToast && (
          <div className="fixed bottom-6 right-6 z-[9999] flex items-center gap-3 bg-gray-900 text-white text-xs px-4 py-3 rounded-2xl shadow-xl border border-gray-800 animate-slide-in-up">
            <div className={`h-2 w-2 rounded-full ${localToast.type === 'success' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 animate-pulse'}`} />
            <span className="font-medium">{localToast.message}</span>
            <button 
              type="button"
              onClick={() => setLocalToast(null)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* 3.1. Active Income Profile & Evolution Module */}
      {incomeProfile && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-3xs space-y-5 animate-fade-in">
          <div className="flex items-center gap-2 border-b border-gray-50 pb-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-950 font-display flex items-center gap-2">
                Inteligência de Renda & Crescimento
              </h3>
              <p className="text-xs text-gray-500">
                Acompanhamento em tempo real dos proventos base, rendas complementares e taxa de crescimento histórico.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* KPI breakdown */}
            <div className="lg:col-span-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Salário Base</span>
                  <span className="text-sm font-extrabold text-gray-800 block">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(incomeProfile.salarioBase)}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Rendas Extras</span>
                  <span className="text-sm font-extrabold text-indigo-600 block">
                    + {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(somaExtras)}
                  </span>
                </div>
                <div className="p-3 bg-indigo-50/50 border border-indigo-100/50 rounded-xl space-y-1 col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-indigo-700 tracking-wider">Renda Consolidada</span>
                    <span className="text-[9px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                      {incomeProfile.frequencia}
                    </span>
                  </div>
                  <span className="text-lg font-black text-indigo-900 block">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(incomeProfile.rendaTotal)}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-[11px] text-gray-500 space-y-1.5">
                <div className="flex justify-between">
                  <span>Última Atualização:</span>
                  <span className="font-semibold text-gray-700">
                    {new Date(incomeProfile.ultimaAtualizacao).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Autor da Alteração:</span>
                  <span className="font-semibold text-gray-700 truncate max-w-[150px]" title={incomeProfile.usuario}>
                    {incomeProfile.usuario.includes("@") ? incomeProfile.usuario : "Usuário Autenticado"}
                  </span>
                </div>
                {incomeProfile.historico.length > 0 && (
                  <div className="flex justify-between border-t border-slate-200/50 pt-1.5 text-indigo-600 font-medium">
                    <span>Variação Histórica:</span>
                    <span>
                      {incomeProfile.historico.length} {incomeProfile.historico.length === 1 ? "alteração" : "alterações registradas"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Growth Chart */}
            <div className="lg:col-span-7 flex flex-col justify-between border border-gray-100 rounded-2xl p-4.5 bg-gray-50/30">
              <div className="mb-2">
                <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  Evolução & Gráfico de Crescimento
                </h4>
                <p className="text-[10px] text-gray-400">
                  Progresso cronológico da sua receita mensal integrada.
                </p>
              </div>

              {chartHistoryData.length > 1 ? (
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartHistoryData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRenda" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="date" stroke="#94A3B8" fontSize={9} tickLine={false} />
                      <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "#1E293B", borderRadius: "12px", border: "none", color: "#F8FAFC", fontSize: "11px" }}
                        formatter={(value: any) => [new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value)), "Renda Total"]}
                      />
                      <Area type="monotone" dataKey="Renda Total" stroke="#4F46E5" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRenda)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-44 flex flex-col items-center justify-center text-center p-4 space-y-2.5">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full">
                    <Sparkles className="h-5 w-5 animate-pulse" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-gray-700 block">Pronto para acompanhar seu progresso!</span>
                    <p className="text-[10px] text-gray-400 max-w-sm leading-relaxed">
                      Seu gráfico de evolução de renda começará a desenhar o crescimento de forma automática assim que você atualizar seus proventos ou rendas extras nas configurações.
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Budget Alerts & Variance Analysis Module */}
      <div className="p-5 rounded-xl border border-gray-100 bg-white shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold font-display text-gray-900 flex items-center gap-2">
              <Sliders className="h-4 w-4 text-indigo-600" />
              Alertas de Orçamento & Desvio de Variância
            </h3>
            <p className="text-xs text-gray-500">
              Identificação automática de gastos próximos do limite com cálculo em tempo real da variância entre Planejado e Realizado.
            </p>
          </div>

          <button
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            className="text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shrink-0 cursor-pointer self-start sm:self-auto"
          >
            <Settings className="h-3.5 w-3.5 text-gray-500" />
            {isConfigOpen ? "Fechar Configurações" : "Configurar Limites"}
          </button>
        </div>

        {/* Configuration Panel */}
        {isConfigOpen && (
          <div className="p-4 border border-indigo-100 bg-indigo-50/20 rounded-xl space-y-4 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-indigo-100/50 pb-2 gap-2">
              <span className="text-xs font-bold text-indigo-900 uppercase tracking-wide flex items-center gap-1">
                Definir Limites Planejados por Categoria
              </span>
              <span className="text-[10px] text-indigo-600">
                Os limites são salvos localmente e recalculam os desvios automaticamente.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.keys(tempLimits).map((cat) => (
                <div key={cat} className="space-y-1">
                  <label className="text-[10px] text-gray-600 font-semibold block truncate">
                    {cat}
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-[10px] text-gray-400 font-mono">R$</span>
                    <input
                      type="number"
                      value={tempLimits[cat] || ""}
                      onChange={(e) =>
                        setTempLimits({
                          ...tempLimits,
                          [cat]: parseFloat(e.target.value) || 0
                        })
                      }
                      className="w-full pl-8 pr-2 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setIsConfigOpen(false)}
                className="text-xs border border-gray-200 text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveLimits}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-all shadow-xs cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                Salvar Limites
              </button>
            </div>
          </div>
        )}

        {/* Alerts & Variance list */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categoryVarianceData.map((item) => (
            <BudgetAlertCard
              key={item.category}
              category={item.category}
              planned={item.planned}
              realized={item.realized}
              variance={item.variance}
              variancePct={item.variancePct}
              pctConsumed={item.pctConsumed}
              status={item.status}
              selectedMonth={selectedMonth}
            />
          ))}
        </div>

        {/* Global Variance Insights summary block */}
        <div className="p-3.5 bg-indigo-50/30 border border-indigo-100/50 rounded-xl text-xs leading-relaxed text-indigo-950 flex gap-2.5">
          <Info className="h-4.5 w-4.5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Análise Estrutural de Desvio de Custos:</span>
            <p>
              {categoryVarianceData.filter(i => i.status === "EXCEDIDO").length > 0 ? (
                <span>
                  Detectamos desvio orçamentário em{" "}
                  <strong>
                    {categoryVarianceData.filter(i => i.status === "EXCEDIDO").map(i => i.category).join(", ")}
                  </strong>
                  . A variância positiva acumulada total nestas áreas indica a necessidade urgente de remanejamento de limites ou contingenciamento de gastos não-essenciais.
                </span>
              ) : (
                <span>
                  Excelente trabalho! Todas as categorias de despesa estão sob controle e abaixo dos limites planejados neste período. Continue monitorando para garantir a manutenção do superávit.
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* 4. Interactive Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Chart: Monthly Revenue vs Expenses (Deficit View) */}
        <div className="lg:col-span-2 p-5 rounded-xl border border-gray-100 bg-white shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold font-display text-gray-900">Evolução do Fluxo de Caixa (Deficitário)</h3>
              <p className="text-[11px] text-gray-400">Comparação mensal direta entre o Salário e os Débitos no ano</p>
            </div>
            <span className="text-xs bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Salário Estagnado vs Contas
            </span>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={monthlyChartData}
                margin={{ top: 10, right: 10, bottom: 0, left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={11} tickLine={false} />
                <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} />
                <Tooltip 
                  formatter={(value: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)}
                  contentStyle={{ backgroundColor: "#1e293b", color: "#fff", borderRadius: "8px", fontSize: "12px" }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                
                {/* Bar chart representing total expenses */}
                <Bar name="Despesas Totais" dataKey="Despesas Totais" fill="#f87171" radius={[4, 4, 0, 0]} barSize={28} />
                
                {/* Line chart representing the fixed income */}
                <Line name="Rendimento (Salário)" type="monotone" dataKey="Rendimento (Salário)" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Expenses by Category */}
        <div className="p-5 rounded-xl border border-gray-100 bg-white shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-semibold font-display text-gray-900">Distribuição das Despesas</h3>
            <p className="text-[11px] text-gray-400">Quais categorias consomem mais o orçamento</p>
          </div>

          <div className="h-60 w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {categoryChartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={CATEGORY_COLORS[entry.name as keyof typeof CATEGORY_COLORS] || "#cbd5e1"} 
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)}
                  contentStyle={{ backgroundColor: "#1e293b", color: "#fff", borderRadius: "8px", fontSize: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Inner Label showing biggest category */}
            <div className="absolute text-center">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Maior Gasto</span>
              <span className="text-xs font-bold text-red-600 block truncate max-w-[110px]">
                {categoryChartData[0]?.name || "Nenhum"}
              </span>
            </div>
          </div>

          {/* Custom Legends list */}
          <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
            {categoryChartData.map((item, index) => {
              const pct = metrics.totalExpenses > 0 ? (item.value / metrics.totalExpenses) * 100 : 0;
              return (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-2.5 h-2.5 rounded-full shrink-0" 
                      style={{ backgroundColor: CATEGORY_COLORS[item.name as keyof typeof CATEGORY_COLORS] }} 
                    />
                    <span className="text-gray-600 truncate max-w-[120px]">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-gray-500">
                    <span>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.value)}</span>
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-sm font-semibold">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>



      {/* 5. Bottom Rows: Top Creditors vs Payment Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top 10 Creditors / Elements list */}
        <div className="p-5 rounded-xl border border-gray-100 bg-white shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-semibold font-display text-gray-900">Top 10 Maiores Credores ou Contas do Ano</h3>
            <p className="text-[11px] text-gray-400">Consolidado acumulado que mais sangra seu saldo líquido</p>
          </div>

          <div className="space-y-3">
            {topCreditorsData.map((creditor, i) => {
              const maxVal = topCreditorsData[0]?.value || 1;
              const ratio = (creditor.value / maxVal) * 100;
              return (
                <div key={creditor.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-800 flex items-center gap-2">
                      <span className="text-[10px] bg-indigo-50 text-indigo-600 w-4 h-4 rounded-full flex items-center justify-center font-mono">
                        {i + 1}
                      </span>
                      {creditor.name}
                    </span>
                    <span className="font-mono text-gray-500 font-medium">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(creditor.value)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-1.5 rounded-full" 
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status Breakdown and dynamic stats */}
        <div className="p-5 rounded-xl border border-gray-100 bg-white shadow-xs space-y-5">
          <div>
            <h3 className="text-sm font-semibold font-display text-gray-900">Análise de Status de Contas</h3>
            <p className="text-[11px] text-gray-400">Classificação das pendências e pagamentos no período selecionado</p>
          </div>

          {/* Financial Liquidity Indicator */}
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <Info className="h-4 w-4 text-indigo-600" />
                Meta de Liquidação Total
              </span>
              <span className="text-xs font-mono font-bold text-indigo-600">
                {((metrics.totalPaid / (metrics.totalExpenses || 1)) * 100).toFixed(0)}% Pago
              </span>
            </div>
            
            <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full transition-all duration-500" 
                style={{ width: `${(metrics.totalPaid / (metrics.totalExpenses || 1)) * 100}%` }}
              />
            </div>

            <div className="flex justify-between text-[10px] text-gray-400">
              <span>Pago: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(metrics.totalPaid)}</span>
              <span>Pendente: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(metrics.totalPending)}</span>
            </div>
          </div>

          {/* Status Items List */}
          <div className="divide-y divide-gray-100">
            {statusSummary.map((item) => (
              <div key={item.status} className="flex items-center justify-between py-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span 
                    className="w-2.5 h-2.5 rounded-sm shrink-0" 
                    style={{ backgroundColor: STATUS_COLORS[item.status] || "#6b7280" }} 
                  />
                  <span className="font-semibold text-gray-700">{item.status}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">{item.count} contas</span>
                  <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold">
                    {item.percentage.toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-800 leading-relaxed space-y-1">
            <span className="font-bold flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
              Impacto de Cartões Rotativos (Cartão de Crédito)
            </span>
            <p>
              Os cartões de crédito somam mais de 70% de suas despesas anuais. Pagar faturas mínimas (como no Will em Abril) ou adiar para "Próximo Mês" sem renegociar incide juros que ultrapassam 450% ao ano no Brasil.
            </p>
          </div>

        </div>

      </div>
        </>
      ) : (
        <div className="space-y-6 animate-fade-in">
          <CreditorsList data={data} initialMonth={selectedMonth} />
        </div>
      )}

    </div>
  );
}
