# Collegare il form al Foglio Google 📊

Bastano 10 minuti, si fa una volta sola. Ti serve solo l'account Google **padaniatuning@gmail.com** (o quello da cui vuoi far partire le mail).

## 1. Crea il Foglio
1. Vai su [sheets.new](https://sheets.new) e chiamalo **Iscrizioni Padania Tuning**
2. Dal menu **Estensioni → Apps Script**

## 2. Incolla lo script
1. Cancella tutto quello che c'è nell'editor
2. Incolla il contenuto del file `Codice.gs` di questa cartella
3. Premi 💾 **Salva**

## 3. Dai i permessi
1. In alto, nel menu a tendina delle funzioni, scegli **autorizza** e premi **▶ Esegui**
2. Google chiede i permessi: **Rivedi autorizzazioni → scegli l'account → Avanzate → Vai a (non sicuro) → Consenti**
   (è normale, lo script l'hai creato tu)

## 4. Pubblica
1. In alto a destra: **Esegui il deployment → Nuovo deployment**
2. Ingranaggio ⚙️ → **App web**
3. Imposta:
   - **Esegui come:** Me
   - **Chi ha accesso:** Chiunque
4. **Esegui il deployment** e copia l'**URL dell'app web** (finisce con `/exec`)

## 5. Collega il sito
Apri `assets/js/config.js` e incolla l'URL al posto di `INCOLLA_QUI_URL_APPS_SCRIPT`:

```js
SCRIPT_URL: 'https://script.google.com/macros/s/XXXXXXXX/exec',
```

Fatto! ✅ Fai un'iscrizione di prova dal sito: deve comparire una riga nel Foglio e arrivarti la mail.

---

### Cosa succede a ogni iscrizione
- Nuova riga nella scheda **Iscrizioni** (con colonna **Stato** che puoi cambiare in *Selezionato* / *Scartato*)
- Le foto finiscono nella cartella Drive **Padania Tuning - Foto iscrizioni**, con il link nel Foglio
- Il pilota riceve la mail di conferma con il QR code della targa
- Lo staff riceve la notifica su alessandro.radulescu03@gmail.com

### Scaricare l'Excel
Dal Foglio: **File → Scarica → Microsoft Excel (.xlsx)**

### Cambiare evento
- Testi della mail: blocco `EVENTO` in cima allo script
- Testi del sito: `assets/js/config.js`

⚠️ Se modifichi lo script devi ripubblicarlo: **Esegui il deployment → Gestisci deployment → ✏️ → Versione: Nuova versione → Esegui il deployment**. L'URL resta lo stesso.

### Limite mail
Un account Gmail normale può inviare circa **100 mail al giorno** (ogni iscrizione ne usa 2: conferma + notifica staff). Per eventi grandi puoi togliere la notifica allo staff cancellando la riga `inviaNotificaStaff(d, riga);`.

---

# Collegare l'app check-in (Padania-App) 📱

Lo stesso script fa anche da "server" per l'app check-in: l'app scarica gli iscritti dal Foglio e sincronizza gli ingressi tra tutti i telefoni dello staff. I check-in finiscono in una nuova scheda **Check-in** del Foglio (creata da sola).

## 1. Aggiorna il codice
1. Apri il Foglio → **Estensioni → Apps Script**
2. Cancella tutto e incolla il nuovo `Codice.gs` → 💾 **Salva**

## 2. Imposta la chiave staff (una volta sola)
La chiave **non** va nel codice (il repo è pubblico): si salva nelle proprietà dello script.
1. A sinistra ⚙️ **Impostazioni progetto**
2. In fondo: **Proprietà script → Aggiungi proprietà script**
   - Proprietà: `CHIAVE_STAFF`
   - Valore: la **password dell'app** (es. `PadaniaTuning00!`)
3. **Salva proprietà script**

> Se un giorno cambi la password dell'app, cambiala anche qui.

## 3. Ripubblica (l'URL resta uguale)
**Esegui il deployment → Gestisci deployment → ✏️ → Versione: Nuova versione → Esegui il deployment**

## 4. Prova
Nel menu delle funzioni scegli **provaApp** → ▶ **Esegui**: nei log deve comparire `CHIAVE_STAFF impostata ✅`.
Poi nell'app: **Strumenti → Scarica / aggiorna iscritti dal sito**.

### Come funziona all'evento
- Ogni telefono dello staff apre l'app, entra con la password e preme **Scarica iscritti dal sito**: la sincronizzazione si attiva da sola
- In alto compare **● LIVE** quando è tutto collegato, **Offline** se manca il campo (l'app continua a funzionare e invia tutto appena torna la rete)
- La lista iscritti si riaggiorna da sola ogni 5 minuti: se cambi lo **Stato** nel Foglio (Selezionato / Scartato) l'app lo vede
- Il QR della mail di conferma contiene la targa: l'app lo riconosce e registra anche con quale auto è entrato
- Chi ha Stato diverso da "Selezionato" viene segnalato prima dell'ingresso
- Nella scheda **Check-in** del Foglio vedi chi è entrato, a che ora, se è uscito e da quale telefono

⚠️ Non modificare a mano la colonna nascosta "Dati" della scheda Check-in.
