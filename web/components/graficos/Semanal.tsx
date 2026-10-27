"use client";

import { area, curveStep, line, max, range, scaleBand, scaleLinear } from "d3";
import { F0, F1 } from "@/lib/formato";
import type { FaixaSemanal } from "@/lib/tipos";
import { COR, Grafico, medirTexto } from "./base";

const SEMANAS = range(1, 54);

/** Casos por semana epidemiológica contra a faixa histórica (máximo) e a mediana dos anos anteriores. */
export function Semanal({ atual, faixa, rotulo }: { atual: Map<number, number>; faixa: FaixaSemanal[]; rotulo: string }) {
  const altura = 220;
  const porSemana = new Map(faixa.map((r) => [r.semana, r]));
  return (
    <Grafico altura={altura} rotulo={rotulo}>
      {(w, { mostrar, esconder }) => {
        const maior = max([...SEMANAS.map((s) => atual.get(s) ?? 0), ...faixa.map((r) => r.maximo)]) || 1;
        const y = scaleLinear([0, maior * 1.05], [altura - 22, 8]).nice(4);
        const ticks = y.ticks(4).filter(Number.isInteger);
        const ml = medirTexto(ticks.map((t) => F0(t))) + 10;
        const x = scaleBand(SEMANAS, [ml, w - 4]).padding(0.2);
        const meio = (s: number) => x(s)! + x.bandwidth() / 2;
        const passo = x.bandwidth() > 12 ? 4 : 8;
        const faixaMax = area<number>().x(meio).y0(y(0)).y1((s) => y(porSemana.get(s)?.maximo ?? 0)).curve(curveStep);
        const mediana = line<number>().x(meio).y((s) => y(porSemana.get(s)?.mediana ?? 0)).curve(curveStep);
        return (
          <svg width="100%" height={altura} viewBox={`0 0 ${w} ${altura}`} onMouseLeave={esconder}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={ml} x2={w} y1={y(t)} y2={y(t)} style={{ stroke: COR.grade }} />
                <text x={ml - 6} y={y(t) + 4} textAnchor="end">
                  {F0(t)}
                </text>
              </g>
            ))}
            {SEMANAS.filter((s) => s === 1 || s % passo === 0).map((s) => (
              <text key={s} x={meio(s)} y={altura - 4} textAnchor="middle">
                {s}
              </text>
            ))}
            <path d={faixaMax(SEMANAS) ?? undefined} opacity={0.35} style={{ fill: COR.apagada }} />
            <path d={mediana(SEMANAS) ?? undefined} fill="none" strokeWidth={1.5} strokeDasharray="4 3" style={{ stroke: COR.referencia }} />
            {SEMANAS.map((s) => {
              const n = atual.get(s) ?? 0;
              const ref = porSemana.get(s);
              const acima = ref != null && n > ref.maximo;
              return (
                <g key={s}>
                  {n > 0 && (
                    <rect
                      x={x(s)}
                      y={y(n)}
                      width={x.bandwidth()}
                      height={Math.max(1, y(0) - y(n))}
                      rx={Math.min(3, x.bandwidth() / 2)}
                      style={{ fill: acima ? COR.critica : COR.destaque }}
                    />
                  )}
                  <rect
                    x={x(s)}
                    y={0}
                    width={x.bandwidth()}
                    height={altura - 22}
                    fill="transparent"
                    onMouseMove={(e) =>
                      mostrar(e, `Semana ${s}`, [
                        { cor: acima ? COR.critica : COR.destaque, texto: `Casos: ${F0(n)}` },
                        { texto: `Anos anteriores: mediana ${F1(ref?.mediana ?? 0)}, máximo ${F0(ref?.maximo ?? 0)}` },
                      ])
                    }
                  />
                </g>
              );
            })}
          </svg>
        );
      }}
    </Grafico>
  );
}
