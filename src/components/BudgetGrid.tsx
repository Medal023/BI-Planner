import React, { useState, useMemo } from "react";
import { BudgetTransaction, MonthlyBudget } from "../types";
import { getPortugueseCurrentMonth } from "./BIDashboard";
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Search, 
  Filter, 
  CornerDownRight, 
  RefreshCw,
  AlertCircle
} from "lucide-react";

interface BudgetGridProps {
  data: MonthlyBudget[];
  onUpdateData: (newData: MonthlyBudget[]) => void;
  onResetData: () => void;
}

const CATEGORIES = ["Moradia", "Cartão de Crédito", "Utilidades", "Educação", "Pessoal", "Empréstimos", "Outros"] as const;

const STATUSES = [
  "PAGO", 
  "PROXIMO MES", 
  "FALTA PAGAR", 
  "PAGO NO CREDITO", 
  "CUSTO ZERO", 
  "VALOR MINIMO", 
  "ACORDO", 
  "PAGO POR AMANDA"
];

export default function BudgetGrid({ data, onUpdateData, onResetData }: BudgetGridProps) {
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(() => {
    const currentMonthName = getPortugueseCurrentMonth();
    const idx = data.findIndex(m => m.month.toUpperCase() === currentMonthName);
    return idx !== -1 ? idx : 0;
  });
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("TODAS");

  // Edit State
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<BudgetTransaction>>({});

  // Add State
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [addForm, setAddForm] = useState<Partial<BudgetTransaction>>({
    description: "",
    value: 0,
    status: "FALTA PAGAR",
    category: "Outros"
  });

  const activeBudget = data[currentMonthIndex];

  // Recalculations for the active month
  const totals = useMemo(() => {
    if (!activeBudget) return { totalDebits: 0, balance: 0, salary: 0 };
    
    const totalDebits = activeBudget.transactions.reduce((acc, curr) => acc + Math.abs(curr.value), 0);
    const balance = activeBudget.salary - totalDebits;

    return {
      totalDebits,
      balance,
      salary: activeBudget.salary
    };
  }, [activeBudget]);

  // Filtered transactions for the current month
  const filteredTransactions = useMemo(() => {
    if (!activeBudget) return [];
    return activeBudget.transactions.filter(t => {
      const matchSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = categoryFilter === "TODAS" || t.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [activeBudget, searchQuery, categoryFilter]);

  // Actions
  const handleStartEdit = (transaction: BudgetTransaction) => {
    setEditingRowId(transaction.id);
    setEditForm({ ...transaction });
  };

  const handleSaveEdit = () => {
    if (!editingRowId || !editForm.description) return;

    const updatedData = data.map(m => {
      if (m.month === activeBudget.month) {
        return {
          ...m,
          transactions: m.transactions.map(t => {
            if (t.id === editingRowId) {
              const numVal = Number(editForm.value) || 0;
              return {
                ...t,
                description: editForm.description || "",
                value: numVal,
                valueText: editForm.valueText || `R$ ${numVal.toFixed(2).replace(".", ",")}`,
                status: editForm.status || "FALTA PAGAR",
                category: editForm.category || "Outros"
              };
            }
            return t;
          })
        };
      }
      return m;
    });

    onUpdateData(updatedData);
    setEditingRowId(null);
  };

  const handleCancelEdit = () => {
    setEditingRowId(null);
  };

  const handleAddTransaction = () => {
    if (!addForm.description) return;

    const numVal = Number(addForm.value) || 0;
    const newTransaction: BudgetTransaction = {
      id: `custom-${Date.now()}`,
      month: activeBudget.month,
      description: addForm.description,
      value: numVal,
      valueText: `R$ ${numVal.toFixed(2).replace(".", ",")}`,
      status: addForm.status || "FALTA PAGAR",
      category: addForm.category as any || "Outros"
    };

    const updatedData = data.map(m => {
      if (m.month === activeBudget.month) {
        return {
          ...m,
          transactions: [newTransaction, ...m.transactions]
        };
      }
      return m;
    });

    onUpdateData(updatedData);
    setShowAddForm(false);
    setAddForm({
      description: "",
      value: 0,
      status: "FALTA PAGAR",
      category: "Outros"
    });
  };

  const handleDeleteTransaction = (id: string) => {
    const updatedData = data.map(m => {
      if (m.month === activeBudget.month) {
        return {
          ...m,
          transactions: m.transactions.filter(t => t.id !== id)
        };
      }
      return m;
    });
    onUpdateData(updatedData);
  };

  const handleUpdateSalary = (newSalaryVal: number) => {
    const updatedData = data.map(m => {
      if (m.month === activeBudget.month) {
        return {
          ...m,
          salary: Math.max(0, newSalaryVal)
        };
      }
      return m;
    });
    onUpdateData(updatedData);
  };

  return (
    <div className="space-y-6" id="grid-tab">
      
      {/* Tab Selectors like Sheet Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-semibold text-gray-900">Workspace de Lançamentos</h2>
          <p className="text-xs text-gray-500">Editor inteligente em formato de planilha (Airtable / Sheets)</p>
        </div>

        {/* Reset Trigger */}
        <button 
          onClick={() => {
            if (window.confirm("Deseja realmente restaurar os dados originais da planilha? Todas as alterações manuais serão perdidas.")) {
              onResetData();
            }
          }}
          className="text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors shrink-0"
        >
          <RefreshCw className="h-3 w-3" /> Restaurar Originais
        </button>
      </div>

      {/* Sheet Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 p-1.5 rounded-xl overflow-x-auto border border-gray-200/50 scrollbar-none">
        {data.map((m, idx) => (
          <button
            key={m.month}
            onClick={() => {
              setCurrentMonthIndex(idx);
              setShowAddForm(false);
              setEditingRowId(null);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all uppercase shrink-0 flex items-center gap-1.5 ${
              idx === currentMonthIndex 
                ? "bg-white text-indigo-600 shadow-sm border border-gray-200/40" 
                : "text-gray-600 hover:bg-white/50 hover:text-gray-900"
            }`}
          >
            {m.month}
            {m.month.toUpperCase() === getPortugueseCurrentMonth() && (
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" title="Mês Atual" />
            )}
          </button>
        ))}
      </div>

      {/* Salary & Metrics Banner for the Active Month */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900 text-white p-5 rounded-2xl shadow-xs border border-slate-800">
        
        {/* Salary Input */}
        <div className="space-y-1 border-r border-slate-800 pr-4">
          <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Salário Líquido Mensal</label>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-emerald-400 font-mono">R$</span>
            <input
              type="number"
              value={activeBudget?.salary || 0}
              onChange={(e) => handleUpdateSalary(parseFloat(e.target.value) || 0)}
              className="bg-transparent text-lg font-bold text-white focus:outline-hidden focus:ring-1 focus:ring-emerald-400 rounded px-1.5 w-full font-mono"
            />
          </div>
          <span className="text-[10px] text-slate-500 block">Dica: Edite para recalcular o saldo real</span>
        </div>

        {/* Total Expenses for Month */}
        <div className="space-y-1 border-r border-slate-800 px-4">
          <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Total de Débitos (Mês)</label>
          <div className="text-lg font-bold text-red-400 font-mono">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totals.totalDebits)}
          </div>
          <span className="text-[10px] text-slate-500 block">Calculado dinamicamente das linhas</span>
        </div>

        {/* Balance */}
        <div className="space-y-1 pl-4">
          <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Sobra / Déficit</label>
          <div className={`text-lg font-bold font-mono ${totals.balance >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totals.balance)}
          </div>
          <div className="flex items-center gap-1">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${totals.balance >= 0 ? "bg-emerald-400 animate-ping" : "bg-rose-400 animate-pulse"}`} />
            <span className="text-[10px] text-slate-500 uppercase font-semibold">
              {totals.balance >= 0 ? "Superávit" : "Déficit Crítico"}
            </span>
          </div>
        </div>

      </div>

      {/* Grid Controller: Search & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-gray-100 bg-white">
        
        {/* Search & Category Filter */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar credor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-gray-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden"
            >
              <option value="TODAS">Categorias: Todas</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Add Trigger */}
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-xs shrink-0 self-end sm:self-auto"
        >
          {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showAddForm ? "Cancelar Lançamento" : "Adicionar Lançamento"}
        </button>

      </div>

      {/* Add Transaction Inline Form */}
      {showAddForm && (
        <div className="p-5 border border-indigo-100 bg-indigo-50/30 rounded-2xl space-y-4 animate-fade-in">
          <h3 className="text-sm font-semibold text-indigo-900 font-display flex items-center gap-1">
            <CornerDownRight className="h-4 w-4 text-indigo-600" />
            Adicionar Novo Lançamento para {activeBudget.month}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-semibold">Credor / Descrição</label>
              <input
                type="text"
                placeholder="Ex: Fatura Nubank, Aluguel"
                value={addForm.description}
                onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                className="w-full p-2.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-semibold">Valor (R$)</label>
              <input
                type="number"
                placeholder="Ex: 250.00"
                value={addForm.value}
                onChange={(e) => setAddForm({ ...addForm, value: parseFloat(e.target.value) || 0 })}
                className="w-full p-2.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-semibold">Categoria</label>
              <select
                value={addForm.category}
                onChange={(e) => setAddForm({ ...addForm, category: e.target.value as any })}
                className="w-full p-2.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-semibold">Status de Pagamento</label>
              <select
                value={addForm.status}
                onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
                className="w-full p-2.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
              >
                {STATUSES.map(stat => (
                  <option key={stat} value={stat}>{stat}</option>
                ))}
              </select>
            </div>

          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => handleAddTransaction()}
              className="text-xs bg-indigo-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Confirmar e Salvar Lançamento
            </button>
          </div>
        </div>
      )}

      {/* Table Grid (Notion / Airtable Style) */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100 text-gray-500 font-display text-[10px] uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Descrição / Credor</th>
                <th className="py-3 px-4">Valor Estimado</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Status de Pagamento</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400 font-medium">
                    Nenhum lançamento encontrado para os filtros selecionados neste mês.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(t => {
                  const isEditing = editingRowId === t.id;
                  
                  return (
                    <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                      
                      {/* Description Column */}
                      <td className="py-3 px-4 font-semibold text-gray-800">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.description || ""}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            className="w-full p-1.5 text-xs bg-white border border-gray-200 rounded focus:ring-1 focus:ring-indigo-500"
                          />
                        ) : (
                          t.description
                        )}
                      </td>

                      {/* Value Column */}
                      <td className="py-3 px-4 font-mono font-bold text-gray-600">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editForm.value || 0}
                            onChange={(e) => setEditForm({ ...editForm, value: parseFloat(e.target.value) || 0 })}
                            className="w-32 p-1.5 text-xs bg-white border border-gray-200 rounded focus:ring-1 focus:ring-indigo-500 font-mono"
                          />
                        ) : (
                          new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(t.value)
                        )}
                      </td>

                      {/* Category Column */}
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <select
                            value={editForm.category}
                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value as any })}
                            className="p-1.5 text-xs bg-white border border-gray-200 rounded focus:ring-1 focus:ring-indigo-500"
                          >
                            {CATEGORIES.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
                            {t.category}
                          </span>
                        )}
                      </td>

                      {/* Status Column */}
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <select
                            value={editForm.status}
                            onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                            className="p-1.5 text-xs bg-white border border-gray-200 rounded focus:ring-1 focus:ring-indigo-500"
                          >
                            {STATUSES.map(stat => (
                              <option key={stat} value={stat}>{stat}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(t.status)}`}>
                            {t.status}
                          </span>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="py-3 px-4 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleSaveEdit()}
                              className="p-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                              title="Confirmar"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleCancelEdit()}
                              className="p-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                              title="Cancelar"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleStartEdit(t)}
                              className="p-1.5 rounded-lg border border-gray-100 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`Deseja mesmo remover a despesa "${t.description}"?`)) {
                                  handleDeleteTransaction(t.id);
                                }
                              }}
                              className="p-1.5 rounded-lg border border-gray-100 text-gray-400 hover:text-red-600 hover:bg-red-50/50 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
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

      {/* Insight Section for Monthly Data */}
      <div className="p-4 bg-amber-50 border border-amber-200/50 rounded-2xl flex gap-3 text-xs leading-relaxed text-amber-950">
        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold">Análise Estrutural do Mês Selecionado ({activeBudget?.month}):</span>
          <p>
            No mês de {activeBudget?.month}, o total de compromissos lançados é de {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totals.totalDebits)} para uma receita de {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totals.salary)}. 
            {totals.balance < 0 ? (
              <span> Isso representa um déficit de {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Math.abs(totals.balance))}. Em uma planilha profissional no Google Sheets, este saldo deve ser destacado usando Formatação Condicional inteligente para evitar estouros despercebidos.</span>
            ) : (
              <span> Parabéns, as contas cabem no rendimento líquido. Certifique-se de direcionar o restante para amortizar cartões antigos ou compor fundo de reserva.</span>
            )}
          </p>
        </div>
      </div>

    </div>
  );
}

function getStatusColor(status: string): string {
  const upper = status.toUpperCase();
  if (upper === "PAGO") return "bg-emerald-100 text-emerald-800";
  if (upper === "PAGO NO CREDITO" || upper === "PAGO NO CRÉDITO") return "bg-sky-100 text-sky-800";
  if (upper === "PAGO POR AMANDA") return "bg-teal-100 text-teal-800";
  if (upper === "CUSTO ZERO") return "bg-slate-100 text-slate-700 font-medium";
  if (upper === "PROXIMO MES" || upper === "PRÓXIMO MÊS") return "bg-amber-100 text-amber-800";
  if (upper === "VALOR MINIMO" || upper === "VALOR MÍNIMO") return "bg-orange-100 text-orange-800";
  if (upper === "ACORDO") return "bg-purple-100 text-purple-800";
  return "bg-red-100 text-red-800"; // FALTA PAGAR
}
