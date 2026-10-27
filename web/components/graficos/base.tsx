"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

/** Largura do elemento, atualizada quando a tela muda de tamanho. */
export function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLargura(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, largura] as const;
}

let ctx: CanvasRenderingContext2D | null = null;
/** Largura em pixels do maior texto, na fonte usada pelos rótulos dos gráficos (11px). */
export function medirTexto(textos: string[], px = 11): number {
  if (typeof document === "undefined") return 0;
  ctx ??= document.createElement("canvas").getContext("2d");
  if (!ctx) return textos.reduce((m, t) => Math.max(m, t.length * px * 0.6), 0);
  ctx.font = `${px}px ${getComputedStyle(document.body).fontFamily}`;
  return textos.reduce((m, t) => Math.max(m, ctx!.measureText(t).width), 0);
}

export interface LinhaDica {
  cor?: string;
  texto: string;
}
interface EstadoDica {
  x: number;
  y: number;
  titulo: string;
  linhas: LinhaDica[];
}

/** Dica flutuante posicionada dentro do contêiner do gráfico (`caixa`). */
export function useDica(caixa: RefObject<HTMLDivElement | null>) {
  const [dica, setDica] = useState<EstadoDica | null>(null);
  const mostrar = (e: React.MouseEvent, titulo: string, linhas: LinhaDica[]) => {
    const r = caixa.current?.getBoundingClientRect();
    if (!r) return;
    setDica({ x: e.clientX - r.left, y: e.clientY - r.top, titulo, linhas });
  };
  const esconder = () => setDica(null);
  return { dica, mostrar, esconder };
}

export function Dica({ dica, largura }: { dica: EstadoDica | null; largura: number }) {
  if (!dica) return null;
  const aEsquerda = dica.x > largura * 0.6;
  return (
    <div
      className="dica"
      role="status"
      style={{
        left: aEsquerda ? undefined : dica.x + 12,
        right: aEsquerda ? largura - dica.x + 12 : undefined,
        top: dica.y + 12,
      }}
    >
      <div className="dica-titulo">{dica.titulo}</div>
      {dica.linhas.map((l, k) => (
        <div key={k}>
          {l.cor && <span className="ponto" style={{ background: l.cor }} />}
          {l.texto}
        </div>
      ))}
    </div>
  );
}

export interface ItemLegenda {
  nome: string;
  cor: string;
  tracejada?: boolean;
}

export function Legenda({ itens }: { itens: ItemLegenda[] }) {
  return (
    <div className="legenda">
      {itens.map((s) => (
        <span key={s.nome}>
          <span
            className="amostra"
            style={{
              background: s.tracejada ? `repeating-linear-gradient(90deg, ${s.cor} 0 4px, transparent 4px 7px)` : s.cor,
            }}
          />
          {s.nome}
        </span>
      ))}
    </div>
  );
}

export function Grafico({
  altura,
  children,
  rotulo,
}: {
  altura: number;
  rotulo: string;
  children: (largura: number, dica: ReturnType<typeof useDica>) => ReactNode;
}) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const dica = useDica(ref);
  return (
    <div
      ref={ref}
      className="grafico"
      style={{ minHeight: altura }}
      role="img"
      aria-label={rotulo}
    >
      {largura > 0 && children(largura, dica)}
      <Dica dica={dica.dica} largura={largura} />
    </div>
  );
}

/** Cores das séries: CSS custom properties, para seguir o tema claro/escuro. */
export const COR = {
  destaque: "var(--serie-1)",
  serie2: "var(--serie-2)",
  serie3: "var(--serie-3)",
  serie4: "var(--serie-4)",
  apagada: "var(--apagada)",
  referencia: "var(--referencia)",
  critica: "var(--critica)",
  grade: "var(--grade)",
  eixo: "var(--eixo)",
};
