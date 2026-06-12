// ====================================================================
// ARQUIVO: TelegramService.gs
// NOTIFICAÇÕES (Restauração do Formato Amigável - Seção VII)
// ====================================================================

/**
 * Escapa caracteres HTML para evitar erros de parse na API do Telegram.
 */
function escapeHTML(text) {
    if (typeof text !== 'string') text = String(text || "");
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Envia uma mensagem para um Chat ID específico, selecionando o Bot adequado.
 */
function sendTelegramMessage(targetChatId, text, isLogReport) {
    const botToken = isLogReport ? SECRETS.TELEGRAM_BOT_TOKEN_LOG : SECRETS.TELEGRAM_BOT_TOKEN_REPORT;
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const options = {
        method: 'post', 
        contentType: 'application/json',
        payload: JSON.stringify({ chat_id: targetChatId, text: text, parse_mode: 'HTML' }),
        muteHttpExceptions: true
    };
    try {
        const response = UrlFetchApp.fetch(telegramUrl, options);
    } catch (e) {
        captureLog("TELEGRAM ERRO FATAL: " + e.toString());
    }
}

/**
 * Gera e envia o relatório final conforme a estrutura da Seção VII do Manual.
 * Formato Restaurado: Focado em legibilidade e instrução amigável.
 */
function sendReportTelegramLog(targetTable, inputData, creationResult, payload, isFatalError, errorMessage, correlationId) {
    let statusIcon, statusText;

    if (isFatalError) {
        statusIcon = "❌"; 
        statusText = "Falha Total";
    } else if (creationResult && creationResult.status === "DUPLICATE") {
        statusIcon = "🚫"; 
        statusText = "Item Duplicado (Já existe)";
    } else if (creationResult && creationResult.status === "ARCHIVED") {
        statusIcon = "📦"; 
        statusText = "Arquivado (Scraper Offline)";
    } else if (creationResult && creationResult.metadataStatus === "FALLBACK_MODE") {
        statusIcon = "⚠️"; 
        statusText = "Sucesso Parcial (Sem Metadados)";
    } else if (creationResult && creationResult.status === "SUCCESS") {
        statusIcon = "✅";
        statusText = "Sucesso";
    } else if (creationResult && creationResult.status === "UPDATED") {
        statusIcon = "➕";
        statusText = "Creator Atualizado";
    } else {
        statusIcon = "⚠️"; 
        statusText = "Verificar Logs";
    }

    let htmlReport = "<b>Status:</b> " + statusIcon + " " + statusText + "\n";
    htmlReport += "<b>Tabela:</b> " + escapeHTML(targetTable || "N/A") + "\n"; 

    // Exibição da Página (Link original do Notion)
    if (creationResult?.pageLink) {
        const titleProp = creationResult.properties ? Object.values(creationResult.properties).find(p => p.type === "title") : null;
        const title = titleProp?.value || "Página Processada";
        htmlReport += "<b>Page:</b> <a href=\"" + escapeHTML(creationResult.pageLink) + "\">" + escapeHTML(title) + "</a>\n";
    } else {
        htmlReport += "<b>Page:</b> N/A\n";
    }

    htmlReport += "<b>Input:</b> " + escapeHTML(inputData || "N/A") + "\n";
    htmlReport += "\n—\n\n"; 

    // Mensagem amigável para duplicidade (Seção VII)
    if (creationResult?.status === "DUPLICATE") {
        htmlReport += "<i>Este item já consta em seus registros. Clique no link acima para acessar a página original.</i>\n\n";
    } 
    // Exibição de propriedades em caso de sucesso
    else if (creationResult?.properties && creationResult.status !== "ARCHIVED") {
        for (const propName in creationResult.properties) {
            const prop = creationResult.properties[propName]; 
            const pValue = prop.type === "relation" ? "Vinculado (ID)" : (prop.value || "NULO");
            htmlReport += "✅ <b>" + escapeHTML(propName) + ":</b>\n" + escapeHTML(pValue) + "\n\n";
        }
    }

    if (isFatalError && errorMessage) {
        htmlReport += "❌ <b>Erro:</b> <i>" + escapeHTML(errorMessage) + "</i>\n";
    }

    htmlReport += "🆔 <code>" + correlationId + "</code>";
    sendTelegramMessage(SECRETS.TELEGRAM_CHAT_ID, htmlReport, false);

    // Envio de Logs para o Bot de LOG (Apenas em caso de execução técnica)
    if (LOG_BUFFER.length > 0) {
        const logHeader = "♦️♦️♦️ <b>Session Logs</b> ♦️♦️♦️\n🆔 <code>" + correlationId + "</code>\n\n";
        const fullLogText = LOG_BUFFER.map(log => escapeHTML(log)).join("\n");
        sendTelegramMessage(SECRETS.TELEGRAM_CHAT_ID, logHeader + "<pre>" + fullLogText.substring(0, 3000) + "</pre>", true);
    }
}