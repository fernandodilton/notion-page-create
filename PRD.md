# REGRAS DO SISTEMA

## Visão Geral
Sistema GAS que recebe um HTTP POST via webhook (iOS Shortcuts), processa o input, cria uma página no Notion com metadados extraídos e envia relatório + logs via Telegram.

## Entrada (doPost)
- Disparador: HTTP POST com JSON contendo `target_table`, `input_data`, `engagement_selected`, `description_input`
- Ao receber, gerar `correlationId` no formato `ddMMyyHHmmss`; limpar o `LOG_BUFFER` para a nova execução
- Limpar o `input_data` com `cleanInputLink`:
  - Extrai URL embutida em texto
  - Força https em domínios sem protocolo
  - Remove query string (trackers) — **exceto** para URLs YouTube/youtu.be, que preservam `?v=`
  - Retorna `'N/A'` literal se o input for `'N/A'` em qualquer capitalização (verificação case-insensitive via `toUpperCase`)
- Após `routeToExecutionFlow` retornar, `doPost` sincroniza `inputData` e `targetTable` a partir do resultado (importante quando `applyTestDataFallback` substitui os valores originais); os valores sincronizados são os que aparecem no relatório Telegram

## Fase 0 — Fallback de Teste (dentro de routeToExecutionFlow)
- `applyTestDataFallback` é chamado no início de `routeToExecutionFlow`, antes de qualquer outra operação
- SE `target_table` ou `input_data` estiverem ausentes ou forem `'N/A'`: substituir pelos valores de `TEST_INPUT_URL`, `TEST_INPUT_ENGAGEMENT`, `TEST_INPUT_DESCRIPTION` definidos em `config.gs`
- SE `target_table` não for reconhecido (não constar em `tableConfigs`): retornar `{status: "ERROR", message: "Tabela '...' não encontrada no Config.gs."}` → `doPost` encaminha para Telegram como Falha Total
- Permite execução manual de testes sem payload externo

## Fase 1 — Verificação de Duplicidade
- Antes de qualquer extração, chamar `checkDuplicity`
- Tabelas diretas com URL (Articles, Audio-visual, Podcasts, Sites): verificar na própria tabela por `Link` (match exato de URL)
- Tabelas diretas sem URL (Dictionary, Life wishes, Life goals): verificar na própria tabela por `Name` (match exato de texto)
- Tabelas relacionais (Books, Clothes, Equipaments, Read): verificar na tabela `Data Log Prices` por `Link`
- SE duplicata encontrada: retornar `status: DUPLICATE` com nome e link da página existente; interromper fluxo; ir para Telegram
- SE não existe: prosseguir
- SE `databaseId` ou `value` (input a verificar) for nulo/vazio: verificação pulada, retorna `{isDuplicate: false}` imediatamente
- SE a API Notion retornar erro durante a verificação: logar o erro e retornar `{isDuplicate: false}` — o sistema prossegue como se não houvesse duplicata

## Fase 2 — Protocolo de Contingência do Scraper
- Chamar `checkScraperStatus` para inputs HTTP que não sejam YouTube ou Spotify
- SE `LOCAL_SCRAPER_URL` ou `LOCAL_SCRAPER_API_KEY` não estiverem configurados no PropertiesService: scraper considerado offline imediatamente, sem tentativa de conexão
- Health check: considera o scraper **online** se responder com HTTP 200, 400 ou 422 (400/422 indicam scraper ativo mas payload de ping `{ping: true}` não reconhecido)
- SE scraper offline (credenciais ausentes, erro de conexão, ou status fora de 200/400/422): chamar `saveToLinksArchive` com os 4 campos brutos; retornar `status: ARCHIVED`; ir para Telegram
- SE `saveToLinksArchive` falhar (API Notion retornar erro): retorna `null` → `pageLink` fica ausente no relatório ARCHIVED
- SE scraper online: prosseguir para extração
- Schema da tabela Archive no Notion: `input_data` (title), `target_table` (rich_text), `engagement_selected` (rich_text), `description_input` (rich_text)

## Fase 3 — Extração e Mapeamento por Plataforma

