# Observatório de Saúde da Serra da Ibiapaba — Plano

> Base: testes reais na API `https://apidadosabertos.saude.gov.br` (Swagger 2.0, ~120 endpoints, sem autenticação) feitos em 20/10/2026.
> Script de teste: [testes/teste_api.py](testes/teste_api.py) · Municípios: [config/municipios_ibiapaba.json](config/municipios_ibiapaba.json)

---

## 1. Recorte territorial

| Município | IBGE 6 | IBGE 7 | Pop. 2022 |
|---|---|---|---|
| Carnaubal | 230340 | 2303402 | 17.210 |
| Croatá | 230423 | 2304236 | 17.481 |
| Guaraciaba do Norte | 230500 | 2305001 | 42.053 |
| Ibiapina | 230530 | 2305308 | 23.965 |
| São Benedito | 231230 | 2312304 | 47.640 |
| Tianguá | 231340 | 2313401 | 81.506 |
| Ubajara | 231360 | 2313609 | 32.767 |
| Viçosa do Ceará | 231410 | 2314102 | 59.712 |
| *Opcionais: Ipu, Ipueiras* | 230580 / 230590 | | |

**Atenção:** desde a regionalização de 2023 a antiga 13ª RS (Tianguá) foi incorporada à **5ª RS Sobral (23011)**. Não existe filtro "Ibiapaba" na API — sempre filtrar pela lista de municípios e agregar no observatório.

---

## 2. Resultado dos testes da API

### 2.1 Comportamento geral
- Tempo de resposta bom (0,5–2 s; primeira página de dengue chegou a 15 s).
- `offset` = **deslocamento de linhas**, não número de página (`offset=10` pula 10 linhas).
- **Teto de `limit` varia por endpoint** e é aplicado silenciosamente: CNES `/cnes/estabelecimentos` = 20, SISVAN = 20, maioria = 1000. É preciso paginar até vir menos que o teto.
- **Código IBGE com 6 dígitos** na maioria; a população SVSA exige **7 dígitos**. Códigos de 7 dígitos em endpoints de 6 dígitos retornam vazio (sem erro).
- Strings acentuadas chegam corretas (JSON com `á`), o problema de "�" é só do console Windows.

### 2.2 Classificação dos endpoints (filtrando pelos 8 municípios)

**✅ Confiáveis — usar via API**

| Endpoint | Filtro | Uso no observatório |
|---|---|---|
| `/cnes/estabelecimentos` | `codigo_municipio` (teto 20/pág) | Rede de serviços + lat/long para mapa |
| `/arboviroses/dengue`, `/chikungunya`, `/zikavirus` | `id_municip` + `nu_ano` | Casos por semana epidemiológica (Tianguá: 136 notificações em 2025, 1.321 em 2026) |
| `/sisagua/vigilancia-parametros-basicos` | `codigo_ibge` + `ano` | Qualidade da água (cloro, turbidez, coliformes) |
| `/sisagua/controle-mensal-parametros-basicos`, `/pontos-de-captacao` | `codigo_ibge` | Água: controle do prestador e mananciais |
| `/daf/estoque-medicamentos-bnafar-horus` | `codigo_municipio` | Estoque de medicamentos da farmácia básica |
| `/atencao-primaria/indicador-desempenho-programa-previne-brasil` | `codigo_municipio` | 7 indicadores da APS por quadrimestre |
| `/atencao-primaria/cadastro-vinculado-programa-previne-brasil` | `codigo_municipio_ibge` | Cobertura/cadastro de equipes |
| `/atencao-primaria/pmmb-serie-historica` | `ibge` | Mais Médicos ativos |
| `/vigilancia-e-meio-ambiente/svsa-populacao-residente` | `cod_mun` (**7 dígitos**) + `ano` | Denominadores por sexo e idade |
| `/macrorregiao-e-regiao-de-saude/municipio` | `sigla_uf` | Tabela de referência |

**⚠️ Problemáticos — não usar a API como fonte principal**

| Endpoint | Problema observado |
|---|---|
| `sih-procedimentos-hospitalares`, `sia-procedimentos-ambulatoriais` | Retornam exatamente 12 linhas/ano para todo município, e `nu_comp=202406` em Tianguá devolveu 1 procedimento. Filtro é aplicado **depois** da paginação → dados incompletos |
| `cnes-leitos`, `cnes-equipamentos` | Mesmo bug de paginação (limit=5 devolve <5 linhas). Leitos param em 2018 |
| `cnes-profissionais` | Só competências 2009–2010 |
| `sisvan/estado-nutricional` | Só dados de 2008; filtro por competência recente retorna vazio |
| `siaps-atendimento-individual` | Vazio para qualquer município do CE |
| `hospitais-e-leitos` | HTTP 500 |
| SIM, SINASC, SRAG, Vacinação PNI | **Sem filtro de município** → exigiria baixar o Brasil inteiro (milhões de linhas) |

### 2.3 Conclusão dos testes
A API cobre bem **vigilância de arboviroses, água, APS (Previne), medicamentos, rede CNES e população**. Para **mortalidade, nascimentos, internações, produção ambulatorial e vacinação**, usar fontes complementares (seção 3.2).

---

## 3. Plano de recuperação de dados

### 3.1 Coletor da API (Python)
1. **Cliente genérico** com: paginação por `offset` até `len(página) < teto`, teto configurável por endpoint, retry com backoff (3×), timeout de 120 s, pausa curta entre chamadas.
2. **Catálogo de endpoints** em YAML: caminho, parâmetro de município, formato do código (6/7), filtros de período, periodicidade.
3. **Carga incremental**: arboviroses por `nu_ano` (ano corrente + anterior a cada execução, pois há reclassificação de casos); SISAGUA por `ano`; Previne por quadrimestre; CNES e BNAFAR como foto (snapshot) datada.
4. **Camadas de dados** (Parquet + DuckDB):
   - `bruto/` — JSON/Parquet exatamente como veio, com data da coleta
   - `tratado/` — tipos corrigidos, datas padronizadas (`dtobito` vem como `DDMMAAAA`), códigos IBGE unificados em 6 dígitos
   - `indicadores/` — tabelas agregadas por município × período, prontas para o painel
