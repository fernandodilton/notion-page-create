// ====================================================================
// ARQUIVO: NotionService.gs
// INTEGRAÇÃO COM NOTION API (Restrição de Ícones e Obrigatoriedade de Capa)
// ====================================================================

/**
 * MÓDULO: checkDuplicity (Atualizado conforme Manual v3)
 * Verifica se o item existe e retorna metadados da página existente.
 * @return {Object} Objeto com isDuplicate (bool), name (string) e link (string).
 */
function checkDuplicity(databaseId, propertyName, propertyType, value) {
    if (!databaseId || !value) return { isDuplicate: false };
    
    captureLog("DUPLICIDADE: Pesquisando " + propertyName + " na base " + databaseId);
    
    const url = "https://api.notion.com/v1/databases/" + cleanUUID(databaseId) + "/query";
    
    let filter = {};
    if (propertyType === "url") {
        filter = { property: propertyName, url: { equals: value } };
    } else {
        filter = { property: propertyName, title: { equals: value } };
    }

    const options = {
        method: "post",
        contentType: "application/json",
        headers: { 
            "Authorization": "Bearer " + SECRETS.NOTION_API_KEY, 
            "Notion-Version": "2022-02-22" 
        },
        payload: JSON.stringify({ filter: filter, page_size: 1 }),
        muteHttpExceptions: true
    };

    try {
        const response = UrlFetchApp.fetch(url, options);
        const json = JSON.parse(response.getContentText());
        
        if (response.getResponseCode() === 200) {
            const results = json.results;
            if (results && results.length > 0) {
                const existingPage = results[0];
                let existingName = "Item Existente";
                const props = existingPage.properties;
                for (let key in props) {
                    if (props[key].type === 'title' && props[key].title.length > 0) {
                        existingName = props[key].title[0].plain_text;
                        break;
                    }
                }
                
                captureLog("DUPLICIDADE ALERTA: Item encontrado: " + existingName);
                return { isDuplicate: true, name: existingName, link: existingPage.url };
            }
            return { isDuplicate: false };
        }
        captureLog("DUPLICIDADE ERRO: Status " + response.getResponseCode());
        return { isDuplicate: false };
    } catch (e) {
        captureLog("DUPLICIDADE ERRO FATAL: " + e.toString());
        return { isDuplicate: false };
    }
}

/**
 * MÓDULO: saveToLinksArchive (Fase 4 do Manual)
 */
function saveToLinksArchive(data) {
    const databaseId = SECRETS.NOTION_DB_ARCHIVE_ID;
    const payload = {
        parent: { database_id: cleanUUID(databaseId) },
        properties: {
            "input_data": { title: [{ text: { content: data.input_data || "" } }] },
            "target_table": { rich_text: [{ text: { content: data.target_table || "" } }] },
            "engagement_selected": { rich_text: [{ text: { content: data.engagement_selected || "" } }] },
            "description_input": { rich_text: [{ text: { content: data.description_input || "" } }] }
        }
    };
    captureLog("CONTINGÊNCIA: Arquivando dados brutos."); 
    const options = {
        method: "post",
        contentType: "application/json",
        headers: { "Authorization": "Bearer " + SECRETS.NOTION_API_KEY, "Notion-Version": "2022-02-22" },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    };
    try {
        const response = UrlFetchApp.fetch("https://api.notion.com/v1/pages", options);
        if (response.getResponseCode() === 200) return { status: "ARCHIVED", pageLink: JSON.parse(response.getContentText()).url };
        return null;
    } catch (e) { return null; }
}

function buildNotionPropertiesPayload(properties) {
    const notionProperties = {};
    for (const propName in properties) {
        const prop = properties[propName];
        const value = prop.value;
        const type = prop.type;
        if (value === null && type !== "title") continue; 
        switch (type) {
            case "title": notionProperties[propName] = { title: [{ text: { content: String(value || "Sem Título") } }] }; break;
            case "url": if (value && String(value).startsWith("http")) notionProperties[propName] = { url: value }; break;
            case "rich_text": if (value) notionProperties[propName] = { rich_text: [{ text: { content: String(value) } }] }; break;
            case "number": if (value !== null && !isNaN(value)) notionProperties[propName] = { number: Number(value) }; break;
            case "relation": if (value) notionProperties[propName] = { relation: [{ id: value.trim() }] }; break;
            case "date": if (value) notionProperties[propName] = { date: { start: value } }; break;
        }
    }
    return notionProperties;
}

