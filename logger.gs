// ====================================================================
// ARQUIVO: Logger.gs
// SISTEMA DE LOGS E UTILITÁRIOS GLOBAIS
// ====================================================================

/**
 * Buffer global para armazenar entradas de log durante a execução.
 */
const LOG_BUFFER = [];

/**
 * Gera um ID de Correlação baseado em Timestamp (ddMMyyHHmmss).
 * Essencial para vincular logs técnicos ao relatório de negócio.
 * @return {string} ID formatado.
 */
function generateCorrelationId() {
    const now = new Date();
    return Utilities.formatDate(now, Session.getScriptTimeZone(), "ddMMyyHHmmss");
}

/**
 * Captura mensagens de log, atribui emojis contextuais e as armazena no buffer.
 * @param {string} message Mensagem de texto a ser logada.
 */
function captureLog(message) {
    if (typeof message !== 'string') message = String(message || "");
    
    let emoji = 'ℹ️'; // Padrão informativo

    // Lógica de prefixos de emoji baseada no conteúdo da mensagem
    if (message.includes('ERRO') || message.includes('FALHA') || message.includes('FATAL')) {
        emoji = '🔴'; // Erro crítico
    } else if (message.includes('ALERTA') || message.includes('BLOQUEIO')) {
        emoji = '🟡'; // Atenção/Aviso
    } else if (message.includes('RASTREAMENTO CRÍTICO')) {
        emoji = '🌟'; // Ponto de interesse técnico
    } else if (message.includes('SUCESSO') || message.includes('ADICIONADO') || message.includes('CONCLUÍDO')) {
        emoji = '🟢'; // Resultado positivo
    } else if (message.includes('INICIADO') || message.includes('ROTEANDO')) {
        emoji = '🔵'; // Transição de estado/Fluxo principal
    }

    const logEntry = `${emoji} ${message}`;
    
    LOG_BUFFER.push(logEntry);
    Logger.log(logEntry); // Log nativo do Google Apps Script
}

/**
 * Escapa caracteres HTML para evitar erros de parse na API do Telegram.
 * @param {string} text - O texto a ser escapado.
 * @return {string} Texto formatado com entidades HTML.
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