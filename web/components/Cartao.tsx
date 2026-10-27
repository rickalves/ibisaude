import type { ReactNode } from "react";

export function Cartao({
  titulo,
  nota,
  id,
  acao,
  children,
}: {
  titulo: ReactNode;
  nota?: ReactNode;
  id?: string;
  /** Botão no canto do título, como o de baixar a planilha. */
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="cartao" id={id}>
      {acao ? (
        <div className="cartao-topo">
          <h2 className="cartao-titulo">{titulo}</h2>
          {acao}
        </div>
      ) : (
        <h2 className="cartao-titulo">{titulo}</h2>
      )}
      {nota && <p className="nota">{nota}</p>}
      {children}
    </section>
  );
}

export function Selo({ cor, children }: { cor: string; children: ReactNode }) {
  return (
    <span className="selo">
      <span className="ponto" style={{ background: cor }} />
      {children}
    </span>
  );
}
