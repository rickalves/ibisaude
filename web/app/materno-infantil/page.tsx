import type { Metadata } from "next";
import { Materno } from "@/components/paginas/Materno";
import { COLUNAS_MATERNO, GRAFICOS_MATERNO } from "@/lib/constantes";
import { definicoes, meta, pivot, pontos } from "@/lib/dados";

export const metadata: Metadata = { title: "Materno-infantil · Observatório de Saúde da Ibiapaba" };

const NECESSARIOS = new Set([...GRAFICOS_MATERNO, ...GRAFICOS_MATERNO.map((i) => `${i}_3a`), ...COLUNAS_MATERNO]);

export default function Pagina() {
  return (
    <Materno
      pontos={pontos((r) => NECESSARIOS.has(r.indicador))}
      definicoes={definicoes}
      tabela={pivot(COLUNAS_MATERNO)}
      anoParcial={meta.ano_parcial}
      temCeara={meta.tem_ceara}
    />
  );
}
