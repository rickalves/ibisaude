# Arquitetura

O observatório tem três partes que rodam em momentos diferentes:

1. **Coleta** (Python + Java): baixa os microdados do DATASUS e a população do IBGE. É demorada e roda uma vez por mês.
2. **Cálculo** (Python + DuckDB): transforma os microdados em indicadores agregados. Leva menos de um minuto.
3. **Site** (Next.js): lê os indicadores e gera páginas HTML estáticas. Não há servidor nem banco de dados em produção.

```
                          ┌────────────── fora do git (microdados) ──────────────┐
FTP DATASUS ──► coleta/datasus.py ──► data/datasus/*.parquet      (só a Ibiapaba, todas as colunas)
 SIM, SINASC,    └ Dbc2Dbf.java       data/datasus_ce/*.parquet   (todo o CE, colunas reduzidas)
 SIH, SINAN
                          └──────────────────────────────────────────────────────┘
                 └──► data/datasus/manifesto.json  (nomes, tamanhos e datas no FTP; no git)
IBGE SIDRA ──► coleta/populacao_ibge.py ──► data/referencia/populacao.csv
                                                    │
                       indicadores/construir.py ◄───┘   (lê data/datasus_ce + população)
                                 │  ▲
                                 │  └── data/agregados/*.csv  contagens por arquivo de origem (no git)
                                 │
                                 ├──► web/public/dados/*.json           tabelas que o site lê
                                 ├──► web/public/dados/indicadores.csv  formato longo, para programas
                                 └──► indicadores/planilhas.py ──► web/public/dados/planilhas/  (.xlsx e .csv para Excel)
                                                    │
                              web/ (next build) ──► web/out/  HTML estático ──► Vercel
```

## Pastas

| Pasta | Conteúdo |
|---|---|
| `config/` | `municipios_ibiapaba.json`: os 8 municípios do núcleo (código IBGE de 6 e 7 dígitos) e 2 opcionais (Ipu, Ipueiras) |
| `coleta/` | `datasus.py` (FTP do DATASUS), `Dbc2Dbf.java` (descompressor de `.dbc`), `populacao_ibge.py` (SIDRA), `resumo_datasus.py` (contagem de registros, para conferência) |
| `indicadores/` | `construir.py` (cálculo dos indicadores) e `planilhas.py` (geração do Excel e dos CSV) |
| `data/` | `datasus/` e `datasus_ce/` (microdados, ignorados pelo git, exceto `datasus/manifesto.json`), `agregados/` (contagens por arquivo de origem), `referencia/` (população), `indicadores/` (cópia do CSV de indicadores) |
| `web/` | Site Next.js. Detalhes em [web/README.md](../web/README.md) |
| `testes/` | `teste_api.py`: teste da API de Dados Abertos do Ministério da Saúde (não é usado pelo site) |
| `painel/` | Primeira versão do painel, publicada no claude.ai; substituída pelo site |
| `.github/workflows/` | `atualizar-dados.yml`: atualização mensal automática |

## 1. Coleta

### Por que o FTP do DATASUS e não a API

A [API de Dados Abertos](https://apidadosabertos.saude.gov.br/v1/) foi testada primeiro (resultados em
`PLANO_OBSERVATORIO.md`). Ela serve para arboviroses, CNES e alguns programas da atenção primária, mas:

- SIM, SINASC e SRAG não têm filtro por município;
- SIH, SIA, leitos e equipamentos aplicam o filtro de município **depois** da paginação, então as páginas voltam
  quase vazias;
- vários endpoints estavam fora do ar ou retornavam erro 500 durante os testes.

Por isso os indicadores vêm dos microdados do FTP público (`ftp.datasus.gov.br/dissemin/publicos/`), que são a fonte
original da própria API e do TabNet.

### Como `datasus.py` funciona

Para cada arquivo (por exemplo `DOCE2024.dbc`, os óbitos do Ceará em 2024):

