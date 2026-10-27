"""Confere a coleta do DATASUS: registros de RESIDENTES da Ibiapaba por sistema, município e ano.

Uso: .venv/Scripts/python coleta/resumo_datasus.py
Saída: data/datasus/resumo.md
"""
import json
from pathlib import Path

import duckdb

RAIZ = Path(__file__).resolve().parent.parent
DADOS = RAIZ / "data" / "datasus"

# sistema -> (glob, campo de residência, expressão do ano)
CONSULTAS = {
    "SIM (óbitos)": ("SIM/*.parquet", "CODMUNRES", "right(DTOBITO, 4)"),
    "SINASC (nascidos vivos)": ("SINASC/*.parquet", "CODMUNRES", "right(DTNASC, 4)"),
    "SIH (internações)": ("SIH/*.parquet", "MUNIC_RES", "'20' || substr(_arquivo, 5, 2)"),
    "SINAN dengue": ("SINAN/DENG*.parquet", "ID_MN_RESI", "NU_ANO"),
    "SINAN chikungunya": ("SINAN/CHIK*.parquet", "ID_MN_RESI", "NU_ANO"),
    "SINAN zika": ("SINAN/ZIKA*.parquet", "ID_MN_RESI", "NU_ANO"),
}


def main():
    cfg = json.loads((RAIZ / "config" / "municipios_ibiapaba.json").read_text(encoding="utf-8"))
    nomes = {m["ibge6"]: m["nome"] for m in cfg["nucleo"]}
    con = duckdb.connect()
    con.execute("create table mun(cod varchar, nome varchar)")
    con.executemany("insert into mun values (?, ?)", list(nomes.items()))
    md = ["# Coleta DATASUS — residentes da Serra da Ibiapaba", ""]
    for titulo, (padrao, campo, ano) in CONSULTAS.items():
        if not list(DADOS.glob(padrao)):
            continue
        tab = con.sql(f"""
            pivot (select m.nome, {ano} as ano
                   from read_parquet('{(DADOS / padrao).as_posix()}', union_by_name=true) d
                   join mun m on left(d.{campo}, 6) = m.cod)
            on ano using count(*) group by nome order by nome
        """).fetchdf()
        cols = list(tab.columns)
        md += [f"## {titulo}", "", "| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)]
        for _, linha in tab.iterrows():
            md.append("| " + " | ".join(str(v) if v == v else "0" for v in linha) + " |")
        totais = ["**Total**"] + [str(int(tab[c].sum())) for c in cols[1:]]
        md += ["| " + " | ".join(totais) + " |", ""]
    md += ["Anos marcados como preliminares no `manifesto.json` ainda podem mudar.", ""]
    (DADOS / "resumo.md").write_text("\n".join(md), encoding="utf-8")
    print("\n".join(md))


if __name__ == "__main__":
    main()
