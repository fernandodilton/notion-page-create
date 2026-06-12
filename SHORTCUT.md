# 📑 New Notion Page — Documentação do Shortcut

Shortcut iOS/macOS que captura a URL ou texto em foco, detecta a plataforma, coleta os inputs necessários e dispara o webhook para o sistema GAS.

**Compatibilidade:** iOS/iPadOS (Share Sheet) e macOS (AppleScript)  
**Input aceito:** URL ou texto livre

---

## Fluxo de ações

```
1. Get What's On Screen
   └─ output → "On Screen Content"

2. Show Result
   └─ text: [On Screen Content]

3. Get Device Details
   └─ detail: Device Model
   └─ output → "Device Model"

4. If  ─ [Device Model] contains "Mac"  AND  Extension Input exists
   │
   ├─ 5. Run AppleScript
   │      └─ input: [Device Model]
   │      └─ script:
   │             tell application "System Events"
   │                 set frontApp to name of first application process whose frontmost is true
   │             end tell
   │             if frontApp is "Dia"          → return URL of current tab
   │             if frontApp is "Google Chrome" → return URL of active tab of front window
   │             if frontApp is "Safari"        → return URL of current tab of front window
   │             else → try toolbar text field 1 of window 1
   │                    try name of front window
   │      └─ output → "AppleScript Result"
   │
   ├─ 6. Show Result
   │      └─ text: [AppleScript Result]
   │
   └─ Otherwise
          7. Get What's On Screen
             └─ output → "On Screen Content (iOS)"

8. Get Text
   └─ text: [Extension Input] + [If Result]     ← combina input do Share Sheet com resultado Mac/iOS
   └─ output → "Text"

9. Get Contents of URL
   └─ url: [Text]
   └─ output → "Contents of URL"

10. Detect Text
    └─ input: [Contents of URL]                 ← usado para detectar "Medium Logo" na página
    └─ output → "Detected Text"

11. If  ─ [Text] does not have a value          ← URL não foi capturada automaticamente
    │
    ├─ 12. Ask for Input                         ← usuário digita a URL manualmente
    │       └─ output → "Provided Input"
    │
    └─ Otherwise
           (segue com [Text] já preenchido)

13. Set Variable: INPUT_DATA
    └─ value: [If Result]                        ← URL capturada automaticamente ou digitada pelo usuário

14. If  ─ [Detected Text] contains "Medium Logo"
        OR [INPUT_DATA] contains "open.spotify.com"
        OR [INPUT_DATA] contains "youtube.com/"
        OR [INPUT_DATA] contains "substack.com"
    │
    ├─ 15. If  ─ [Detected Text] contains "Medium Logo"
    │           OR [INPUT_DATA] contains "substack.com"
    │       │
    │       ├─ 16. Get Text: "Articles"
    │       │       └─ Set Variable: TARGET_TABLE = "Articles"
    │       │
    │       └─ Otherwise
    │
    ├─ 17. If  ─ [INPUT_DATA] contains "open.spotify.com"
    │       │
    │       ├─ 18. Get Text: "Podcasts"
    │       │       └─ Set Variable: TARGET_TABLE = "Podcasts"
    │       │
    │       └─ Otherwise
    │
    ├─ 19. If  ─ [INPUT_DATA] contains "youtube.com/"
    │       │
    │       ├─ 20. Get Text: "Audio-visual"
    │       │       └─ Set Variable: TARGET_TABLE = "Audio-visual"
    │       │
    │       └─ Otherwise
    │
    └─ Otherwise  ─ nenhuma plataforma reconhecida automaticamente
           │
           ├─ 21. Match Text
           │       └─ pattern: ^(\w+\.)?[\w-]+\.[\w-]+(\.[\\w-]+)?.*$
           │       └─ input: [INPUT_DATA]
           │       └─ output → "Matches"
           │
           ├─ 22. If  ─ [Text] contains "https://"
           │           OR [Text] contains "http://"
           │           OR [Matches] is not empty
           │       │
           │       ├─ 23. List                   ← tabelas para inputs com URL
           │       │       └─ items:
           │       │              "📃 Articles"
           │       │              "🎞️ Audio-visual"
           │       │              "📚 Books"
           │       │              "⛓️ Clothes"
           │       │              "🖥️ Equipaments"
           │       │              "🎙️ Podcasts"
           │       │              "📃 Read"
           │       │              "🌐 Sites"
           │       │              "📲 Social posts"
           │       │
           │       └─ Otherwise
           │              24. List               ← tabelas para inputs sem URL
           │                  └─ items:
           │                         "📖 Dictionary"
           │                         "💭 Life wishes"
           │                         "🎯 Life goals"
           │
           ├─ 25. Choose from List
           │       └─ prompt: "Para '[INPUT_DATA]':"
           │       └─ output → "Selected Item"
           │
           ├─ 26. Replace Text
           │       └─ find: ^.*?   (regex — remove emoji e espaço do início)
           │       └─ replace: ""
           │       └─ input: [Selected Item]
           │       └─ output → "Updated Text"
           │
           └─ Set Variable: TARGET_TABLE = [Updated Text]

27. If  ─ [TARGET_TABLE] is "Clothes"
    │
    ├─ 28. List
    │       └─ items:
    │              "Actively Disengaged"
    │              "Disengaged"
    │              "Ok"
    │              "Engaged"
    │              "Thoroughly Engaged"
    │
    ├─ 29. Choose from List
    │       └─ prompt: "Para '[INPUT_DATA]':"
    │       └─ output → "Selected Item"
    │
    └─ Otherwise
           (ENGAGEMENT_SELECTED = vazio)

30. Set Variable: ENGAGEMENT_SELECTED
    └─ value: [Selected Item]                    ← item escolhido ou vazio

31. If  ─ [TARGET_TABLE] is "Life wishes"
        OR [TARGET_TABLE] is "Life goals"
    │
    ├─ 32. Ask for Input                         ← usuário digita nome ou descrição do item
    │       └─ output → "Provided Input"
    │
    └─ Otherwise
           (DESCRIPTION_INPUT = vazio)

33. Set Variable: DESCRIPTION_INPUT
    └─ value: [Provided Input]                   ← texto digitado ou vazio

34. Get Contents of URL  ─  POST
    └─ url: <GAS_DEPLOYMENT_URL>
    └─ method: POST
    └─ body type: JSON
    └─ body:
           {
             "action":             "create_page",
             "input_data":         [INPUT_DATA],
             "target_table":       [TARGET_TABLE],
             "engagement_selected":[ENGAGEMENT_SELECTED],
             "description_input":  [DESCRIPTION_INPUT]
           }
```

---

## Variáveis

| Variável | Tipo | Origem |
|---|---|---|
| `INPUT_DATA` | String / URL | Captura automática ou input manual do usuário |
| `TARGET_TABLE` | String | Detecção automática ou seleção do usuário |
| `ENGAGEMENT_SELECTED` | String | Seleção do usuário (apenas Clothes) ou vazio |
| `DESCRIPTION_INPUT` | String | Input do usuário (apenas Life wishes / Life goals) ou vazio |

---

## Notas

- O campo `"action": "create_page"` é enviado no payload mas não é lido pelo sistema GAS
- A URL do endpoint GAS está configurada diretamente na action 34 do shortcut
- A remoção do emoji nos nomes de tabela usa o regex `^.*? ` (apaga tudo até o primeiro espaço)
- A detecção de Medium usa o texto `"Medium Logo"` presente na página, não no domínio
