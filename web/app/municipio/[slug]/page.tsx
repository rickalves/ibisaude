import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Ficha } from "@/components/paginas/Ficha";
import {
  causasInternacao, causasObito, definicoes, destino, ficha, meta, pontos, unidadePorSlug, unidades,
} from "@/lib/dados";

export const dynamicParams = false;

export function generateStaticParams() {
  return unidades.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata({ params }: PageProps<"/municipio/[slug]">): Promise<Metadata> {
  const u = unidadePorSlug((await params).slug);
  return { title: u ? `${u.nome} · Observatório de Saúde da Ibiapaba` : "Município não encontrado" };
}

export default async function Pagina({ params }: PageProps<"/municipio/[slug]">) {
  const unidade = unidadePorSlug((await params).slug);
  if (!unidade) notFound();
  const u = unidade.codigo;
  return (
    <Ficha
      unidade={unidade}
      pontos={pontos((r) => r.unidade === u || r.unidade === "IBIAPABA" || r.unidade === "CE")}
      definicoes={definicoes}
      ficha={ficha.filter((r) => r.unidade === u)}
      causasObito={causasObito.filter((r) => r.unidade === u)}
      causasInternacao={causasInternacao.filter((r) => r.unidade === u)}
      destino={destino.filter((r) => r.unidade === u)}
      anoParcial={meta.ano_parcial}
      temCeara={meta.tem_ceara}
    />
  );
}
