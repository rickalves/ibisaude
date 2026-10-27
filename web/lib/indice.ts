import { F0 } from "./formato";
import type { Definicao, Ponto } from "./tipos";

export interface Indice {
  valor(u: string, a: number, i: string): number | null;
  /** "numerador ÷ denominador", para mostrar de onde vem uma taxa */
  conta(u: string, a: number, i: string): string;
  def(i: string): Definicao;
}

export function criarIndice(pontos: Ponto[], definicoes: Definicao[]): Indice {
  const m = new Map(pontos.map((p) => [`${p[0]}|${p[1]}|${p[2]}`, p]));
  const defs = new Map(definicoes.map((d) => [d.indicador, d]));
  return {
    valor: (u, a, i) => m.get(`${u}|${a}|${i}`)?.[3] ?? null,
    conta: (u, a, i) => {
      const p = m.get(`${u}|${a}|${i}`);
      return p && p[5] != null && p[4] != null ? `${F0(p[4])} ÷ ${F0(p[5])}` : "";
    },
    def: (i) => defs.get(i) ?? { indicador: i, nome: i, eixo: "", unidade_medida: "", melhor: null, fonte: "", nota: "" },
  };
}

/** Nos municípios, taxas com poucos eventos usam a média de 3 anos. */
const PEQUENAS = new Set(["tmi", "tmn"]);
export const indicadorPara = (i: string, unidade: string) =>
  unidade !== "IBIAPABA" && PEQUENAS.has(i) ? `${i}_3a` : i;
