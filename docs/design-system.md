# Design system

Todas as cores, tamanhos de texto e espaçamentos do site vêm de variáveis CSS definidas em
[`web/app/tema.css`](../web/app/tema.css). Os componentes (`web/app/globals.css` e os gráficos) usam só essas
variáveis, nunca um valor fixo. É isso que permite trocar entre modo claro e escuro sem mexer em nenhum componente.

## Modo claro e escuro

O visitante escolhe no seletor do topo da página:

| Opção | O que faz | Como fica no HTML |
|---|---|---|
| **Automático** (padrão) | Segue o tema do sistema operacional ou do navegador | `<html>` sem atributo |
| **Claro** | Força o modo claro | `<html data-tema="claro">` |
| **Escuro** | Força o modo escuro | `<html data-tema="escuro">` |

A escolha fica salva no navegador (`localStorage`, chave `tema`). Um script curto no `<head>` (`SCRIPT_TEMA`, em
[`components/SeletorTema.tsx`](../web/components/SeletorTema.tsx)) aplica o tema salvo antes de a página aparecer,
para não piscar o tema errado ao carregar. Se o navegador bloquear o armazenamento, o seletor funciona só na página
aberta.

### Como funciona

Cada cor é declarada uma vez, com os dois valores, usando a função CSS `light-dark()`:

```css
:root {
  color-scheme: light dark;          /* automático: o navegador escolhe pelo sistema */
  --fundo: light-dark(var(--neutro-50), var(--neutro-950));
}
:root[data-tema="claro"]  { color-scheme: light; }
:root[data-tema="escuro"] { color-scheme: dark; }
```

`light-dark()` devolve o primeiro valor quando o `color-scheme` do elemento é claro e o segundo quando é escuro. Assim
não é preciso repetir a lista de cores numa media query para o modo escuro. Ela funciona em todos os navegadores
atuais (Chrome e Edge 123+, Firefox 120+, Safari 17.5+). `light-dark()` só aceita cores, por isso a sombra tem um
token de cor separado (`--sombra-cor`).

## As três camadas de tokens

### 1. Paleta base

Cores brutas, nomeadas por família e tom (50 = mais claro, 950 = mais escuro). **Não use direto nos componentes**:
elas existem para compor os tokens semânticos.

| Família | Tons | Uso |
|---|---|---|
| `--neutro-*` | 0 a 950 | Fundos, texto, bordas. Levemente esverdeados, para combinar com a marca |
| `--verde-*` | 300, 700, 900, 950 | Cor da marca (verde de mata da serra) |
| `--verde-claro-*` | 300, 700 | Variação "bom" |
| `--ambar-*`, `--azul-*`, `--terracota-*` | 300 e 600 (+ âmbar 700) | Séries de gráficos e alerta |
| `--vermelho-*` | 300, 600, 700 | Situação crítica e "ruim" |

Em geral o tom 600–700 é usado no modo claro e o 300 no escuro: cores claras sobre fundo escuro, escuras sobre fundo
claro.

### 2. Tokens semânticos

Nomeados pela **função**, não pela cor. É o que os componentes usam.

| Token | Para quê | Claro | Escuro |
|---|---|---|---|
| `--fundo` | Fundo da página | neutro-50 | neutro-950 |
| `--painel` | Cartões, campos, tabelas | neutro-0 | neutro-900 |
| `--texto` | Texto principal | neutro-900 | neutro-100 |
| `--texto-suave` | Notas, rótulos, legendas | neutro-600 | neutro-400 |
| `--linha` | Bordas e divisórias | neutro-200 | neutro-800 |
| `--topo`, `--topo-texto` | Cabeçalho do site | verde-900 / neutro-50 | verde-950 / neutro-100 |
| `--destaque` | Links, botões, foco, item ativo | verde-700 | verde-300 |
| `--sobre-destaque` | Texto sobre fundo `--destaque` | neutro-0 | neutro-950 |
| `--foco` | Contorno de foco do teclado | = `--destaque` | = `--destaque` |
| `--bom` / `--ruim` | Variação que melhora / piora | verde-claro-700 / vermelho-700 | verde-claro-300 / vermelho-300 |
| `--alerta` | Situação "média" | âmbar-700 | âmbar-300 |
| `--critica` | Epidemia, acima do máximo histórico | vermelho-600 | vermelho-300 |
| `--serie-1` … `--serie-4` | Séries de gráficos, nesta ordem | verde, âmbar, azul, terracota (700/600) | os mesmos (300) |
| `--apagada` | Contexto nos gráficos (a serra atrás do município, faixa histórica) | neutro-300 | neutro-700 |
| `--referencia` | Linha do Ceará (tracejada) | neutro-500 | neutro-400 |
| `--grade` | Linhas de grade dos gráficos | neutro-100 | neutro-850 |
| `--eixo` | Linha-guia do cursor nos gráficos | neutro-450 | neutro-500 |
| `--sombra` | Dica flutuante dos gráficos | preto 12% | preto 45% |

Nos gráficos, os componentes usam o objeto `COR` de
[`components/graficos/base.tsx`](../web/components/graficos/base.tsx), que aponta para esses tokens
(`COR.destaque` = `var(--serie-1)` etc.). Como o SVG recebe `var(...)`, os gráficos trocam de tema sem redesenhar.

### 3. Escalas

Iguais nos dois modos.

| Grupo | Tokens |
|---|---|
| Fontes | `--fonte-corpo` (Source Sans 3), `--fonte-display` (Source Serif 4, títulos) |
| Tamanho de texto | `--texto-2xs` 11px · `--texto-xs` 13px · `--texto-sm` 14px · `--texto-md` 15px · `--texto-base` 16px · `--texto-lg` 17px · `--texto-xl` 18px · `--texto-kpi` 34px |
| Espaçamento | `--esp-1` 4px · `--esp-2` 8px · `--esp-3` 12px · `--esp-4` 16px · `--esp-5` 20px · `--esp-6` 24px · `--esp-8` 32px · `--esp-12` 48px |
| Forma | `--raio` 8px · `--raio-pilula` 999px · `--largura-max` 1200px |

Os títulos de página usam `clamp()` para crescer com a tela, por isso não têm token.

## Contraste (acessibilidade)

Todas as combinações abaixo foram conferidas nos dois modos pelo critério WCAG 2.1 AA: 4,5:1 para texto e 3:1 para
elementos gráficos e texto grande.

- Texto: `--texto` e `--texto-suave` sobre `--fundo` e `--painel`; `--destaque`, `--bom` e `--ruim` sobre `--painel`;
  `--sobre-destaque` sobre `--destaque`; `--topo-texto` sobre `--topo`.
- Gráficos: `--serie-2` a `--serie-4`, `--referencia`, `--eixo`, `--alerta` e `--critica` sobre `--painel`.

Ao criar ou mudar uma cor, confira o contraste nos **dois** modos.

## Como usar e estender

- **Nova regra de CSS:** use tokens semânticos e de escala (`color: var(--texto-suave); gap: var(--esp-3)`). Se um
  valor não existe na escala, prefira o mais próximo a criar um valor solto.
- **Nova cor:** acrescente o tom na paleta base, se precisar, e crie um token semântico com
  `light-dark(claro, escuro)`. Nunca use a paleta base direto num componente: isso quebra o modo escuro ou deixa as
  cores fora de sincronia.
- **Nova série de gráfico:** acrescente `--serie-5` em `tema.css` e `serie5` em `COR`.
- **Testar os temas:** use o seletor do topo. No DevTools do Chrome há também *Rendering → Emulate CSS media feature
  prefers-color-scheme*, para testar o modo Automático.
