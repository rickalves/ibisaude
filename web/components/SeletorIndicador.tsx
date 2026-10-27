"use client";

import { group } from "d3";
import { ehTaxa } from "@/lib/formato";
import type { Definicao } from "@/lib/tipos";

/** Lista os indicadores que são taxas ou proporções (comparáveis entre municípios), agrupados por eixo. */
export function SeletorIndicador({
  definicoes,
  valor,
  aoMudar,
}: {
  definicoes: Definicao[];
  valor: string;
  aoMudar: (i: string) => void;
}) {
  const porEixo = group(
    definicoes.filter((d) => ehTaxa(d.unidade_medida)),
    (d) => d.eixo,
  );
  return (
    <label className="campo">
      Indicador
      <select id="filtro-indicador" value={valor} onChange={(e) => aoMudar(e.target.value)}>
        {[...porEixo].map(([eixo, ds]) => (
          <optgroup key={eixo} label={eixo}>
            {ds.map((d) => (
              <option key={d.indicador} value={d.indicador}>
                {d.nome}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
