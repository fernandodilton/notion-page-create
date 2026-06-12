// ====================================================================
// ARQUIVO: Config.gs
// CONFIGURAÇÃO — Credenciais lidas do PropertiesService (Script Properties)
// ====================================================================

// Chaves esperadas em GAS Editor > Project Settings > Script Properties:
//   NOTION_API_KEY
//   TELEGRAM_BOT_TOKEN_REPORT
//   TELEGRAM_BOT_TOKEN_LOG
//   TELEGRAM_CHAT_ID
//   SPOTIFY_CLIENT_ID
//   SPOTIFY_CLIENT_SECRET
//   NOTION_DB_ARTICLES_ID
//   NOTION_DB_AUDIOVISUAL_ID
//   NOTION_DB_BOOKS_ID
//   NOTION_DB_CLOTHES_ID
//   NOTION_DB_DICTIONARY_ID
//   NOTION_DB_EQUIPAMENTS_ID
//   NOTION_DB_LIFE_WISHES_ID
//   NOTION_DB_LIFE_GOALS_ID
//   NOTION_DB_PODCASTS_ID
//   NOTION_DB_READ_ID
//   NOTION_DB_SITES_ID
//   NOTION_DB_SOCIAL_POSTS_ID
//   NOTION_DB_DATA_LOG_PRICES_ID
//   NOTION_DB_ARCHIVE_ID
//   LANGUAGE_ID_ENGLISH
//   LANGUAGE_ID_PORTUGUESE
//   ENGAGEMENT_ID_THOROUGHLY_ENGAGED
//   ENGAGEMENT_ID_ENGAGED
//   ENGAGEMENT_ID_OK
//   ENGAGEMENT_ID_DISENGAGED
//   ENGAGEMENT_ID_ACTIVELY_DISENGAGED
//   LOCAL_SCRAPER_URL
//   LOCAL_SCRAPER_API_KEY
const SECRETS = PropertiesService.getScriptProperties().getProperties();

// CONSTANTES PARA AMBIENTE DE TESTE
const TEST_INPUT_URL = "https://brasil.uxdesign.cc/n%C3%A3o-sou-apaixonada-por-design-5372f5895f33";
const TEST_INPUT_TEXT = "Love";
const TEST_INPUT_ENGAGEMENT = "Engaged";
const TEST_INPUT_DESCRIPTION = "Uma descrição ou observação adicional.";