**YouTube:**
- Extrair video ID → chamar YouTube Data API via GAS Advanced Service (`YouTube.Videos.list`)
- Mapear: Name, Link, Cover, Duration (ISO→HH:MM:SS como rich_text), Release, Language (via relation ID)
- Cover: prioridade `thumbnails.high > medium > default`
- Language: usa `snippet.defaultLanguage`; fallback para `snippet.defaultAudioLanguage` se ausente
- SE chamada à API falhar: todos os campos retornam `null`; `Name` cai no fallback da URL (`inputData`)
- Aplicar `decodeHTMLEntities` no título

**Spotify:**
- Obter access token via client_credentials
- Extrair tipo e ID do link (`track`, `episode`, `show`, `album`) → chamar Spotify API endpoint `/{tipo}s/{id}`
- Mapear: Name, Link, Cover, Duration (ms→HH:MM:SS como rich_text), Release
- Cover: usa `data.images[0].url`; para tracks, fallback para `data.album.images[0].url` (imagem vem do álbum)
- Release: usa `data.release_date`; para episodes, fallback para `data.show.release_date`
- SE token nulo OU regex do link não casar com padrão `spotify.com/(track|episode|show|album)/ID`: todos os campos retornam `null`
- Aplicar `decodeHTMLEntities` no título

**URLs Gerais (via scraping):**
- Chamar `executeHybridExtraction`: tenta GET nativo com User-Agent fakeado (`Chrome/Windows`) para contornar detecção de bot; se bloqueado (403/429/503 **ou** resposta 200 com conteúdo Cloudflare — `"Just a moment..."` / `"cloudflare"`), tenta POST para scraper local
- SE nativo bloqueado E scraper não configurado: retorna FALLBACK_MODE diretamente, sem tentativa de scraper
- Extrair: título (OG > Twitter > title tag), imagem de capa (OG > Twitter > landingImage > image_src), favicon, site name, meta description
- URLs relativas em imagens e favicons são resolvidas contra a URL base (`//` → `https:`, `/path` → origem, caminho relativo → diretório base)
- Favicon — hierarquia de prioridade: `apple-touch-icon` (maior) > `icon` > `shortcut icon`; fallback para `domínio/favicon.ico` se nenhum `<link>` encontrado
- Site name — usa `og:site_name`; fallback para nome do domínio capitalizado (ex: `brasil.uxdesign.cc` → `Brasil`) se meta ausente
- Aplicar `decodeHTMLEntities` em todos os campos de texto extraídos
- Limpeza de título por tabela: para tabelas que não sejam `Sites` nem `Articles`, aplicar `trimOGTitle` (remove sufixo `" | Nome do Site"` do título)
- SE extração falhar completamente (HTML nulo): retornar `metadataStatus: FALLBACK_MODE` com URL como título
- SE HTML obtido mas sem capa: prosseguir normalmente; `PARTIAL_FAILURE` será definido na Fase 5

**Sem URL (inputs de texto puro):**
- Mapear apenas `Name` com `decodeHTMLEntities` aplicado

## Fase 4 — Mapeamento Específico por Tabela

- **Articles**: antes da extração de Duration e Language, o HTML é pré-processado por `cleanHtmlText` (remove `<script>`, `<style>` e todas as tags HTML); extrair Release (meta/time/JSON-LD — meta tags verificadas: `article:published_time`, `datePublished`, `publishDate`, `publication_date`, `date`; JSON-LD verifica `datePublished`, `uploadDate`, `@graph[].datePublished`; todas as datas truncadas para `YYYY-MM-DD`), Duration via regex `(\d+)\s*(min\s*read|minuto|min|minute)` pesquisando nos primeiros **8000 caracteres** do texto limpo → armazenado como `number` (inteiro de minutos), Language: `LanguageApp.detect` nos primeiros 1000 chars; fallback por frequência de palavras (PT: `você, nós, porque, também, artigo`; EN: `the, and, is, with, that, this`; retorna `null` se empate)
- **Books, Clothes, Equipaments, Read**: criar entrada em `Data Log Prices` via `createPriceLogEntry` (propriedades: `Store` [title] = siteName, `Link` [url]; ícone = favicon) → SE `createPriceLogEntry` falhar (retorna `null`), a propriedade `Data log prices` é omitida e a página principal é criada sem a relação → deletar propriedade `Link` da página principal (**o `coverUrl` é preservado** e continua sendo enviado para `createNotionPage`); para Clothes, adicionar `Engagement` via relation ID
- **Sites**: extrair meta description via `extractMetaDescription`; se ausente no HTML, usar `description_input` do payload como fallback; aplicar `decodeHTMLEntities`; adicionar propriedade `Description`; favicon aplicado como ícone da página
- **Dictionary, Life wishes, Life goals**: mapear apenas `Name` (sem URL, sem scraping)

