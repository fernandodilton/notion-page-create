// ====================================================================
// ARQUIVO: ExtractionService.gs
// EXTRAÇÃO HÍBRIDA (Seção IV.2 - Hierarquia de Imagem e Fallbacks)
// ====================================================================

/**
 * EXECUTOR PRINCIPAL: executeHybridExtraction
 * Tenta obter HTML (Nativo -> Local) e processa todos os extratores com sanitização.
 */
function executeHybridExtraction(inputUrl, targetTable) {
    let htmlContent = null;
    let extractedTitle = null;
    let extractedCoverUrl = null;
    let extractedSiteName = null; 
    let extractedFavicon = null; 
    let fetchStatus = 'NOT_FETCHED';
    
    captureLog(`EXTRAÇÃO HÍBRIDA: Iniciando processo para ${inputUrl}`);

    const fetchResult = fetchHTML(inputUrl);
    htmlContent = fetchResult.htmlContent;
    fetchStatus = fetchResult.status;
    
    if (htmlContent === null) {
         captureLog(`EXTRAÇÃO HÍBRIDA: Falha crítica ao obter HTML (${fetchStatus}). Ativando FALLBACK_MODE.`);
         return { status: 'FALLBACK_MODE', extractedTitle: inputUrl };
    }

    captureLog(`METADADOS: HTML obtido com sucesso via ${fetchStatus}. Iniciando parsers e sanitização.`);

    // Processamento de metadados com decodificação de entidades HTML
    extractedSiteName = decodeHTMLEntities(extractSiteName(htmlContent, inputUrl));
    if (extractedSiteName) captureLog(`METADADOS: Site Name extraído e sanitizado: ${extractedSiteName}`);

    extractedFavicon = extractFavicon(htmlContent, inputUrl); 
    if (extractedFavicon) captureLog(`METADADOS: Favicon localizado com sucesso.`);

    // Título com lógica de prioridade (OG > Twitter > Title)
    extractedTitle = decodeHTMLEntities(extractOGTitle(htmlContent));
    if (extractedTitle) {
        captureLog(`METADADOS: Título extraído e sanitizado: ${extractedTitle}`);
        if (targetTable !== 'Sites' && targetTable !== 'Articles') {
            extractedTitle = trimOGTitle(extractedTitle);
            captureLog(`METADADOS: Título limpo (trim) para: ${extractedTitle}`);
        }
    }

    // EXTRAÇÃO DE CAPA (Seção IV.2): Hierarquia de Busca Refinada
    extractedCoverUrl = extractOGImage(htmlContent, extractedTitle, inputUrl);
    if (extractedCoverUrl) captureLog('METADADOS: Imagem de capa extraída via hierarquia de prioridade.');

    return { 
        htmlContent, 
        extractedTitle: extractedTitle || inputUrl, 
        coverUrl: extractedCoverUrl, 
        siteName: extractedSiteName || extractDomainNameFallback(inputUrl), 
        faviconUrl: extractedFavicon, 
        isExtractionSuccess: (extractedTitle !== null),
        status: (extractedTitle !== null) ? fetchStatus : 'FALLBACK_MODE'
    };
}

/**
 * MODULO: checkScraperStatus
 * Verifica se o scraper local está configurado e respondendo.
 */
function checkScraperStatus() {
    const scraperUrl = SECRETS.LOCAL_SCRAPER_URL;
    const scraperKey = SECRETS.LOCAL_SCRAPER_API_KEY;
    if (!scraperUrl || !scraperKey) return false;
    const options = {
        method: 'post', contentType: 'application/json', headers: { 'x-api-key': scraperKey },
        payload: JSON.stringify({ ping: true }), muteHttpExceptions: true, connectTimeout: 5000 
    };
    try {
        const response = UrlFetchApp.fetch(scraperUrl, options);
        const code = response.getResponseCode();
        return (code === 200 || code === 400 || code === 422);
    } catch (e) { return false; }
}

/**
 * MODULO: extractOGTitle (Seção IV.2)
 * Extrai o Título priorizando Open Graph e Twitter Cards.
 */
