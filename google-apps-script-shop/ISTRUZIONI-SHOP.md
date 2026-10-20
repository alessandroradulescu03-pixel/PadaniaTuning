# Attivare lo shop con Stripe 🛒

Funziona come il form delle iscrizioni: un **Foglio Google** con prodotti, magazzino e ordini, più uno **script** che parla con Stripe.
Si parte in **modalità TEST** (carte finte, nessun soldo vero). Quando è tutto ok si passa alla modalità reale cambiando solo la chiave.

---

## 1. Account Stripe (lo apre Padania Tuning)
1. Vai su [dashboard.stripe.com/register](https://dashboard.stripe.com/register) e crea l'account **a nome di Padania Tuning**
2. In alto a destra attiva **Modalità test** (interruttore "Test mode")
3. Menu **Sviluppatori → Chiavi API** → copia la **Chiave segreta** (inizia con `sk_test_...`)

⚠️ La chiave segreta è come la password del conto: non va mai scritta nel sito né mandata in chat.

## 2. Foglio + script
1. Vai su [sheets.new](https://sheets.new) e chiamalo **Shop Padania Tuning**
2. **Estensioni → Apps Script**, cancella tutto e incolla il contenuto di `Shop.gs`, poi salva (**Cmd+S**)
3. Dal menu delle funzioni scegli **preparaFoglio** → **▶ Esegui** → dai i permessi
   (crea le schede *Prodotti*, *Magazzino*, *Ordini* con i 3 prodotti attuali)

## 3. Salva la chiave Stripe (in modo sicuro)
1. Nello script trova la funzione `salvaChiaveStripe` e incolla la chiave al posto di `INCOLLA_QUI_LA_CHIAVE_SEGRETA`
2. Scegli **salvaChiaveStripe** → **▶ Esegui**
3. **Cancella la chiave** da quella riga (rimetti `INCOLLA_QUI_LA_CHIAVE_SEGRETA`) e salva: ormai è conservata al sicuro nelle impostazioni dello script

## 4. Controllo automatico degli ordini
Scegli **attivaControlloOrdini** → **▶ Esegui**.
Ogni 10 minuti lo script controlla Stripe e registra anche gli ordini dei clienti che hanno chiuso la pagina subito dopo aver pagato.

## 5. Pubblica e collega
1. **Esegui il deployment → Nuovo deployment → App web** — Esegui come: **Me**, Chi ha accesso: **Chiunque**
2. Copia l'URL (finisce con `/exec`) e incollalo in `assets/js/config.js` al posto di `INCOLLA_QUI_URL_SCRIPT_SHOP`

## 6. Prova con una carta finta
Sul sito: aggiungi prodotti → **Vai al pagamento sicuro** → su Stripe usa
- Carta: **4242 4242 4242 4242**
- Scadenza: una qualsiasi futura (es. 12/30) — CVC: **123**

Devi vedere la pagina **Ordine confermato**, una riga nella scheda *Ordini*, il magazzino scalato e due mail (cliente + notifica).

## 7. Vendere davvero
1. Su Stripe completa l'attivazione dell'account (dati attività, IBAN) e disattiva la Modalità test
2. Copia la chiave **`sk_live_...`** e ripeti il punto 3 con quella
3. Fatto: da ora i pagamenti sono reali 💸

---

### Gestire lo shop ogni giorno (senza toccare il codice)
- **Prezzi, nomi, descrizioni** → scheda *Prodotti*
- **Nascondere un prodotto** → colonna `attivo` = `no`
- **Taglie e pezzi disponibili** → scheda *Magazzino* (una riga per taglia; `Unica` per gli accessori). A zero il sito mostra *Esaurito*
- **Nuovo prodotto** → aggiungi una riga in *Prodotti* (con un `id` senza spazi, es. `adesivo`) e le sue righe in *Magazzino*. La foto va in `assets/img/shop/` sul sito
- **Ordini** → scheda *Ordini*: cambia la colonna *Stato* in *Spedito* / *Ritirato*
- **Spedizione**: costo, soglia gratis e "ritiro all'evento" sono in cima a `Shop.gs` (e i testi uguali in `config.js`)

⚠️ Dopo ogni modifica a `Shop.gs`: **Gestisci deployment → ✏️ → Nuova versione**. Le modifiche al Foglio invece valgono subito.

### Costi
Nessun canone. Stripe trattiene una commissione solo sulle vendite (carte europee: 1,5% + 0,25 €).
