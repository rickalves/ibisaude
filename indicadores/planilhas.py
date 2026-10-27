"""Gera as planilhas para download a partir dos JSON do site (web/public/dados).

Saída em web/public/dados/planilhas/:
  observatorio-saude-ibiapaba.xlsx   uma aba por tabela, com uma aba "Leia-me"
  *.csv                              as mesmas tabelas no padrão do Excel em português
                                     (separador ";", vírgula decimal, UTF-8 com BOM)

Roda sozinho (`.venv/Scripts/python indicadores/planilhas.py`) ou no fim de construir.py.
"""
import csv
import datetime as dt
import json
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

RAIZ = Path(__file__).resolve().parent.parent
DADOS = RAIZ / "web" / "public" / "dados"
ARQUIVO_XLSX = "observatorio-saude-ibiapaba.xlsx"


def ler(nome):
    return json.loads((DADOS / f"{nome}.json").read_text(encoding="utf-8"))


def tabelas():
    """Cada tabela: (aba, arquivo csv, descrição, colunas, linhas)."""
    meta, defs = ler("meta"), ler("indicadores")
    nomes = {m["codigo"]: m["nome"] for m in meta["municipios"]} | {"IBIAPABA": "Serra da Ibiapaba", "CE": "Ceará"}
    ordem_unid = {c: k for k, c in enumerate([*nomes])}
    ordem_ind = {d["indicador"]: k for k, d in enumerate(defs)}
    anual = sorted(ler("anual"), key=lambda r: (ordem_unid[r["unidade"]], r["ano"], ordem_ind[r["indicador"]]))

    # formato largo: uma linha por município e ano, uma coluna por indicador
    rotulo = {d["indicador"]: f"{d['nome']} ({d['unidade_medida']})" for d in defs}
    largo = {}
    for r in anual:
        linha = largo.setdefault((r["unidade"], r["ano"]), [nomes[r["unidade"]], r["unidade"], r["ano"]])
        linha.append((r["indicador"], r["valor"]))
    col_ind = [d["indicador"] for d in defs]
    linhas_largo = []
    for base in largo.values():
        valores = dict(base[3:])
        linhas_largo.append(base[:3] + [valores.get(i) for i in col_ind])

    def por_unidade(lista, *campos):
        lista = sorted(lista, key=lambda r: (ordem_unid[r["unidade"]], *(r[c] for c in campos[:-1])))
        return [[nomes[r["unidade"]], r["unidade"], *(r[c] for c in campos)] for r in lista]

    agravo = {"dengue": "Dengue", "chik": "Chikungunya"}
    semanal = sorted(ler("semanal"), key=lambda r: (ordem_unid[r["unidade"]], r["agravo"], r["ano"], r["semana"]))

    return [
        ("Indicadores", "indicadores.csv",
         "Uma linha por município e ano, uma coluna por indicador.",
         ["Município", "Código IBGE", "Ano", *(rotulo[i] for i in col_ind)], linhas_largo),
        ("Indicadores (detalhe)", "indicadores-detalhado.csv",
         "Uma linha por município, ano e indicador, com o numerador e o denominador usados no cálculo.",
         ["Município", "Código IBGE", "Ano", "Indicador", "Unidade de medida", "Numerador", "Denominador", "Valor"],
         [[nomes[r["unidade"]], r["unidade"], r["ano"], defs[ordem_ind[r["indicador"]]]["nome"],
           defs[ordem_ind[r["indicador"]]]["unidade_medida"], r["numerador"], r["denominador"], r["valor"]]
          for r in anual]),
        ("Definições", "definicoes.csv",
         "O que cada indicador mede, de onde vem e como é calculado.",
         ["Código", "Indicador", "Eixo", "Unidade de medida", "Melhor quando", "Fonte", "Como é calculado"],
         [[d["indicador"], d["nome"], d["eixo"], d["unidade_medida"], d["melhor"] or "", d["fonte"], d["nota"]]
          for d in defs]),
        ("Causas de óbito", "causas-de-obito.csv",
         "Óbitos de residentes por grupo de causa básica (capítulo da CID-10).",
         ["Município", "Código IBGE", "Ano", "Grupo de causa", "Óbitos"],
         por_unidade(ler("causas_obito"), "ano", "grupo", "obitos")),
        ("Causas de internação", "causas-de-internacao.csv",
         "Internações SUS de residentes por grupo do diagnóstico principal (capítulo da CID-10).",
         ["Município", "Código IBGE", "Ano", "Grupo de causa", "Internações"],
         por_unidade(ler("causas_internacao"), "ano", "grupo", "internacoes")),
        ("Local de internação", "local-de-internacao.csv",
         "Internações SUS de residentes pelo município do hospital.",
         ["Município", "Código IBGE", "Ano", "Local do hospital", "Internações"],
         por_unidade(ler("destino_internacao"), "ano", "destino", "internacoes")),
        ("Arboviroses por semana", "arboviroses-por-semana.csv",
         "Casos prováveis de dengue e chikungunya por semana epidemiológica de início dos sintomas.",
         ["Município", "Código IBGE", "Doença", "Ano", "Semana epidemiológica", "Casos prováveis"],
         [[nomes[r["unidade"]], r["unidade"], agravo[r["agravo"]], r["ano"], r["semana"], r["casos"]]
          for r in semanal]),
    ]


