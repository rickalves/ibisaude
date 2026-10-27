"use client";

import { useMemo } from "react";
import { Legenda } from "@/components/graficos/base";
import { Linhas } from "@/components/graficos/Linhas";
import { BotaoBaixar } from "@/components/BotaoBaixar";
import { Cartao } from "@/components/Cartao";
import { BarraFiltros, nomeUnidade, useFiltros } from "@/components/Filtros";
import { formatar } from "@/lib/formato";
import { criarIndice, indicadorPara } from "@/lib/indice";
import { seriesPara } from "@/lib/series";
import { COLUNAS_MATERNO, GRAFICOS_MATERNO } from "@/lib/constantes";
import type { Definicao, LinhaPivot, Ponto } from "@/lib/tipos";

const CABECALHOS = ["Nascidos vivos", "Mort. infantil (3 anos)", "7+ consultas", "Cesáreas", "Baixo peso", "Mães adolescentes"];

export function Materno({
  pontos,
  definicoes,
  tabela,
  anoParcial,
  temCeara,
}: {
  pontos: Ponto[];
  definicoes: Definicao[];
  tabela: LinhaPivot[];
  anoParcial: number;
  temCeara: boolean;
}) {
  const { unidades, unidade: u, anos, ano } = useFiltros();
  const ix = useMemo(() => criarIndice(pontos, definicoes), [pontos, definicoes]);
  const nome = nomeUnidade(unidades, u);
  const ordem = (r: LinhaPivot) => (r.unidade === "CE" ? 2 : r.unidade === "IBIAPABA" ? 1 : 0);
  const linhas = tabela
    .filter((r) => r.ano === ano)
    .sort((a, b) => ordem(a) - ordem(b) || a.nome.localeCompare(b.nome, "pt"));

  return (
    <div className="pagina">
      <header className="cabecalho-pagina">
        <h1 className="titulo-pagina">Saúde materno-infantil</h1>
        <p className="nota">
          {nome} comparado{u === "IBIAPABA" ? "" : " com a serra e"}
          {temCeara ? " com o Ceará" : ""}, de {anos[0]} a {anos[anos.length - 1]}. Nos municípios, as taxas de
          mortalidade usam média de 3 anos para não oscilar com poucos casos.
        </p>
      </header>

      <BarraFiltros />

      <div className="grade grade-pequena">
        {GRAFICOS_MATERNO.map((base) => {
          const i = indicadorPara(base, u);
          const d = ix.def(i);
          const series = seriesPara(ix, i, u, nome, anos, temCeara);
          return (
            <Cartao key={base} id={`materno-${base}`} titulo={d.nome} nota={d.unidade_medida}>
              <Legenda itens={series.map((s) => ({ nome: s.nome, cor: s.cor, tracejada: s.tracejada }))} />
              <Linhas
                series={series}
                formatar={(v) => formatar(v, d.unidade_medida)}
                anoParcial={anoParcial}
                altura={160}
                rotulo={d.nome}
              />
            </Cartao>
          );
        })}
      </div>

      <Cartao
        id="materno-municipios"
        titulo={`Municípios lado a lado · ${ano}`}
        acao={
          <BotaoBaixar
            arquivo={`materno-infantil municipios ${ano}`}
            colunas={["Município", ...COLUNAS_MATERNO.map((c) => `${ix.def(c).nome} (${ix.def(c).unidade_medida})`)]}
            linhas={() => linhas.map((r) => [r.nome, ...COLUNAS_MATERNO.map((c) => r[c] as number | null)])}
          />
        }
      >
        <div className="tabela-rolagem">
          <table>
            <thead>
              <tr>
                <th>Município</th>
                {CABECALHOS.map((c) => (
                  <th key={c} className="num">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((r) => (
                <tr key={r.unidade} className={r.unidade === u ? "destacada" : undefined}>
                  <td>{r.nome}</td>
                  {COLUNAS_MATERNO.map((c) => (
                    <td key={c} className="num">
                      {formatar(r[c] as number | null, ix.def(c).unidade_medida)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>
    </div>
  );
}