1. Lista a pasta no FTP e compara tamanho e data com `data/datasus/manifesto.json`. Se nada mudou e as duas saídas
   existem, pula o arquivo.
2. Baixa o `.dbc`.
3. Descomprime com `Dbc2Dbf.java` direto para um *pipe*: o `.dbf` descomprimido nunca é gravado em disco (os arquivos
   nacionais do SINAN passam de vários GB).
4. Filtra os registros e grava duas saídas em Parquet:
   - `data/datasus/<SIS>/` — registros da Ibiapaba por **residência ou ocorrência**, com todas as colunas. Serve para
     análises locais futuras (por exemplo, quem vem de fora se internar na serra).
   - `data/datasus_ce/<SIS>/` — todos os **residentes do Ceará**, só com as colunas usadas nos indicadores. É a base
     de `construir.py` e permite comparar com o estado.
5. Apaga o `.dbc` (a menos que se use `--manter-dbc`).

Arquivos marcados como preliminares pelo DATASUS (pastas `PRELIM`) mudam de tamanho quando são atualizados, então são
baixados de novo automaticamente.

| Sistema | Arquivos | Unidade | Campos de município (residência, ocorrência) |
|---|---|---|---|
| SIM | `DOCE{ano}` | 1 por ano, CE | `CODMUNRES`, `CODMUNOCOR` |
| SINASC | `DNCE{ano}` | 1 por ano, CE | `CODMUNRES`, `CODMUNNASC` |
| SIH | `RDCE{aamm}` | 1 por mês, CE | `MUNIC_RES`, `MUNIC_MOV` |
| SINAN | `DENGBR{aa}`, `CHIKBR{aa}`, `ZIKABR{aa}` | 1 por ano, Brasil | `ID_MN_RESI`, `ID_MUNICIP` |
| SIA (opcional) | `PACE{aamm}` | 1 por mês, CE | `PA_MUNPCN`, `PA_UFMUN` |

### Por que um descompressor em Java

O `.dbc` é um `.dbf` (dBase) comprimido com o algoritmo *PKWare DCL implode*. As bibliotecas Python que leem esse
formato (`pyreaddbc`, `datasus-dbc`) não compilavam no Python 3.14. `Dbc2Dbf.java` é uma tradução do `blast.c`
(zlib/contrib) sem dependências; `datasus.py` o compila uma vez com `javac` em `data/cache/bin`.

### População

`populacao_ibge.py` usa a API do SIDRA: tabela 6579 (estimativas anuais) e tabela 4709 (Censo 2022). Não há estimativa
para 2023, então o valor é interpolado entre 2022 e 2024. A API do Ministério também tem população, mas estava fora do ar.

## 2. Cálculo dos indicadores

`construir.py` usa DuckDB para consultar os Parquet direto do disco, sem carregar tudo na memória.

- **Unidades.** Cada indicador é calculado para 10 unidades: os 8 municípios (código IBGE de 6 dígitos),
  `IBIAPABA` (soma dos 8) e `CE` (o estado inteiro). A serra é sempre a soma dos numeradores e denominadores, nunca a
  média das taxas.
- **Residência.** Todos os indicadores contam pelo município onde a pessoa mora.
- **Ano.** Óbito: ano do óbito. Nascimento: ano do nascimento. Internação: ano de competência da AIH. Arbovirose: ano
  de notificação (`NU_ANO`). As séries semanais usam a semana de início dos sintomas (`SEM_PRI`).
- **Médias de 3 anos** (`tmi_3a`, `tmn_3a`, `rmm_3a`): soma dos óbitos do ano e dos dois anteriores dividida pela soma
  dos nascidos vivos dos mesmos três anos. Os municípios têm de 200 a 1.500 nascimentos por ano, e um único óbito
  muda a taxa anual em vários pontos.
