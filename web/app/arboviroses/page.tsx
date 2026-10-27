import type { Metadata } from "next";
import { Arboviroses } from "@/components/paginas/Arboviroses";
import { COLUNAS_ARBO } from "@/lib/constantes";
import { anosHistoricos, definicoes, faixaSemanal, meta, pivot, pontos, semanal } from "@/lib/dados";

export const metadata: Metadata = { title: "Arboviroses · Observatório de Saúde da Ibiapaba" };

export default function Pagina() {
  const anoSemanal = Math.max(...semanal.map((r) => r.ano));
  return (
    <Arboviroses
      pontos={pontos((r) => r.indicador === "dengue_incidencia" || r.indicador === "chik_incidencia")}
      definicoes={definicoes}
      semanal={semanal.filter((r) => r.ano === anoSemanal)}
      faixa={faixaSemanal()}
      anosHistoricos={anosHistoricos()}
      tabela={pivot(COLUNAS_ARBO).filter((r) => r.ano === meta.ano_arbo)}
      anoParcial={meta.ano_parcial}
      anoArbo={meta.ano_arbo}
      temCeara={meta.tem_ceara}
    />
  );
}
