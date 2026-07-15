import React from "react";
import { TrendingUp, TrendingDown, AlertCircle, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";

interface BudgetAlertCardProps {
  category: string;
  planned: number;
  realized: number;
  variance: number;
  variancePct: number;
  pctConsumed: number;
  status: "EXCEDIDO" | "ALERTA" | "SOB_CONTROLE";
  selectedMonth: string;
}

export const BudgetAlertCard: React.FC<BudgetAlertCardProps> = ({
  category,
  planned,
  realized,
  variance,
  variancePct,
  pctConsumed,
  status,
  selectedMonth,
}) => {
  const hasExceeded = status === "EXCEDIDO";
  const isWarning = status === "ALERTA";

  // Determine styles, icons, and indicators based on the budget health
  let statusBadgeStyle = "text-emerald-700 bg-emerald-50 border-emerald-100";
  let barColor = "bg-emerald-500";
  let cardBorder = "border-gray-200/60 bg-white hover:border-gray-300";
  let statusLabel = "Sob Controle";
  
  // Semaphore indicator style
  let semaphoreColor = "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]";
  let Icon = CheckCircle2;

  if (hasExceeded) {
    statusBadgeStyle = "text-rose-700 bg-rose-50 border-rose-100";
    barColor = "bg-rose-500";
    cardBorder = "border-rose-100 bg-rose-50/5 hover:border-rose-200";
    statusLabel = "Limite Estourado";
    semaphoreColor = "bg-rose-500 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.7)]";
    Icon = AlertCircle;
  } else if (isWarning) {
    statusBadgeStyle = "text-amber-700 bg-amber-50 border-amber-100";
    barColor = "bg-amber-500";
    cardBorder = "border-amber-100 bg-amber-50/5 hover:border-amber-200";
    statusLabel = "Atenção (≥80%)";
    semaphoreColor = "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)]";
    Icon = AlertTriangle;
  }

  // Contextual advice for each category
  const getContextualAdvice = (cat: string) => {
    switch (cat) {
      case "Cartão de Crédito":
        return "Evite compras parceladas ou uso do limite rotativo para cessar juros acumulados.";
      case "Utilidades":
        return "Revise contas de consumo e busque desligar eletrônicos ou renegociar pacotes.";
      case "Moradia":
        return "Gastos fixos elevados. Considere buscar reajuste de contratos de aluguel ou taxas.";
      case "Pessoal":
        return "Monitore gastos de lazer e pequenas despesas diárias para estancar o vazamento financeiro.";
      case "Educação":
        return "Atenção a reajustes escolares e taxas. Planeje semestralidades com antecedência.";
      case "Empréstimos":
        return "Custo financeiro de juros. Priorize liquidar as parcelas de maior taxa de encargos.";
      default:
        return "Despesas gerais elevadas. Audite compras pequenas que juntas somam montantes relevantes.";
    }
  };

  return (
    <div
      id={`budget-alert-card-${category.toLowerCase().replace(/\s+/g, "-")}`}
      className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between space-y-4 shadow-2xs ${cardBorder}`}
    >
      {/* Top Section with Title and Semaphore */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5 truncate">
          <h4 className="text-xs font-bold text-gray-800 truncate uppercase tracking-wider font-sans">
            {category}
          </h4>
          <span className="text-[10px] text-gray-400 font-mono block">
            {selectedMonth === "TODOS" ? "Média Mensal" : `Mês de ${selectedMonth}`}
          </span>
        </div>

        {/* Semaphore Visual Element */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex h-2.5 w-2.5 relative">
            {hasExceeded && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${semaphoreColor}`}></span>
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadgeStyle} font-sans`}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Progress & Values */}
      <div className="space-y-2">
        <div className="flex justify-between items-baseline text-[11px] font-mono">
          <span className="text-gray-500">Realizado</span>
          <span className="text-gray-950 font-bold">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(realized)}
          </span>
        </div>

        <div className="flex justify-between items-baseline text-[11px] font-mono border-b border-gray-100/60 pb-1.5">
          <span className="text-gray-400">Limite Definido</span>
          <span className="text-gray-600 font-medium">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(planned)}
          </span>
        </div>

        {/* Custom Segmented Bar Meter */}
        <div className="space-y-1 pt-1">
          <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden flex">
            <div
              className={`h-full transition-all duration-500 rounded-full ${barColor}`}
              style={{ width: `${Math.min(pctConsumed, 100)}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[10px] font-medium font-mono pt-0.5">
            <span className="text-gray-500">
              Consumido: <strong className={hasExceeded ? "text-rose-600 font-bold" : isWarning ? "text-amber-600 font-bold" : "text-emerald-600 font-bold"}>{pctConsumed.toFixed(0)}%</strong>
            </span>

            {variance > 0 ? (
              <span className="text-rose-600 font-bold flex items-center gap-0.5">
                <TrendingUp className="h-3 w-3" />
                +R$ {variance.toFixed(2)} (+{variancePct.toFixed(0)}%)
              </span>
            ) : (
              <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                <TrendingDown className="h-3 w-3" />
                -R$ {Math.abs(variance).toFixed(2)} ({variancePct.toFixed(0)}%)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Advice / Alert Box if threshold is reached */}
      {(hasExceeded || isWarning) && (
        <div className={`p-2.5 rounded-xl text-[10px] leading-relaxed flex items-start gap-2 ${
          hasExceeded 
            ? "bg-rose-50/50 text-rose-950 border border-rose-100/30" 
            : "bg-amber-50/50 text-amber-950 border border-amber-100/30"
        }`}>
          <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${hasExceeded ? "text-rose-500" : "text-amber-500"}`} />
          <p className="font-sans">
            <span className="font-bold">Recomendação:</span> {getContextualAdvice(category)}
          </p>
        </div>
      )}
    </div>
  );
};

export default BudgetAlertCard;
