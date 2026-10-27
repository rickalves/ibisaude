"use client";

import { line, max, scaleLinear, scalePoint } from "d3";
import { useState } from "react";
import { COR, Grafico, medirTexto } from "./base";

export interface Serie {
  nome: string;
  cor: string;
  tracejada?: boolean;
  pontos: { x: number; y: number | null; nota?: string }[];
}

/** Séries anuais em linha reta ponto a ponto; anos >= anoParcial ficam com marcador vazado e asterisco. */
export function Linhas({
  series,
  formatar,
  anoParcial,
  altura = 200,
  rotulo,
}: {
  series: Serie[];
  formatar: (v: number | null) => string;
  anoParcial: number;
  altura?: number;
  rotulo: string;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const anos = [...new Set(series.flatMap((s) => s.pontos.map((p) => p.x)))].sort((a, b) => a - b);
  const ys = series.flatMap((s) => s.pontos.map((p) => p.y)).filter((v): v is number => v != null);
  if (!anos.length || !ys.length) return <p className="nota">Sem dados para esta combinação.</p>;

  return (
    <Grafico altura={altura} rotulo={rotulo}>
      {(w, { mostrar, esconder }) => {
        const y = scaleLinear([0, (max(ys) ?? 1) * 1.08 || 1], [altura - 22, 8]).nice(4);
        const ticks = y.ticks(4);
        const ml = medirTexto(ticks.map(formatar)) + 10;
        const x = scalePoint(anos, [ml + 8, w - 12]);
        const passo = Math.ceil(anos.length / Math.max(1, Math.floor((w - ml) / 44)));
        const tracar = line<{ x: number; y: number | null }>()
          .defined((p) => p.y != null)
          .x((p) => x(p.x)!)
          .y((p) => y(p.y!));
        return (
          <svg
            width="100%"
            height={altura}
            viewBox={`0 0 ${w} ${altura}`}
            onMouseLeave={() => {
              setAtivo(null);
              esconder();
            }}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={ml} x2={w} y1={y(t)} y2={y(t)} style={{ stroke: COR.grade }} />
                <text x={ml - 6} y={y(t) + 4} textAnchor="end">
                  {formatar(t)}
                </text>
              </g>
            ))}
            {anos.map((a, k) =>
              k % passo && k !== anos.length - 1 ? null : (
                <text key={a} x={x(a)} y={altura - 4} textAnchor="middle">
                  {a >= anoParcial ? `${a}*` : a}
                </text>
              ),
            )}
            {ativo != null && <line x1={x(ativo)} x2={x(ativo)} y1={8} y2={altura - 22} style={{ stroke: COR.eixo }} />}
            {series.map((s) => (
              <g key={s.nome}>
                <path
                  d={tracar(s.pontos) ?? undefined}
                  fill="none"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={s.tracejada ? "5 4" : undefined}
                  style={{ stroke: s.cor }}
                />
                {s.pontos.map((p) =>
                  p.y == null ? null : (
                    <circle
                      key={p.x}
                      cx={x(p.x)}
                      cy={y(p.y)}
                      r={s.tracejada ? 2 : 3}
                      strokeWidth={1.5}
                      style={{ stroke: s.cor, fill: p.x >= anoParcial ? "var(--painel)" : s.cor }}
                    />
                  ),
                )}
              </g>
            ))}
            <rect
              x={ml}
              y={0}
              width={Math.max(0, w - ml)}
              height={altura}
              fill="transparent"
              onMouseMove={(e) => {
                const px = e.clientX - e.currentTarget.ownerSVGElement!.getBoundingClientRect().left;
                const a = anos.reduce((b, c) => (Math.abs(x(c)! - px) < Math.abs(x(b)! - px) ? c : b), anos[0]);
                setAtivo(a);
                mostrar(
                  e,
                  a >= anoParcial ? `${a} (parcial)` : String(a),
                  series.map((s) => {
                    const p = s.pontos.find((q) => q.x === a);
                    return { cor: s.cor, texto: `${s.nome}: ${formatar(p?.y ?? null)}${p?.nota ? ` · ${p.nota}` : ""}` };
                  }),
                );
              }}
            />
          </svg>
        );
      }}
    </Grafico>
  );
}