- **Contagens guardadas.** Antes de virar indicador, tudo é contado por arquivo de origem (por exemplo
  "óbitos infantis em Tianguá, 2024, vindos de `DOCE2024`") e guardado em `data/agregados/`. Na execução seguinte,
  os arquivos que estão no disco são recontados e substituem suas linhas; os que não estão (porque não mudaram no
  FTP) continuam valendo. Como todas as contagens são somas, o resultado é idêntico ao de recalcular tudo. O valor em
  reais das internações é arredondado a centavos por arquivo, para o CSV não mudar à toa entre execuções.
- **Definições.** O dicionário `DEFINICOES` em `construir.py` é a fonte única de nome, eixo, multiplicador, unidade,
  sentido (`melhor`: "menor" ou "maior"), fonte e nota de cada indicador. O site e as planilhas leem dele, via
  `indicadores.json`.

Saídas em `web/public/dados/` (campos em [dicionario-de-dados.md](dicionario-de-dados.md)):
`anual.json`, `ficha.json`, `indicadores.json`, `semanal.json`, `causas_obito.json`, `causas_internacao.json`,
`destino_internacao.json`, `meta.json`, `indicadores.csv` e a pasta `planilhas/`.

`meta.json` registra o ano parcial (o ano corrente), os anos fechados, a última competência do SIH e a lista de
arquivos preliminares. O site usa isso para marcar dados incompletos.

## 3. Site

Next.js 16 com `output: "export"`: `next build` gera um HTML por rota em `web/out/`, com os dados já embutidos. No
navegador, o React só cuida dos filtros e dos gráficos.

| Rota | Arquivo | Conteúdo |
|---|---|---|
| `/` | `app/page.tsx` → `components/paginas/Inicio.tsx` | Resumo, 6 indicadores principais, alerta de dengue, comparação entre municípios |
| `/municipio/<slug>/` | `app/municipio/[slug]/page.tsx` → `Ficha.tsx` | Ficha de um município ou da serra (9 páginas geradas por `generateStaticParams`) |
| `/materno-infantil/` | `Materno.tsx` | 8 gráficos e tabela comparativa |
| `/arboviroses/` | `Arboviroses.tsx` | Curva semanal contra o histórico, incidência anual, situação por município |
| `/metodologia/` | `app/metodologia/page.tsx` | Notas de método e definição de cada indicador |
| `/baixar/` | `app/baixar/page.tsx` | Planilhas e arquivos para download |

Peças principais:

- `lib/dados.ts` importa os JSON no build e monta as estruturas compartilhadas (`pontos`, `pivot`, `faixaSemanal`).
  Como a importação é estática, mudar os dados exige um novo `next build`.
- `lib/indice.ts` cria um índice `(unidade, ano, indicador) → valor` e escolhe a versão de 3 anos para municípios.
- `components/Filtros.tsx` guarda o município e o ano escolhidos num *context* React, que vale para todas as páginas
  durante a visita.
- `app/tema.css` é o design system (cores dos modos claro e escuro, tipografia, espaçamento) e
  `components/SeletorTema.tsx` o seletor de tema; ver [design-system.md](design-system.md).
- `components/graficos/` tem os gráficos em SVG (d3 só calcula escalas e formatos; o desenho é React).
- `components/BotaoBaixar.tsx` + `lib/planilha.ts`: o botão "Baixar planilha" de cada cartão monta um CSV no
  navegador com os números daquele cartão.

### Por que site estático

Os dados mudam uma vez por mês. Um site estático não tem servidor para manter nem banco para proteger, é hospedado de
graça (Vercel, GitHub Pages, Netlify) e continua no ar mesmo se o DATASUS estiver fora. A opção `cacheComponents` do
Next.js 16 fica desligada porque não funciona com `output: "export"`.

## 4. Atualização automática

`.github/workflows/atualizar-dados.yml` roda no dia 5 de cada mês (ou manualmente, em *Actions*):

