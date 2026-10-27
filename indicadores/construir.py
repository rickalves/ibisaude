"""Calcula os indicadores do observatório a partir dos microdados coletados.

Unidades: os 8 municípios (código IBGE de 6 dígitos), IBIAPABA (soma dos 8) e CE (referência estadual).
Todos os indicadores são por município de RESIDÊNCIA.

Uso:
  .venv/Scripts/python indicadores/construir.py                 # base do Ceará (data/datasus_ce)
  .venv/Scripts/python indicadores/construir.py --base ibiapaba # só Ibiapaba (data/datasus), sem a unidade CE

Saída:
  data/indicadores/indicadores.csv   tabela longa (unidade, ano, indicador, numerador, denominador, valor)
  web/public/dados/*.json            tabelas do site (só agregados, sem microdados); também baixáveis
  web/public/dados/planilhas/        as mesmas tabelas em .xlsx e .csv para Excel (indicadores/planilhas.py)
"""
import argparse
import csv
import datetime as dt
import json
from collections import defaultdict
from pathlib import Path

import duckdb

import planilhas

RAIZ = Path(__file__).resolve().parent.parent
SOBRAL, FORTALEZA = "231290", "230440"

# Lista brasileira de internações por condições sensíveis à atenção primária (Portaria SAS/MS 221/2008)
ICSAP = (r"^(A0[0-9]|A1[5-9]|A3[3-7]|A5[0-3]|A95|B0[56]|B16|B26|B5[0-4]|B77|D50|E1[0-4]|E4[0-6]|E5[0-9]|"
         r"E6[0-4]|E86|G000|G4[015]|G46|H66|I0[0-2]|I1[01]|I20|I50|I6[3-7]|I69|J0[0-3]|J06|J1[34]|J15[3489]|"
         r"J181|J2[01]|J31|J4[0-7]|J81|K2[5-8]|K92[0-2]|L0[1-48]|N1[0-2]|N30|N34|N390|N7[0-3]|N7[56]|O23|P350)")

CAPITULO_CID = """
    case
        when {c} < 'C' then 'Infecciosas e parasitárias'
        when {c} < 'D5' then 'Neoplasias (câncer)'
        when {c} < 'E' then 'Sangue e imunidade'
        when {c} < 'F' then 'Endócrinas e metabólicas'
        when {c} < 'G' then 'Transtornos mentais'
        when {c} < 'H' then 'Sistema nervoso'
        when {c} < 'I' then 'Olho e ouvido'
        when {c} < 'J' then 'Aparelho circulatório'
        when {c} < 'K' then 'Aparelho respiratório'
        when {c} < 'L' then 'Aparelho digestivo'
        when {c} < 'M' then 'Pele'
        when {c} < 'N' then 'Osteomuscular'
        when {c} < 'O' then 'Aparelho geniturinário'
        when {c} < 'P' then 'Gravidez, parto e puerpério'
        when {c} < 'Q' then 'Afecções perinatais'
        when {c} < 'R' then 'Malformações congênitas'
        when {c} < 'S' then 'Causas mal definidas'
        when {c} < 'U' then 'Lesões e envenenamentos'
        when {c} < 'V' then 'COVID-19 e códigos especiais'
        when {c} < 'Z' then 'Causas externas'
        else 'Contatos com serviços de saúde'
    end"""

