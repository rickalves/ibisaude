"use client";

import { useSyncExternalStore } from "react";

type Tema = "sistema" | "claro" | "escuro";

const CHAVE = "tema";
const EVENTO = "mudou-tema";

/**
 * Roda no <head> antes da página aparecer, para não piscar o tema errado. Sem escolha salva, o atributo fica
 * ausente e o CSS segue o sistema operacional (app/tema.css).
 */
export const SCRIPT_TEMA = `try{var t=localStorage.getItem("${CHAVE}");if(t==="claro"||t==="escuro")document.documentElement.dataset.tema=t}catch(e){}`;

function lerTema(): Tema {
  const t = document.documentElement.dataset.tema;
  return t === "claro" || t === "escuro" ? t : "sistema";
}

function aplicar(tema: Tema) {
  if (tema === "sistema") delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = tema;
  try {
    if (tema === "sistema") localStorage.removeItem(CHAVE);
    else localStorage.setItem(CHAVE, tema);
  } catch {
    // navegação privada ou armazenamento bloqueado: o tema vale só nesta página
  }
  window.dispatchEvent(new Event(EVENTO));
}

function assinar(avisar: () => void) {
  window.addEventListener(EVENTO, avisar);
  return () => window.removeEventListener(EVENTO, avisar);
}

const OPCOES: { tema: Tema; nome: string; icone: React.ReactNode }[] = [
  {
    tema: "sistema",
    nome: "Automático",
    icone: (
      <>
        <rect x="2" y="3" width="12" height="8" rx="1.5" />
        <path d="M6 14h4M8 11v3" />
      </>
    ),
  },
  {
    tema: "claro",
    nome: "Claro",
    icone: (
      <>
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
      </>
    ),
  },
  {
    tema: "escuro",
    nome: "Escuro",
    icone: <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z" />,
  },
];

/** Alterna entre seguir o sistema, modo claro e modo escuro. */
export function SeletorTema() {
  const atual = useSyncExternalStore(assinar, lerTema, () => "sistema" as Tema);
  return (
    <div className="seletor-tema" role="group" aria-label="Tema de cores">
      {OPCOES.map((o) => (
        <button
          key={o.tema}
          type="button"
          aria-pressed={atual === o.tema}
          title={`Tema: ${o.nome.toLowerCase()}`}
          onClick={() => aplicar(o.tema)}
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {o.icone}
            </g>
          </svg>
          <span className="seletor-tema-nome">{o.nome}</span>
        </button>
      ))}
    </div>
  );
}
