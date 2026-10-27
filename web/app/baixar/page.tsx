import { statSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { Cartao } from "@/components/Cartao";
import { meta } from "@/lib/dados";

export const metadata: Metadata = { title: "Baixar dados · Observatório de Saúde da Ibiapaba" };

const XLSX = "planilhas/observatorio-saude-ibiapaba.xlsx";

const PLANILHAS = [
  { arquivo: "planilhas/indicadores.csv", nome: "Indicadores", descricao: "Uma linha por município e ano, uma coluna por indicador. O jeito mais rápido de comparar." },
  { arquivo: "planilhas/indicadores-detalhado.csv", nome: "Indicadores (detalhe)", descricao: "Uma linha por município, ano e indicador, com o numerador e o denominador de cada taxa." },
  { arquivo: "planilhas/definicoes.csv", nome: "Definições", descricao: "O que cada indicador mede, de onde vem e como é calculado." },
  { arquivo: "planilhas/causas-de-obito.csv", nome: "Causas de óbito", descricao: "Óbitos de residentes por grupo de causa (capítulo da CID-10)." },
  { arquivo: "planilhas/causas-de-internacao.csv", nome: "Causas de internação", descricao: "Internações SUS de residentes por grupo do diagnóstico principal." },
  { arquivo: "planilhas/local-de-internacao.csv", nome: "Local de internação", descricao: "Internações de residentes pelo município do hospital." },
  { arquivo: "planilhas/arboviroses-por-semana.csv", nome: "Arboviroses por semana", descricao: "Casos prováveis de dengue e chikungunya por semana epidemiológica." },
];

const BRUTOS = [
  { arquivo: "indicadores.csv", descricao: "Indicadores em formato longo (separador vírgula, ponto decimal)" },
  { arquivo: "anual.json", descricao: "A mesma tabela em JSON" },
  { arquivo: "ficha.json", descricao: "Cada indicador com o ano anterior, a variação e os valores da serra e do Ceará" },
  { arquivo: "indicadores.json", descricao: "Definição de cada indicador" },
  { arquivo: "semanal.json", descricao: "Arboviroses por semana epidemiológica" },
  { arquivo: "causas_obito.json", descricao: "Óbitos por grupo de causa" },
  { arquivo: "causas_internacao.json", descricao: "Internações por grupo de causa" },
  { arquivo: "destino_internacao.json", descricao: "Internações pelo local do hospital" },
  { arquivo: "meta.json", descricao: "Data de processamento, ano parcial e arquivos preliminares" },
];

/** Tamanho lido no build, direto de public/dados. */
function tamanho(arquivo: string) {
  const kb = statSync(path.join(process.cwd(), "public", "dados", arquivo)).size / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(kb))} kB`;
}

export default function Pagina() {
  return (
    <div className="pagina">
      <header className="cabecalho-pagina">
        <h1 className="titulo-pagina">Baixar dados</h1>
        <p className="nota">
          Tudo o que aparece no observatório, em planilhas. Podem ser usadas livremente, citando a fonte (DATASUS e IBGE,
          processados pelo Observatório de Saúde da Serra da Ibiapaba). Dados processados em{" "}
          {new Date(meta.gerado_em).toLocaleDateString("pt-BR")}.
        </p>
      </header>

      <Cartao
        id="planilha-completa"
        titulo="Planilha completa (Excel)"
        nota="Um arquivo com uma aba para cada tabela abaixo e uma aba “Leia-me” explicando as fontes e os cuidados na leitura."
      >
        <p>
          <a className="botao-arquivo principal" href={`/dados/${XLSX}`} download>
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path d="M8 2v8m0 0L4.5 6.5M8 10l3.5-3.5M2.5 13.5h11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Baixar observatorio-saude-ibiapaba.xlsx
            <span className="tamanho">· {tamanho(XLSX)}</span>
          </a>
        </p>
      </Cartao>

      <Cartao
        id="planilhas"
        titulo="Planilhas separadas (CSV)"
        nota="Abrem direto no Excel ou no LibreOffice, com acentos e vírgula decimal. Todas cobrem os 8 municípios, a serra e o Ceará, de 2019 até hoje."
      >
        <ul className="lista-arquivos">
          {PLANILHAS.map((p) => (
            <li key={p.arquivo}>
              <a href={`/dados/${p.arquivo}`} download>
                {p.nome} <span className="tamanho">· CSV, {tamanho(p.arquivo)}</span>
              </a>
              <span className="nota">{p.descricao}</span>
            </li>
          ))}
        </ul>
      </Cartao>

      <Cartao id="por-pagina" titulo="Só o que está na tela">
        <div className="texto">
          <p>
            Cada gráfico e tabela do observatório tem um botão <b>Baixar planilha</b> no canto. Ele baixa os números
            daquele cartão para o município e o ano escolhidos. Na{" "}
            <Link href="/municipio/serra-da-ibiapaba/">ficha de cada município</Link>, o botão da tabela de indicadores
            traz todos os anos de uma vez.
          </p>
        </div>
      </Cartao>

      <Cartao
        id="brutos"
        titulo="Para programadores"
        nota="Os arquivos que o site lê, nos formatos originais. As definições de cada campo estão no repositório do projeto (docs/dicionario-de-dados.md)."
      >
        <ul className="lista-arquivos">
          {BRUTOS.map((a) => (
            <li key={a.arquivo}>
              <a href={`/dados/${a.arquivo}`} download>
                {a.arquivo} <span className="tamanho">· {tamanho(a.arquivo)}</span>
              </a>
              <span className="nota">{a.descricao}</span>
            </li>
          ))}
        </ul>
      </Cartao>
    </div>
  );
}
