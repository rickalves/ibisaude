"use client";

import { baixarCsv, type Celula } from "@/lib/planilha";
import { slug } from "@/lib/formato";

/** Baixa como planilha (CSV) a tabela que o cartão está mostrando. As linhas só são montadas no clique. */
export function BotaoBaixar({
  arquivo,
  colunas,
  linhas,
  rotulo = "Baixar planilha",
}: {
  arquivo: string;
  colunas: string[];
  linhas: () => Celula[][];
  rotulo?: string;
}) {
  return (
    <button type="button" className="botao-baixar" onClick={() => baixarCsv(slug(arquivo), colunas, linhas())}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M8 2v8m0 0L4.5 6.5M8 10l3.5-3.5M2.5 13.5h11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {rotulo}
    </button>
  );
}
