import { MonthlyBudget, BudgetTransaction } from "./types";

export const INITIAL_BUDGET_DATA: MonthlyBudget[] = [
  {
    month: "JANEIRO",
    salary: 1550.00,
    ticketText: "ALELO",
    transactions: [
      { id: "jan-1", month: "JANEIRO", description: "CASA NOVA", value: 250.00, valueText: "R$ 250,00", status: "PAGO", category: "Moradia" },
      { id: "jan-2", month: "JANEIRO", description: "AGUA CASA NOVA", value: 77.81, valueText: "R$ 77,81", status: "PAGO", category: "Utilidades" },
      { id: "jan-3", month: "JANEIRO", description: "INTER", value: 1189.25, valueText: "R$ 1.189,25", status: "PAGO", category: "Cartão de Crédito" },
      { id: "jan-4", month: "JANEIRO", description: "MERCADO PAGO", value: 290.42, valueText: "R$ 290,42", status: "PAGO", category: "Cartão de Crédito" },
      { id: "jan-5", month: "JANEIRO", description: "WILL", value: 223.00, valueText: "R$ 223,00", status: "PAGO", category: "Cartão de Crédito" },
      { id: "jan-6", month: "JANEIRO", description: "SANTANDER", value: 500.00, valueText: "R$ 500,00", status: "PAGO", category: "Cartão de Crédito" },
      { id: "jan-7", month: "JANEIRO", description: "BRADESCO", value: 97.00, valueText: "R$ 97,00", status: "PAGO", category: "Cartão de Crédito" },
      { id: "jan-8", month: "JANEIRO", description: "INTERNET", value: 100.00, valueText: "R$ 100,00", status: "PAGO", category: "Utilidades" },
      { id: "jan-9", month: "JANEIRO", description: "CONTA CLARO", value: 32.71, valueText: "R$ 32,71", status: "PAGO", category: "Utilidades" },
      { id: "jan-10", month: "JANEIRO", description: "NU", value: 228.87, valueText: "R$ 228,87", status: "PAGO", category: "Cartão de Crédito" },
      { id: "jan-11", month: "JANEIRO", description: "ENERGIA", value: 0.00, valueText: "-------", status: "PROXIMO MES", category: "Utilidades" },
      { id: "jan-12", month: "JANEIRO", description: "FACULDADE", value: 0.00, valueText: "renovação", status: "PAGO", category: "Educação" },
      { id: "jan-13", month: "JANEIRO", description: "BB", value: 216.07, valueText: "R$ 216,07", status: "PAGO", category: "Cartão de Crédito" },
      { id: "jan-14", month: "JANEIRO", description: "Amanda", value: 240.00, valueText: "R$ 240,00", status: "PAGO", category: "Pessoal" },
      { id: "jan-15", month: "JANEIRO", description: "Marcelo", value: 183.34, valueText: "R$ 183,34", status: "PAGO", category: "Pessoal" }
    ]
  },
  {
    month: "FEVEREIRO",
    salary: 1550.00,
    ticketText: "ALELO",
    transactions: [
      { id: "fev-1", month: "FEVEREIRO", description: "CASA NOVA", value: 0.00, valueText: "********", status: "PAGO", category: "Moradia" },
      { id: "fev-2", month: "FEVEREIRO", description: "AGUA CASA NOVA", value: 0.00, valueText: "---------", status: "PROXIMO MES", category: "Utilidades" },
      { id: "fev-3", month: "FEVEREIRO", description: "INTER", value: 847.97, valueText: "R$ 847,97", status: "PAGO", category: "Cartão de Crédito" },
      { id: "fev-4", month: "FEVEREIRO", description: "MERCADO PAGO", value: 328.14, valueText: "R$ 328,14", status: "PAGO", category: "Cartão de Crédito" },
      { id: "fev-5", month: "FEVEREIRO", description: "WILL", value: 452.55, valueText: "R$ 452,55", status: "PAGO", category: "Cartão de Crédito" },
      { id: "fev-6", month: "FEVEREIRO", description: "SANTANDER", value: 500.00, valueText: "R$ 500,00", status: "CUSTO ZERO", category: "Cartão de Crédito" },
      { id: "fev-7", month: "FEVEREIRO", description: "INTERNET", value: 100.00, valueText: "R$ 100,00", status: "PAGO", category: "Utilidades" },
      { id: "fev-8", month: "FEVEREIRO", description: "CONTA CLARO", value: 36.62, valueText: "R$ 36,62", status: "PAGO", category: "Utilidades" },
      { id: "fev-9", month: "FEVEREIRO", description: "NU", value: 79.41, valueText: "R$ 79,41", status: "PAGO", category: "Cartão de Crédito" },
      { id: "fev-10", month: "FEVEREIRO", description: "ENERGIA", value: 0.00, valueText: "---------", status: "PROXIMO MES", category: "Utilidades" },
      { id: "fev-11", month: "FEVEREIRO", description: "FACULDADE", value: 0.00, valueText: "R$ 0,00", status: "PAGO NO CREDITO", category: "Educação" },
      { id: "fev-12", month: "FEVEREIRO", description: "BB", value: 216.07, valueText: "R$ 216,07", status: "PAGO", category: "Cartão de Crédito" },
      { id: "fev-13", month: "FEVEREIRO", description: "Amanda", value: -200.00, valueText: "-R$ 200,00", status: "PAGO", category: "Pessoal" },
      { id: "fev-14", month: "FEVEREIRO", description: "Marcelo", value: 0.00, valueText: "----------", status: "PROXIMO MES", category: "Pessoal" }
    ]
  },
  {
    month: "MARÇO",
    salary: 1550.00,
    ticketText: "ALELO",
    transactions: [
      { id: "mar-1", month: "MARÇO", description: "CASA NOVA", value: 250.00, valueText: "R$ 250,00", status: "PAGO", category: "Moradia" },
      { id: "mar-2", month: "MARÇO", description: "AGUA CASA NOVA", value: 80.00, valueText: "R$ 80,00", status: "PROXIMO MES", category: "Utilidades" },
      { id: "mar-3", month: "MARÇO", description: "INTER", value: 660.07, valueText: "R$ 660,07", status: "PAGO", category: "Cartão de Crédito" },
      { id: "mar-4", month: "MARÇO", description: "MERCADO PAGO", value: 381.46, valueText: "R$ 381,46", status: "PAGO", category: "Cartão de Crédito" },
      { id: "mar-5", month: "MARÇO", description: "WILL", value: 0.00, valueText: "----------", status: "ACORDO", category: "Cartão de Crédito" },
      { id: "mar-6", month: "MARÇO", description: "SANTANDER", value: 500.00, valueText: "R$ 500,00", status: "PAGO", category: "Cartão de Crédito" },
      { id: "mar-7", month: "MARÇO", description: "INTERNET", value: 100.00, valueText: "R$ 100,00", status: "PAGO", category: "Utilidades" },
      { id: "mar-8", month: "MARÇO", description: "CONTA CLARO", value: 36.00, valueText: "R$ 36,00", status: "PROXIMO MES", category: "Utilidades" },
      { id: "mar-9", month: "MARÇO", description: "NU", value: 226.44, valueText: "R$ 226,44", status: "PROXIMO MES", category: "Cartão de Crédito" },
      { id: "mar-10", month: "MARÇO", description: "ENERGIA", value: 0.00, valueText: "", status: "PAGO NO CREDITO", category: "Utilidades" },
      { id: "mar-11", month: "MARÇO", description: "FACULDADE", value: 136.87, valueText: "R$ 136,87", status: "PAGO", category: "Educação" },
      { id: "mar-12", month: "MARÇO", description: "BB", value: 214.88, valueText: "R$ 214,88", status: "PAGO", category: "Cartão de Crédito" },
      { id: "mar-13", month: "MARÇO", description: "Amanda", value: 100.00, valueText: "R$ 100,00", status: "PAGO", category: "Pessoal" },
      { id: "mar-14", month: "MARÇO", description: "Marcelo", value: 183.34, valueText: "R$ 183,34", status: "PAGO", category: "Pessoal" },
      { id: "mar-15", month: "MARÇO", description: "BRADESCO", value: 133.28, valueText: "R$ 133,28", status: "PAGO", category: "Cartão de Crédito" }
    ]
  },
  {
    month: "ABRIL",
    salary: 1550.00,
    ticketText: "ALELO",
    transactions: [
      { id: "abr-1", month: "ABRIL", description: "CASA NOVA", value: 250.00, valueText: "R$ 250,00", status: "PAGO", category: "Moradia" },
      { id: "abr-2", month: "ABRIL", description: "AGUA CASA NOVA", value: 80.43, valueText: "R$ 80,43", status: "PAGO NO CREDITO", category: "Utilidades" },
      { id: "abr-3", month: "ABRIL", description: "INTER", value: 684.72, valueText: "R$ 684,72", status: "PAGO", category: "Cartão de Crédito" },
      { id: "abr-4", month: "ABRIL", description: "MERCADO PAGO", value: 276.58, valueText: "R$ 276,58", status: "PAGO", category: "Cartão de Crédito" },
      { id: "abr-5", month: "ABRIL", description: "WILL", value: 105.00, valueText: "R$ 105,00", status: "VALOR MINIMO", category: "Cartão de Crédito" },
      { id: "abr-6", month: "ABRIL", description: "INTERNET", value: 100.00, valueText: "R$ 100,00", status: "PAGO", category: "Utilidades" },
      { id: "abr-7", month: "ABRIL", description: "CONTA CLARO", value: 39.27, valueText: "R$ 39,27", status: "PAGO", category: "Utilidades" },
      { id: "abr-8", month: "ABRIL", description: "NU", value: 80.00, valueText: "R$ 80,00", status: "PAGO", category: "Cartão de Crédito" },
      { id: "abr-9", month: "ABRIL", description: "ENERGIA", value: 164.20, valueText: "R$ 164,20", status: "PAGO NO CREDITO", category: "Utilidades" },
      { id: "abr-10", month: "ABRIL", description: "FACULDADE", value: 136.87, valueText: "R$ 136,87", status: "PAGO", category: "Educação" },
      { id: "abr-11", month: "ABRIL", description: "BB", value: 216.07, valueText: "R$ 216,07", status: "PAGO", category: "Cartão de Crédito" },
      { id: "abr-12", month: "ABRIL", description: "Amanda", value: 100.00, valueText: "R$ 100,00", status: "PROXIMO MES", category: "Pessoal" },
      { id: "abr-13", month: "ABRIL", description: "Marcelo", value: 373.60, valueText: "R$ 373,60", status: "PAGO", category: "Pessoal" },
      { id: "abr-14", month: "ABRIL", description: "BRADESCO", value: 328.00, valueText: "R$ 328,00", status: "PAGO", category: "Cartão de Crédito" },
      { id: "abr-15", month: "ABRIL", description: "Marisa", value: 148.87, valueText: "R$ 148,87", status: "PROXIMO MES", category: "Pessoal" },
      { id: "abr-16", month: "ABRIL", description: "Miranda", value: 292.25, valueText: "R$ 292,25", status: "PAGO", category: "Pessoal" },
      { id: "abr-17", month: "ABRIL", description: "CONTA CLARO ATRASADA", value: 36.95, valueText: "R$ 36,95", status: "PAGO", category: "Utilidades" }
    ]
  },
  {
    month: "MAIO",
    salary: 1550.00,
    ticketText: "ALELO",
    transactions: [
      { id: "mai-1", month: "MAIO", description: "CASA NOVA", value: 400.00, valueText: "R$ 400,00", status: "PAGO", category: "Moradia" },
      { id: "mai-2", month: "MAIO", description: "AGUA CASA NOVA", value: 77.81, valueText: "R$ 77,81", status: "PAGO POR AMANDA", category: "Utilidades" },
      { id: "mai-3", month: "MAIO", description: "INTER", value: 740.00, valueText: "R$ 740,00", status: "PAGO", category: "Cartão de Crédito" },
      { id: "mai-4", month: "MAIO", description: "MERCADO PAGO", value: 439.40, valueText: "R$ 439,40", status: "PAGO", category: "Cartão de Crédito" },
      { id: "mai-5", month: "MAIO", description: "WILL", value: 342.07, valueText: "R$ 342,07", status: "PROXIMO MES", category: "Cartão de Crédito" },
      { id: "mai-6", month: "MAIO", description: "SANTANDER CARD", value: 408.36, valueText: "R$ 408,36", status: "PAGO", category: "Cartão de Crédito" },
      { id: "mai-7", month: "MAIO", description: "INTERNET", value: 106.99, valueText: "R$ 106,99", status: "PAGO", category: "Utilidades" },
      { id: "mai-8", month: "MAIO", description: "CONTA CLARO", value: 36.00, valueText: "R$ 36,00", status: "PAGO", category: "Utilidades" },
      { id: "mai-9", month: "MAIO", description: "NU", value: 149.64, valueText: "R$ 149,64", status: "PAGO", category: "Cartão de Crédito" },
      { id: "mai-10", month: "MAIO", description: "ENERGIA", value: 0.00, valueText: "", status: "PAGO NO CREDITO", category: "Utilidades" },
      { id: "mai-11", month: "MAIO", description: "FACULDADE", value: 136.87, valueText: "R$ 136,87", status: "PAGO NO CREDITO", category: "Educação" },
      { id: "mai-12", month: "MAIO", description: "BB", value: 0.00, valueText: "R$ 0,00", status: "ACORDO", category: "Cartão de Crédito" },
      { id: "mai-13", month: "MAIO", description: "Amanda", value: 100.00, valueText: "R$ 100,00", status: "PAGO", category: "Pessoal" },
      { id: "mai-14", month: "MAIO", description: "Marcelo", value: 373.70, valueText: "R$ 373,70", status: "PAGO", category: "Pessoal" },
      { id: "mai-15", month: "MAIO", description: "BRADESCO", value: 460.89, valueText: "R$ 460,89", status: "PAGO", category: "Cartão de Crédito" },
      { id: "mai-16", month: "MAIO", description: "Marisa", value: 157.73, valueText: "R$ 157,73", status: "PAGO", category: "Pessoal" },
      { id: "mai-17", month: "MAIO", description: "EMPRESTIMO MP", value: 170.00, valueText: "R$ 170,00", status: "PAGO", category: "Empréstimos" },
      { id: "mai-18", month: "MAIO", description: "VIVO", value: 0.00, valueText: "", status: "ACORDO", category: "Utilidades" }
    ]
  },
  {
    month: "JUNHO",
    salary: 1550.00,
    ticketText: "ALELO",
    transactions: [
      { id: "jun-1", month: "JUNHO", description: "CASA", value: 250.00, valueText: "R$ 250,00", status: "PAGO", category: "Moradia" },
      { id: "jun-2", month: "JUNHO", description: "INTER", value: 996.00, valueText: "R$ 996,00", status: "PAGO", category: "Cartão de Crédito" },
      { id: "jun-3", month: "JUNHO", description: "MERCADO PAGO", value: 514.78, valueText: "R$ 514,78", status: "PAGO", category: "Cartão de Crédito" },
      { id: "jun-4", month: "JUNHO", description: "WILL", value: 342.07, valueText: "R$ 342,07", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "jun-5", month: "JUNHO", description: "SANTANDER", value: 539.74, valueText: "R$ 539,74", status: "PAGO", category: "Cartão de Crédito" },
      { id: "jun-6", month: "JUNHO", description: "NU", value: 299.11, valueText: "R$ 299,11", status: "PAGO", category: "Cartão de Crédito" },
      { id: "jun-7", month: "JUNHO", description: "BRADESCO", value: 568.19, valueText: "R$ 568,19", status: "PAGO", category: "Cartão de Crédito" },
      { id: "jun-8", month: "JUNHO", description: "FACULDADE", value: 194.02, valueText: "R$ 194,02", status: "PAGO", category: "Educação" },
      { id: "jun-9", month: "JUNHO", description: "INTERNET", value: 100.00, valueText: "R$ 100,00", status: "PAGO", category: "Utilidades" },
      { id: "jun-10", month: "JUNHO", description: "CONTA CLARO", value: 35.84, valueText: "R$ 35,84", status: "PAGO", category: "Utilidades" },
      { id: "jun-11", month: "JUNHO", description: "ENERGIA", value: 145.70, valueText: "R$ 145,70", status: "PAGO NO CREDITO", category: "Utilidades" },
      { id: "jun-12", month: "JUNHO", description: "AGUA CASA NOVA", value: 85.28, valueText: "R$ 85,28", status: "PAGO POR AMANDA", category: "Utilidades" },
      { id: "jun-13", month: "JUNHO", description: "BB", value: 204.98, valueText: "R$ 204,98", status: "PAGO", category: "Cartão de Crédito" },
      { id: "jun-14", month: "JUNHO", description: "Amanda", value: 169.61, valueText: "R$ 169,61", status: "PAGO", category: "Pessoal" },
      { id: "jun-15", month: "JUNHO", description: "Marcelo", value: 373.70, valueText: "R$ 373,70", status: "PAGO", category: "Pessoal" },
      { id: "jun-16", month: "JUNHO", description: "VIVO", value: 84.87, valueText: "R$ 84,87", status: "ACORDO", category: "Utilidades" },
      { id: "jun-17", month: "JUNHO", description: "Marisa", value: 157.73, valueText: "R$ 157,73", status: "PAGO", category: "Pessoal" }
    ]
  },
  {
    month: "JULHO",
    salary: 1550.00,
    ticketText: "ALELO",
    transactions: [
      { id: "jul-1", month: "JULHO", description: "CASA", value: 250.00, valueText: "R$ 250,00", status: "FALTA PAGAR", category: "Moradia" },
      { id: "jul-2", month: "JULHO", description: "INTER", value: 996.00, valueText: "R$ 996,00", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "jul-3", month: "JULHO", description: "MERCADO PAGO", value: 514.78, valueText: "R$ 514,78", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "jul-4", month: "JULHO", description: "WILL", value: 342.07, valueText: "R$ 342,07", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "jul-5", month: "JULHO", description: "SANTANDER", value: 539.74, valueText: "R$ 539,74", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "jul-6", month: "JULHO", description: "NU", value: 299.11, valueText: "R$ 299,11", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "jul-7", month: "JULHO", description: "BRADESCO", value: 568.19, valueText: "R$ 568,19", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "jul-8", month: "JULHO", description: "FACULDADE", value: 136.87, valueText: "R$ 136,87", status: "FALTA PAGAR", category: "Educação" },
      { id: "jul-9", month: "JULHO", description: "INTERNET", value: 100.00, valueText: "R$ 100,00", status: "FALTA PAGAR", category: "Utilidades" },
      { id: "jul-10", month: "JULHO", description: "CONTA CLARO", value: 30.00, valueText: "R$ 30,00", status: "FALTA PAGAR", category: "Utilidades" },
      { id: "jul-11", month: "JULHO", description: "ENERGIA", value: 145.70, valueText: "R$ 145,70", status: "FALTA PAGAR", category: "Utilidades" },
      { id: "jul-12", month: "JULHO", description: "AGUA CASA NOVA", value: 85.28, valueText: "R$ 85,28", status: "FALTA PAGAR", category: "Utilidades" },
      { id: "jul-13", month: "JULHO", description: "BB", value: 204.98, valueText: "R$ 204,98", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "jul-14", month: "JULHO", description: "Amanda", value: 169.61, valueText: "R$ 169,61", status: "FALTA PAGAR", category: "Pessoal" },
      { id: "jul-15", month: "JULHO", description: "Marcelo", value: 373.70, valueText: "R$ 373,70", status: "FALTA PAGAR", category: "Pessoal" },
      { id: "jul-16", month: "JULHO", description: "VIVO", value: 66.01, valueText: "R$ 66,01", status: "FALTA PAGAR", category: "Utilidades" }
    ]
  },
  {
    month: "AGOSTO",
    salary: 1550.00,
    ticketText: "ALELO",
    transactions: [
      { id: "ago-1", month: "AGOSTO", description: "CASA", value: 250.00, valueText: "R$ 250,00", status: "FALTA PAGAR", category: "Moradia" },
      { id: "ago-2", month: "AGOSTO", description: "INTER", value: 996.00, valueText: "R$ 996,00", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "ago-3", month: "AGOSTO", description: "MERCADO PAGO", value: 514.78, valueText: "R$ 514,78", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "ago-4", month: "AGOSTO", description: "WILL", value: 342.07, valueText: "R$ 342,07", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "ago-5", month: "AGOSTO", description: "SANTANDER", value: 539.74, valueText: "R$ 539,74", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "ago-6", month: "AGOSTO", description: "NU", value: 299.11, valueText: "R$ 299,11", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "ago-7", month: "AGOSTO", description: "BRADESCO", value: 568.19, valueText: "R$ 568,19", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "ago-8", month: "AGOSTO", description: "FACULDADE", value: 136.87, valueText: "R$ 136,87", status: "FALTA PAGAR", category: "Educação" },
      { id: "ago-9", month: "AGOSTO", description: "INTERNET", value: 100.00, valueText: "R$ 100,00", status: "FALTA PAGAR", category: "Utilidades" },
      { id: "ago-10", month: "AGOSTO", description: "CONTA CLARO", value: 30.00, valueText: "R$ 30,00", status: "FALTA PAGAR", category: "Utilidades" },
      { id: "ago-11", month: "AGOSTO", description: "ENERGIA", value: 145.70, valueText: "R$ 145,70", status: "FALTA PAGAR", category: "Utilidades" },
      { id: "ago-12", month: "AGOSTO", description: "AGUA CASA NOVA", value: 85.28, valueText: "R$ 85,28", status: "FALTA PAGAR", category: "Utilidades" },
      { id: "ago-13", month: "AGOSTO", description: "BB", value: 204.98, valueText: "R$ 204,98", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "ago-14", month: "AGOSTO", description: "Amanda", value: 169.61, valueText: "R$ 169,61", status: "FALTA PAGAR", category: "Pessoal" },
      { id: "ago-15", month: "AGOSTO", description: "Marcelo", value: 373.70, valueText: "R$ 373,70", status: "FALTA PAGAR", category: "Pessoal" },
      { id: "ago-16", month: "AGOSTO", description: "VIVO", value: 66.01, valueText: "R$ 66,01", status: "FALTA PAGAR", category: "Utilidades" }
    ]
  },
  {
    month: "SETEMBRO",
    salary: 1550.00,
    ticketText: "ALELO",
    transactions: [
      { id: "set-1", month: "SETEMBRO", description: "CASA", value: 250.00, valueText: "R$ 250,00", status: "FALTA PAGAR", category: "Moradia" },
      { id: "set-2", month: "SETEMBRO", description: "INTER", value: 996.00, valueText: "R$ 996,00", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "set-3", month: "SETEMBRO", description: "MERCADO PAGO", value: 514.78, valueText: "R$ 514,78", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "set-4", month: "SETEMBRO", description: "WILL", value: 342.07, valueText: "R$ 342,07", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "set-5", month: "SETEMBRO", description: "SANTANDER", value: 539.74, valueText: "R$ 539,74", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "set-6", month: "SETEMBRO", description: "NU", value: 299.11, valueText: "R$ 299,11", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "set-7", month: "SETEMBRO", description: "BRADESCO", value: 568.19, valueText: "R$ 568,19", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "set-8", month: "SETEMBRO", description: "FACULDADE", value: 136.87, valueText: "R$ 136,87", status: "FALTA PAGAR", category: "Educação" },
      { id: "set-9", month: "SETEMBRO", description: "INTERNET", value: 100.00, valueText: "R$ 100,00", status: "FALTA PAGAR", category: "Utilidades" },
      { id: "set-10", month: "SETEMBRO", description: "CONTA CLARO", value: 30.00, valueText: "R$ 30,00", status: "FALTA PAGAR", category: "Utilidades" },
      { id: "set-11", month: "SETEMBRO", description: "ENERGIA", value: 145.70, valueText: "R$ 145,70", status: "FALTA PAGAR", category: "Utilidades" },
      { id: "set-12", month: "SETEMBRO", description: "AGUA CASA NOVA", value: 85.28, valueText: "R$ 85,28", status: "FALTA PAGAR", category: "Utilidades" },
      { id: "set-13", month: "SETEMBRO", description: "BB", value: 204.98, valueText: "R$ 204,98", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "set-14", month: "SETEMBRO", description: "Amanda", value: 169.61, valueText: "R$ 169,61", status: "FALTA PAGAR", category: "Pessoal" },
      { id: "set-15", month: "SETEMBRO", description: "Marcelo", value: 373.70, valueText: "R$ 373,70", status: "FALTA PAGAR", category: "Pessoal" },
      { id: "set-16", month: "SETEMBRO", description: "VIVO", value: 66.01, valueText: "R$ 66,01", status: "FALTA PAGAR", category: "Utilidades" }
    ]
  },
  {
    month: "OUTUBRO",
    salary: 1550.00,
    ticketText: "ALELO",
    transactions: [
      { id: "out-1", month: "OUTUBRO", description: "CASA", value: 250.00, valueText: "R$ 250,00", status: "FALTA PAGAR", category: "Moradia" },
      { id: "out-2", month: "OUTUBRO", description: "INTER", value: 996.00, valueText: "R$ 996,00", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "out-3", month: "OUTUBRO", description: "MERCADO PAGO", value: 514.78, valueText: "R$ 514,78", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "out-4", month: "OUTUBRO", description: "WILL", value: 342.07, valueText: "R$ 342,07", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "out-5", month: "OUTUBRO", description: "SANTANDER", value: 539.74, valueText: "R$ 539,74", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "out-6", month: "OUTUBRO", description: "NU", value: 299.11, valueText: "R$ 299,11", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "out-7", month: "OUTUBRO", description: "BRADESCO", value: 568.19, valueText: "R$ 568,19", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "out-8", month: "OUTUBRO", description: "FACULDADE", value: 136.87, valueText: "R$ 136,87", status: "FALTA PAGAR", category: "Educação" },
      { id: "out-9", month: "OUTUBRO", description: "INTERNET", value: 100.00, valueText: "R$ 100,00", status: "FALTA PAGAR", category: "Utilidades" },
      { id: "out-10", month: "OUTUBRO", description: "CONTA CLARO", value: 30.00, valueText: "R$ 30,00", status: "FALTA PAGAR", category: "Utilidades" },
      { id: "out-11", month: "OUTUBRO", description: "ENERGIA", value: 145.70, valueText: "R$ 145,70", status: "FALTA PAGAR", category: "Utilidades" },
      { id: "out-12", month: "OUTUBRO", description: "AGUA CASA NOVA", value: 85.28, valueText: "R$ 85,28", status: "FALTA PAGAR", category: "Utilidades" },
      { id: "out-13", month: "OUTUBRO", description: "BB", value: 204.98, valueText: "R$ 204,98", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "out-14", month: "OUTUBRO", description: "Amanda", value: 169.61, valueText: "R$ 169,61", status: "FALTA PAGAR", category: "Pessoal" },
      { id: "out-15", month: "OUTUBRO", description: "Marcelo", value: 373.70, valueText: "R$ 373,70", status: "FALTA PAGAR", category: "Pessoal" },
      { id: "out-16", month: "OUTUBRO", description: "VIVO", value: 66.01, valueText: "R$ 66,01", status: "FALTA PAGAR", category: "Utilidades" }
    ]
  },
  {
    month: "NOVEMBRO",
    salary: 1550.00,
    ticketText: "ALELO",
    transactions: [
      { id: "nov-1", month: "NOVEMBRO", description: "CASA", value: 250.00, valueText: "R$ 250,00", status: "FALTA PAGAR", category: "Moradia" },
      { id: "nov-2", month: "NOVEMBRO", description: "INTER", value: 996.00, valueText: "R$ 996,00", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "nov-3", month: "NOVEMBRO", description: "MERCADO PAGO", value: 514.78, valueText: "R$ 514,78", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "nov-4", month: "NOVEMBRO", description: "WILL", value: 342.07, valueText: "R$ 342,07", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "nov-5", month: "NOVEMBRO", description: "SANTANDER", value: 539.74, valueText: "R$ 539,74", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "nov-6", month: "NOVEMBRO", description: "NU", value: 299.11, valueText: "R$ 299,11", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "nov-7", month: "NOVEMBRO", description: "BRADESCO", value: 568.19, valueText: "R$ 568,19", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "nov-8", month: "NOVEMBRO", description: "FACULDADE", value: 136.87, valueText: "R$ 136,87", status: "FALTA PAGAR", category: "Educação" },
      { id: "nov-9", month: "NOVEMBRO", description: "INTERNET", value: 100.00, valueText: "R$ 100,00", status: "FALTA PAGAR", category: "Utilidades" },
      { id: "nov-10", month: "NOVEMBRO", description: "CONTA CLARO", value: 30.00, valueText: "R$ 30,00", status: "FALTA PAGAR", category: "Utilidades" },
      { id: "nov-11", month: "NOVEMBRO", description: "ENERGIA", value: 145.70, valueText: "R$ 145,70", status: "FALTA PAGAR", category: "Utilidades" },
      { id: "nov-12", month: "NOVEMBRO", description: "AGUA CASA NOVA", value: 85.28, valueText: "R$ 85,28", status: "FALTA PAGAR", category: "Utilidades" },
      { id: "nov-13", month: "NOVEMBRO", description: "BB", value: 204.98, valueText: "R$ 204,98", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "nov-14", month: "NOVEMBRO", description: "Amanda", value: 169.61, valueText: "R$ 169,61", status: "FALTA PAGAR", category: "Pessoal" },
      { id: "nov-15", month: "NOVEMBRO", description: "Marcelo", value: 373.70, valueText: "R$ 373,70", status: "FALTA PAGAR", category: "Pessoal" },
      { id: "nov-16", month: "NOVEMBRO", description: "VIVO", value: 66.01, valueText: "R$ 66,01", status: "FALTA PAGAR", category: "Utilidades" }
    ]
  },
  {
    month: "DEZEMBRO",
    salary: 1550.00,
    ticketText: "ALELO",
    transactions: [
      { id: "dez-1", month: "DEZEMBRO", description: "CASA", value: 250.00, valueText: "R$ 250,00", status: "FALTA PAGAR", category: "Moradia" },
      { id: "dez-2", month: "DEZEMBRO", description: "INTER", value: 996.00, valueText: "R$ 996,00", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "dez-3", month: "DEZEMBRO", description: "MERCADO PAGO", value: 514.78, valueText: "R$ 514,78", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "dez-4", month: "DEZEMBRO", description: "WILL", value: 342.07, valueText: "R$ 342,07", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "dez-5", month: "DEZEMBRO", description: "SANTANDER", value: 539.74, valueText: "R$ 539,74", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "dez-6", month: "DEZEMBRO", description: "NU", value: 299.11, valueText: "R$ 299,11", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "dez-7", month: "DEZEMBRO", description: "BRADESCO", value: 568.19, valueText: "R$ 568,19", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "dez-8", month: "DEZEMBRO", description: "FACULDADE", value: 136.87, valueText: "R$ 136,87", status: "FALTA PAGAR", category: "Educação" },
      { id: "dez-9", month: "DEZEMBRO", description: "INTERNET", value: 100.00, valueText: "R$ 100,00", status: "FALTA PAGAR", category: "Utilidades" },
      { id: "dez-10", month: "DEZEMBRO", description: "CONTA CLARO", value: 30.00, valueText: "R$ 30,00", status: "FALTA PAGAR", category: "Utilidades" },
      { id: "dez-11", month: "DEZEMBRO", description: "ENERGIA", value: 145.70, valueText: "R$ 145,70", status: "FALTA PAGAR", category: "Utilidades" },
      { id: "dez-12", month: "DEZEMBRO", description: "AGUA CASA NOVA", value: 85.28, valueText: "R$ 85,28", status: "FALTA PAGAR", category: "Utilidades" },
      { id: "dez-13", month: "DEZEMBRO", description: "BB", value: 204.98, valueText: "R$ 204,98", status: "FALTA PAGAR", category: "Cartão de Crédito" },
      { id: "dez-14", month: "DEZEMBRO", description: "Amanda", value: 169.61, valueText: "R$ 169,61", status: "FALTA PAGAR", category: "Pessoal" },
      { id: "dez-15", month: "DEZEMBRO", description: "Marcelo", value: 373.70, valueText: "R$ 373,70", status: "FALTA PAGAR", category: "Pessoal" },
      { id: "dez-16", month: "DEZEMBRO", description: "VIVO", value: 66.01, valueText: "R$ 66,01", status: "FALTA PAGAR", category: "Utilidades" }
    ]
  }
];

export const MONTH_ORDER = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", 
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
];
