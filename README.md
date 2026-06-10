# notion-page-create

Sistema em Google Apps Script que recebe um webhook do iOS Shortcuts, extrai metadados de URLs, cria páginas no Notion e envia um relatório via Telegram.

## Como funciona (teste)

1. Um iOS Shortcut dispara um HTTP POST com `target_table`, `input_data`, `engagement_selected` e `description_input`
2. O sistema limpa o input, verifica duplicidade e roteia por plataforma (YouTube, Spotify ou URL geral)
3. Os metadados são extraídos (título, imagem de capa, favicon, data de lançamento, duração, idioma)
4. Uma página é criada no banco de dados Notion correspondente com as propriedades mapeadas
5. Um relatório formatado é enviado via Telegram Bot, com uma mensagem separada de logs técnicos

## Tabelas suportadas

| Tabela | Tipo | Observações |
|---|---|---|
| Articles | Direta | Extrai data de publicação, tempo de leitura, idioma |
| Audio-visual | Direta | Integração com YouTube API |
| Podcasts | Direta | Integração com Spotify API |
| Sites | Direta | Favicon como ícone da página, meta description |
| Books | Relacional | Link migra para Data Log Prices |
| Clothes | Relacional | Link migra para Data Log Prices, armazena engajamento |
| Equipaments | Relacional | Link migra para Data Log Prices |
| Read | Relacional | Link migra para Data Log Prices |
| Dictionary | Texto | Verificação de duplicidade pelo nome |
| Life wishes | Texto | Verificação de duplicidade pelo nome |
| Life goals | Texto | Verificação de duplicidade pelo nome |

## Stack

- **Runtime:** Google Apps Script (GAS)
- **Linguagem:** JavaScript (ES5/ES6 compatível com GAS)
- **Integrações:** Notion API, Telegram Bot API, YouTube Data API (GAS Advanced Service), Spotify API
- **Scraping:** Scraper local via HTTP com `x-api-key` (fallback para páginas protegidas por bot)

## Configuração

### 1. Copiar os arquivos para o Google Apps Script

Criar um novo projeto GAS e adicionar cada arquivo `.gs`. Habilitar o **YouTube Data API v3** em Serviços Avançados.

### 2. Configurar as Script Properties

No GAS Editor, acessar **Project Settings → Script Properties** e adicionar as seguintes chaves:

| Chave | Descrição |
|---|---|
| `NOTION_API_KEY` | Token de integração do Notion |
| `TELEGRAM_BOT_TOKEN_REPORT` | Token do bot para mensagens de relatório |
| `TELEGRAM_BOT_TOKEN_LOG` | Token do bot para mensagens de log técnico |
| `TELEGRAM_CHAT_ID` | Chat ID do destinatário |
| `SPOTIFY_CLIENT_ID` | Client ID do app Spotify |
| `SPOTIFY_CLIENT_SECRET` | Client Secret do app Spotify |
| `NOTION_DB_ARTICLES_ID` | ID do banco de dados Notion |
| `NOTION_DB_AUDIOVISUAL_ID` | ID do banco de dados Notion |
| `NOTION_DB_BOOKS_ID` | ID do banco de dados Notion |
| `NOTION_DB_CLOTHES_ID` | ID do banco de dados Notion |
| `NOTION_DB_DICTIONARY_ID` | ID do banco de dados Notion |
| `NOTION_DB_EQUIPAMENTS_ID` | ID do banco de dados Notion |
| `NOTION_DB_LIFE_WISHES_ID` | ID do banco de dados Notion |
| `NOTION_DB_LIFE_GOALS_ID` | ID do banco de dados Notion |
| `NOTION_DB_PODCASTS_ID` | ID do banco de dados Notion |
| `NOTION_DB_READ_ID` | ID do banco de dados Notion |
| `NOTION_DB_SITES_ID` | ID do banco de dados Notion |
| `NOTION_DB_DATA_LOG_PRICES_ID` | ID do banco de dados Notion |
| `NOTION_DB_ARCHIVE_ID` | ID do banco de dados de contingência |
| `LANGUAGE_ID_ENGLISH` | ID de relação Notion para Inglês |
| `LANGUAGE_ID_PORTUGUESE` | ID de relação Notion para Português |
| `ENGAGEMENT_ID_THOROUGHLY_ENGAGED` | ID de relação Notion |
| `ENGAGEMENT_ID_ENGAGED` | ID de relação Notion |
| `ENGAGEMENT_ID_OK` | ID de relação Notion |
| `ENGAGEMENT_ID_DISENGAGED` | ID de relação Notion |
| `ENGAGEMENT_ID_ACTIVELY_DISENGAGED` | ID de relação Notion |
| `LOCAL_SCRAPER_URL` | URL do serviço de scraper local (opcional) |
| `LOCAL_SCRAPER_API_KEY` | Chave de API do scraper local (opcional) |

### 3. Publicar como Web App

No GAS Editor: **Implantar → Nova implantação → App da Web**. Definir "Quem tem acesso" como **Qualquer pessoa** para que o iOS Shortcut consiga alcançar o endpoint.

### 4. Configurar o iOS Shortcut

Enviar uma requisição POST para a URL da implantação com o corpo em JSON:

```json
{
  "target_table": "Articles",
  "input_data": "https://exemplo.com/artigo",
  "engagement_selected": "Engaged",
  "description_input": ""
}
```

## Contingência do scraper

Se uma URL for bloqueada por Cloudflare ou retornar 403/429/503, o sistema tenta buscar via scraper local. Se o scraper estiver offline ou não configurado, o input bruto é salvo no banco de dados Archive no Notion e o usuário é notificado via Telegram.

## Testes

Cada tabela possui uma função de teste correspondente em `tests.gs` (ex: `fluxoArticles`, `fluxoBooks`) que pode ser executada manualmente pelo GAS Editor. Os dados de teste são configurados em `config.gs`.
