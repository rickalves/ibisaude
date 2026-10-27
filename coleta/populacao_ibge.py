"""População residente (IBGE/SIDRA) dos municípios da Ibiapaba e do Ceará, 2019 em diante.

Fontes: tabela 6579 (estimativas anuais) e tabela 4709 (Censo 2022). O IBGE não publicou estimativa
para 2023; esse ano é interpolado linearmente entre o Censo 2022 e a estimativa de 2024.
(A API do Ministério também tem população por idade/sexo, mas ficou fora do ar nos testes.)

Uso: .venv/Scripts/python coleta/populacao_ibge.py
Saída: data/referencia/populacao.csv  (codigo, ano, populacao, fonte)
"""
import csv
import json
import time
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "data" / "referencia" / "populacao.csv"
SIDRA = "https://apisidra.ibge.gov.br/values"


def sidra(caminho):
    for tentativa in range(4):
        try:
            with urllib.request.urlopen(f"{SIDRA}{caminho}", timeout=90) as r:
                return json.load(r)[1:]
        except Exception:
            if tentativa == 3:
                raise
            time.sleep(5 * (tentativa + 1))


def main():
    cfg = json.loads((RAIZ / "config" / "municipios_ibiapaba.json").read_text(encoding="utf-8"))
    cod7 = {m["ibge7"]: m["ibge6"] for m in cfg["nucleo"]}
    alvo = f"n6/{','.join(cod7)}/n3/23"
    pop = {}  # (codigo6 ou '23', ano) -> (valor, fonte)
    for r in sidra(f"/t/6579/{alvo}/v/all/p/all/f/c"):
        ano = int(r["D3C"])
        if ano >= 2019 and r["V"].isdigit():
            pop[(cod7.get(r["D1C"], r["D1C"]), ano)] = (int(r["V"]), "IBGE estimativa")
    for r in sidra(f"/t/4709/{alvo}/v/93/p/2022/f/c"):
        pop[(cod7.get(r["D1C"], r["D1C"]), 2022)] = (int(r["V"]), "IBGE Censo 2022")
    for cod in {c for c, _ in pop}:
        if (cod, 2022) in pop and (cod, 2024) in pop and (cod, 2023) not in pop:
            meio = round((pop[(cod, 2022)][0] + pop[(cod, 2024)][0]) / 2)
            pop[(cod, 2023)] = (meio, "interpolado 2022-2024")

    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    with open(SAIDA, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["codigo", "ano", "populacao", "fonte"])
        for (cod, ano), (valor, fonte) in sorted(pop.items()):
            w.writerow([cod, ano, valor, fonte])
    print(f"{len(pop)} linhas -> {SAIDA}")


if __name__ == "__main__":
    main()