def numero_br(v):
    if isinstance(v, float):
        return f"{v:.2f}".rstrip("0").rstrip(".").replace(".", ",")
    return "" if v is None else v


def escrever_csv(caminho, colunas, linhas):
    with open(caminho, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(colunas)
        w.writerows([numero_br(v) for v in linha] for linha in linhas)


def leia_me(ws, meta, abas):
    gerado = dt.datetime.fromisoformat(meta["gerado_em"]).strftime("%d/%m/%Y")
    texto = [
        ("Observatório de Saúde da Serra da Ibiapaba", True),
        (f"Dados processados em {gerado}.", False),
        ("", False),
        ("Municípios: " + ", ".join(m["nome"] for m in meta["municipios"]) +
         ". \"Serra da Ibiapaba\" é a soma dos 8; o Ceará serve de referência.", False),
        ("Fontes: microdados públicos do DATASUS (SIM, SINASC, SIH, SINAN) e população do IBGE.", False),
        ("Todos os números contam pessoas pelo município onde moram (residência), não onde foram atendidas.", False),
        (f"{meta['ano_parcial']} está incompleto e os anos anteriores ainda podem ser revisados pelo Ministério "
         "da Saúde. Arquivos preliminares: " + ", ".join(meta["preliminares"]) + ".", False),
        ("Nos municípios pequenos, prefira as taxas de mortalidade com média de 3 anos.", False),
        ("Só há totais agregados; nenhum dado individual é publicado.", False),
        ("", False),
        ("Abas", True),
        *((f"{aba}: {descricao}", False) for aba, descricao in abas),
    ]
    for k, (t, negrito) in enumerate(texto, start=1):
        c = ws.cell(row=k, column=1, value=t)
        c.font = Font(bold=negrito, size=14 if k == 1 else 11)
        c.alignment = Alignment(wrap_text=True, vertical="top")
    ws.column_dimensions["A"].width = 110


def main():
    meta = ler("meta")
    pasta = DADOS / "planilhas"
    pasta.mkdir(parents=True, exist_ok=True)
    lista = tabelas()

    wb = Workbook()
    leia_me(wb.active, meta, [(aba, desc) for aba, _, desc, _, _ in lista])
    wb.active.title = "Leia-me"
    cabecalho = Font(bold=True, color="FFFFFF")
    fundo = PatternFill("solid", fgColor="1D6B57")
    for aba, arquivo, _, colunas, linhas in lista:
        escrever_csv(pasta / arquivo, colunas, linhas)
        ws = wb.create_sheet(aba)
        ws.append(colunas)
        for linha in linhas:
            ws.append(linha)
        for k, nome in enumerate(colunas, start=1):
            c = ws.cell(row=1, column=k)
            c.font, c.fill = cabecalho, fundo
            c.alignment = Alignment(wrap_text=True, vertical="top")
            largura = max([len(str(nome)) // 2 + 2] + [len(str(ln[k - 1] or "")) + 2 for ln in linhas[:200]])
            ws.column_dimensions[get_column_letter(k)].width = min(max(largura, 9), 60)
        ws.freeze_panes = "D2" if colunas[:3] == ["Município", "Código IBGE", "Ano"] else "A2"
        ws.auto_filter.ref = ws.dimensions
    wb.save(pasta / ARQUIVO_XLSX)

    for f in sorted(pasta.iterdir()):
        print(f"{f.name:32} {f.stat().st_size / 1e3:6.0f} kB")


if __name__ == "__main__":
    main()
