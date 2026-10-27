import type { Metadata } from "next";
import Link from "next/link";
import { Cartao } from "@/components/Cartao";
import { definicoes, meta } from "@/lib/dados";

export const metadata: Metadata = { title: "Metodologia · Observatório de Saúde da Ibiapaba" };


export default function Pagina() {
  const competencia = `${meta.sih_ultima_competencia.slice(2)}/20${meta.sih_ultima_competencia.slice(0, 2)}`;
  return (
    <div className="pagina">
      <header className="cabecalho-pagina">
        <h1 className="titulo-pagina">Como os números são feitos</h1>
      </header>

      <div className="texto">
        <p>
          Todos os indicadores contam pessoas pelo município onde moram, não onde foram atendidas. Os dados vêm dos
          microdados públicos do DATASUS (SIM, SINASC, SIH e SINAN), baixados e filtrados para os 8 municípios da serra e
          para o Ceará inteiro, que serve de referência. A população é do IBGE.
        </p>
        <ul>
          <li>
            <b>Dados preliminares.</b> {meta.ano_parcial} está incompleto e os anos anteriores ainda podem ser revisados
            pelo Ministério da Saúde. Arquivos preliminares nesta versão: {meta.preliminares.join(", ")}. As internações
            vão até a competência {competencia}.
          </li>
          <li>
            <b>Municípios pequenos.</b> Em Carnaubal ou Croatá, um único óbito infantil muda a taxa em vários pontos. Por
            isso o observatório usa médias de 3 anos para as taxas de mortalidade dos municípios e mostra sempre o total da
            serra.
          </li>
          <li>
            <b>Internações.</b> Contadas pelo mês de competência da AIH no SIH. Internações de moradores do Ceará em
            hospitais de outros estados não entram.
          </li>
          <li>
            <b>Dengue.</b> Casos prováveis são as notificações menos as descartadas, contadas pelo ano em que foram
            notificadas.
          </li>
          <li>
            <b>Privacidade.</b> O site mostra apenas totais agregados; nenhum dado individual é publicado.
          </li>
        </ul>
        <p className="nota">Dados processados em {new Date(meta.gerado_em).toLocaleDateString("pt-BR")}.</p>
      </div>

      <Cartao id="baixar" titulo="Baixar os dados">
        <div className="texto">
          <p>
            Todas as tabelas estão na página <Link href="/baixar/">Baixar dados</Link>, em Excel (.xlsx) e CSV.
          </p>
        </div>
      </Cartao>

      <Cartao id="definicoes" titulo="Definição de cada indicador">
        <div className="tabela-rolagem">
          <table>
            <thead>
              <tr>
                <th>Indicador</th>
                <th>Eixo</th>
                <th>Unidade</th>
                <th>Fonte</th>
                <th>Como é calculado</th>
              </tr>
            </thead>
            <tbody>
              {definicoes.map((d) => (
                <tr key={d.indicador}>
                  <td>{d.nome}</td>
                  <td>{d.eixo}</td>
                  <td>{d.unidade_medida}</td>
                  <td>{d.fonte}</td>
                  <td>{d.nota}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>
    </div>
  );
}
