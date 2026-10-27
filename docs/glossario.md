# Glossário

Termos usados no site, nas planilhas e no código. Nomes de variáveis do código aparecem entre crases.

## Fontes de dados

| Termo | Significado |
|---|---|
| **DATASUS** | Departamento de Informática do SUS. Publica os microdados dos sistemas de informação em `ftp.datasus.gov.br`. |
| **SIM** | Sistema de Informações sobre Mortalidade. Um registro por declaração de óbito. |
| **SINASC** | Sistema de Informações sobre Nascidos Vivos. Um registro por declaração de nascido vivo. |
| **SIH** (SIH/SUS) | Sistema de Informações Hospitalares. Um registro por AIH paga pelo SUS. Não inclui internações particulares nem de planos de saúde. |
| **SINAN** | Sistema de Informação de Agravos de Notificação. Um registro por notificação de doença de notificação obrigatória (aqui: dengue, chikungunya e zika). |
| **SIA** | Sistema de Informações Ambulatoriais. Produção de consultas, exames e procedimentos. Coletado só como opção; ainda não usado. |
| **CNES** | Cadastro Nacional de Estabelecimentos de Saúde. Disponível na API; ainda não usado no site. |
| **IBGE / SIDRA** | Instituto Brasileiro de Geografia e Estatística e seu sistema de tabelas. Fonte da população (estimativas anuais e Censo 2022). |
| **API de Dados Abertos** | `apidadosabertos.saude.gov.br`, mantida pelo Ministério da Saúde. Testada no início do projeto e descartada para os indicadores principais (ver [arquitetura](arquitetura.md#por-que-o-ftp-do-datasus-e-não-a-api)). |
| **Microdados** | Arquivos com um registro por evento (óbito, nascimento, internação, notificação). Nunca são publicados por este projeto. |
| **Arquivo preliminar** | Arquivo de um ano ainda não fechado pelo Ministério. Os números podem mudar quando o arquivo definitivo sair. Listados em `meta.json` → `preliminares`. |
| **`.dbc` / `.dbf`** | Formato dos arquivos do DATASUS: `.dbf` é uma tabela dBase; `.dbc` é o mesmo arquivo comprimido. |
| **Parquet** | Formato de tabela em colunas, compacto e rápido de consultar, usado para guardar os microdados filtrados. |

## Território

| Termo | Significado |
|---|---|
| **Serra da Ibiapaba** / `IBIAPABA` | Os 8 municípios do núcleo: Carnaubal, Croatá, Guaraciaba do Norte, Ibiapina, São Benedito, Tianguá, Ubajara e Viçosa do Ceará. Os valores da serra são a soma dos 8 (numeradores somados ÷ denominadores somados). |
| **`CE`** | O estado do Ceará inteiro, usado como referência. |
| **Código IBGE** | Identificador do município. O IBGE usa 7 dígitos (Tianguá = 2313401); o DATASUS usa os 6 primeiros (231340). O projeto usa 6 dígitos em quase tudo. |
| **Município de residência** | Onde a pessoa mora. É o critério de **todos** os indicadores do observatório. |
| **Município de ocorrência / atendimento** | Onde o evento aconteceu (hospital do parto, da internação, do óbito). Usado só para o indicador de internações fora da serra e para o gráfico "Onde os moradores se internam". |
| **Região de Saúde** | Divisão do estado para organizar o SUS. A antiga 13ª Região (Tianguá) foi incorporada à 5ª Região de Saúde (Sobral) em 2023. O observatório usa os 8 municípios, não a região oficial. |
| **Unidade** | No código, qualquer recorte com indicadores: um município, `IBIAPABA` ou `CE`. |
| **Slug** | Versão do nome usada na URL, sem acentos e espaços (`viçosa do ceará` → `vicosa-do-ceara`). |

## Termos de saúde

| Termo | Significado |
|---|---|
| **Nascido vivo** | Criança que nasceu com qualquer sinal de vida. Denominador das taxas materno-infantis. |
| **Óbito infantil** | Óbito antes de completar 1 ano. |
| **Óbito neonatal** | Óbito antes de completar 28 dias. |
| **Óbito materno** | Óbito durante a gravidez ou até 42 dias após, por causa ligada à gestação (CID-10 O00–O95, O98–O99 e A34). |
| **Taxa de mortalidade infantil (TMI)** | Óbitos infantis ÷ nascidos vivos × 1.000. |
| **Razão de mortalidade materna (RMM)** | Óbitos maternos ÷ nascidos vivos × 100.000. Chama-se razão, não taxa, porque o denominador não é a população exposta. |
| **Média de 3 anos** | Soma dos eventos do ano e dos 2 anteriores ÷ soma dos denominadores dos mesmos 3 anos. Usada nos municípios porque números pequenos fazem a taxa anual oscilar muito. |
| **CID-10** | Classificação Internacional de Doenças, 10ª revisão. Códigos como `I21` (infarto) ou `A90` (dengue). |
| **Capítulo da CID-10** | Grupo de códigos por sistema do corpo ou tipo de causa (ex.: "Aparelho circulatório" = I00–I99). Usado nos gráficos de causas. |
| **Causa básica** | A doença ou lesão que iniciou a cadeia de eventos que levou à morte. É a causa usada nas estatísticas de óbito. |
| **Diagnóstico principal** | O motivo da internação, registrado na AIH. |
| **Causas externas** | Acidentes e violências: trânsito, quedas, afogamentos, agressões, lesões autoprovocadas (CID-10 V01–Y98). |
| **DCNT** | Doenças crônicas não transmissíveis: câncer, diabetes, doenças circulatórias e respiratórias crônicas. "Óbito prematuro por DCNT" é entre 30 e 69 anos. |
| **AIH** | Autorização de Internação Hospitalar: o documento que o hospital apresenta ao SUS para receber pela internação. Cada AIH é contada como uma internação. |
| **Competência** | Mês e ano em que a AIH foi apresentada para pagamento. Pode ser alguns meses depois da alta. |
| **ICSAP** | Internações por Condições Sensíveis à Atenção Primária: doenças que uma atenção básica eficaz costuma evitar que cheguem ao hospital (ex.: diabetes descompensado, pneumonia, infecção urinária). Lista oficial da Portaria SAS/MS 221/2008. Quanto menor o percentual, melhor. |
| **Caso provável** | Notificação de arbovirose que não foi descartada (inclui confirmados e casos ainda em investigação). É o critério do Ministério da Saúde para os boletins. |
| **Arboviroses** | Doenças transmitidas por mosquitos, aqui dengue, chikungunya e zika (todas pelo *Aedes aegypti*). |
| **Dengue com sinais de alarme / grave** | Classificação final 11 e 12 no SINAN: casos com risco de evoluir mal. |
| **Incidência** | Casos novos ÷ população × 100.000. |
| **Limiar de epidemia** | Incidência de dengue de 300 casos prováveis por 100 mil habitantes no ano, referência do Ministério da Saúde. Abaixo de 100 o observatório chama de "baixa"; de 100 a 299, "média". |
| **Semana epidemiológica (SE)** | Semana padronizada de domingo a sábado usada na vigilância. O ano tem 52 ou 53 semanas. |
| **Faixa histórica** | Nos gráficos semanais, o máximo e a mediana de casos da mesma semana nos anos anteriores. Semanas acima do máximo ficam em vermelho. |

## Termos dos números

| Termo | Significado |
|---|---|
| **Numerador / denominador** | As duas contagens que formam a taxa (ex.: óbitos infantis e nascidos vivos). Estão na planilha "Indicadores (detalhe)" para quem quiser recalcular ou agregar. |
| **p.p.** (pontos percentuais) | Diferença entre dois percentuais. De 44% para 63% são +19 p.p. (e não +19%). |
| **Variação** | Valor do ano menos o valor do ano anterior, na unidade do indicador. |
| **Ano parcial** | O ano corrente, ainda incompleto. Nos gráficos aparece com marcador vazado e asterisco. |
| **Anos fechados** | Anos anteriores ao corrente. Os mais recentes ainda podem ter arquivos preliminares. |
| **Melhor quando** (`melhor`) | Se o indicador melhora quando sobe (`maior`) ou quando desce (`menor`). Define a cor verde/vermelha da variação. Vazio quando não há direção desejável (ex.: população). |

## Termos de tecnologia

| Termo | Significado |
|---|---|
| **DuckDB** | Banco de dados analítico embutido, usado em Python para consultar os Parquet com SQL. |
| **Next.js** | Framework React usado no site. |
| **Exportação estática** (`output: "export"`) | Modo em que o Next.js gera arquivos HTML prontos no build, sem servidor. |
| **`generateStaticParams`** | Função que diz ao Next.js quais fichas de município gerar no build. |
| **Componente de servidor / cliente** | No Next.js, componentes de servidor rodam só no build (leem os dados); componentes cliente (`"use client"`) rodam no navegador (filtros, gráficos, botões de download). |
| **d3** | Biblioteca de visualização. Aqui só calcula escalas, eixos e formatação de números. |
| **Vercel** | Serviço de hospedagem recomendado; publica o site a cada commit no GitHub. |
| **GitHub Actions** | Automação do GitHub que roda a atualização mensal dos dados. |
| **Manifesto** | `data/datasus/manifesto.json`: registro de cada arquivo já baixado (tamanho, data no FTP, se é preliminar), usado para não baixar de novo o que não mudou. |
| **Contagens agregadas** | `data/agregados/*.csv`: contagens por município, ano e arquivo de origem do DATASUS, guardadas no git para que a atualização mensal só precise baixar os arquivos que mudaram. |
| **Execução incremental** | Modo da coleta (`--incremental`) que confia no manifesto e só baixa arquivos novos ou alterados no FTP. |
| **BOM** | Marca no início de um arquivo de texto que avisa ao Excel que o arquivo é UTF-8. Sem ela, os acentos aparecem errados nos CSV. |
