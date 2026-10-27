# Dicionário de dados

Arquivos publicados pelo observatório, todos com totais agregados (nenhum registro individual). No site, ficam em
`/dados/` e estão listados na página **Baixar dados**. No repositório, em `web/public/dados/`. São gerados por
`indicadores/construir.py` e `indicadores/planilhas.py`.

Cobertura: os 8 municípios da Serra da Ibiapaba, a soma da serra (`IBIAPABA`) e o Ceará (`CE`), de 2019 até o
último mês disponível. O ano corrente é parcial. Termos técnicos estão no [glossário](glossario.md).

## Planilhas (para Excel)

Pasta `planilhas/`. Os CSV usam o padrão do Excel em português: separador `;`, vírgula decimal e UTF-8 com BOM.
O `.xlsx` tem as mesmas tabelas, uma por aba, e uma aba **Leia-me**.

| Arquivo | Aba do .xlsx | Uma linha por | Colunas |
|---|---|---|---|
| `observatorio-saude-ibiapaba.xlsx` | — | — | Todas as abas abaixo + Leia-me |
| `indicadores.csv` | Indicadores | município × ano | Município, Código IBGE, Ano e uma coluna por indicador, no formato "Nome (unidade)" |
| `indicadores-detalhado.csv` | Indicadores (detalhe) | município × ano × indicador | Município, Código IBGE, Ano, Indicador, Unidade de medida, Numerador, Denominador, Valor |
| `definicoes.csv` | Definições | indicador | Código, Indicador, Eixo, Unidade de medida, Melhor quando, Fonte, Como é calculado |
| `causas-de-obito.csv` | Causas de óbito | município × ano × grupo | Município, Código IBGE, Ano, Grupo de causa, Óbitos |
| `causas-de-internacao.csv` | Causas de internação | município × ano × grupo | Município, Código IBGE, Ano, Grupo de causa, Internações |
| `local-de-internacao.csv` | Local de internação | município × ano × local | Município, Código IBGE, Ano, Local do hospital, Internações |
| `arboviroses-por-semana.csv` | Arboviroses por semana | município × doença × ano × semana | Município, Código IBGE, Doença, Ano, Semana epidemiológica, Casos prováveis |

Na coluna "Código IBGE", a serra aparece como `IBIAPABA` e o estado como `CE`. Células vazias significam que o
indicador não se aplica ou não pôde ser calculado (por exemplo, médias de 3 anos nos dois primeiros anos da série).

Os botões **Baixar planilha** dos cartões do site geram CSV no mesmo padrão, com o recorte que está na tela.

## Arquivos do site (JSON e CSV longo)

Os arquivos que o site lê no build. Nomes de campos em `snake_case`; valores numéricos com ponto decimal; códigos de
unidade como texto.

### `anual.json` e `indicadores.csv`

A tabela principal, em formato longo. `indicadores.csv` é a mesma tabela com separador vírgula e ponto decimal (para
R, Python etc.).

| Campo | Tipo | Descrição |
|---|---|---|
| `unidade` | texto | Código IBGE de 6 dígitos, `IBIAPABA` ou `CE` |
| `nome` | texto | Nome da unidade |
| `ano` | inteiro | Ano de referência |
| `indicador` | texto | Código do indicador (tabela no fim desta página) |
| `numerador` | número | Contagem do evento (ou o próprio valor, nos indicadores de contagem) |
| `denominador` | número ou vazio | Base da taxa; vazio nos indicadores de contagem |
| `valor` | número | `numerador ÷ denominador × multiplicador`, arredondado a 2 casas |

### `ficha.json`

Uma linha por unidade × ano × indicador (sem o Ceará como unidade), já com as comparações da ficha do município.

| Campo | Descrição |
|---|---|
| `id` | `unidade-ano-indicador` |
| `unidade`, `ano`, `indicador` | Como em `anual.json` |
| `nome`, `eixo` | Nome e eixo do indicador |
| `valor` | Valor no ano |
| `anterior` | Valor no ano anterior (ou vazio) |
| `variacao` | `valor − anterior`, na unidade do indicador (pontos percentuais nos percentuais) |
| `ibiapaba` | Valor da serra no mesmo ano |
| `ceara` | Valor do Ceará no mesmo ano |

### `indicadores.json`

Definição de cada indicador: `indicador`, `nome`, `eixo`, `unidade_medida`, `melhor` (`"menor"`, `"maior"` ou vazio),
`fonte` e `nota`.

### `semanal.json`

| Campo | Descrição |
|---|---|
| `unidade` | Código da unidade |
| `agravo` | `dengue` ou `chik` |
| `ano`, `semana` | Ano e semana epidemiológica de início dos sintomas (`SEM_PRI`) |
| `casos` | Casos prováveis (dengue: todas as notificações dos arquivos públicos; chikungunya: exceto descartadas) |

### `causas_obito.json` e `causas_internacao.json`

`unidade`, `ano`, `grupo` (capítulo da CID-10 da causa básica do óbito ou do diagnóstico principal da internação) e
`obitos` ou `internacoes`.

### `destino_internacao.json`

`unidade`, `ano`, `destino` e `internacoes`. Os destinos são: Próprio município, Outro município da serra, Sobral,
Fortaleza e Outros municípios do CE. Só há destinos no Ceará porque o arquivo do SIH usado é o do estado.

### `meta.json`

