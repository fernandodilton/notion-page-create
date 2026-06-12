// ====================================================================
// ARQUIVO: Main.gs
// FASE 2: PROCESSAMENTO E CRIAÇÃO (Ponto de Entrada)
// ====================================================================

/**
 * Função padrão de entrada para requisições POST.
 */
function doPost(e) {
    let payload;
    let targetTable = ""; 
    let inputData = ""; 
    
    const correlationId = generateCorrelationId();
    LOG_BUFFER.length = 0; 
    captureLog("INÍCIO DE EXECUÇÃO | ID: " + correlationId);

    try {
        if (!e || !e.postData || !e.postData.contents) {
            captureLog("ROTEAMENTO INFO: Operando em modo de teste manual.");
            payload = {}; 
        } else {
             captureLog("RASTREAMENTO CRÍTICO: Payload recebido via POST externo.");
             payload = JSON.parse(e.postData.contents);
        }

        targetTable = getPayloadValue(payload, "target_table") || "";
        let rawInputData = getPayloadValue(payload, "input_data") || "";
        let engagementSelected = getPayloadValue(payload, "engagement_selected") || "";
        let descriptionInput = getPayloadValue(payload, "description_input") || "";
        
        inputData = rawInputData ? cleanInputLink(rawInputData) : "";
        captureLog("FLUXO: Input processado como: " + (inputData || "vazio"));

        let result = routeToExecutionFlow(targetTable, inputData, engagementSelected, descriptionInput);

        // SINCRONIZAÇÃO DO INPUT (Especialmente importante para fallback de testes)
        if (result && result.inputData) inputData = result.inputData;
        if (result && result.targetTable) targetTable = result.targetTable;

        // --- GESTÃO DE RESULTADOS ---
        
        // 1. Erro Estruturado do Workflow
        if (result && result.status === "ERROR") {
            sendReportTelegramLog(targetTable, inputData, null, payload, true, result.message, correlationId);
            return ContentService.createTextOutput("");
        }

        // 2. Duplicidade
        if (result && result.status === "DUPLICATE") {
            sendReportTelegramLog(targetTable, inputData, result, payload, false, null, correlationId);
            return ContentService.createTextOutput("");
        }

        // 3. Creator Atualizado
        if (result && result.status === "UPDATED") {
            sendReportTelegramLog(targetTable, inputData, result, payload, false, null, correlationId);
            return ContentService.createTextOutput("");
        }

        // 4. Sucesso na Criação
        if (result && result.databaseId && result.properties) {
            captureLog("CRIAÇÃO: Enviando requisição para o Notion...");
            const creationResult = createNotionPage(result.databaseId, result.properties, result.coverUrl, result.pageIconUrl, result.metadataStatus); 
            sendReportTelegramLog(targetTable, inputData, creationResult, payload, false, null, correlationId); 
            return ContentService.createTextOutput(""); 

        } 
        // 4. Arquivado (Contingência)
        else if (result && result.status === "ARCHIVED") {
            sendReportTelegramLog(targetTable, inputData, result, payload, false, null, correlationId);
            return ContentService.createTextOutput("");
        } 
        // 5. Erro Genérico
        else {
            sendReportTelegramLog(targetTable, inputData, null, payload, true, "Falha desconhecida no workflow ou resultado nulo.", correlationId);
            return ContentService.createTextOutput(""); 
        }

    } catch (error) {
        captureLog("ERRO FATAL (doPost): " + error.toString());
        sendReportTelegramLog(targetTable, inputData, null, payload, true, error.toString(), correlationId); 
        return ContentService.createTextOutput(""); 
    }
}