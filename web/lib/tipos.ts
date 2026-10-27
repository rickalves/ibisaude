export type Melhor = "menor" | "maior" | null;

export interface Definicao {
  indicador: string;
  nome: string;
  eixo: string;
  unidade_medida: string;
  melhor: Melhor;
  fonte: string;
  nota: string;
}

export interface LinhaAnual {
  unidade: string;
  nome: string;
  ano: number;
  indicador: string;
  numerador: number | null;
  denominador: number | null;
  valor: number;
}

/** [unidade, ano, indicador, valor, numerador, denominador] — forma compacta enviada ao navegador */
export type Ponto = [string, number, string, number, number | null, number | null];

export interface LinhaFicha {
  id: string;
  unidade: string;
  ano: number;
  indicador: string;
  nome: string;
  eixo: string;
  valor: number;
  anterior: number | null;
  variacao: number | null;
  ibiapaba: number | null;
  ceara: number | null;
}

export interface LinhaSemanal {
  unidade: string;
  agravo: "dengue" | "chik";
  ano: number;
  semana: number;
  casos: number;
}

export interface LinhaCausa {
  unidade: string;
  ano: number;
  grupo: string;
  obitos?: number;
  internacoes?: number;
}

export interface LinhaDestino {
  unidade: string;
  ano: number;
  destino: string;
  internacoes: number;
}

export interface Unidade {
  codigo: string;
  nome: string;
  slug: string;
}

export interface Meta {
  gerado_em: string;
  ano_parcial: number;
  anos_fechados: number[];
  ano_arbo: number;
  tem_ceara: boolean;
  preliminares: string[];
  sih_ultima_competencia: string;
  municipios: { codigo: string; nome: string }[];
}

export interface FaixaSemanal {
  unidade: string;
  agravo: string;
  semana: number;
  mediana: number;
  maximo: number;
}

/** Uma linha por unidade e ano, com vários indicadores lado a lado (tabelas comparativas). */
export type LinhaPivot = { unidade: string; nome: string; ano: number } & Record<string, number | string | null>;