1. roda `datasus.py --incremental`: lista as pastas do FTP (alguns segundos) e compara com o manifesto que está no
   git. Só baixa os arquivos novos ou com tamanho/data diferentes. Na prática são os preliminares do ano corrente e
   do anterior, os meses novos do SIH e, de vez em quando, um arquivo antigo que o DATASUS revisou;
2. roda `populacao_ibge.py` e `construir.py`, que recalcula só os arquivos baixados e usa `data/agregados/` para o resto;
3. faz commit de `web/public/dados`, `data/indicadores`, `data/referencia`, `data/agregados` e do manifesto;
4. a Vercel percebe o commit e publica o site de novo.

Por que não "baixar só os 2 últimos anos": o DATASUS também revisa anos anteriores (o SIM de um ano só fica
definitivo cerca de dois anos depois, e o SIH reapresenta AIHs de meses passados). Comparar com o manifesto pega
essas revisões sem baixar o que não mudou.

**Execução completa.** Em *Actions → Atualizar dados → Run workflow*, marque "Baixar todos os anos de novo". Ela apaga
`data/agregados` e baixa tudo (cerca de 1 hora). É necessária quando muda o **cálculo** de uma contagem que já existe
(por exemplo, a lista de códigos CID de um indicador) ou quando se adiciona uma coluna nova do DATASUS, porque as
contagens guardadas dos anos antigos foram feitas com a regra anterior. Quem tem todos os microdados na própria
máquina pode, em vez disso, rodar `construir.py` localmente e fazer commit de `data/agregados`.

## Privacidade (LGPD)

Os microdados do DATASUS são públicos, mas têm registros individuais (data de nascimento, município, causa de morte).
Em municípios pequenos, cruzar esses campos pode identificar uma pessoa. Por isso:

- `data/datasus/`, `data/datasus_ce/` e `data/cache/` estão no `.gitignore` e nunca vão para o repositório nem para o site.
  A única exceção é `data/datasus/manifesto.json`, que só tem nomes, tamanhos e datas dos arquivos do FTP;
- `data/agregados/` tem contagens por município, ano e arquivo de origem, o mesmo nível de detalhe do que o site já publica;
- o site e as planilhas só publicam contagens agregadas por município e ano (ou semana).

## Como estender

### Adicionar um indicador

1. Se precisar de uma coluna nova do DATASUS, inclua-a em `colunas_ce` do sistema em `coleta/datasus.py` e rode a
   coleta de novo para os anos desejados (os arquivos já processados só são refeitos se você apagar o Parquet ou a
   entrada correspondente no manifesto).
2. Em `construir.py`, conte o numerador numa das consultas `acumular(...)` (por exemplo
   `count(*) filter (where ...) as minha_variavel`).
3. Como as contagens dos anos antigos estão guardadas sem a variável nova, rode `construir.py` com todos os
   microdados locais (ou dispare a execução completa do workflow) e faça commit de `data/agregados`.
4. Adicione a definição em `DEFINICOES`: `"codigo": (nome, eixo, multiplicador, unidade, melhor, fonte, nota)`.
5. Chame `add(u, a, "codigo", g("numerador"), g("denominador"))` no laço de indicadores.
6. Rode `construir.py` e `npm run build`. O indicador aparece sozinho no seletor, na ficha, na Metodologia e nas
   planilhas.

### Adicionar uma página

Crie `web/app/<rota>/page.tsx` (componente de servidor que lê de `lib/dados.ts`) e, se tiver filtros ou gráficos, um
componente cliente em `components/paginas/`. Inclua a rota em `PAGINAS` de `components/Filtros.tsx` para aparecer no
menu. Para um cartão com download, passe `acao={<BotaoBaixar ... />}` ao `Cartao`.

### Adicionar um município

Inclua-o em `nucleo` de `config/municipios_ibiapaba.json` e rode coleta, cálculo e build. A soma `IBIAPABA` passa a
incluí-lo; textos fixos que dizem "8 municípios" (layout, Metodologia, README) precisam ser ajustados à mão.
