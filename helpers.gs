// ====================================================================
// ARQUIVO: Helpers.gs
// UTILITÁRIOS, PARSERS E SANITIZAÇÃO (Restauração Completa)
// ====================================================================

/**
 * MODULO: decodeHTMLEntities (Fase 4 do Manual)
 * Converte entidades HTML em caracteres de texto plano.
 */
function decodeHTMLEntities(text) {
    if (!text || typeof text !== 'string') return text;
    const entities = {
        'amp': '&', 'apos': "'", 'gt': '>', 'lt': '<', 'quot': '"', 'nbsp': ' ',
        'brvbar': '¦', 'copy': '©', 'reg': '®', 'trade': '™'
    };
    return text.replace(/&(#(?:x[a-f0-9]+|\d+)|[a-z]+);/gi, function(match, entity) {
        if (entities[entity.toLowerCase()]) return entities[entity.toLowerCase()];
        if (entity.startsWith('#')) {
            const code = entity.startsWith('#x') 
                ? parseInt(entity.substring(2), 16) 
                : parseInt(entity.substring(1), 10);
            return isNaN(code) ? match : String.fromCharCode(code);
        }
        return match;
    });
}

/**
 * Recupera um valor de um objeto payload de forma segura.
 */
function getPayloadValue(payload, key) {
    if (payload && typeof payload === 'object' && key in payload) {
        return payload[key];
    }
    return null;
}

/**
 * MODULO: cleanInputLink (Seção IV do Manual)
 */
function cleanInputLink(inputString) {
    if (!inputString || typeof inputString !== 'string') return inputString; 
    let workString = inputString.trim();
    if (workString.toUpperCase() === 'N/A') return 'N/A';
    
    let cleanedUrl = null; 
    const urlRegex = /(https?:\/\/[^\s]+)/i;
    const match = workString.match(urlRegex);
    
    if (match && match[1]) {
        cleanedUrl = match[1].trim(); 
    } else {
        const domainRegex = /^([\w-]+\.)?[\w-]+\.[\w-]+(\.[\w-]+)?.*$/i;
        if (domainRegex.test(workString)) cleanedUrl = 'https://' + workString;
        else return inputString;
    }
    
    // Remove trackers se não for YouTube
    if (cleanedUrl && !cleanedUrl.includes('youtube.com') && !cleanedUrl.includes('youtu.be')) {
        const queryIndex = cleanedUrl.indexOf('?');
        if (queryIndex !== -1) cleanedUrl = cleanedUrl.substring(0, queryIndex);
    }
    return cleanedUrl; 
}

/**
 * MODULO: applyTestDataFallback (Seção 3.A, Passo 9 do Manual)
 */
function applyTestDataFallback(targetTable, inputData, engagement, description) {
    if (!targetTable || !inputData || inputData === 'N/A') {
        captureLog('FALLBACK DE TESTE ATIVADO: Injetando dados do Config.gs.');
        return { 
            targetTable: targetTable || 'Articles', 
            inputData: TEST_INPUT_URL, 
            engagementSelected: engagement || TEST_INPUT_ENGAGEMENT, 
            descriptionInput: description || TEST_INPUT_DESCRIPTION 
        };
    }
    return { targetTable, inputData, engagementSelected: engagement, descriptionInput: description };
}

/**
 * Limpa e normaliza UUIDs para o Notion.
 */
function cleanUUID(uuidString) {
    if (!uuidString) return null;
    return uuidString.toString().trim().replace(/-/g, ''); 
}

/**
 * CONVERSORES DE IDIOMA E ENGAJAMENTO
 */
function convertEngagementToId(name) {
    if (!name) return null;
    let cleanedName = name.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim().toLowerCase(); 
    const engagementMap = {
        'thoroughly engaged': cleanUUID(SECRETS.ENGAGEMENT_ID_THOROUGHLY_ENGAGED),
        'engaged': cleanUUID(SECRETS.ENGAGEMENT_ID_ENGAGED),
        'ok': cleanUUID(SECRETS.ENGAGEMENT_ID_OK),
        'disengaged': cleanUUID(SECRETS.ENGAGEMENT_ID_DISENGAGED),
        'actively disengaged': cleanUUID(SECRETS.ENGAGEMENT_ID_ACTIVELY_DISENGAGED),
    };
    return engagementMap[cleanedName] || null;
}

