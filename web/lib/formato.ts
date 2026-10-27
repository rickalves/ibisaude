import { formatLocale } from "d3";
import type { Melhor } from "./tipos";

const L = formatLocale({ decimal: ",", thousands: ".", grouping: [3], currency: ["R$ ", ""] });
export const F0 = L.format(",.0f");
export const F1 = L.format(",.1f");
export const F2 = L.format(",.2f");

/** Formata um valor conforme a unidade de medida do indicador. */
export function formatar(v: number | null | undefined, unidadeMedida = ""): string {
  if (v == null || Number.isNaN(v)) return "—";
  if (unidadeMedida.startsWith("%")) return F1(v) + "%";
  if (unidadeMedida.startsWith("R$")) return "R$ " + F2(v);
  if (unidadeMedida.startsWith("por ")) return F1(v);
  return F0(v);
}

export function formatarVariacao(d: number | null | undefined, unidadeMedida = ""): string {
  if (d == null) return "";
  const sinal = d > 0 ? "+" : d < 0 ? "−" : "±";
  const a = Math.abs(d);
  if (unidadeMedida.startsWith("%")) return `${sinal}${F1(a)} p.p.`;
  if (unidadeMedida.startsWith("R$")) return `${sinal}R$ ${F2(a)}`;
  if (unidadeMedida.startsWith("por ")) return sinal + F1(a);
  return sinal + F0(a);
}

/** Classe CSS da variação: melhora, piora ou neutra. */
export function tom(d: number | null | undefined, melhor: Melhor): "bom" | "ruim" | "neutro" {
  if (d == null || d === 0 || !melhor) return "neutro";
  return (melhor === "menor") === d < 0 ? "bom" : "ruim";
}

export const ehTaxa = (unidadeMedida: string) => /%|por |R\$/.test(unidadeMedida);

export function slug(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const parcial = (ano: number, anoParcial: number) => (ano >= anoParcial ? " (parcial)" : "");
