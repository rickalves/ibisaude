"""Teste de fumaça da API de Dados Abertos do Ministério da Saúde para a Serra da Ibiapaba.

Para cada endpoint filtrável por município, consulta cada município do núcleo e registra
status HTTP, nº de linhas, tempo de resposta e um teste de consistência da paginação
(detecta endpoints que aplicam o filtro DEPOIS de paginar, o que torna a contagem não confiável).

Uso:  python testes/teste_api.py            (somente biblioteca padrão)
Saída: testes/resultados/relatorio_<data>.md e .csv
"""
import csv
import datetime as dt
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://apidadosabertos.saude.gov.br"
RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "testes" / "resultados"

# nome -> (caminho, parâmetro do município, formato do código, filtros extras)
ENDPOINTS = {
    "cnes_estabelecimentos": ("/cnes/estabelecimentos", "codigo_municipio", "ibge6", {}),
    "cnes_leitos": ("/assistencia-a-saude/cnes-leitos", "co_ibge", "ibge6", {}),
    "cnes_profissionais": ("/assistencia-a-saude/cnes-profissionais", "co_ibge", "ibge6", {}),
    "cnes_equipamentos": ("/assistencia-a-saude/cnes-equipamentos", "co_ibge", "ibge6", {}),
    "sih_2024": ("/assistencia-a-saude/sih-procedimentos-hospitalares", "co_ibge", "ibge6", {"nu_ano": 2024}),
    "sia_2024": ("/assistencia-a-saude/sia-procedimentos-ambulatoriais", "co_ibge", "ibge6", {"nu_ano": 2024}),
    "dengue_2025": ("/arboviroses/dengue", "id_municip", "ibge6", {"nu_ano": 2025}),
    "chikungunya_2025": ("/arboviroses/chikungunya", "id_municip", "ibge6", {"nu_ano": 2025}),
    "zika_2025": ("/arboviroses/zikavirus", "id_municip", "ibge6", {"nu_ano": 2025}),
    "sisvan": ("/sisvan/estado-nutricional", "codigo_municipio", "ibge6", {}),
    "sisagua_vigilancia_2025": ("/sisagua/vigilancia-parametros-basicos", "codigo_ibge", "ibge6", {"ano": 2025}),
    "sisagua_controle": ("/sisagua/controle-mensal-parametros-basicos", "codigo_ibge", "ibge6", {}),
    "bnafar_estoque": ("/daf/estoque-medicamentos-bnafar-horus", "codigo_municipio", "ibge6", {}),
    "previne_indicadores": ("/atencao-primaria/indicador-desempenho-programa-previne-brasil", "codigo_municipio", "ibge6", {}),
    "previne_cadastro": ("/atencao-primaria/cadastro-vinculado-programa-previne-brasil", "codigo_municipio_ibge", "ibge6", {}),
    "mais_medicos": ("/atencao-primaria/pmmb-serie-historica", "ibge", "ibge6", {}),
    "siaps_atendimento": ("/atencao-primaria/siaps-atendimento-individual", "municipio", "ibge6", {}),
    "populacao_2024": ("/vigilancia-e-meio-ambiente/svsa-populacao-residente", "cod_mun", "ibge7", {"ano": 2024}),
}


def consultar(caminho, params, timeout=120):
    url = f"{BASE}{caminho}?{urllib.parse.urlencode(params)}"
    t0 = time.time()
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            corpo, status = r.read(), r.status
    except urllib.error.HTTPError as e:
        corpo, status = e.read(), e.code
    except Exception as e:  # timeout, DNS etc.
        return "ERRO", None, round(time.time() - t0, 2), str(e)[:100]
    tempo = round(time.time() - t0, 2)
    try:
        dados = json.loads(corpo)
        listas = [v for v in dados.values() if isinstance(v, list)] if isinstance(dados, dict) else [dados]
        return status, (listas[0] if listas else []), tempo, ""
    except ValueError:
        return status, None, tempo, corpo[:100].decode("utf-8", "replace")


def paginacao_consistente(caminho, params):
    """limit=5 deve retornar 5 linhas se limit=50 retorna >5. Se não, o filtro é aplicado após paginar."""
    _, a, _, _ = consultar(caminho, {**params, "limit": 5, "offset": 0})
    _, b, _, _ = consultar(caminho, {**params, "limit": 50, "offset": 0})
    if a is None or b is None:
        return "?"
    if len(b) > 5 and len(a) < 5:
        return "NAO"
    return "sim"


def main():
    cfg = json.loads((RAIZ / "config" / "municipios_ibiapaba.json").read_text(encoding="utf-8"))
    municipios = cfg["nucleo"]
    SAIDA.mkdir(parents=True, exist_ok=True)
    hoje = dt.date.today().isoformat()
    linhas = []
    for nome_ep, (caminho, param, fmt, extras) in ENDPOINTS.items():
        pag = paginacao_consistente(caminho, {param: municipios[0][fmt], **extras})
        for m in municipios:
            status, rows, tempo, erro = consultar(caminho, {param: m[fmt], **extras, "limit": 1000, "offset": 0})
            n = len(rows) if rows is not None else None
            linhas.append({"endpoint": nome_ep, "municipio": m["nome"], "status": status,
                           "linhas": n, "tempo_s": tempo, "paginacao_ok": pag, "erro": erro})
            print(f"{nome_ep:26} {m['nome']:20} {status} n={n} {tempo}s pag={pag} {erro}")

    with open(SAIDA / f"relatorio_{hoje}.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(linhas[0]))
        w.writeheader()
        w.writerows(linhas)

    nomes = [m["nome"] for m in municipios]
    md = [f"# Teste da API — Serra da Ibiapaba ({hoje})", "",
          "Linhas retornadas com `limit=1000` (1000 = há mais páginas). `pag` = paginação consistente.", "",
          "| endpoint | pag | " + " | ".join(nomes) + " |",
          "|---|---|" + "---|" * len(nomes)]
    for nome_ep in ENDPOINTS:
        sub = [l for l in linhas if l["endpoint"] == nome_ep]
        cel = [str(l["linhas"]) if l["status"] == 200 else f"HTTP {l['status']}" for l in sub]
        md.append(f"| {nome_ep} | {sub[0]['paginacao_ok']} | " + " | ".join(cel) + " |")
    (SAIDA / f"relatorio_{hoje}.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print(f"\nRelatório salvo em {SAIDA}")


if __name__ == "__main__":
    main()
