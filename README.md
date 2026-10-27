# Observatório de Saúde da Serra da Ibiapaba

Indicadores de saúde dos 8 municípios da Serra da Ibiapaba (CE) — Carnaubal, Croatá, Guaraciaba do Norte,
Ibiapina, São Benedito, Tianguá, Ubajara e Viçosa do Ceará — comparados entre si e com o Ceará, a partir
dos microdados públicos do DATASUS e da população do IBGE.

## Como funciona

```
FTP DATASUS ──► coleta/datasus.py ──► data/datasus_ce/*.parquet ──► indicadores/construir.py ──► web/public/dados/*.json ──► site (Next.js)
 (SIM, SINASC,     + Dbc2Dbf.java        (microdados, fora do git)       (34 indicadores)          (só agregados)              estático
  SIH, SINAN)    IBGE ──► coleta/populacao_ibge.py ──► data/referencia/populacao.csv ──┘
```

| Pasta | O que tem |
|---|---|
| `coleta/` | Download e filtro dos microdados do DATASUS (`datasus.py`, com o descompressor `Dbc2Dbf.java`) e da população do IBGE |
| `indicadores/` | Cálculo dos indicadores por município de residência (`construir.py`) e planilhas para download (`planilhas.py`) |
| `web/` | Site em Next.js, exportado como HTML estático |
| `config/` | Lista de municípios e códigos IBGE |
| `docs/` | Arquitetura, glossário e dicionário de dados ([docs/README.md](docs/README.md)) |
| `testes/` | Teste da API de Dados Abertos do Ministério da Saúde |
| `painel/` | Primeira versão do painel, publicada no claude.ai |
| `PLANO_OBSERVATORIO.md` | Plano do observatório e resultado dos testes da API |

Os microdados (`data/datasus/`, `data/datasus_ce/`) têm registros individuais e **não entram no git**.
O site publica apenas totais agregados, que também podem ser baixados em Excel e CSV (página **Baixar dados**).

## Rodar localmente

Requisitos: Python 3.12+, Java 17+ (para descomprimir os arquivos `.dbc`) e Node.js 20+.

```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt     # no Linux/macOS: .venv/bin/pip

# 1. Dados (a primeira coleta leva cerca de 1 hora; as seguintes só baixam o que mudou)
.venv/Scripts/python coleta/datasus.py
.venv/Scripts/python coleta/populacao_ibge.py
.venv/Scripts/python indicadores/construir.py

# 2. Site
cd web
npm install
npm run dev          # http://localhost:3000
npm run build        # gera web/out/, pronto para publicar
```

## Publicar

O site é estático (`web/out/`). Recomendado: **Vercel**, importando o repositório com *Root Directory* = `web`.
A cada commit o site é reconstruído.

## Atualização automática

O workflow `.github/workflows/atualizar-dados.yml` roda todo dia 5 (ou manualmente, em *Actions*):
coleta os arquivos novos do DATASUS, recalcula os indicadores e faz commit de `web/public/dados/`.
Esse commit dispara a nova publicação na Vercel.

## Notas de método

- Indicadores por município de **residência**; o Ceará serve de referência.
- O ano corrente é parcial e o anterior ainda pode ser revisado (arquivos preliminares do DATASUS).
- Taxas de mortalidade nos municípios usam média de 3 anos, porque poucos casos fazem a taxa anual oscilar muito.
- Detalhes de cada indicador: página **Metodologia** do site ou `web/public/dados/indicadores.json`.