function extractOGTitle(html) {
    if (!html) return null;
    const ogMatch = html.match(/<meta[^>]*property\s*=\s*["']og:title["'][^>]*content\s*=\s*["']([^"']*)["']/i) ||
                    html.match(/<meta[^>]*content\s*=\s*["']([^"']*)["'][^>]*property\s*=\s*["']og:title["']/i);
    if (ogMatch && ogMatch[1]) return ogMatch[1].trim();

    const twMatch = html.match(/<meta[^>]*name\s*=\s*["']twitter:title["'][^>]*content\s*=\s*["']([^"']*)["']/i);
    if (twMatch && twMatch[1]) return twMatch[1].trim();
    
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    return titleMatch ? titleMatch[1].trim() : null;
}

/**
 * MODULO: extractOGImage (Seção IV.2 - Hierarquia de Busca)
 * 1. Busca og:image (Open Graph)
 * 2. Busca twitter:image (Twitter Cards)
 * 3. Busca elemento com ID landingImage (Amazon/E-commerce), preferindo data-old-hires
 * 4. Busca link rel="image_src"
 */
function extractOGImage(html, title, baseUrl) {
    if (!html) return null;

    // 1. Prioridade: og:image
    const ogMatch = html.match(/<meta[^>]*property\s*=\s*["']og:image["'][^>]*content\s*=\s*["']([^"']*)["']/i) ||
                    html.match(/<meta[^>]*content\s*=\s*["']([^"']*)["'][^>]*property\s*=\s*["']og:image["']/i);
    if (ogMatch && ogMatch[1]) return resolveUrl(ogMatch[1].trim(), baseUrl);

    // 2. Fallback: twitter:image
    const twMatch = html.match(/<meta[^>]*name\s*=\s*["']twitter:image["'][^>]*content\s*=\s*["']([^"']*)["']/i);
    if (twMatch && twMatch[1]) return resolveUrl(twMatch[1].trim(), baseUrl);

    // 3. Fallback: landingImage (Preferindo Alta Resolução - data-old-hires)
    const landingMatch = html.match(/<img[^>]*id\s*=\s*["']landingImage["'][^>]*>/i);
    if (landingMatch) {
        const tag = landingMatch[0];
        const hiresMatch = tag.match(/data-old-hires\s*=\s*["']([^"']*)["']/i);
        if (hiresMatch && hiresMatch[1]) return resolveUrl(hiresMatch[1].trim(), baseUrl);
        
        const srcMatch = tag.match(/src\s*=\s*["']([^"']*)["']/i);
        if (srcMatch && srcMatch[1]) return resolveUrl(srcMatch[1].trim(), baseUrl);
    }

    // 4. Fallback Tradicional: link image_src
    const srcMatch = html.match(/<link[^>]*rel\s*=\s*["']image_src["'][^>]*href\s*=\s*["']([^"']*)["']/i);
    if (srcMatch && srcMatch[1]) return resolveUrl(srcMatch[1].trim(), baseUrl);

    return null;
}

/**
 * MODULO: fetchHTML
 */
function fetchHTML(url) {
    const scraperUrl = SECRETS.LOCAL_SCRAPER_URL;
    const scraperKey = SECRETS.LOCAL_SCRAPER_API_KEY;
    const nativeOptions = { 
        muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' } 
    };
    try {
        const response = UrlFetchApp.fetch(url, nativeOptions);
        const code = response.getResponseCode();
        const content = response.getContentText();
        const isBlocked = [403, 429, 503].includes(code) || content.includes('Just a moment...') || content.includes('cloudflare');
        if (code === 200 && !isBlocked) return { htmlContent: content, status: 'NATIVE_SUCCESS' };
        if (scraperUrl && scraperKey) {
            const localRes = UrlFetchApp.fetch(scraperUrl, {
                method: 'post', contentType: 'application/json', headers: { 'x-api-key': scraperKey },
                payload: JSON.stringify({ url: url }), muteHttpExceptions: true
            });
            if (localRes.getResponseCode() === 200) {
                const data = JSON.parse(localRes.getContentText());
                const html = data.html || data.raw_html || (typeof data === 'string' ? data : null);
                if (html) return { htmlContent: html, status: 'LOCAL_SUCCESS' };
            }
        }
    } catch (e) { captureLog(`FETCH ERRO: ${e.toString()}`); }
    return { htmlContent: null, status: 'FAILED' };
}

function resolveUrl(url, baseUrl) {
    if (!url || url.startsWith('http')) return url;
    if (!baseUrl) return null;
    try {
        const originMatch = baseUrl.match(/^(https?:\/\/[^\/]+)/i);
        if (!originMatch) return null;
        const origin = originMatch[1];
        if (url.startsWith('//')) return 'https:' + url;
        if (url.startsWith('/')) return origin + url;
        const baseDir = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
        return baseDir + url;
    } catch (e) { return null; }
}

function extractFavicon(htmlContent, baseUrl) { 
    if (!htmlContent || !baseUrl) return null;
    let bestIconUrl = null;
    let maxScore = 0;
    const linkTagRegex = /<link\s+[^>]*?>/gi;
    let match;
    while ((match = linkTagRegex.exec(htmlContent)) !== null) {
        const tag = match[0];
        const relMatch = tag.match(/rel\s*=\s*["']([^"']+)["']/i);
        const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
        if (relMatch && hrefMatch) {
            const rel = relMatch[1].toLowerCase();
            const href = hrefMatch[1];
            let score = 0;
            if (rel.includes('apple-touch-icon')) score = 5; 
            else if (rel.includes('shortcut icon')) score = 3; 
            else if (rel.includes('icon')) score = 4; 
            if (score > maxScore) {
                const resolved = resolveUrl(href, baseUrl);
                if (resolved) { maxScore = score; bestIconUrl = resolved; }
            }
        }
    }
    if (!bestIconUrl) {
        try { bestIconUrl = baseUrl.match(/^(https?:\/\/[^\/]+)/i)[1] + '/favicon.ico'; } catch(e) {}
    }
    return bestIconUrl;
}

function extractMetaDescription(html) {
    if (!html) return null;
    const match = html.match(/<meta[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["']/i);
    return match ? decodeHTMLEntities(match[1].trim()) : null;
}

function extractSiteName(html) {
    if (!html) return null;
    const match = html.match(/<meta[^>]*property\s*=\s*["']og:site_name["'][^>]*content\s*=\s*["']([^"']*)["']/i);
    return match ? match[1].trim() : null;
}

function extractDomainNameFallback(url) {
    try {
        const name = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/.]+)/i)[1];
        return name.charAt(0).toUpperCase() + name.slice(1);
    } catch(e) { return "Site"; }
}

function trimOGTitle(t) { return t ? t.replace(/\s*\|\s*.*$/, '').trim() : null; }

function cleanHtmlText(h) {
    return h ? h.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
}