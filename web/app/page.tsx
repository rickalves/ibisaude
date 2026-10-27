import { Inicio } from "@/components/paginas/Inicio";
import { definicoes, meta, pivot, pontos } from "@/lib/dados";

const INDICADORES_ARBO = ["dengue_incidencia"];

export default function Pagina() {
  return (
    <Inicio
      pontos={pontos()}
      definicoes={definicoes}
      anoParcial={meta.ano_parcial}
      anoArbo={meta.ano_arbo}
      temCeara={meta.tem_ceara}
      arbo={pivot(INDICADORES_ARBO).filter((r) => r.ano === meta.ano_arbo)}
    />
  );
}