function convertLanguageToId(langCode) {
    if (!langCode) return null;
    let normalized = langCode.toLowerCase().split('-')[0].trim();
    const languageMap = {
        'en': cleanUUID(SECRETS.LANGUAGE_ID_ENGLISH), 
        'pt': cleanUUID(SECRETS.LANGUAGE_ID_PORTUGUESE)
    };
    return languageMap[normalized] || null;
}

/**
 * MODULO: extractReleaseDate (Fase 4 do Manual)
 */
function extractReleaseDate(htmlContent) { 
    if (!htmlContent) return null;
    
    // 1. Meta Tags
    const metaDateRegex = /<meta[^>]+(?:property|name)\s*=\s*["'](?:article:published_time|datePublished|publishDate|publication_date|date)["'][^>]+content\s*=\s*["']([^"']*)["']/i;
    let match = htmlContent.match(metaDateRegex);
    if (match && match[1]) return match[1].trim().substring(0, 10);
    
    // 2. tags <time>
    const timeMatch = htmlContent.match(/<time[^>]+datetime\s*=\s*["']([^"']*)["']/i);
    if (timeMatch && timeMatch[1]) return timeMatch[1].trim().substring(0, 10);

    // 3. JSON-LD
    const ldJsonMatch = htmlContent.match(/<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (ldJsonMatch && ldJsonMatch[1]) {
        try {
            const ldData = JSON.parse(ldJsonMatch[1]);
            const foundDate = ldData.datePublished || ldData.uploadDate || (ldData['@graph'] && ldData['@graph'].find(o => o.datePublished)?.datePublished);
            if (foundDate) return String(foundDate).substring(0, 10);
        } catch (e) {}
    }
    return null;
}

/**
 * EXTRATORES DE TEMPO E DATA
 */
function extractTimeDuration(cleanText) { 
    if (!cleanText) return null;
    const durationRegex = /(\d+)\s*(min\s*read|minuto|min|minute)/i;
    const match = cleanText.substring(0, 8000).match(durationRegex);
    return match ? match[1] + ' min' : null;
}

function extractDurationNumber(durationText) {
    if (!durationText) return null;
    const match = String(durationText).match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
}

function extractRawLanguageCode(cleanText) { 
    if (!cleanText || cleanText.length < 20) return null;
    try {
        if (typeof LanguageApp !== 'undefined' && LanguageApp.detect) {
            return LanguageApp.detect(cleanText.substring(0, 1000)).getLanguage();
        }
    } catch (e) {}
    const ptWords = ["você", "nós", "porque", "também", "artigo"];
    const enWords = ["the", "and", "is", "with", "that", "this"];
    let pt = 0, en = 0;
    const words = cleanText.toLowerCase().split(/\s+/);
    for (const w of words) {
        if (ptWords.includes(w)) pt++;
        if (enWords.includes(w)) en++;
    }
    return pt > en ? 'pt' : (en > pt ? 'en' : null);
}

function extractCreatorPlatform(url) {
    if (!url) return null;
    const domainMatch = url.match(/^https?:\/\/(?:www\.)?([^/?#]+)/i);
    if (!domainMatch) return null;
    const domain = domainMatch[1].toLowerCase();
    if (domain === "instagram.com") return "Instagram";
    if (domain === "twitter.com" || domain === "x.com") return "X";
    if (domain === "tiktok.com") return "TikTok";
    if (domain === "youtube.com" && url.toLowerCase().includes("/shorts")) return "YouTube Shorts";
    if (domain === "youtube.com") return "YouTube";
    if (domain === "linkedin.com") return "LinkedIn";
    if (domain === "medium.com") return "Medium";
    return null;
}

function extractCreatorUsername(url, platform) {
    if (!url || !platform) return null;
    const pathMatch = url.match(/^https?:\/\/(?:www\.)?[^/?#]+\/(.+?)(?:[?#].*)?$/i);
    if (!pathMatch) return null;
    const segments = pathMatch[1].split("/").filter(Boolean);
    if (!segments.length) return null;
    if (platform === "LinkedIn" && (segments[0].toLowerCase() === "in" || segments[0].toLowerCase() === "company")) {
        return segments[1] ? segments[1].replace(/^@/, "") : null;
    }
    return segments[0].replace(/^@/, "");
}