**Normalização de conversores:**
- `convertLanguageToId`: normaliza o código de idioma pegando apenas a parte antes do `-` e convertendo para lowercase (`en-US` → `en`, `pt-BR` → `pt`)
- `convertEngagementToId`: remove caracteres especiais (`[^\w\s]`) e converte para lowercase antes do match (ex: `"Engaged!"` → `"engaged"` → mapeia corretamente)

## Fase 5 — Criação no Notion
- Chamar `createNotionPage` com databaseId, properties, coverUrl, pageIconUrl, metadataStatus
- Capa (cover): obrigatória para fluxos de URL; se `coverUrl` ausente e propriedade `Link` presente, definir `metadataStatus: PARTIAL_FAILURE`
- Ícone (icon) em `createNotionPage`: aplicado **somente** para a tabela Sites; ignorado silenciosamente para todas as demais
- Ícone em `Data Log Prices`: aplicado dentro de `createPriceLogEntry` (caminho separado de `createNotionPage`)
- Propriedades nulas são omitidas do payload (exceto title, que usa `"Sem Título"` como fallback)
- SE a API Notion retornar não-200: `createNotionPage` lança exceção → capturada pelo `catch` de `doPost` → Telegram de Falha Total

## Status de metadados
| Status | Origem | Significado |
|---|---|---|
| `SUCCESS` | padrão | Extração completa |
| `NATIVE_SUCCESS` | fetchHTML | HTML obtido via GET nativo |
| `LOCAL_SUCCESS` | fetchHTML | HTML obtido via scraper local |
| `FALLBACK_MODE` | executeHybridExtraction | HTML nulo; título = URL |
| `PARTIAL_FAILURE` | createNotionPage | HTML obtido mas sem capa |

## Fase 6 — Relatório Telegram
- **Bot Relatório** (TELEGRAM_BOT_TOKEN_REPORT): envia relatório de negócio formatado em HTML
- **Bot Logs** (TELEGRAM_BOT_TOKEN_LOG): envia session logs do LOG_BUFFER em bloco `<pre>`
- Ambos os bots entregam para o mesmo `TELEGRAM_CHAT_ID`; a separação é por identidade de bot, não por canal
- Status exibidos:
  - ✅ Sucesso — `status: SUCCESS`
  - ⚠️ Sucesso Parcial — `metadataStatus: FALLBACK_MODE` ou `PARTIAL_FAILURE`
  - ⚠️ Verificar Logs — estado residual: resultado existe mas sem status reconhecível (edge case)
  - 🚫 Item Duplicado — `status: DUPLICATE`
  - 📦 Arquivado — `status: ARCHIVED` (relatório não exibe lista de propriedades)
  - ❌ Falha Total — exceção ou `status: ERROR`
- Em caso de DUPLICATE: exibir nome da página existente como link clicável; mensagem de instrução amigável
- Propriedades do tipo `relation` no relatório exibem `"Vinculado (ID)"` em vez do ID real (afeta Language, Engagement, Data log prices)
- Falhas no envio ao Telegram são silenciadas (`muteHttpExceptions: true`); erros não interrompem a execução
- Bot de logs só envia mensagem se `LOG_BUFFER` tiver ao menos uma entrada
- Sempre incluir correlationId no rodapé do relatório e no header dos logs
- Logs: truncar em 3000 caracteres

## Restrições
- O sistema nunca cria duplicatas: a verificação é sempre a primeira operação após o fallback de teste
- O archive é o destino de contingência para qualquer URL quando o scraper está offline
- Ícone em `createNotionPage` restrito à tabela Sites; ícone em `Data Log Prices` gerenciado exclusivamente por `createPriceLogEntry`
- Credenciais de Notion, Telegram e Spotify ficam no objeto `SECRETS` definido em `config.gs` (valores fixos no arquivo); credenciais do scraper local (`LOCAL_SCRAPER_URL`, `LOCAL_SCRAPER_API_KEY`) ficam em `PropertiesService` (GAS Script Properties)
- Nunca expor valores reais de credenciais em código-fonte compartilhado
