// ====================================================================
// ARQUIVO: WorkflowController.gs
// FASE 3: CONTROLADOR DE FLUXO (Duplicidade Orientada ao Destino)
// ====================================================================

function routeToExecutionFlow(targetTable, inputData, engagementSelected, descriptionInput) {
    let databaseId;
    let properties = {};
    let htmlContent = null; 
    let coverUrl = null; 
    let pageIconUrl = null; 
    let siteName = null; 
    let metadataStatus = "SUCCESS";

    // 1. APLICA FALLBACK
    const fallbackData = applyTestDataFallback(targetTable, inputData, engagementSelected, descriptionInput);
    targetTable = fallbackData.targetTable;
    inputData = fallbackData.inputData;

    // 2. CONFIGURAÇÃO DE DUPLICIDADE (Orientada ao Destino - Seção III, Passo 4)
    const tableConfigs = {
        "Articles": { id: SECRETS.NOTION_DB_ARTICLES_ID, dupProp: "Link", dupType: "url", isRelational: false },
        "Audio-visual": { id: SECRETS.NOTION_DB_AUDIOVISUAL_ID, dupProp: "Link", dupType: "url", isRelational: false },
        "Podcasts": { id: SECRETS.NOTION_DB_PODCASTS_ID, dupProp: "Link", dupType: "url", isRelational: false },
        "Sites": { id: SECRETS.NOTION_DB_SITES_ID, dupProp: "Link", dupType: "url", isRelational: false },
        "Dictionary": { id: SECRETS.NOTION_DB_DICTIONARY_ID, dupProp: "Name", dupType: "title", isRelational: false },
        "Life wishes": { id: SECRETS.NOTION_DB_LIFE_WISHES_ID, dupProp: "Name", dupType: "title", isRelational: false },
        "Life goals": { id: SECRETS.NOTION_DB_LIFE_GOALS_ID, dupProp: "Name", dupType: "title", isRelational: false },
        "Social posts": { id: SECRETS.NOTION_DB_SOCIAL_POSTS_ID, dupProp: "Link", dupType: "url", isRelational: false },

        // Fluxos Relacionais: Validação ocorre na base de Log de Preços
        "Books": { id: SECRETS.NOTION_DB_BOOKS_ID, dupProp: "Link", dupType: "url", isRelational: true },
        "Clothes": { id: SECRETS.NOTION_DB_CLOTHES_ID, dupProp: "Link", dupType: "url", isRelational: true },
        "Equipaments": { id: SECRETS.NOTION_DB_EQUIPAMENTS_ID, dupProp: "Link", dupType: "url", isRelational: true },
        "Read": { id: SECRETS.NOTION_DB_READ_ID, dupProp: "Link", dupType: "url", isRelational: true }
    };

    const config = tableConfigs[targetTable];
    if (!config) {
        captureLog("ROTEAMENTO ERRO: Tabela " + targetTable + " não configurada.");
        return { status: "ERROR", message: "Tabela '" + targetTable + "' não encontrada no Config.gs.", inputData, targetTable };
    }
    databaseId = config.id;

    // 3. VERIFICAÇÃO DE DUPLICIDADE ORIENTADA AO DESTINO
    const duplicityCheckDbId = config.isRelational ? SECRETS.NOTION_DB_DATA_LOG_PRICES_ID : databaseId;
    const dupResult = checkDuplicity(duplicityCheckDbId, config.dupProp, config.dupType, inputData);
    
    if (dupResult.isDuplicate) {
        return { 
            status: "DUPLICATE", databaseId: databaseId, inputData: inputData, targetTable,
            pageLink: dupResult.link, properties: { "Name": { value: decodeHTMLEntities(dupResult.name), type: "title" } } 
        };
    }

    // 4. PROCESSAMENTO DE EXTRAÇÃO
    if (targetTable === "Social posts") {
        properties["Name"] = { value: inputData, type: "title" };
        properties["Link"] = { value: inputData, type: "url" };
        return { databaseId, properties, coverUrl: null, pageIconUrl: null, metadataStatus, inputData, targetTable };
    }

    if (inputData && inputData.startsWith("http")) {
        if (inputData.includes("youtube.com") || inputData.includes("youtu.be")) {
            const vid = extractYouTubeVideoId(inputData);
            const yt = extractYouTubeDataNative(vid); 
            properties["Name"] = { value: decodeHTMLEntities(yt.Name), source: "YouTubeAPI", type: "title" };
            properties["Link"] = { value: inputData, type: "url" };
            coverUrl = yt.Cover;
            pageIconUrl = "https://www.youtube.com/favicon.ico";
            properties["Duration"] = { value: convertISO8601DurationToHHMMSS(yt.DurationISO), type: "rich_text" };
            properties["Release"] = { value: yt.Release, type: "date" };
            properties["Language"] = { value: convertLanguageToId(yt.LanguageCode), type: "relation" };
            return { databaseId, properties, coverUrl, pageIconUrl, metadataStatus, inputData, targetTable };
        } 
        else if (inputData.includes("spotify.com")) {
            const spot = extractSpotifyData(inputData);
            properties["Name"] = { value: decodeHTMLEntities(spot.Name), type: "title" };
            properties["Link"] = { value: inputData, type: "url" };
            coverUrl = spot.Cover;
            properties["Duration"] = { value: spot.DurationRichText, type: "rich_text" };
            properties["Release"] = { value: spot.Release, type: "date" };
            return { databaseId, properties, coverUrl, metadataStatus, inputData, targetTable };
        }

        if (!checkScraperStatus()) {
            const archive = saveToLinksArchive({ target_table: targetTable, input_data: inputData, engagement_selected: engagementSelected, description_input: descriptionInput });
            return { status: "ARCHIVED", databaseId: SECRETS.NOTION_DB_ARCHIVE_ID, pageLink: archive?.pageLink, inputData, targetTable };
        }

        const extraction = executeHybridExtraction(inputData, targetTable);
        metadataStatus = extraction.status;
        htmlContent = extraction.htmlContent;
        coverUrl = extraction.coverUrl;
        siteName = extraction.siteName;
        pageIconUrl = extraction.faviconUrl;
        properties["Name"] = { value: extraction.extractedTitle || inputData, type: "title" };
        properties["Link"] = { value: inputData, type: "url" };
    } else {
        properties["Name"] = { value: decodeHTMLEntities(inputData), type: "title" };
    }

    // 5. MAPEAMENTO ESPECÍFICO
    switch (targetTable) {
        case "Articles":
            if (htmlContent) {
                const cleanText = cleanHtmlText(htmlContent);
                properties["Release"] = { value: extractReleaseDate(htmlContent), type: "date" };
                properties["Duration"] = { value: extractDurationNumber(extractTimeDuration(cleanText)), type: "number" };
                properties["Language"] = { value: convertLanguageToId(extractRawLanguageCode(cleanText)), type: "relation" };
            }
            break;
        case "Books":
        case "Clothes":
        case "Equipaments":
        case "Read":
            if (targetTable === "Clothes") properties["Engagement"] = { value: convertEngagementToId(engagementSelected), type: "relation" };
            
            // COMPORTAMENTO CRÍTICO (Seção III.B): Migração de Link e Gestão de Capa
            if (properties["Link"]?.value) {
                const logId = createPriceLogEntry(properties["Link"].value, siteName, pageIconUrl);
                properties["Data log prices"] = { value: logId, type: "relation" };
                
                // Reinforço: A capa extraída (coverUrl) permanece ativa mesmo deletando o link textual
                delete properties["Link"]; 
                captureLog(`COMPORTAMENTO CRÍTICO: Link migrado para Price Log. Capa preservada para a página principal de ${targetTable}.`);
            }
            break;
        case "Sites":
            let desc = extractMetaDescription(htmlContent) || descriptionInput;
            properties["Description"] = { value: decodeHTMLEntities(desc), type: "rich_text" };
            break;
    }

    return { databaseId, properties, coverUrl, pageIconUrl, metadataStatus, inputData, targetTable };
}