5. **Validação** a cada execução: rodar `testes/teste_api.py` antes; alertar se um endpoint confiável voltar vazio ou mudar de colunas.

### 3.2 Fontes complementares
| Lacuna | Fonte recomendada |
|---|---|
| Óbitos (SIM), nascidos vivos (SINASC), internações (SIH), ambulatorial (SIA), SINAN completo | FTP DATASUS via biblioteca **PySUS** (arquivos DBC por UF/ano → filtrar CE e os 8 municípios) |
| Indicadores estaduais e regionais do Ceará | **IntegraSUS** (SESA-CE) |
| Cobertura vacinal | SI-PNI/TabNet ou painel de cobertura vacinal do MS |
| Socioeconômico (renda, saneamento, IDH) | API **IBGE SIDRA** / Censo 2022 |

### 3.3 Cronograma de coleta
| Frequência | Dados |
|---|---|
| Semanal | Arboviroses (época de chuvas: jan–jun) |
| Mensal | SISAGUA, BNAFAR, CNES, SIH/SIA (PySUS, com ~2 meses de defasagem) |
| Quadrimestral | Previne Brasil |
| Anual | População, SIM/SINASC consolidados, IBGE |

---

## 4. Plano do Observatório

### 4.1 Objetivo
Oferecer a gestores, conselhos municipais de saúde, pesquisadores e população da Ibiapaba um painel público, comparativo entre os 8 municípios, com indicadores atualizados e série histórica.

### 4.2 Eixos e indicadores
| Eixo | Indicadores | Fonte |
|---|---|---|
| **1. Perfil demográfico** | População por sexo/faixa etária, pirâmide etária, envelhecimento | SVSA (API) |
| **2. Vigilância — arboviroses** | Incidência de dengue/chikungunya por 100 mil hab., curva por semana epidemiológica, % hospitalizados, óbitos, sorotipos | Arboviroses (API) |
| **3. Água e ambiente** | % amostras fora do padrão (cloro residual, turbidez, coliformes), mananciais, formas de abastecimento | SISAGUA (API) |
| **4. Atenção Primária** | 7 indicadores do Previne (pré-natal, citopatológico, vacinação infantil, hipertensos, diabéticos), pessoas cadastradas, médicos do Mais Médicos | Previne + PMMB (API) |
| **5. Rede e recursos** | Estabelecimentos por tipo, mapa georreferenciado, leitos por mil hab., estoque de medicamentos | CNES + BNAFAR (API) |
| **6. Mortalidade e nascimentos** | Mortalidade infantil e materna, causas de óbito (CID-10), baixo peso ao nascer, partos cesáreos, pré-natal adequado | SIM/SINASC (PySUS) |
| **7. Assistência hospitalar** | Internações por condições sensíveis à APS (ICSAP), fluxo de pacientes (onde o morador da Ibiapaba interna), gasto SUS | SIH/SIA (PySUS) |

### 4.3 Arquitetura proposta (baixo custo)
```
GitHub Actions (agenda) ──► coletor Python ──► Parquet/DuckDB ──► painel
                                │                                   │
                          teste_api.py                    Streamlit ou Evidence.dev
                        (falha = alerta)                  (hospedagem gratuita)
```
- **Por quê:** sem servidor de banco, versionável, custo zero até o volume crescer. Se precisar de multiusuário/BI, migrar para PostgreSQL + Metabase.

### 4.4 Fases
| Fase | Entregas | Duração estimada |
|---|---|---|
| **0. Testes da API** ✅ | Matriz de confiabilidade, script de teste | concluída |
| **1. Coletor + base** | Cliente paginado, catálogo, carga histórica dos endpoints confiáveis (2019→hoje) | 2–3 semanas |
| **2. MVP do painel** | Eixos 1–5 com dados da API, comparação entre municípios, mapa | 3 semanas |
| **3. Fontes complementares** | PySUS para SIM/SINASC/SIH, eixos 6–7 | 3–4 semanas |
| **4. Automação e qualidade** | Coleta agendada, alertas, notas metodológicas por indicador | 2 semanas |
| **5. Publicação** | Boletins periódicos (ex.: boletim de arboviroses), validação com a 5ª RS / secretarias municipais | contínuo |

### 4.5 Cuidados
- **LGPD:** arboviroses, SIM e vacinação são microdados individuais (idade, sexo, raça, datas). Publicar só agregados; suprimir células com menos de 5 casos em municípios pequenos (Carnaubal, Croatá).
- **Residência × ocorrência:** `id_municip` nas arboviroses é o município de **notificação**; para incidência usar `id_mn_resi` (residência). Isso exige baixar a UF/região e filtrar localmente para não perder moradores notificados em Sobral/Fortaleza.
- **Atraso de notificação:** dados do ano corrente são preliminares — sinalizar no painel.
- **Instabilidade da API:** endpoints mudam sem aviso (ex.: Previne foi substituído por novo modelo de financiamento da APS em 2025). O teste automatizado serve como sentinela.

---

## 5. Próximos passos imediatos
1. Confirmar o recorte: 8 municípios do núcleo ou incluir Ipu/Ipueiras.
2. Implementar o cliente paginado e fazer a carga histórica de arboviroses + SISAGUA + Previne.
3. Testar PySUS com SIM-CE 2023 para validar o eixo de mortalidade.