/**
 * MODULO: createPriceLogEntry (Refinado Seção 4.3)
 * Cria um registro na tabela Data Log Prices.
 * O Ícone (Favicon) é OBRIGATÓRIO nesta tabela.
 */
function createPriceLogEntry(linkUrl, siteName, faviconUrl) {
    const payload = {
        parent: { database_id: cleanUUID(SECRETS.NOTION_DB_DATA_LOG_PRICES_ID) },
        properties: { 
            "Store": { title: [{ text: { content: siteName || "Site Desconhecido" } }] }, 
            "Link": { url: linkUrl } 
        }
    };
    
    // Aplicação obrigatória do ícone em Data Log Prices
    if (faviconUrl && String(faviconUrl).startsWith("http")) {
        payload.icon = { type: "external", external: { url: faviconUrl } };
    } else {
        captureLog("ALERTA: Favicon ausente para Data Log Prices, mas obrigatório conforme Manual.");
    }

    const options = {
        method: "post", contentType: "application/json",
        headers: { "Authorization": "Bearer " + SECRETS.NOTION_API_KEY, "Notion-Version": "2022-02-22" },
        payload: JSON.stringify(payload), muteHttpExceptions: true
    };
    try {
        const response = UrlFetchApp.fetch("https://api.notion.com/v1/pages", options);
        if (response.getResponseCode() === 200) return JSON.parse(response.getContentText()).id;
        return null;
    } catch (e) { return null; }
}

/**
 * MODULO: createNotionPage (Refinado Seção VI, Item 6)
 * Persiste a página no Notion. Capa é obrigatória para fluxos de URL.
 */
function createNotionPage(databaseId, properties, coverUrl, pageIconUrl, metadataStatus) { 
    let currentMetadataStatus = metadataStatus || "SUCCESS";

    const payload = {
        parent: { database_id: cleanUUID(databaseId) },
        properties: buildNotionPropertiesPayload(properties)
    };
    
    // REGRA DE CAPA (Fase 3 & Seção VI, Item 6): Obrigatória para fluxos de URL
    if (coverUrl && String(coverUrl).startsWith("http")) {
        payload.cover = { type: "external", external: { url: coverUrl } };
    } else if (properties["Link"]) {
        // Se há um link mas não há capa, é considerada falha parcial de extração
        currentMetadataStatus = "PARTIAL_FAILURE";
        captureLog("ALERTA: Ausência de imagem de capa detectada. Status alterado para PARTIAL_FAILURE.");
    }

    // RESTRIÇÃO VISUAL (Seção VI, Item 5): Ícones exclusivos para a tabela Sites
    const isSitesDb = cleanUUID(databaseId) === cleanUUID(SECRETS.NOTION_DB_SITES_ID);
    if (isSitesDb && pageIconUrl && String(pageIconUrl).startsWith("http")) {
        payload.icon = { type: "external", external: { url: pageIconUrl } };
    } else if (pageIconUrl) {
        captureLog("RESTRIÇÃO: Ícone ignorado para esta tabela (Permitido apenas em Sites e Data Log Prices).");
    }

    const options = {
        method: "post", contentType: "application/json",
        headers: { "Authorization": "Bearer " + SECRETS.NOTION_API_KEY, "Notion-Version": "2022-02-22" },
        payload: JSON.stringify(payload), muteHttpExceptions: true
    };
    try {
        const response = UrlFetchApp.fetch("https://api.notion.com/v1/pages", options);
        const json = JSON.parse(response.getContentText());
        if (response.getResponseCode() === 200) {
            return { status: "SUCCESS", metadataStatus: currentMetadataStatus, pageId: json.id, pageLink: json.url, properties, coverUrl, pageIconUrl };
        }
        throw new Error("Notion API Failure: " + json.message);
    } catch (e) { throw e; }
}

function cleanUUID(uuidString) {
    if (!uuidString) return null;
    return uuidString.toString().replace(/[^0-9a-fA-F]/g, "").trim();
}