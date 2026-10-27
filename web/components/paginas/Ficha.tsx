"use client";

import { rollup, sum } from "d3";
import { useEffect, useMemo, useState } from "react";
import { BarrasH } from "@/components/graficos/BarrasH";
import { COR, Legenda } from "@/components/graficos/base";
import { Empilhado } from "@/components/graficos/Empilhado";
import { Linhas } from "@/components/graficos/Linhas";
import { BotaoBaixar } from "@/components/BotaoBaixar";
import { Cartao } from "@/components/Cartao";
import { BarraFiltros, useFiltros } from "@/components/Filtros";
import { SeletorIndicador } from "@/components/SeletorIndicador";
import { F0, F1, formatar, formatarVariacao, tom } from "@/lib/formato";
import { criarIndice } from "@/lib/indice";
import { tabelaSeries } from "@/lib/planilha";
import { seriesPara } from "@/lib/series";
import type { Definicao, LinhaCausa, LinhaDestino, LinhaFicha, Ponto, Unidade } from "@/lib/tipos";

const EIXOS = ["Demografia", "Materno-infantil", "Mortalidade", "Internações", "Arboviroses"];
const DESTINOS = ["Próprio município", "Outro município da serra", "Sobral", "Fortaleza", "Outros municípios do CE"];

export function Ficha({
  unidade,
  pontos,
  definicoes,
  ficha,
  causasObito,
  causasInternacao,
  destino,
  anoParcial,
  temCeara,
}: {
  unidade: Unidade;
  pontos: Ponto[];
  definicoes: Definicao[];
  ficha: LinhaFicha[];
  causasObito: LinhaCausa[];
  causasInternacao: LinhaCausa[];
  destino: LinhaDestino[];
  anoParcial: number;
  temCeara: boolean;
}) {
  const { anos, ano, setUnidade } = useFiltros();
  const [indicador, setIndicador] = useState("tmi");
  const u = unidade.codigo;
  useEffect(() => setUnidade(u), [u, setUnidade]);
  const ix = useMemo(() => criarIndice(pontos, definicoes), [pontos, definicoes]);
  const d = ix.def(indicador);
  const ehArbo = indicador.startsWith("dengue") || indicador.startsWith("chik");
  const anosSerie = ehArbo ? [...anos, anoParcial] : anos;
  const series = seriesPara(ix, indicador, u, unidade.nome, anosSerie, temCeara);
  const pop = ix.valor(u, ano, "populacao");

  // destino das internações (na serra, juntar "próprio município" e "outro da serra")
  const serra = u === "IBIAPABA";
  const categorias = serra ? ["Na própria serra", "Sobral", "Fortaleza", "Outros municípios do CE"] : DESTINOS;
  const cores = serra
    ? [COR.destaque, COR.serie3, COR.serie4, COR.apagada]
    : [COR.destaque, COR.serie2, COR.serie3, COR.serie4, COR.apagada];
  const juntar = (x: string) => (serra && (x === "Próprio município" || x === "Outro município da serra") ? "Na própria serra" : x);
  const porAno = rollup(
    destino,
    (v) => rollup(v, (w) => sum(w, (r) => r.internacoes), (r) => juntar(r.destino)),
    (r) => r.ano,
  );
  const linhasDestino = [...porAno.keys()].sort((a, b) => b - a).map((a) => ({ ano: a, partes: porAno.get(a)! }));

  const causas = (linhas: LinhaCausa[], campo: "obitos" | "internacoes", rotulo: string) => {
    const doAno = linhas.filter((r) => r.ano === ano).map((r) => ({ grupo: r.grupo, n: r[campo] ?? 0 }));
    const total = sum(doAno, (r) => r.n);
    return doAno
      .sort((a, b) => b.n - a.n)
      .slice(0, 8)
      .map((r) => ({ chave: r.grupo, rotulo: r.grupo, valor: r.n, nota: `${F1((r.n / total) * 100)}% dos ${rotulo}` }));
  };

  const tabela = ficha
    .filter((r) => r.ano === ano)
    .sort((a, b) => EIXOS.indexOf(a.eixo) - EIXOS.indexOf(b.eixo));

  // planilhas: cada cartão baixa a série completa da unidade, não só o ano na tela
  const tendencia = tabelaSeries(series);
  const historico = () =>
    [...ficha]
      .sort((a, b) => a.ano - b.ano || EIXOS.indexOf(a.eixo) - EIXOS.indexOf(b.eixo))
      .map((r) => [
        r.ano, r.eixo, r.nome, ix.def(r.indicador).unidade_medida, r.valor, r.anterior, r.variacao,
        ...(serra ? [] : [r.ibiapaba]), ...(temCeara ? [r.ceara] : []),
      ]);
  const causasTodas = (linhas: LinhaCausa[], campo: "obitos" | "internacoes") => () =>
    [...linhas].sort((a, b) => a.ano - b.ano || (b[campo] ?? 0) - (a[campo] ?? 0)).map((r) => [r.ano, r.grupo, r[campo]]);

  return (
    <div className="pagina">
      <header className="cabecalho-pagina">
        <h1 className="titulo-pagina">{unidade.nome}</h1>
        {pop != null && <p className="nota">{F0(pop)} habitantes em {ano} (IBGE)</p>}
      </header>

      <BarraFiltros fixa={u}>
        <SeletorIndicador definicoes={definicoes} valor={indicador} aoMudar={setIndicador} />
      </BarraFiltros>

      <div className="grade">
        <Cartao
          id="tendencia"
          titulo={`${d.nome} (${d.unidade_medida})`}
          nota={d.nota || undefined}
          acao={<BotaoBaixar arquivo={`${d.nome} ${unidade.nome}`} colunas={tendencia.colunas} linhas={tendencia.linhas} />}
        >
          <Legenda itens={series.map((s) => ({ nome: s.nome, cor: s.cor, tracejada: s.tracejada }))} />
          <Linhas series={series} formatar={(v) => formatar(v, d.unidade_medida)} anoParcial={anoParcial} rotulo={d.nome} />
        </Cartao>
        <Cartao
          id="destino"
          titulo="Onde os moradores se internam"
          nota="Internações SUS de residentes, pelo município do hospital."
          acao={
            <BotaoBaixar
              arquivo={`local de internacao ${unidade.nome}`}
              colunas={["Ano", "Local do hospital", "Internações"]}
              linhas={() => [...destino].sort((a, b) => a.ano - b.ano).map((r) => [r.ano, r.destino, r.internacoes])}
            />
          }
        >
          <Legenda itens={categorias.map((nome, k) => ({ nome, cor: cores[k] }))} />
          <Empilhado
            linhas={linhasDestino}
            categorias={categorias}
            cores={cores}
            anoParcial={anoParcial}
            rotulo="Distribuição das internações por local do hospital"
          />
        </Cartao>
        <Cartao
          id="causas-obito"
          titulo={`Principais causas de óbito · ${ano}`}
          nota="Grupos de causa básica (capítulos da CID-10)."
          acao={
            <BotaoBaixar
              arquivo={`causas de obito ${unidade.nome}`}
              colunas={["Ano", "Grupo de causa", "Óbitos"]}
              linhas={causasTodas(causasObito, "obitos")}
              rotulo="Baixar (todos os anos)"
            />
          }
        >
          <BarrasH itens={causas(causasObito, "obitos", "óbitos")} formatar={(v) => F0(v ?? 0)} rotulo="Óbitos por grupo de causa" />
        </Cartao>
        <Cartao
          id="causas-internacao"
          titulo={`Principais causas de internação · ${ano}`}
          nota="Grupos do diagnóstico principal (capítulos da CID-10)."
          acao={
            <BotaoBaixar
              arquivo={`causas de internacao ${unidade.nome}`}
              colunas={["Ano", "Grupo de causa", "Internações"]}
              linhas={causasTodas(causasInternacao, "internacoes")}
              rotulo="Baixar (todos os anos)"
            />
          }
        >
          <BarrasH
            itens={causas(causasInternacao, "internacoes", "internações")}
            formatar={(v) => F0(v ?? 0)}
            rotulo="Internações por grupo de causa"
          />
        </Cartao>
      </div>

      <Cartao
        id="todos-indicadores"
        titulo={`Todos os indicadores · ${ano}`}
        nota="Variação em relação ao ano anterior: verde quando melhora, vermelho quando piora."
        acao={
          <BotaoBaixar
            arquivo={`indicadores ${unidade.nome}`}
            colunas={[
              "Ano", "Eixo", "Indicador", "Unidade de medida", "Valor", "Ano anterior", "Variação",
              ...(serra ? [] : ["Serra da Ibiapaba"]), ...(temCeara ? ["Ceará"] : []),
            ]}
            linhas={historico}
            rotulo="Baixar planilha (todos os anos)"
          />
        }
      >
        <div className="tabela-rolagem">
          <table>
            <thead>
              <tr>
                <th>Eixo</th>
                <th>Indicador</th>
                <th className="num">Valor</th>
                <th className="num">Ano anterior</th>
                <th className="num">Variação</th>
                {!serra && <th className="num">Serra</th>}
                {temCeara && <th className="num">Ceará</th>}
              </tr>
            </thead>
            <tbody>
              {tabela.map((r) => {
                const um = ix.def(r.indicador).unidade_medida;
                return (
                  <tr key={r.id}>
                    <td>{r.eixo}</td>
                    <td>{r.nome}</td>
                    <td className="num">{formatar(r.valor, um)}</td>
                    <td className="num">{formatar(r.anterior, um)}</td>
                    <td className={`num ${tom(r.variacao, ix.def(r.indicador).melhor)}`}>{formatarVariacao(r.variacao, um)}</td>
                    {!serra && <td className="num">{formatar(r.ibiapaba, um)}</td>}
                    {temCeara && <td className="num">{formatar(r.ceara, um)}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Cartao>
    </div>
  );
}
