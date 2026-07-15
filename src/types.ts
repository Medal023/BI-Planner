export interface ExtraIncome {
  id: string;
  nome: string;
  valor: number;
}

export interface IncomeHistoryEntry {
  valorAnterior: number;
  novoValor: number;
  data: string;
  hora: string;
  usuario: string; // user email or UID
  origem: string;  // e.g. "Configuração de Perfil"
}

export interface IncomeProfile {
  salarioBase: number;
  rendasExtras: ExtraIncome[];
  rendaTotal: number;
  frequencia: "Mensal" | "Quinzenal" | "Semanal" | "Diário" | "Personalizado";
  ultimaAtualizacao: string;
  usuario: string; // uid
  historico: IncomeHistoryEntry[];
}

export interface BudgetTransaction {
  id: string;
  month: string; // e.g., "JANEIRO", "FEVEREIRO", "MARÇO", etc.
  description: string;
  value: number; // numeric value for calculations (0 if non-numeric)
  valueText: string; // text representation (e.g., "R$ 250,00" or "---------" or "renovação")
  status: string; // e.g., "PAGO", "PROXIMO MES", "FALTA PAGAR", "PAGO NO CREDITO", "CUSTO ZERO", "VALOR MINIMO", "ACORDO"
  category: "Moradia" | "Cartão de Crédito" | "Utilidades" | "Educação" | "Pessoal" | "Empréstimos" | "Outros";
}

export interface MonthlyBudget {
  month: string;
  salary: number;
  ticketText: string; // e.g. "ALELO" or value
  transactions: BudgetTransaction[];
}

export interface AdvisorMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface DebtSimulatorPlan {
  name: string;
  monthlyPayment: number;
  monthsToClear: number;
  totalInterestSaved: number;
  priorityOrder: string[];
}