# id: (nome, eixo, multiplicador, unidade, melhor ('menor'|'maior'|None), fonte, nota)
DEFINICOES = {
    "populacao": ("População residente", "Demografia", None, "hab.", None, "IBGE", "Estimativas anuais; 2022 = Censo; 2023 interpolado."),
    "nascidos_vivos": ("Nascidos vivos", "Materno-infantil", None, "nascimentos", None, "SINASC", ""),
    "tmi": ("Mortalidade infantil", "Materno-infantil", 1000, "por mil nascidos vivos", "menor", "SIM + SINASC", "Óbitos de menores de 1 ano ÷ nascidos vivos."),
    "tmi_3a": ("Mortalidade infantil (média de 3 anos)", "Materno-infantil", 1000, "por mil nascidos vivos", "menor", "SIM + SINASC", "Soma do ano e dos 2 anteriores; estabiliza municípios pequenos."),
    "tmn": ("Mortalidade neonatal", "Materno-infantil", 1000, "por mil nascidos vivos", "menor", "SIM + SINASC", "Óbitos com menos de 28 dias ÷ nascidos vivos."),
    "tmn_3a": ("Mortalidade neonatal (média de 3 anos)", "Materno-infantil", 1000, "por mil nascidos vivos", "menor", "SIM + SINASC", ""),
    "obitos_maternos": ("Óbitos maternos", "Materno-infantil", None, "óbitos", "menor", "SIM", "Causa básica O00–O95, O98–O99 ou A34."),
    "rmm_3a": ("Razão de mortalidade materna (3 anos)", "Materno-infantil", 100000, "por 100 mil nascidos vivos", "menor", "SIM + SINASC", ""),
    "pct_cesarea": ("Partos cesáreos", "Materno-infantil", 100, "% dos partos", "menor", "SINASC", "Excluídos partos com tipo ignorado."),
    "pct_prenatal7": ("7 ou mais consultas de pré-natal", "Materno-infantil", 100, "% dos nascidos vivos", "maior", "SINASC", "Excluídos registros com nº de consultas ignorado."),
    "pct_prenatal_1tri": ("Pré-natal iniciado no 1º trimestre", "Materno-infantil", 100, "% dos nascidos vivos", "maior", "SINASC", "Mês de início 1 a 3; excluídos ignorados."),
    "pct_baixo_peso": ("Baixo peso ao nascer", "Materno-infantil", 100, "% dos nascidos vivos", "menor", "SINASC", "Menos de 2.500 g."),
    "pct_prematuro": ("Prematuridade", "Materno-infantil", 100, "% dos nascidos vivos", "menor", "SINASC", "Menos de 37 semanas de gestação."),
    "pct_mae_adolescente": ("Mães adolescentes", "Materno-infantil", 100, "% dos nascidos vivos", "menor", "SINASC", "Mãe com 10 a 19 anos."),
    "obitos": ("Óbitos", "Mortalidade", None, "óbitos", None, "SIM", ""),
    "tx_mortalidade": ("Mortalidade geral", "Mortalidade", 1000, "por mil hab.", "menor", "SIM + IBGE", "Taxa bruta, sem padronização por idade."),
    "obitos_dcnt_prematuros": ("Óbitos prematuros por doenças crônicas", "Mortalidade", None, "óbitos (30–69 anos)", "menor", "SIM", "Câncer, diabetes, doenças circulatórias e respiratórias crônicas."),
    "tx_causas_externas": ("Mortalidade por causas externas", "Mortalidade", 100000, "por 100 mil hab.", "menor", "SIM + IBGE", "Acidentes, violências e lesões (V01–Y98)."),
    "tx_homicidio": ("Homicídios", "Mortalidade", 100000, "por 100 mil hab.", "menor", "SIM + IBGE", "Agressões X85–Y09."),
    "tx_transito": ("Mortes no trânsito", "Mortalidade", 100000, "por 100 mil hab.", "menor", "SIM + IBGE", "V01–V89."),
    "obitos_covid": ("Óbitos por COVID-19", "Mortalidade", None, "óbitos", "menor", "SIM", "B34.2, U07.1, U07.2."),
    "internacoes": ("Internações SUS", "Internações", None, "internações", None, "SIH", "Por ano de competência da AIH."),
    "tx_internacao": ("Taxa de internação SUS", "Internações", 1000, "por mil hab.", None, "SIH + IBGE", ""),
    "pct_icsap": ("Internações sensíveis à atenção primária", "Internações", 100, "% das internações (exceto partos)", "menor", "SIH", "Lista brasileira de ICSAP, Portaria 221/2008."),
    "pct_fora_serra": ("Internações fora da Ibiapaba", "Internações", 100, "% das internações", None, "SIH", "Hospital localizado fora dos 8 municípios."),
    "pct_obito_hospitalar": ("Mortalidade hospitalar", "Internações", 100, "% das internações", "menor", "SIH", "Internações que terminaram em óbito."),
    "gasto_sih_per_capita": ("Gasto SUS com internações por habitante", "Internações", 1, "R$ por hab.", None, "SIH + IBGE", "Valor total das AIHs ÷ população."),
    "dengue_casos": ("Casos prováveis de dengue", "Arboviroses", None, "casos", "menor", "SINAN", "Notificações exceto descartadas, por ano de notificação."),
    "dengue_incidencia": ("Incidência de dengue", "Arboviroses", 100000, "por 100 mil hab.", "menor", "SINAN + IBGE", "Acima de 300/100 mil é considerado epidemia (MS)."),
    "dengue_graves": ("Dengue com sinais de alarme ou grave", "Arboviroses", None, "casos", "menor", "SINAN", ""),
    "dengue_obitos": ("Óbitos por dengue", "Arboviroses", None, "óbitos", "menor", "SINAN", "Evolução = óbito pelo agravo."),
    "chik_casos": ("Casos prováveis de chikungunya", "Arboviroses", None, "casos", "menor", "SINAN", ""),
    "chik_incidencia": ("Incidência de chikungunya", "Arboviroses", 100000, "por 100 mil hab.", "menor", "SINAN + IBGE", ""),
    "zika_casos": ("Casos prováveis de zika", "Arboviroses", None, "casos", "menor", "SINAN", ""),
}


