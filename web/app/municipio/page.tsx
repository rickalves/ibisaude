import type { Metadata } from "next";
import Link from "next/link";
import { unidades } from "@/lib/dados";

export const metadata: Metadata = { title: "Municípios · Observatório de Saúde da Ibiapaba" };

export default function Pagina() {
  return (
    <div className="pagina">
      <header className="cabecalho-pagina">
        <h1 className="titulo-pagina">Fichas dos municípios</h1>
        <p className="nota">Todos os indicadores de cada município, comparados com a serra e com o Ceará.</p>
      </header>
      <ul className="lista-municipios">
        {unidades.map((u) => (
          <li key={u.codigo}>
            <Link href={`/municipio/${u.slug}/`}>{u.nome}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