| Campo | Descrição |
|---|---|
| `gerado_em` | Data e hora do processamento |
| `ano_parcial` | Ano corrente (incompleto) |
| `anos_fechados` | Anos anteriores ao corrente presentes nos dados |
| `ano_arbo` | Último ano com dados de dengue |
| `tem_ceara` | Se a unidade `CE` foi calculada |
| `preliminares` | Arquivos do DATASUS ainda preliminares nesta versão |
| `sih_ultima_competencia` | Último mês do SIH disponível, no formato `AAMM` |
| `municipios` | Código e nome dos 8 municípios |

## Indicadores

| Código | Nome | Unidade | Fonte | Como é calculado |
|---|---|---|---|---|
| `populacao` | População residente | hab. | IBGE | Estimativas anuais; 2022 = Censo; 2023 interpolado. |
| `nascidos_vivos` | Nascidos vivos | nascimentos | SINASC | — |
| `tmi` | Mortalidade infantil | por mil nascidos vivos | SIM + SINASC | Óbitos de menores de 1 ano ÷ nascidos vivos. |
| `tmi_3a` | Mortalidade infantil (média de 3 anos) | por mil nascidos vivos | SIM + SINASC | Soma do ano e dos 2 anteriores; estabiliza municípios pequenos. |
| `tmn` | Mortalidade neonatal | por mil nascidos vivos | SIM + SINASC | Óbitos com menos de 28 dias ÷ nascidos vivos. |
| `tmn_3a` | Mortalidade neonatal (média de 3 anos) | por mil nascidos vivos | SIM + SINASC | — |
| `obitos_maternos` | Óbitos maternos | óbitos | SIM | Causa básica O00–O95, O98–O99 ou A34. |
| `rmm_3a` | Razão de mortalidade materna (3 anos) | por 100 mil nascidos vivos | SIM + SINASC | — |
| `pct_cesarea` | Partos cesáreos | % dos partos | SINASC | Excluídos partos com tipo ignorado. |
| `pct_prenatal7` | 7 ou mais consultas de pré-natal | % dos nascidos vivos | SINASC | Excluídos registros com nº de consultas ignorado. |
| `pct_prenatal_1tri` | Pré-natal iniciado no 1º trimestre | % dos nascidos vivos | SINASC | Mês de início 1 a 3; excluídos ignorados. |
| `pct_baixo_peso` | Baixo peso ao nascer | % dos nascidos vivos | SINASC | Menos de 2.500 g. |
| `pct_prematuro` | Prematuridade | % dos nascidos vivos | SINASC | Menos de 37 semanas de gestação. |
| `pct_mae_adolescente` | Mães adolescentes | % dos nascidos vivos | SINASC | Mãe com 10 a 19 anos. |
| `obitos` | Óbitos | óbitos | SIM | — |
| `tx_mortalidade` | Mortalidade geral | por mil hab. | SIM + IBGE | Taxa bruta, sem padronização por idade. |
| `obitos_dcnt_prematuros` | Óbitos prematuros por doenças crônicas | óbitos (30–69 anos) | SIM | Câncer, diabetes, doenças circulatórias e respiratórias crônicas. |
| `tx_causas_externas` | Mortalidade por causas externas | por 100 mil hab. | SIM + IBGE | Acidentes, violências e lesões (V01–Y98). |
| `tx_homicidio` | Homicídios | por 100 mil hab. | SIM + IBGE | Agressões X85–Y09. |
| `tx_transito` | Mortes no trânsito | por 100 mil hab. | SIM + IBGE | V01–V89. |
| `obitos_covid` | Óbitos por COVID-19 | óbitos | SIM | B34.2, U07.1, U07.2. |
| `internacoes` | Internações SUS | internações | SIH | Por ano de competência da AIH. |
| `tx_internacao` | Taxa de internação SUS | por mil hab. | SIH + IBGE | — |
| `pct_icsap` | Internações sensíveis à atenção primária | % das internações (exceto partos) | SIH | Lista brasileira de ICSAP, Portaria 221/2008. |
| `pct_fora_serra` | Internações fora da Ibiapaba | % das internações | SIH | Hospital localizado fora dos 8 municípios. |
| `pct_obito_hospitalar` | Mortalidade hospitalar | % das internações | SIH | Internações que terminaram em óbito. |
| `gasto_sih_per_capita` | Gasto SUS com internações por habitante | R$ por hab. | SIH + IBGE | Valor total das AIHs ÷ população. |
| `dengue_casos` | Casos prováveis de dengue | casos | SINAN | Notificações exceto descartadas, por ano de notificação. |
| `dengue_incidencia` | Incidência de dengue | por 100 mil hab. | SINAN + IBGE | Acima de 300/100 mil é considerado epidemia (MS). |
| `dengue_graves` | Dengue com sinais de alarme ou grave | casos | SINAN | — |
| `dengue_obitos` | Óbitos por dengue | óbitos | SINAN | Evolução = óbito pelo agravo. |
| `chik_casos` | Casos prováveis de chikungunya | casos | SINAN | — |
| `chik_incidencia` | Incidência de chikungunya | por 100 mil hab. | SINAN + IBGE | — |
| `zika_casos` | Casos prováveis de zika | casos | SINAN | — |

Nos municípios, o site mostra `tmi_3a` e `tmn_3a` no lugar de `tmi` e `tmn`; na serra e no Ceará mostra as taxas
anuais, porque os números já são grandes o bastante. A razão de mortalidade materna só é calculada em média de 3 anos.
As planilhas trazem as duas versões.
