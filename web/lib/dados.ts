// Acesso aos dados no build. Os JSON vêm de indicadores/construir.py e são importados de forma estática,
// então todo o site é gerado no `next build`, sem servidor.
import anualJson from "@/public/dados/anual.json";
import causasIntJson from "@/public/dados/causas_internacao.json";
import causasObitoJson from "@/public/dados/causas_obito.json";
import destinoJson from "@/public/dados/destino_internacao.json";
import fichaJson from "@/public/dados/ficha.json";
import indicadoresJson from "@/public/dados/indicadores.json";
import metaJson from "@/public/dados/meta.json";
import semanalJson from "@/public/dados/semanal.json";
import { median, max } from "d3";
import { slug } from "./formato";
import type {
  Definicao, FaixaSemanal, LinhaAnual, LinhaCausa, LinhaDestino, LinhaFicha, LinhaPivot, LinhaSemanal, Meta, Ponto, Unidade,
} from "./tipos";

export const meta = metaJson as Meta;
export const anual = anualJson as unknown as LinhaAnual[];
export const definicoes = indicadoresJson as unknown as Definicao[];
export const ficha = fichaJson as unknown as LinhaFicha[];
export const semanal = semanalJson as unknown as LinhaSemanal[];
export const causasObito = causasObitoJson as unknown as LinhaCausa[];
export const causasInternacao = causasIntJson as unknown as LinhaCausa[];
export const destino = destinoJson as unknown as LinhaDestino[];

export const SERRA: Unidade = { codigo: "IBIAPABA", nome: "Serra da Ibiapaba", slug: "serra-da-ibiapaba" };
export const CEARA = { codigo: "CE", nome: "Ceará" };
export const municipios: Unidade[] = meta.municipios
  .map((m) => ({ codigo: m.codigo, nome: m.nome, slug: slug(m.nome) }))
  .sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
/** Serra primeiro, depois os municípios em ordem alfabética. */
export const unidades: Unidade[] = [SERRA, ...municipios];

export const unidadePorSlug = (s: string) => unidades.find((u) => u.slug === s);

export function pontos(filtro: (r: LinhaAnual) => boolean = () => true): Ponto[] {
  return anual.filter(filtro).map((r) => [r.unidade, r.ano, r.indicador, r.valor, r.numerador, r.denominador]);
}

/** Pivota indicadores escolhidos em uma linha por unidade e ano. */
export function pivot(indicadores: string[]): LinhaPivot[] {
  const m = new Map<string, LinhaPivot>();
  for (const r of anual) {
    if (!indicadores.includes(r.indicador)) continue;
    const k = `${r.unidade}-${r.ano}`;
    if (!m.has(k)) m.set(k, { unidade: r.unidade, nome: r.nome, ano: r.ano });
    m.get(k)![r.indicador] = r.valor;
  }
  return [...m.values()];
}

/** Faixa histórica semanal: mediana e máximo dos anos anteriores ao mais recente (semanas sem caso = 0). */
export function faixaSemanal(): FaixaSemanal[] {
  const anoMax = max(semanal, (r) => r.ano)!;
  const anos = [...new Set(semanal.map((r) => r.ano))].filter((a) => a < anoMax);
  const casos = new Map(semanal.map((r) => [`${r.unidade}|${r.agravo}|${r.ano}|${r.semana}`, r.casos]));
  const grupos = new Set(semanal.map((r) => `${r.unidade}|${r.agravo}`));
  const linhas: FaixaSemanal[] = [];
  for (const g of grupos) {
    const [unidade, agravo] = g.split("|");
    for (let s = 1; s <= 53; s++) {
      const v = anos.map((a) => casos.get(`${unidade}|${agravo}|${a}|${s}`) ?? 0);
      linhas.push({ unidade, agravo, semana: s, mediana: median(v) ?? 0, maximo: max(v) ?? 0 });
    }
  }
  return linhas;
}

export const anosHistoricos = () => {
  const anoMax = max(semanal, (r) => r.ano)!;
  return [...new Set(semanal.map((r) => r.ano))].filter((a) => a < anoMax).sort();
};