def carregar(con, base, cfg):
    con.execute("create table mun(cod varchar, nome varchar)")
    con.executemany("insert into mun values (?, ?)", [(m["ibge6"], m["nome"]) for m in cfg["nucleo"]])

    def ler(sistema, padrao="*.parquet"):
        arquivos = list((base / sistema).glob(padrao))
        if not arquivos:
            raise SystemExit(f"sem dados em {base / sistema}")
        return f"read_parquet('{(base / sistema).as_posix()}/{padrao}', union_by_name=true, filename=true)"

    def unidades(nome, origem, res, com_ce):
        sql = f"""
            create or replace view {nome} as
            select left({res}, 6) as unidade, * from {origem} where left({res}, 6) in (select cod from mun)
            union all
            select 'IBIAPABA', * from {origem} where left({res}, 6) in (select cod from mun)"""
        if com_ce:
            sql += f"\n union all select 'CE', * from {origem} where left({res}, 2) = '23'"
        con.execute(sql)
    return ler, unidades


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", choices=["ce", "ibiapaba"], default="ce")
    args = ap.parse_args()
    base = RAIZ / "data" / ("datasus_ce" if args.base == "ce" else "datasus")
    com_ce = args.base == "ce"
    cfg = json.loads((RAIZ / "config" / "municipios_ibiapaba.json").read_text(encoding="utf-8"))

    con = duckdb.connect()
    ler, unidades = carregar(con, base, cfg)
    unidades("sim", ler("SIM"), "CODMUNRES", com_ce)
    unidades("sinasc", ler("SINASC"), "CODMUNRES", com_ce)
    unidades("sih", ler("SIH"), "MUNIC_RES", com_ce)
    unidades("sinan", ler("SINAN"), "ID_MN_RESI", com_ce)

    agg = defaultdict(dict)  # (unidade, ano) -> {variável: valor}

    def acumular(sql):
        res = con.execute(sql)
        cols = [d[0] for d in res.description]
        for linha in res.fetchall():
            reg = dict(zip(cols, linha))
            if reg["ano"] is None:
                continue
            chave = (reg.pop("unidade"), int(reg.pop("ano")))
            agg[chave].update({k: v for k, v in reg.items()})

    # população
    with open(RAIZ / "data" / "referencia" / "populacao.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            agg[("CE" if r["codigo"] == "23" else r["codigo"], int(r["ano"]))]["pop"] = int(r["populacao"])
    for m in cfg["nucleo"]:
        for (u, a), v in list(agg.items()):
            if u == m["ibge6"] and "pop" in v:
                agg[("IBIAPABA", a)]["pop"] = agg[("IBIAPABA", a)].get("pop", 0) + v["pop"]

    acumular("""
        with s as (
            select *, case left(IDADE, 1) when '4' then try_cast(substr(IDADE, 2, 2) as int)
                                          when '5' then 100 + try_cast(substr(IDADE, 2, 2) as int)
                                          else 0 end as idade_anos
            from sim)
        select unidade, try_cast(right(DTOBITO, 4) as int) as ano,
            count(*) as obitos,
            count(*) filter (where left(IDADE, 1) in ('0', '1', '2', '3')) as obitos_inf,
            count(*) filter (where left(IDADE, 1) in ('0', '1')
                             or (left(IDADE, 1) = '2' and try_cast(substr(IDADE, 2, 2) as int) < 28)) as obitos_neo,
            count(*) filter (where (CAUSABAS like 'O%' and left(CAUSABAS, 3) not in ('O96', 'O97'))
                             or left(CAUSABAS, 3) = 'A34') as obitos_mat,
            count(*) filter (where left(CAUSABAS, 1) in ('V', 'W', 'X', 'Y')) as obitos_ext,
            count(*) filter (where CAUSABAS between 'X85' and 'Y09z') as homicidios,
            count(*) filter (where CAUSABAS between 'V01' and 'V89z') as transito,
            count(*) filter (where left(CAUSABAS, 4) in ('B342', 'U071', 'U072')) as covid,
            count(*) filter (where idade_anos between 30 and 69 and (
                CAUSABAS between 'C00' and 'C97z' or CAUSABAS between 'E10' and 'E14z'
                or CAUSABAS between 'I00' and 'I99z' or CAUSABAS between 'J30' and 'J98z')) as dcnt_prem
        from s group by all""")

    acumular("""
        select unidade, try_cast(right(DTNASC, 4) as int) as ano,
            count(*) as nv,
            count(*) filter (where PARTO = '2') as cesareas,
            count(*) filter (where PARTO in ('1', '2')) as partos_inf,
            count(*) filter (where try_cast(PESO as int) between 100 and 2499) as baixo_peso,
            count(*) filter (where try_cast(PESO as int) between 100 and 7000) as peso_inf,
            count(*) filter (where GESTACAO in ('1', '2', '3', '4')) as prematuros,
            count(*) filter (where GESTACAO in ('1', '2', '3', '4', '5', '6')) as gestacao_inf,
            count(*) filter (where try_cast(CONSPRENAT as int) between 7 and 98) as prenatal7,
            count(*) filter (where try_cast(CONSPRENAT as int) between 0 and 98) as prenatal_inf,
            count(*) filter (where try_cast(MESPRENAT as int) between 1 and 3) as prenatal_1tri,
            count(*) filter (where try_cast(MESPRENAT as int) between 1 and 9) as mesprenatal_inf,
            count(*) filter (where try_cast(IDADEMAE as int) between 10 and 19) as mae_adol,
            count(*) filter (where try_cast(IDADEMAE as int) between 10 and 60) as idademae_inf
        from sinasc group by all""")

    acumular(f"""
        select unidade, try_cast(ANO_CMPT as int) as ano,
            count(*) as internacoes,
            count(*) filter (where not (DIAG_PRINC between 'O80' and 'O84z')) as internacoes_sem_parto,
            count(*) filter (where regexp_matches(DIAG_PRINC, '{ICSAP}')) as icsap,
            count(*) filter (where left(MUNIC_MOV, 6) not in (select cod from mun)) as fora_serra,
            count(*) filter (where MORTE = '1') as obitos_hosp,
            sum(try_cast(VAL_TOT as double)) as gasto
        from sih group by all""")

    acumular("""
        select unidade, try_cast(NU_ANO as int) as ano,
            count(*) filter (where filename like '%DENG%') as dengue,
            count(*) filter (where filename like '%DENG%' and CLASSI_FIN in ('11', '12')) as dengue_graves,
            count(*) filter (where filename like '%DENG%' and EVOLUCAO = '2') as dengue_obitos,
            count(*) filter (where filename like '%CHIK%' and coalesce(CLASSI_FIN, '') <> '5') as chik,
            count(*) filter (where filename like '%ZIKA%' and coalesce(CLASSI_FIN, '') <> '2') as zika
        from sinan group by all""")

    # ------------------------------------------------------------- indicadores anuais (formato longo)
    linhas = []

    def add(u, a, ind, num, den=None):
        if num is None:
            return
        mult = DEFINICOES[ind][2]
        if den is None:
            valor = num
        elif not den:
            return
        else:
            valor = num / den * mult
        linhas.append({"u": u, "a": a, "i": ind, "n": num, "d": den, "v": round(valor, 2)})

    def soma3(u, a, var):
        vals = [agg.get((u, a - k), {}).get(var) for k in range(3)]
        return None if None in vals else sum(vals)

    if not com_ce:
        agg = {k: v for k, v in agg.items() if k[0] != "CE"}
    for (u, a), v in sorted(agg.items()):
        if a < 2019:
            continue
        g = v.get
        pop = g("pop")
        add(u, a, "populacao", pop)
        add(u, a, "nascidos_vivos", g("nv"))
        add(u, a, "tmi", g("obitos_inf"), g("nv"))
        add(u, a, "tmi_3a", soma3(u, a, "obitos_inf"), soma3(u, a, "nv"))
        add(u, a, "tmn", g("obitos_neo"), g("nv"))
        add(u, a, "tmn_3a", soma3(u, a, "obitos_neo"), soma3(u, a, "nv"))
        add(u, a, "obitos_maternos", g("obitos_mat"))
        add(u, a, "rmm_3a", soma3(u, a, "obitos_mat"), soma3(u, a, "nv"))
        add(u, a, "pct_cesarea", g("cesareas"), g("partos_inf"))
        add(u, a, "pct_prenatal7", g("prenatal7"), g("prenatal_inf"))
        add(u, a, "pct_prenatal_1tri", g("prenatal_1tri"), g("mesprenatal_inf"))
        add(u, a, "pct_baixo_peso", g("baixo_peso"), g("peso_inf"))
        add(u, a, "pct_prematuro", g("prematuros"), g("gestacao_inf"))
        add(u, a, "pct_mae_adolescente", g("mae_adol"), g("idademae_inf"))
        add(u, a, "obitos", g("obitos"))
        add(u, a, "tx_mortalidade", g("obitos"), pop)
        add(u, a, "obitos_dcnt_prematuros", g("dcnt_prem"))
        add(u, a, "tx_causas_externas", g("obitos_ext"), pop)
        add(u, a, "tx_homicidio", g("homicidios"), pop)
        add(u, a, "tx_transito", g("transito"), pop)
        add(u, a, "obitos_covid", g("covid"))
        add(u, a, "internacoes", g("internacoes"))
        add(u, a, "tx_internacao", g("internacoes"), pop)
        add(u, a, "pct_icsap", g("icsap"), g("internacoes_sem_parto"))
        if u != "CE":
            add(u, a, "pct_fora_serra", g("fora_serra"), g("internacoes"))
        add(u, a, "pct_obito_hospitalar", g("obitos_hosp"), g("internacoes"))
        if g("gasto") is not None and pop:
            add(u, a, "gasto_sih_per_capita", round(g("gasto"), 2), pop)
        add(u, a, "dengue_casos", g("dengue"))
        add(u, a, "dengue_incidencia", g("dengue"), pop)
        add(u, a, "dengue_graves", g("dengue_graves"))
        add(u, a, "dengue_obitos", g("dengue_obitos"))
        add(u, a, "chik_casos", g("chik"))
        add(u, a, "chik_incidencia", g("chik"), pop)
        add(u, a, "zika_casos", g("zika"))

    # ------------------------------------------------------------- séries auxiliares
    def tabela(sql):
        res = con.execute(sql)
        cols = [d[0] for d in res.description]
        return [dict(zip(cols, r)) for r in res.fetchall()]

    semanal = tabela("""
        select unidade as u, case when filename like '%DENG%' then 'dengue' else 'chik' end as agravo,
               try_cast(left(SEM_PRI, 4) as int) as a, try_cast(right(SEM_PRI, 2) as int) as s, count(*) as n
        from sinan
        where (filename like '%DENG%' or (filename like '%CHIK%' and coalesce(CLASSI_FIN, '') <> '5'))
          and length(SEM_PRI) = 6 and left(SEM_PRI, 4) >= '2019'
        group by all order by all""")

    causas_obito = tabela(f"""
        select unidade as u, try_cast(right(DTOBITO, 4) as int) as a, {CAPITULO_CID.format(c='CAUSABAS')} as c,
               count(*) as n
        from sim where CAUSABAS <> '' group by all order by all""")

    causas_internacao = tabela(f"""
        select unidade as u, try_cast(ANO_CMPT as int) as a, {CAPITULO_CID.format(c='DIAG_PRINC')} as c,
               count(*) as n
        from sih where DIAG_PRINC <> '' group by all order by all""")

    destino = tabela(f"""
        select unidade as u, try_cast(ANO_CMPT as int) as a,
            case when left(MUNIC_MOV, 6) = left(MUNIC_RES, 6) then 'Próprio município'
                 when left(MUNIC_MOV, 6) in (select cod from mun) then 'Outro município da serra'
                 when left(MUNIC_MOV, 6) = '{SOBRAL}' then 'Sobral'
                 when left(MUNIC_MOV, 6) = '{FORTALEZA}' then 'Fortaleza'
                 else 'Outros municípios do CE' end as c,
            count(*) as n
        from sih where unidade <> 'CE' group by all order by all""")

    # ------------------------------------------------------------- saída
    nomes = {m["ibge6"]: m["nome"] for m in cfg["nucleo"]} | {"IBIAPABA": "Serra da Ibiapaba", "CE": "Ceará"}
    valor = {(ln["u"], ln["a"], ln["i"]): ln["v"] for ln in linhas}

    ficha = []
    for (u, a, i), v in sorted(valor.items()):
        if u == "CE":
            continue
        anterior = valor.get((u, a - 1, i))
        ficha.append({
            "id": f"{u}-{a}-{i}", "unidade": u, "ano": a, "indicador": i, "nome": DEFINICOES[i][0],
            "eixo": DEFINICOES[i][1], "valor": v, "anterior": anterior,
            "variacao": None if anterior is None else round(v - anterior, 2),
            "ibiapaba": valor.get(("IBIAPABA", a, i)), "ceara": valor.get(("CE", a, i)),
        })

    datasets = {
        "anual": [{"unidade": ln["u"], "nome": nomes[ln["u"]], "ano": ln["a"], "indicador": ln["i"],
                   "numerador": ln["n"], "denominador": ln["d"], "valor": ln["v"]} for ln in linhas],
        "ficha": ficha,
        "indicadores": [{"indicador": k, "nome": d[0], "eixo": d[1], "unidade_medida": d[3], "melhor": d[4],
                         "fonte": d[5], "nota": d[6]} for k, d in DEFINICOES.items()],
        "semanal": [{"unidade": r["u"], "agravo": r["agravo"], "ano": r["a"], "semana": r["s"], "casos": r["n"]}
                    for r in semanal if r["a"] is not None and r["s"] is not None],
        "causas_obito": [{"unidade": r["u"], "ano": r["a"], "grupo": r["c"], "obitos": r["n"]}
                         for r in causas_obito if r["a"] is not None],
        "causas_internacao": [{"unidade": r["u"], "ano": r["a"], "grupo": r["c"], "internacoes": r["n"]}
                              for r in causas_internacao if r["a"] is not None],
        "destino_internacao": [{"unidade": r["u"], "ano": r["a"], "destino": r["c"], "internacoes": r["n"]}
                               for r in destino if r["a"] is not None],
    }

    manifesto = json.loads((RAIZ / "data" / "datasus" / "manifesto.json").read_text(encoding="utf-8"))
    hoje = dt.date.today()
    anos = sorted({ln["a"] for ln in linhas})
    datasets["meta"] = {
        "gerado_em": dt.datetime.now().isoformat(timespec="minutes"),
        "ano_parcial": hoje.year,
        "anos_fechados": [a for a in anos if a < hoje.year],
        "ano_arbo": max(ln["a"] for ln in linhas if ln["i"] == "dengue_casos"),
        "tem_ceara": com_ce,
        "preliminares": sorted({f"{m['sistema']} {m['arquivo']}" for m in manifesto.values() if m.get("preliminar")}),
        "sih_ultima_competencia": max(m["arquivo"][4:8] for m in manifesto.values() if m["sistema"] == "SIH"),
        "municipios": [{"codigo": m["ibge6"], "nome": m["nome"]} for m in cfg["nucleo"]],
    }

    pasta = RAIZ / "web" / "public" / "dados"
    pasta.mkdir(parents=True, exist_ok=True)
    for nome, conteudo in datasets.items():
        caminho = pasta / f"{nome}.json"
        caminho.write_text(json.dumps(conteudo, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"{nome:20} {len(conteudo):6} itens  {caminho.stat().st_size / 1e3:6.0f} kB")

    for saida_csv in (RAIZ / "data" / "indicadores" / "indicadores.csv", pasta / "indicadores.csv"):
        saida_csv.parent.mkdir(parents=True, exist_ok=True)
        with open(saida_csv, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(datasets["anual"][0]))
            w.writeheader()
            w.writerows(datasets["anual"])
    planilhas.main()
    print(f"-> {pasta}")


if __name__ == "__main__":
    main()
