import type { Serie } from "@/components/graficos/Linhas";
import { COR } from "@/components/graficos/base";
import type { Indice } from "./indice";

/** Séries padrão de um indicador: a unidade escolhida, a serra (se for um município) e o Ceará. */
export function seriesPara(
  indice: Indice,
  indicador: string,
  unidade: string,
  nomeUnidade: string,
  anos: number[],
  temCeara: boolean,
): Serie[] {
  const pts = (u: string) => anos.map((a) => ({ x: a, y: indice.valor(u, a, indicador), nota: indice.conta(u, a, indicador) }));
  const s: Serie[] = [{ nome: nomeUnidade, cor: COR.destaque, pontos: pts(unidade) }];
  if (unidade !== "IBIAPABA") s.push({ nome: "Serra da Ibiapaba", cor: COR.apagada, pontos: pts("IBIAPABA") });
  if (temCeara) s.push({ nome: "Ceará", cor: COR.referencia, tracejada: true, pontos: pts("CE") });
  return s;
}
