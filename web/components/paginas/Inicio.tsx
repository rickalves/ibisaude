"use client";

import { useMemo, useState } from "react";
import { BarrasH } from "@/components/graficos/BarrasH";
import { COR } from "@/components/graficos/base";
import { BotaoBaixar } from "@/components/BotaoBaixar";
import { Cartao, Selo } from "@/components/Cartao";
import { BarraFiltros, nomeUnidade, useFiltros } from "@/components/Filtros";
import { SeletorIndicador } from "@/components/SeletorIndicador";
import { formatar, formatarVariacao, tom } from "@/lib/formato";
import { criarIndice, indicadorPara } from "@/lib/indice";
import type { Definicao, LinhaPivot, Ponto } from "@/lib/tipos";

const PRINCIPAIS = ["tmi", "pct_prenatal7", "pct_icsap", "pct_fora_serra", "tx_homicidio", "dengue_incidencia"];

export function Inicio({
  pontos,
  definicoes,
  anoParcial,
  anoArbo,
  temCeara,
  arbo,
}: {
  pontos: Ponto[];
  definicoes: Definicao[];
  anoParcial: number;
  anoArbo: number;
  temCeara: boolean;
  arbo: LinhaPivot[];
}) {
  const { unidades, unidade: u, ano } = useFiltros();
  const [indicador, setIndicador] = useState("tmi");
  const ix = useMemo(() => criarIndice(pontos, definicoes), [pontos, definicoes]);
  const nome = nomeUnidade(unidades, u);
  const iT = indicadorPara("tmi", u);
  const tmi = ix.valor(u, ano, iT);
  const tmiCE = temCeara ? ix.valor("CE", ano, "tmi") : null;
  const dengue = ix.valor(u, anoArbo, "dengue_incidencia");
  const emEpidemia = arbo
    .filter((r) => r.unidade !== "IBIAPABA" && r.unidade !== "CE" && Number(r.dengue_incidencia) >= 300)
    .sort((a, b) => Number(b.dengue_incidencia) - Number(a.dengue_incidencia));

  const d = ix.def(indicador);
  const municipios = unidades.filter((x) => x.codigo !== "IBIAPABA");
  const barras = [...municipios, unidades[0]]
    .map((m) => ({
      chave: m.codigo,
      rotulo: m.nome,
      valor: ix.valor(m.codigo, ano, indicador),
      destaque: m.codigo === u,
      nota: ix.conta(m.codigo, ano, indicador),
    }))
    .sort((a, b) => (b.valor ?? -1) - (a.valor ?? -1));
  const ce = temCeara ? ix.valor("CE", ano, indicador) : null;

  return (
    <div className="pagina">
      <p className="resumo">
        Em {ano}, a mortalidade infantil em {nome} foi de <b>{formatar(tmi, "por ")}</b> por mil nascidos vivos
        {iT.endsWith("_3a") && " (média de 3 anos)"}
        {tmiCE != null && (
          <>
            ; no Ceará, <b>{formatar(tmiCE, "por ")}</b>
          </>
        )}
        .{" "}
        {dengue != null && (
          <>
            Dengue em {anoArbo}
            {anoArbo >= anoParcial && ", até agora"}: <b>{formatar(dengue, "por ")}</b> casos prováveis por 100 mil
            habitantes{dengue >= 300 ? ", acima do limiar de epidemia." : "."}
          </>
        )}
      </p>

      <BarraFiltros>
        <SeletorIndicador definicoes={definicoes} valor={indicador} aoMudar={setIndicador} />
      </BarraFiltros>

      <div className="kpis">
        {PRINCIPAIS.map((base) => {
          const i = indicadorPara(base, u);
          const a = base.startsWith("dengue") ? anoArbo : ano;
          const v = ix.valor(u, a, i);
          const ant = ix.valor(u, a - 1, i);
          const def = ix.def(i);
          const variacao = v != null && ant != null ? v - ant : null;
          const vCE = temCeara ? ix.valor("CE", a, base) : null;
          return (
            <div className="kpi" key={base} id={`kpi-${base}`}>
              <div className="kpi-rotulo">
                {def.nome} · {a}
                {a >= anoParcial && " (parcial)"}
              </div>
              <div className="kpi-valor">{formatar(v, def.unidade_medida)}</div>
              <div className="kpi-unidade">{def.unidade_medida}</div>
              <div className="kpi-rodape">
                {variacao != null && (
                  <span className={tom(variacao, def.melhor)}>
                    {formatarVariacao(variacao, def.unidade_medida)} vs {a - 1}
                  </span>
                )}
                {vCE != null && <span>Ceará {formatar(vCE, def.unidade_medida)}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <Cartao
        id="alerta-dengue"
        titulo={`Municípios acima do limiar de epidemia de dengue em ${anoArbo}${anoArbo >= anoParcial ? " (até agora)" : ""}`}
        nota="Incidência de casos prováveis. O Ministério da Saúde considera epidemia acima de 300 casos por 100 mil habitantes."
      >
        <div className="selos">
          {emEpidemia.length ? (
            emEpidemia.map((r) => (
              <Selo key={r.unidade} cor={COR.critica}>
                {r.nome} · {formatar(Number(r.dengue_incidencia), "por ")} por 100 mil
              </Selo>
            ))
          ) : (
            <span className="nota">Nenhum município acima de 300 casos por 100 mil habitantes.</span>
          )}
        </div>
      </Cartao>

      <Cartao
        id="comparacao"
        titulo={`${d.nome}, ${ano}: comparação entre os municípios`}
        nota={`${d.unidade_medida}. ${d.nota}`.trim()}
        acao={
          <BotaoBaixar
            arquivo={`${d.nome} municipios ${ano}`}
            colunas={["Município", `${d.nome} (${d.unidade_medida})`, "Numerador", "Denominador"]}
            linhas={() =>
              [...barras.map((b) => ({ codigo: b.chave, nome: b.rotulo })), ...(temCeara ? [{ codigo: "CE", nome: "Ceará" }] : [])].map(
                (m) => {
                  const p = pontos.find((x) => x[0] === m.codigo && x[1] === ano && x[2] === indicador);
                  return [m.nome, p?.[3], p?.[4], p?.[5]];
                },
              )
            }
          />
        }
      >
        <BarrasH
          itens={barras}
          formatar={(v) => formatar(v, d.unidade_medida)}
          referencia={ce != null ? { valor: ce, rotulo: `Ceará ${formatar(ce, d.unidade_medida)}` } : null}
          rotulo={`${d.nome} por município em ${ano}`}
        />
      </Cartao>
    </div>
  );
}
