import React, { useState, useMemo } from "react";
import { MonthlyBudget, BudgetTransaction } from "../types";
import { 
  Search, 
  CalendarDays, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  Clock, 
  CreditCard,
  Layers,
  ChevronRight,
  Filter,
  DollarSign
} from "lucide-react";

const MONTHS_ORDER = [
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

interface CreditorsListProps {
  data: MonthlyBudget[];
  initialMonth: string;
}

export default function CreditorsList({ data, initialMonth }: CreditorsListProps) {
  // Local month selector for granular monthly filtering, initialized with the dashboard's month
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth || "TODOS");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("TODOS");

  // Keep selectedMonth updated if initialMonth changes from the parent dashboard filter
  React.useEffect(() => {
    if (initialMonth) {
      setSelectedMonth(initialMonth);
    }
  }, [initialMonth]);

  // Find next month's name
  const getNextMonthName = (monthName: string): string => {
    const monthUpper = monthName.toUpperCase();
    const currentIdx = MONTHS_ORDER.indexOf(monthUpper);
    if (currentIdx === -1 || currentIdx === MONTHS_ORDER.length - 1) {
      return "Próx. Mês";
    }
    return MONTHS_ORDER[currentIdx + 1];
  };

  // Find matching next month's transaction for a current transaction
  const getNextMonthTransaction = (currentTx: BudgetTransaction) => {
    const currentMonthUpper = currentTx.month.toUpperCase();
    const currentIdx = MONTHS_ORDER.indexOf(currentMonthUpper);
    if (currentIdx === -1 || currentIdx === MONTHS_ORDER.length - 1) {
      return null;
    }
    const nextMonthName = MONTHS_ORDER[currentIdx + 1];
    const nextMonthBudget = data.find(m => m.month.toUpperCase() === nextMonthName);
    if (!nextMonthBudget) {
      return null;
    }
    
    // Try to find a transaction with a matching description (case-insensitive substring match)
    const currentDesc = currentTx.description.toUpperCase();
    return nextMonthBudget.transactions.find(t => {
      const nextDesc = t.description.toUpperCase();
      return nextDesc === currentDesc || nextDesc.includes(currentDesc) || currentDesc.includes(nextDesc);
    }) || null;
  };

  // Next month's metrics/stats for predictive analysis
  const nextMonthStats = useMemo(() => {
    if (selectedMonth === "TODOS") {
      return null;
    }
    const nextMonthName = getNextMonthName(selectedMonth);
    const nextMonthBudget = data.find(m => m.month.toUpperCase() === nextMonthName);
    if (!nextMonthBudget) {
      return null;
    }

    let totalValue = 0;
    let paidValue = 0;
    let pendingValue = 0;
    let pendingCount = 0;
    let scheduledValue = 0;

    nextMonthBudget.transactions.forEach(t => {
      totalValue += Math.abs(t.value);
      const statusUpper = t.status.toUpperCase();
      if (statusUpper.startsWith("PAGO") || statusUpper === "CUSTO ZERO") {
        paidValue += Math.abs(t.value);
      } else if (statusUpper === "FALTA PAGAR") {
        pendingCount++;
        pendingValue += Math.abs(t.value);
      } else {
        scheduledValue += Math.abs(t.value);
      }
    });

    return {
      month: nextMonthName,
      totalValue,
      paidValue,
      pendingValue,
      pendingCount,
      scheduledValue
    };
  }, [data, selectedMonth]);

  // List of all unique months in the dataset for the filter tabs
  const availableMonths = useMemo(() => {
    return data.map(m => m.month);
  }, [data]);

  // Get all transactions for the selected month (or all months if "TODOS" is selected)
  const filteredTransactions = useMemo(() => {
    let list: BudgetTransaction[] = [];
    
    data.forEach(m => {
      if (selectedMonth === "TODOS" || m.month === selectedMonth) {
        list = [...list, ...m.transactions];
      }
    });

    // Apply search query filter
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(t => 
        t.description.toLowerCase().includes(q) || 
        t.category.toLowerCase().includes(q) ||
        t.status.toLowerCase().includes(q)
      );
    }

    // Apply status filter
    if (statusFilter !== "TODOS") {
      list = list.filter(t => {
        const statusUpper = t.status.toUpperCase();
        if (statusFilter === "PAGO") {
          return statusUpper.startsWith("PAGO") || statusUpper === "CUSTO ZERO";
        } else if (statusFilter === "PENDENTE") {
          return statusUpper === "FALTA PAGAR";
        } else if (statusFilter === "AGENDADO") {
          return statusUpper === "PROXIMO MES" || statusUpper === "VALOR MINIMO" || statusUpper === "ACORDO";
        }
        return true;
      });
    }

    return list;
  }, [data, selectedMonth, searchQuery, statusFilter]);

  // Calculations for current month/view metrics
  const stats = useMemo(() => {
    let totalCount = 0;
    let totalValue = 0;
    let paidCount = 0;
    let paidValue = 0;
    let pendingCount = 0;
    let pendingValue = 0;
    let scheduledCount = 0;
    let scheduledValue = 0;

    // We scan transactions for the active selectedMonth
    data.forEach(m => {
      if (selectedMonth === "TODOS" || m.month === selectedMonth) {
        m.transactions.forEach(t => {
          totalCount++;
          totalValue += Math.abs(t.value);

          const statusUpper = t.status.toUpperCase();
          if (statusUpper.startsWith("PAGO") || statusUpper === "CUSTO ZERO") {
            paidCount++;
            paidValue += Math.abs(t.value);
          } else if (statusUpper === "FALTA PAGAR") {
            pendingCount++;
            pendingValue += Math.abs(t.value);
          } else {
            // PROXIMO MES, VALOR MINIMO, ACORDO
            scheduledCount++;
            scheduledValue += Math.abs(t.value);
          }
        });
      }
    });

    return {
      totalCount,
      totalValue,
      paidCount,
      paidValue,
      pendingCount,
      pendingValue,
      scheduledCount,
      scheduledValue
    };
  }, [data, selectedMonth]);

  // Helper to determine semaphore styles based on status
  const getStatusConfig = (status: string) => {
    const statusUpper = status.toUpperCase();
    if (statusUpper.startsWith("PAGO") || statusUpper === "CUSTO ZERO") {
      return {
        dotClass: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-100",
        label: statusUpper === "CUSTO ZERO" ? "Custo Zero" : "Pago",
        colorText: "text-emerald-600"
      };
    } else if (statusUpper === "FALTA PAGAR") {
      return {
        dotClass: "bg-rose-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.7)]",
        badgeClass: "bg-rose-50 text-rose-700 border-rose-100",
        label: "Falta Pagar",
        colorText: "text-rose-600"
      };
    } else if (statusUpper === "PROXIMO MES" || statusUpper === "VALOR MINIMO") {
      return {
        dotClass: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]",
        badgeClass: "bg-amber-50 text-amber-700 border-amber-100",
        label: statusUpper === "VALOR MINIMO" ? "Mínimo Pago" : "Próximo Mês",
        colorText: "text-amber-600"
      };
    } else if (statusUpper === "ACORDO") {
      return {
        dotClass: "bg-purple-500 shadow-[0_0_8px_rgba(139,92,246,0.6)]",
        badgeClass: "bg-purple-50 text-purple-700 border-purple-100",
        label: "Acordo / Parcelado",
        colorText: "text-purple-600"
      };
    } else {
      return {
        dotClass: "bg-gray-400 shadow-[0_0_6px_rgba(156,163,175,0.4)]",
        badgeClass: "bg-gray-50 text-gray-700 border-gray-100",
        label: status,
        colorText: "text-gray-600"
      };
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "Moradia": return "bg-indigo-50 text-indigo-700 border-indigo-100";
      case "Cartão de Crédito": return "bg-rose-50 text-rose-700 border-rose-100";
      case "Utilidades": return "bg-cyan-50 text-cyan-700 border-cyan-100";
      case "Educação": return "bg-amber-50 text-amber-700 border-amber-100";
      case "Pessoal": return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "Empréstimos": return "bg-purple-50 text-purple-700 border-purple-100";
      default: return "bg-gray-50 text-gray-700 border-gray-100";
    }
  };

  return (
    <div 
      id="creditors-panel-wrapper" 
      className="p-5 rounded-xl border border-gray-100 bg-white shadow-xs space-y-6"
    >
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold font-display text-gray-900 flex items-center gap-2">
            <CalendarDays className="h-4.5 w-4.5 text-indigo-600" />
            Análise Avançada de Contas & Credores
          </h3>
          <p className="text-xs text-gray-500">
            Monitoramento de obrigações recorrentes, faturas de cartões e parcelamentos com controle integrado de semáforos de liquidez.
          </p>
        </div>

        {/* Quick Month Filter Buttons / Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 max-w-full scrollbar-none" id="month-tabs-creditors">
          <button
            onClick={() => setSelectedMonth("TODOS")}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-md border shrink-0 transition-all cursor-pointer ${
              selectedMonth === "TODOS"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
            }`}
          >
            Todos (Anual)
          </button>
          {availableMonths.map(m => (
            <button
              key={m}
              onClick={() => setSelectedMonth(m)}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-md border shrink-0 transition-all cursor-pointer ${
                selectedMonth === m
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Summary Panel with Semaphores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="creditors-stats-grid">
        
        {/* Total General */}
        <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 shrink-0">
            <Layers className="h-5 w-5" />
          </div>
          <div className="space-y-0.5 truncate">
            <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Total Lançado</span>
            <span className="text-sm font-extrabold text-gray-800 font-mono">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats.totalValue)}
            </span>
            <span className="text-[9px] text-gray-500 block">
              {stats.totalCount} contas no período
            </span>
          </div>
        </div>

        {/* Paid (Green Semaphore) */}
        <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 relative">
            <CheckCircle2 className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
          </div>
          <div className="space-y-0.5 truncate">
            <span className="text-[10px] text-emerald-700 font-bold block uppercase tracking-wider">Pagas (Semáforo Verde)</span>
            <span className="text-sm font-extrabold text-emerald-600 font-mono">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats.paidValue)}
            </span>
            <span className="text-[9px] text-emerald-700 block font-sans">
              {stats.paidCount} de {stats.totalCount} liquidadas ({stats.totalCount > 0 ? ((stats.paidCount/stats.totalCount)*100).toFixed(0) : 0}%)
            </span>
          </div>
        </div>

        {/* Pending (Red Semaphore) */}
        <div className="p-4 rounded-xl border border-rose-100 bg-rose-50/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 shrink-0 relative">
            <AlertCircle className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.7)]" />
          </div>
          <div className="space-y-0.5 truncate">
            <span className="text-[10px] text-rose-700 font-bold block uppercase tracking-wider">A Pagar (Semáforo Vermelho)</span>
            <span className="text-sm font-extrabold text-rose-600 font-mono">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats.pendingValue)}
            </span>
            <span className="text-[9px] text-rose-700 block font-sans">
              {stats.pendingCount} contas pendentes de pagamento
            </span>
          </div>
        </div>

        {/* Scheduled/Agreements (Yellow/Purple Semaphore) */}
        <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0 relative">
            <Clock className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
          </div>
          <div className="space-y-0.5 truncate">
            <span className="text-[10px] text-amber-700 font-bold block uppercase tracking-wider">Agendadas (Amarelo/Roxo)</span>
            <span className="text-sm font-extrabold text-amber-600 font-mono">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats.scheduledValue)}
            </span>
            <span className="text-[9px] text-amber-700 block font-sans">
              {stats.scheduledCount} agendamentos / parcelas / acordos
            </span>
          </div>
        </div>

      </div>

      {/* Next Month Predictive Panel */}
      {nextMonthStats && (
        <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in" id="next-month-prediction-card">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-indigo-600" />
              Projeção Antecipada: {nextMonthStats.month} (Recorrentes & Dívidas)
            </h4>
            <p className="text-[11px] text-indigo-700/90 leading-relaxed">
              Análise baseada nos vencimentos mapeados para o mês seguinte. Você tem um total de{" "}
              <strong>
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(nextMonthStats.totalValue)}
              </strong>{" "}
              cadastrado. O status das faturas recorrentes impacta diretamente o saldo líquido futuro.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 shrink-0">
            <div className="bg-white border border-indigo-100/50 px-3 py-1.5 rounded-lg text-center min-w-[90px] shadow-2xs">
              <span className="text-[9px] text-gray-400 font-bold block uppercase">Total Previsto</span>
              <span className="text-xs font-mono font-bold text-gray-800">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(nextMonthStats.totalValue)}
              </span>
            </div>

            <div className="bg-white border border-rose-100/50 px-3 py-1.5 rounded-lg text-center min-w-[90px] shadow-2xs">
              <span className="text-[9px] text-rose-500 font-bold block uppercase">Pendente ({nextMonthStats.pendingCount})</span>
              <span className="text-xs font-mono font-bold text-rose-600">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(nextMonthStats.pendingValue)}
              </span>
            </div>

            <div className="bg-white border border-emerald-100/50 px-3 py-1.5 rounded-lg text-center min-w-[90px] shadow-2xs">
              <span className="text-[9px] text-emerald-500 font-bold block uppercase">Já Liquidado</span>
              <span className="text-xs font-mono font-bold text-emerald-600">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(nextMonthStats.paidValue)}
              </span>
            </div>
            
            {nextMonthStats.pendingValue > 1550.00 ? (
              <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2.5 py-1.5 rounded-lg uppercase tracking-wide flex items-center gap-1.5 shadow-2xs">
                <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                Déficit Crítico!
              </span>
            ) : (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1.5 rounded-lg uppercase tracking-wide flex items-center gap-1.5 shadow-2xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                Saldo Seguro
              </span>
            )}
          </div>
        </div>
      )}

      {/* Controls & Filter Pills row */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-gray-50/60 p-3 rounded-xl border border-gray-100">
        
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por credor, categoria, status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 max-w-full overflow-x-auto">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1 shrink-0">
            <Filter className="h-3.5 w-3.5" /> Filtrar:
          </span>
          <div className="flex gap-1">
            {[
              { id: "TODOS", label: "Todas" },
              { id: "PAGO", label: "Pagas" },
              { id: "PENDENTE", label: "Pendentes (Falta Pagar)" },
              { id: "AGENDADO", label: "Agendadas / Acordos" }
            ].map(pill => (
              <button
                key={pill.id}
                onClick={() => setStatusFilter(pill.id)}
                className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer shrink-0 ${
                  statusFilter === pill.id
                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                    : "bg-white text-gray-600 border-gray-200/80 hover:bg-gray-50"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Creditors List Table */}
      <div className="border border-gray-100 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Credor / Conta</th>
                <th className="py-3 px-4">Mês de Lançamento</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4 text-right">Valor Corrente</th>
                <th className="py-3 px-4 text-center">Status Corrente</th>
                
                {/* Dynamically named columns for next month comparison */}
                <th className="py-3 px-4 text-right bg-indigo-50/20 text-indigo-900 border-l border-indigo-100/50">
                  Previsão {selectedMonth !== "TODOS" ? getNextMonthName(selectedMonth) : "Próx. Mês"} (Valor)
                </th>
                <th className="py-3 px-4 text-center bg-indigo-50/20 text-indigo-900 border-r border-indigo-100/50">
                  Status {selectedMonth !== "TODOS" ? getNextMonthName(selectedMonth) : "Próx. Mês"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    Nenhuma conta ou credor encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t) => {
                  const statusCfg = getStatusConfig(t.status);
                  const nextTx = getNextMonthTransaction(t);
                  const nextStatusCfg = nextTx ? getStatusConfig(nextTx.status) : null;
                  return (
                    <tr 
                      key={t.id} 
                      className="hover:bg-gray-50/50 transition-all duration-150 group"
                    >
                      {/* Description / Creditor */}
                      <td className="py-3 px-4 font-semibold text-gray-800">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-5 rounded-sm shrink-0 ${
                            statusCfg.label === "Falta Pagar" ? "bg-rose-500" : "bg-indigo-500"
                          }`} />
                          <span className="truncate group-hover:text-indigo-600 transition-colors">
                            {t.description.toUpperCase()}
                          </span>
                        </div>
                      </td>

                      {/* Month */}
                      <td className="py-3 px-4 text-gray-500 font-mono text-[10px] font-medium uppercase">
                        {t.month}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${getCategoryColor(t.category)}`}>
                          {t.category}
                        </span>
                      </td>

                      {/* Value */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                        {t.value > 0 ? (
                          new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(t.value)
                        ) : (
                          <span className="text-gray-300">R$ 0,00</span>
                        )}
                        {t.valueText && t.valueText !== "R$ 0,00" && t.valueText !== "-------" && t.valueText !== "----------" && (
                          <span className="block text-[9px] text-gray-400 font-normal">
                            ({t.valueText})
                          </span>
                        )}
                      </td>

                      {/* Status indicator */}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <div className="flex h-2.5 w-2.5 relative">
                            {t.status.toUpperCase() === "FALTA PAGAR" && (
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                            )}
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${statusCfg.dotClass}`} />
                          </div>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${statusCfg.badgeClass}`}>
                            {statusCfg.label}
                          </span>
                        </div>
                      </td>

                      {/* Next Month Value */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-indigo-950 bg-indigo-50/5 border-l border-indigo-100/30">
                        {nextTx ? (
                          nextTx.value > 0 ? (
                            new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(nextTx.value)
                          ) : (
                            <span className="text-gray-300">R$ 0,00</span>
                          )
                        ) : (
                          <span className="text-gray-400 font-normal text-[10px] italic">Não Lançado</span>
                        )}
                        {nextTx?.valueText && nextTx.valueText !== "R$ 0,00" && nextTx.valueText !== "-------" && nextTx.valueText !== "----------" && (
                          <span className="block text-[9px] text-indigo-500/70 font-normal">
                            ({nextTx.valueText})
                          </span>
                        )}
                      </td>

                      {/* Next Month Status */}
                      <td className="py-3 px-4 text-center bg-indigo-50/5 border-r border-indigo-100/30">
                        {nextTx ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="flex h-2.5 w-2.5 relative">
                              {nextTx.status.toUpperCase() === "FALTA PAGAR" && (
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                              )}
                              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${nextStatusCfg?.dotClass}`} />
                            </div>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${nextStatusCfg?.badgeClass}`}>
                              {nextStatusCfg?.label}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100 font-medium">
                            Sem obrigações
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Explanatory contextual intelligence box */}
      <div className="p-3.5 bg-indigo-50/20 border border-indigo-100/30 rounded-xl text-[11px] leading-relaxed text-indigo-950 flex gap-2.5">
        <HelpCircle className="h-4.5 w-4.5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold">Como funciona os semáforos de controle de contas?</span>
          <p>
            O semáforo utiliza um sistema visual simplificado de três estados para sinalizar riscos orçamentários:
            <span className="font-bold text-emerald-600"> Verde </span> indica contas liquidadas ou sem custo;
            <span className="font-bold text-amber-500"> Amarelo </span> indica contas planejadas para o próximo período ou liquidações mínimas que geram juros residuais;
            <span className="font-bold text-rose-500"> Vermelho Pulsante </span> aponta obrigações em atraso ou que necessitam de quitação prioritária no mês corrente.
          </p>
        </div>
      </div>
    </div>
  );
}
