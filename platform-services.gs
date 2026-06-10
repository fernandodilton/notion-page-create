// ====================================================================
// ARQUIVO: PlatformServices.gs
// INTEGRAÇÕES YOUTUBE E SPOTIFY (Logs Detalhados Restaurados)
// ====================================================================

// --- YOUTUBE ---

function extractYouTubeVideoId(url) {
    if (!url) return null;
    const regexWatch = /watch\?v=([a-zA-Z0-9_-]{11})/;
    const regexShort = /youtu\.be\/([a-zA-Z0-9_-]{11})/;
    let match = url.match(regexWatch) || url.match(regexShort);
    const id = match ? match[1] : null;
    if (id) captureLog(`YOUTUBE INFO: ID do Vídeo extraído: ${id}`);
    return id;
}

function extractYouTubeDataNative(videoId) {
    if (!videoId) return { Name: null, Cover: null, Release: null, DurationISO: null, LanguageCode: null };
    try {
        const response = YouTube.Videos.list('snippet,contentDetails', { id: videoId });
        if (response.items && response.items.length > 0) {
            const item = response.items[0];
            const snippet = item.snippet;
            const thumb = snippet.thumbnails;
            const data = {
                Name: snippet.title,
                Cover: thumb.high ? thumb.high.url : (thumb.medium ? thumb.medium.url : thumb.default.url),
                Release: snippet.publishedAt ? snippet.publishedAt.substring(0, 10) : null,
                DurationISO: item.contentDetails.duration,
                LanguageCode: snippet.defaultLanguage || snippet.defaultAudioLanguage
            };
            captureLog(`YOUTUBE NATIVO SUCESSO: Título: ${data.Name}, Lançamento: ${data.Release}`);
            return data;
        }
    } catch (e) { 
        captureLog(`YOUTUBE ERRO: Falha na API Nativa: ${e.toString()}`);
    }
    return { Name: null, Cover: null, Release: null, DurationISO: null, LanguageCode: null };
}

function convertISO8601DurationToHHMMSS(isoDuration) {
    if (!isoDuration) return null;
    const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
    const match = isoDuration.match(regex);
    if (match) {
        const h = String(parseInt(match[1] || 0, 10)).padStart(2, '0');
        const m = String(parseInt(match[2] || 0, 10)).padStart(2, '0');
        const s = String(parseInt(match[3] || 0, 10)).padStart(2, '0');
        const formatted = `${h}:${m}:${s}`;
        captureLog(`YOUTUBE DURAÇÃO SUCESSO: ${isoDuration} convertida para ${formatted}`);
        return formatted;
    }
    return null;
}

// --- SPOTIFY ---

function getSpotifyAccessToken() {
    captureLog('SPOTIFY: Solicitando Access Token...');
    const auth = Utilities.base64Encode(SECRETS.SPOTIFY_CLIENT_ID + ':' + SECRETS.SPOTIFY_CLIENT_SECRET);
    const options = {
        method: 'post',
        headers: { 'Authorization': 'Basic ' + auth },
        payload: { 'grant_type': 'client_credentials' },
        muteHttpExceptions: true
    };
    try {
        const response = UrlFetchApp.fetch('https://accounts.spotify.com/api/token', options);
        const json = JSON.parse(response.getContentText());
        return json.access_token || null;
    } catch (e) {
        captureLog(`SPOTIFY ERRO AUTH: ${e.toString()}`);
        return null;
    }
}

function extractSpotifyData(url) { 
    const token = getSpotifyAccessToken();
    const match = url.match(/spotify\.com\/(track|episode|show|album)\/([^/?]+)/i);
    if (!token || !match) {
        captureLog('SPOTIFY ALERTA: Link inválido ou falha no Token.');
        return { Name: null, Cover: null, Release: null, DurationRichText: null };
    }
    
    const type = match[1];
    const id = match[2];
    captureLog(`SPOTIFY INFO: Extraindo dados de ${type} ID: ${id}`);

    const apiUrl = `https://api.spotify.com/v1/${type}s/${id}`; 
    const options = { headers: { 'Authorization': 'Bearer ' + token }, muteHttpExceptions: true };
    
    try {
        const response = UrlFetchApp.fetch(apiUrl, options);
        const data = JSON.parse(response.getContentText());

        if (response.getResponseCode() === 200) {
            const result = {
                Name: data.name,
                Cover: (data.images && data.images[0]) ? data.images[0].url : (data.album?.images[0]?.url || null),
                Release: (data.release_date || data.show?.release_date || "").substring(0, 10),
                DurationRichText: convertMsToHHMMSS(data.duration_ms || 0)
            };
            captureLog(`SPOTIFY SUCESSO: ${result.Name} (${result.DurationRichText})`);
            return result;
        }
        captureLog(`SPOTIFY ERRO API: Status ${response.getResponseCode()}`);
    } catch (e) {
        captureLog(`SPOTIFY ERRO FATAL: ${e.toString()}`);
    }
    return { Name: null, Cover: null, Release: null, DurationRichText: null };
}

function convertMsToHHMMSS(ms) {
    if (!ms) return null;
    let s = Math.round(ms / 1000); 
    const h = Math.floor(s / 3600);
    s %= 3600;
    const m = Math.floor(s / 60);
    s %= 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}