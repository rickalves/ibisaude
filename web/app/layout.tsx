import type { Metadata } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import { Navegacao, ProvedorFiltros } from "@/components/Filtros";
import { SCRIPT_TEMA, SeletorTema } from "@/components/SeletorTema";
import { meta, unidades } from "@/lib/dados";
import "./tema.css";
import "./globals.css";

const sans = Source_Sans_3({ variable: "--fonte-texto", subsets: ["latin"] });
const serif = Source_Serif_4({ variable: "--fonte-titulo", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Observatório de Saúde da Serra da Ibiapaba",
  description:
    "Indicadores de saúde dos 8 municípios da Serra da Ibiapaba (CE): mortalidade, nascimentos, internações e arboviroses, com dados públicos do DATASUS.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: SCRIPT_TEMA pode pôr data-tema no <html> antes do React assumir a página
    <html lang="pt-BR" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>
        <ProvedorFiltros unidades={unidades} anos={meta.anos_fechados}>
          <header className="topo">
            <div className="topo-interno">
              <div className="topo-marca">
                <div>
                  <p className="marca-sobre">Serra da Ibiapaba · Ceará</p>
                  <p className="marca">Observatório de Saúde</p>
                </div>
                <SeletorTema />
              </div>
              <Navegacao />
            </div>
          </header>
          <main className="conteudo">{children}</main>
          <footer className="rodape">
            <div className="rodape-interno">
              <p>
                Fontes: DATASUS (SIM, SINASC, SIH, SINAN) e IBGE. Municípios: Carnaubal, Croatá, Guaraciaba do Norte,
                Ibiapina, São Benedito, Tianguá, Ubajara e Viçosa do Ceará.
              </p>
              <p>Dados processados em {new Date(meta.gerado_em).toLocaleDateString("pt-BR")}.</p>
            </div>
          </footer>
        </ProvedorFiltros>
      </body>
    </html>
  );
}
