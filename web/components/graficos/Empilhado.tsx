"use client";

import { scaleLinear, sum } from "d3";
import { F0, F1 } from "@/lib/formato";
import { Grafico, medirTexto } from "./base";

const ALTURA_LINHA = 26;

/** Uma barra 100% empilhada por ano. */
export function Empilhado({
  linhas,
  categorias,
  cores,
  anoParcial,
  rotulo,
}: {
  linhas: { ano: number; partes: Map<string, number> }[];
  categorias: string[];
  cores: string[];
  anoParcial: number;
  rotulo: string;
}) {
  const altura = linhas.length * ALTURA_LINHA + 4;
  const nomeAno = (a: number) => (a >= anoParcial ? `${a}*` : String(a));
  return (
    <Grafico altura={altura} rotulo={rotulo}>
      {(w, { mostrar, esconder }) => {
        const lw = medirTexto(linhas.map((l) => nomeAno(l.ano))) + 10;
        const x = scaleLinear([0, 1], [lw, w - 4]);
        return (
          <svg width="100%" height={altura} viewBox={`0 0 ${w} ${altura}`} onMouseLeave={esconder}>
            {linhas.map((l, k) => {
              const y = k * ALTURA_LINHA;
              const total = sum(categorias, (c) => l.partes.get(c) ?? 0) || 1;
              let acumulado = 0;
              return (
                <g key={l.ano}>
                  <text x={lw - 8} y={y + ALTURA_LINHA / 2 + 4} textAnchor="end">
                    {nomeAno(l.ano)}
                  </text>
                  {categorias.map((c, j) => {
                    const n = l.partes.get(c) ?? 0;
                    const f = n / total;
                    const x0 = x(acumulado);
                    acumulado += f;
                    return (
                      <rect
                        key={c}
                        x={x0}
                        y={y + 5}
                        width={Math.max(0, x(acumulado) - x0 - 1)}
                        height={ALTURA_LINHA - 10}
                        style={{ fill: cores[j] }}
                        onMouseMove={(e) =>
                          mostrar(e, `${l.ano}${l.ano >= anoParcial ? " (parcial)" : ""}`, [
                            { cor: cores[j], texto: `${c}: ${F1(f * 100)}% (${F0(n)})` },
                          ])
                        }
                      />
                    );
                  })}
                </g>
              );
            })}
          </svg>
        );
      }}
    </Grafico>
  );
}
