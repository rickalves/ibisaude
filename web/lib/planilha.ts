// Planilhas geradas no navegador a partir do que a tela mostra. Formato do Excel em português:
// separador ";", vírgula decimal e BOM para o Excel reconhecer UTF-8 (acentos).

export type Celula = string | number | null | undefined;

function celula(v: Celula) {
  if (v == null) return "";
  const t = typeof v === "number" ? String(Math.round(v * 100) / 100).replace(".", ",") : v;
  return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export function baixarCsv(arquivo: string, colunas: string[], linhas: Celula[][]) {
  const texto = [colunas, ...linhas].map((l) => l.map(celula).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + texto], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = arquivo.endsWith(".csv") ? arquivo : `${arquivo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Séries de um gráfico de linhas como tabela: uma linha por ano, uma coluna por série. */
export function tabelaSeries(series: { nome: string; pontos: { x: number; y: number | null }[] }[]) {
  const anos = [...new Set(series.flatMap((s) => s.pontos.map((p) => p.x)))].sort((a, b) => a - b);
  return {
    colunas: ["Ano", ...series.map((s) => s.nome)],
    linhas: () => anos.map((a) => [a, ...series.map((s) => s.pontos.find((p) => p.x === a)?.y)]),
  };
}
