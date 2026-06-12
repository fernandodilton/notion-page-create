// ====================================================================
// ARQUIVO: Tests.gs
// FASE 4: TESTES (Módulos acionáveis manualmente)
// ====================================================================

function fluxoArticles() {
    const e = { postData: { contents: JSON.stringify({ action: "create_page", target_table: "Articles" }), type: 'application/json' } };
    return doPost(e);
}
function fluxoAudiovisual() {
    const e = { postData: { contents: JSON.stringify({ action: "create_page", target_table: "Audio-visual" }), type: 'application/json' } };
    return doPost(e);
}
function fluxoBooks() {
    const e = { postData: { contents: JSON.stringify({ action: "create_page", target_table: "Books" }), type: 'application/json' } };
    return doPost(e);
}
function fluxoClothes() {
    const e = { postData: { contents: JSON.stringify({ action: "create_page", target_table: "Clothes" }), type: 'application/json' } };
    return doPost(e);
}
function fluxoDictionary() {
    const e = { postData: { contents: JSON.stringify({ action: "create_page", target_table: "Dictionary"}), type: 'application/json' } };
    return doPost(e);
}
function fluxoEquipaments() {
    const e = { postData: { contents: JSON.stringify({ action: "create_page", target_table: "Equipaments" }), type: 'application/json' } };
    return doPost(e);
}
function fluxoLifeWishes() {
    const e = { postData: { contents: JSON.stringify({ action: "create_page", target_table: "Life wishes" }), type: 'application/json' } };
    return doPost(e);
}
function fluxoLifeGoals() {
    const e = { postData: { contents: JSON.stringify({ action: "create_page", target_table: "Life goals" }), type: 'application/json' } };
    return doPost(e);
}
function fluxoPodcasts() {
    const e = { postData: { contents: JSON.stringify({ action: "create_page", target_table: "Podcasts" }), type: 'application/json' } };
    return doPost(e);
}
function fluxoRead() {
    const e = { postData: { contents: JSON.stringify({ action: "create_page", target_table: "Read" }), type: 'application/json' } };
    return doPost(e);
}
function fluxoSites() {
    const e = { postData: { contents: JSON.stringify({ action: "create_page", target_table: "Sites" }), type: 'application/json' } };
    return doPost(e);
}
function fluxoSocialPosts() {
    const e = { postData: { contents: JSON.stringify({ action: "create_page", target_table: "Social posts" }), type: 'application/json' } };
    return doPost(e);
}
function fluxoCreators() {
    const e = { postData: { contents: JSON.stringify({ action: "create_page", target_table: "Creators" }), type: 'application/json' } };
    return doPost(e);
}