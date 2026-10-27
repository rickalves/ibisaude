"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { Unidade } from "@/lib/tipos";

interface Filtros {
  unidades: Unidade[];
  anos: number[];
  unidade: string;
  setUnidade: (u: string) => void;
  ano: number;
  setAno: (a: number) => void;
}

const Contexto = createContext<Filtros | null>(null);

/** Município e ano escolhidos valem para todas as páginas durante a visita. */
export function ProvedorFiltros({ unidades, anos, children }: { unidades: Unidade[]; anos: number[]; children: ReactNode }) {
  const [unidade, setUnidade] = useState("IBIAPABA");
  const [ano, setAno] = useState(anos[anos.length - 1]);
  return (
    <Contexto.Provider value={{ unidades, anos, unidade, setUnidade, ano, setAno }}>{children}</Contexto.Provider>
  );
}

export function useFiltros() {
  const c = useContext(Contexto);
  if (!c) throw new Error("useFiltros fora de ProvedorFiltros");
  return c;
}

export const nomeUnidade = (unidades: Unidade[], codigo: string) =>
  codigo === "CE" ? "Ceará" : (unidades.find((u) => u.codigo === codigo)?.nome ?? codigo);

/**
 * Seletores de município e ano. Na ficha, o município vem da URL (`fixa`) e trocar navega para a outra ficha.
 */
export function BarraFiltros({ fixa, semAno, children }: { fixa?: string; semAno?: boolean; children?: ReactNode }) {
  const { unidades, anos, unidade, setUnidade, ano, setAno } = useFiltros();
  const router = useRouter();
  const atual = fixa ?? unidade;
  return (
    <div className="filtros">
      <label className="campo">
        Município
        <select
          id="filtro-unidade"
          value={atual}
          onChange={(e) => {
            setUnidade(e.target.value);
            if (fixa) router.push(`/municipio/${unidades.find((u) => u.codigo === e.target.value)!.slug}/`);
          }}
        >
          {unidades.map((u) => (
            <option key={u.codigo} value={u.codigo}>
              {u.codigo === "IBIAPABA" ? `${u.nome} (8 municípios)` : u.nome}
            </option>
          ))}
        </select>
      </label>
      {!semAno && (
        <label className="campo">
          Ano de referência
          <select id="filtro-ano" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {[...anos].reverse().map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
      )}
      {children}
    </div>
  );
}

const PAGINAS = [
  { href: "/", nome: "Início" },
  { href: "/municipio/", nome: "Ficha do município" },
  { href: "/materno-infantil/", nome: "Materno-infantil" },
  { href: "/arboviroses/", nome: "Arboviroses" },
  { href: "/metodologia/", nome: "Metodologia" },
  { href: "/baixar/", nome: "Baixar dados" },
];

export function Navegacao() {
  const caminho = usePathname();
  const { unidades, unidade } = useFiltros();
  const slugAtual = unidades.find((u) => u.codigo === unidade)?.slug ?? "serra-da-ibiapaba";
  return (
    <nav className="abas" aria-label="Seções do observatório">
      {PAGINAS.map((p) => {
        const href = p.href === "/municipio/" ? `/municipio/${slugAtual}/` : p.href;
        const ativo = p.href === "/" ? caminho === "/" : caminho.startsWith(p.href.replace(/\/$/, ""));
        return (
          <Link key={p.href} href={href} className="aba" aria-current={ativo ? "page" : undefined}>
            {p.nome}
          </Link>
        );
      })}
    </nav>
  );
}
