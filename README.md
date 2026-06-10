# notion-page-create

Google Apps Script system that receives a webhook from iOS Shortcuts, extracts metadata from URLs, creates pages in Notion, and sends a report via Telegram.

## How it works

1. iOS Shortcut fires an HTTP POST with `target_table`, `input_data`, `engagement_selected`, and `description_input`
2. The system cleans the input, checks for duplicates, and routes by platform (YouTube, Spotify, or general URL)
3. Metadata is extracted (title, cover image, favicon, release date, duration, language)
4. A page is created in the target Notion database with the extracted properties
5. A formatted report is sent via Telegram Bot, with a separate log message for technical details

## Supported tables

| Table | Type | Notes |
|---|---|---|
| Articles | Direct | Extracts release date, read time, language |
| Audio-visual | Direct | YouTube API integration |
| Podcasts | Direct | Spotify API integration |
| Sites | Direct | Stores favicon as page icon, meta description |
| Books | Relational | Link migrates to Data Log Prices |
| Clothes | Relational | Link migrates to Data Log Prices, stores engagement |
| Equipaments | Relational | Link migrates to Data Log Prices |
| Read | Relational | Link migrates to Data Log Prices |
| Dictionary | Text-only | Duplicate check by name |
| Life wishes | Text-only | Duplicate check by name |
| Life goals | Text-only | Duplicate check by name |

## Stack

- **Runtime:** Google Apps Script (GAS)
- **Language:** JavaScript (ES5/ES6 compatible with GAS)
- **Integrations:** Notion API, Telegram Bot API, YouTube Data API (GAS Advanced Service), Spotify API
- **Scraping:** Local scraper via HTTP with `x-api-key` (fallback for bot-protected pages)

## Setup

### 1. Copy files to Google Apps Script

Create a new GAS project and add each `.gs` file. Enable the **YouTube Data API v3** Advanced Service.

### 2. Configure Script Properties

In the GAS Editor, go to **Project Settings → Script Properties** and add the following keys:

| Key | Description |
|---|---|
| `NOTION_API_KEY` | Notion integration token |
| `TELEGRAM_BOT_TOKEN_REPORT` | Bot token for business report messages |
| `TELEGRAM_BOT_TOKEN_LOG` | Bot token for technical log messages |
| `TELEGRAM_CHAT_ID` | Recipient chat ID |
| `SPOTIFY_CLIENT_ID` | Spotify app client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify app client secret |
| `NOTION_DB_ARTICLES_ID` | Notion database ID |
| `NOTION_DB_AUDIOVISUAL_ID` | Notion database ID |
| `NOTION_DB_BOOKS_ID` | Notion database ID |
| `NOTION_DB_CLOTHES_ID` | Notion database ID |
| `NOTION_DB_DICTIONARY_ID` | Notion database ID |
| `NOTION_DB_EQUIPAMENTS_ID` | Notion database ID |
| `NOTION_DB_LIFE_WISHES_ID` | Notion database ID |
| `NOTION_DB_LIFE_GOALS_ID` | Notion database ID |
| `NOTION_DB_PODCASTS_ID` | Notion database ID |
| `NOTION_DB_READ_ID` | Notion database ID |
| `NOTION_DB_SITES_ID` | Notion database ID |
| `NOTION_DB_DATA_LOG_PRICES_ID` | Notion database ID |
| `NOTION_DB_ARCHIVE_ID` | Contingency archive database ID |
| `LANGUAGE_ID_ENGLISH` | Notion relation ID for English |
| `LANGUAGE_ID_PORTUGUESE` | Notion relation ID for Portuguese |
| `ENGAGEMENT_ID_THOROUGHLY_ENGAGED` | Notion relation ID |
| `ENGAGEMENT_ID_ENGAGED` | Notion relation ID |
| `ENGAGEMENT_ID_OK` | Notion relation ID |
| `ENGAGEMENT_ID_DISENGAGED` | Notion relation ID |
| `ENGAGEMENT_ID_ACTIVELY_DISENGAGED` | Notion relation ID |
| `LOCAL_SCRAPER_URL` | URL of the local scraper service (optional) |
| `LOCAL_SCRAPER_API_KEY` | API key for the local scraper (optional) |

### 3. Deploy as Web App

In the GAS Editor: **Deploy → New deployment → Web App**. Set "Who has access" to **Anyone** so the iOS Shortcut can reach it.

### 4. Configure iOS Shortcut

Send a POST request to the deployment URL with a JSON body:

```json
{
  "target_table": "Articles",
  "input_data": "https://example.com/article",
  "engagement_selected": "Engaged",
  "description_input": ""
}
```

## Scraper fallback

If a URL is blocked by Cloudflare or returns 403/429/503, the system attempts to fetch via a local scraper service. If the scraper is offline or not configured, the raw input is saved to the Archive database in Notion and the user is notified via Telegram.

## Testing

Each table has a corresponding test function in `tests.gs` (e.g. `fluxoArticles`, `fluxoBooks`) that can be triggered manually from the GAS Editor. Test data is configured in `config.gs`.
