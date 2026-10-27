# Site do observatório (Next.js)

Site estático: `npm run build` lê os JSON de `public/dados/` (gerados por `indicadores/construir.py`, na raiz
do repositório) e gera `out/` com uma página HTML por rota.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # gera out/
npm run lint
```

| Caminho | Conteúdo |
|---|---|
| `app/` | Rotas: início, `municipio/[slug]` (uma ficha por município), materno-infantil, arboviroses, metodologia, baixar |
| `components/paginas/` | Conteúdo interativo de cada página |
| `components/graficos/` | Gráficos em SVG desenhados com d3 (barras, linhas, semanal, empilhado) |
| `lib/dados.ts` | Leitura dos JSON no build |
| `lib/formato.ts` | Formatação de números em pt-BR |
| `lib/planilha.ts`, `components/BotaoBaixar.tsx` | Botão "Baixar planilha" dos cartões: gera no navegador um CSV no padrão do Excel em português |
| `public/dados/` | Dados do site; também ficam disponíveis para download em `/dados/` (planilhas em `/dados/planilhas/`) |

O município e o ano escolhidos valem para todas as páginas durante a visita (`components/Filtros.tsx`).

Arquitetura completa e glossário: [docs/](../docs/README.md).
