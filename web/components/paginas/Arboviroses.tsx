"use client";

import { useMemo, useState } from "react";
import { COR, Legenda } from "@/components/graficos/base";
import { Linhas } from "@/components/graficos/Linhas";
import { Semanal } from "@/components/graficos/Semanal";
import { BotaoBaixar } from "@/components/BotaoBaixar";
import { Cartao, Selo } from "@/components/Cartao";
import { BarraFiltros, nomeUnidade, useFiltros } from "@/components/Filtros";
import { COLUNAS_ARBO } from "@/lib/constantes";
import { formatar } from "@/lib/formato";
import { criarIndice } from "@/lib/indice";
import { tabelaSeries } from "@/lib/planilha";
import { seriesPara } from "@/lib/series";
import type { Definicao, FaixaSemanal, LinhaPivot, LinhaSemanal, Ponto } from "@/lib/tipos";

const CABECALHOS = ["Dengue", "Por 100 mil", "Graves", "Óbitos", "Chikungunya"];

function situacao(inc: number | null) {
  if (inc == null) return null;
  if (inc >= 300) return { nome: "Epidemia", cor: COR.critica };
  if (inc >= 100) return { nome: "Média", cor: "var(--alerta)" };
  return { nome: "Baixa", cor: COR.apagada };
}

export function Arboviroses({
  pontos,
  definicoes,
  semanal,
  faixa,
  anosHistoricos,
  tabela,
  anoParcial,
  anoArbo,
  temCeara,
}: {
  pontos: Ponto[];
  definicoes: Definicao[];
  semanal: LinhaSemanal[];
  faixa: FaixaSemanal[];
  anosHistoricos: number[];
  tabela: LinhaPivot[];
  anoParcial: number;
  anoArbo: number;
  temCeara: boolean;
}) {
  const { unidades, unidade: u, anos } = useFiltros();
  const [agravo, setAgravo] = useState<"dengue" | "chik">("dengue");
  const ix = useMemo(() => criarIndice(pontos, definicoes), [pontos, definicoes]);
  const nome = nomeUnidade(unidades, u);
  const nomeAgravo = agravo === "dengue" ? "Dengue" : "Chikungunya";
  const anoSemanal = Math.max(...semanal.map((r) => r.ano));
  const atual = new Map(
    semanal.filter((r) => r.unidade === u && r.agravo === agravo && r.ano === anoSemanal).map((r) => [r.semana, r.casos]),
  );
  const faixaU = faixa.filter((r) => r.unidade === u && r.agravo === agravo);
  const iInc = agravo === "dengue" ? "dengue_incidencia" : "chik_incidencia";
  const series = seriesPara(ix, iInc, u, nome, [...anos, anoParcial], temCeara);
  const ate = (a: number) => (a >= anoParcial ? " (até agora)" : "");
  const incidencia = tabelaSeries(series);
  const ordem = (r: LinhaPivot) => (r.unidade === "CE" ? 2 : r.unidade === "IBIAPABA" ? 1 : 0);
  const linhas = [...tabela].sort(
    (a, b) => ordem(a) - ordem(b) || Number(b.dengue_incidencia ?? 0) - Number(a.dengue_incidencia ?? 0),
  );

  return (
    <div className="pagina">
      <header className="cabecalho-pagina">
        <h1 className="titulo-pagina">Arboviroses</h1>
        <p className="nota">
          Dengue e chikungunya por município de residência. Casos prováveis são as notificações menos as descartadas.
        </p>
      </header>

      <BarraFiltros semAno>
        <label className="campo">
          Doença
          <select id="filtro-agravo" value={agravo} onChange={(e) => setAgravo(e.target.value as "dengue" | "chik")}>
            <option value="dengue">Dengue</option>
            <option value="chik">Chikungunya</option>
          </select>
        </label>
      </BarraFiltros>

      <Cartao
        id="semanal"
        titulo={`${nomeAgravo} por semana em ${anoSemanal}${ate(anoSemanal)} · ${nome}`}
        nota="Casos prováveis por semana de início dos sintomas. A faixa cinza é o máximo dos anos anteriores e a linha tracejada, a mediana. Barras em vermelho passaram do máximo histórico."
        acao={
          <BotaoBaixar
            arquivo={`${nomeAgravo} por semana ${nome}`}
            colunas={["Ano", "Semana epidemiológica", "Casos prováveis"]}
            linhas={() =>
              semanal
                .filter((r) => r.unidade === u && r.agravo === agravo)
                .sort((a, b) => a.ano - b.ano || a.semana - b.semana)
                .map((r) => [r.ano, r.semana, r.casos])
            }
            rotulo="Baixar (todos os anos)"
          />
        }
      >
        <Legenda
          itens={[
            { nome: `Casos em ${anoSemanal}`, cor: COR.destaque },
            { nome: `Máximo de ${anosHistoricos[0]} a ${anosHistoricos[anosHistoricos.length - 1]}`, cor: COR.apagada },
            { nome: "Mediana", cor: COR.referencia, tracejada: true },
          ]}
        />
        <Semanal atual={atual} faixa={faixaU} rotulo={`${nomeAgravo} por semana epidemiológica`} />
      </Cartao>

      <>
        <Cartao
          id="incidencia-anual"
          titulo={`Incidência de ${nomeAgravo.toLowerCase()} por ano`}
          nota="Casos prováveis por 100 mil habitantes."
          acao={<BotaoBaixar arquivo={`incidencia ${nomeAgravo} ${nome}`} colunas={incidencia.colunas} linhas={incidencia.linhas} />}
        >
          <Legenda itens={series.map((s) => ({ nome: s.nome, cor: s.cor, tracejada: s.tracejada }))} />
          <Linhas series={series} formatar={(v) => formatar(v, "por ")} anoParcial={anoParcial} rotulo={`Incidência de ${nomeAgravo}`} />
        </Cartao>

        <Cartao
          id="situacao-municipios"
          titulo={`Situação por município em ${anoArbo}${ate(anoArbo)}`}
          nota="Situação pela incidência de dengue: baixa (menos de 100), média (100 a 299) ou epidemia (300 ou mais por 100 mil)."
          acao={
            <BotaoBaixar
              arquivo={`arboviroses municipios ${anoArbo}`}
              colunas={["Município", ...CABECALHOS, "Situação"]}
              linhas={() =>
                linhas.map((r) => [
                  r.nome,
                  ...COLUNAS_ARBO.map((c) => r[c] as number | null),
                  situacao(r.dengue_incidencia as number | null)?.nome,
                ])
              }
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
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((r) => {
                  const s = situacao(r.dengue_incidencia as number | null);
                  return (
                    <tr key={r.unidade} className={r.unidade === u ? "destacada" : undefined}>
                      <td>{r.nome}</td>
                      {COLUNAS_ARBO.map((c) => (
                        <td key={c} className="num">
                          {formatar(r[c] as number | null, ix.def(c).unidade_medida)}
                        </td>
                      ))}
                      <td>{s && <Selo cor={s.cor}>{s.nome}</Selo>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Cartao>
      </>
    </div>
  );
}
