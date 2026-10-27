"use client";

import { max, scaleLinear } from "d3";
import { COR, Grafico, medirTexto } from "./base";

export interface ItemBarra {
  chave: string;
  rotulo: string;
  valor: number | null;
  destaque?: boolean;
  nota?: string;
}

const ALTURA_LINHA = 28;

/** Barras horizontais ordenadas, com linha de referência opcional (ex.: valor do Ceará). */
export function BarrasH({
  itens,
  formatar,
  referencia,
  rotulo,
}: {
  itens: ItemBarra[];
  formatar: (v: number | null) => string;
  referencia?: { valor: number; rotulo: string } | null;
  rotulo: string;
}) {
  const topo = referencia ? 22 : 4;
  const altura = topo + itens.length * ALTURA_LINHA + 4;
  return (
    <Grafico altura={altura} rotulo={rotulo}>
      {(w, { mostrar, esconder }) => {
        const lw = Math.min(medirTexto(itens.map((d) => d.rotulo)), w * 0.42) + 10;
        const vw = medirTexto(itens.map((d) => formatar(d.valor))) + 10;
        const maior = max([...itens.map((d) => d.valor ?? 0), referencia?.valor ?? 0]) || 1;
        const x = scaleLinear([0, maior], [lw, Math.max(lw + 40, w - vw)]);
        return (
          <svg width="100%" height={altura} viewBox={`0 0 ${w} ${altura}`}>
            {itens.map((d, k) => {
              const y = topo + k * ALTURA_LINHA;
              return (
                <g key={d.chave} className={d.destaque ? "forte" : undefined}>
                  <text x={lw - 10} y={y + ALTURA_LINHA / 2 + 4} textAnchor="end">
                    {d.rotulo}
                  </text>
                  {d.valor != null && (
                    <rect
                      x={lw}
                      y={y + 7}
                      width={Math.max(2, x(d.valor) - lw)}
                      height={ALTURA_LINHA - 14}
                      rx={4}
                      style={{ fill: d.destaque ? COR.destaque : COR.apagada }}
                    />
                  )}
                  <text x={(d.valor != null ? x(d.valor) : lw) + 6} y={y + ALTURA_LINHA / 2 + 4}>
                    {formatar(d.valor)}
                  </text>
                  <rect
                    x={0}
                    y={y}
                    width={w}
                    height={ALTURA_LINHA}
                    fill="transparent"
                    onMouseMove={(e) => mostrar(e, d.rotulo, [{ texto: formatar(d.valor) }, ...(d.nota ? [{ texto: d.nota }] : [])])}
                    onMouseLeave={esconder}
                  />
                </g>
              );
            })}
            {referencia && (
              <g>
                <line
                  x1={x(referencia.valor)}
                  x2={x(referencia.valor)}
                  y1={topo - 4}
                  y2={altura}
                  strokeDasharray="4 3"
                  style={{ stroke: COR.referencia }}
                />
                <text x={x(referencia.valor)} y={12} textAnchor={x(referencia.valor) > w * 0.7 ? "end" : "middle"}>
                  {referencia.rotulo}
                </text>
              </g>
            )}
          </svg>
        );
      }}
    </Grafico>
  );
}
