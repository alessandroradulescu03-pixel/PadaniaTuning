# Padania Tuning 🏁

Sito ufficiale Padania Tuning, statico e ospitato gratis su GitHub Pages.

## Pagine
| File | Pagina |
|---|---|
| `index.html` | Home con "Scopri di più" e regolamento |
| `storia.html` | La nostra storia, partner e FAQ |
| `galleria.html` | Galleria foto degli eventi (link Google Drive) |
| `eventi.html` | Sezione eventi con countdown |
| `qi.html` | Form di iscrizione evento Qi Clubbing |
| `collaborazioni.html` | Eventi in collaborazione |
| `conferma.html` | Pagina dopo l'invio del form |
| `shop.html` | Shop vetrina (magliette, felpe, accessori) |
| `contatti.html` | Contatti |

## Dove si modifica cosa
- **Menu e footer** (tutte le pagine): `assets/js/site.js`
- **Data, luogo, orari evento e chiusura iscrizioni**: `assets/js/config.js`
- **Prodotti dello shop**: lista `PRODOTTI` in `shop.html`
- **Foto della galleria**: lista `EVENTS` in `galleria.html`
- **Immagini**: `assets/img/`
- **Form → Foglio Google + mail**: cartella `google-apps-script/` (leggi `ISTRUZIONI.md`)

## Pubblicare su GitHub Pages
1. Fai il push del repository
2. Su GitHub: **Settings → Pages → Branch: `main` / `(root)` → Save**
3. Dopo un paio di minuti il sito è online su `https://alessandroradulescu03-pixel.github.io/PadaniaTuning/`

## Shopify (in futuro)
Quando ci sarà l'account Shopify, nei prodotti di `shop.html` basterà sostituire il link "Ordina" con il Buy Button di Shopify.
