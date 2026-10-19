/**
 * =========================================================
 *  PADANIA TUNING — RICEZIONE ISCRIZIONI
 *  Salva ogni candidatura nel Foglio Google, le foto su Drive,
 *  manda la mail di conferma al pilota e la notifica allo staff.
 *  Istruzioni complete: ISTRUZIONI.md
 * =========================================================
 */

// ---------- IMPOSTAZIONI ----------
var EMAIL_STAFF   = 'padaniatuning@gmail.com';   // dove arriva la notifica di ogni iscrizione
var NOME_MITTENTE = 'Padania Tuning';
var NOME_FOGLIO   = 'Iscrizioni';               // nome della scheda (in basso) del Foglio
var NOME_CARTELLA = 'Padania Tuning - Foto iscrizioni';

var EVENTO = {
  nome: 'Padania Tuning al Qi Clubbing',
  luogo: 'Qi Clubbing',
  indirizzo: "Via dell'Industria, 83, 25030 Erbusco (BS)",
  data: 'Domenica 7 Novembre 2027',
  orarioRaduno: 'dalle ore 21:00',
  orarioSerata: 'dalle ore 23:30'
};

var COLONNE = [
  'Data invio', 'Evento', 'Nome', 'Cognome', 'Telefono', 'Email', 'Instagram', 'N. veicoli',
  'Veicolo 1', 'Targa 1', 'Foto 1',
  'Veicolo 2', 'Targa 2', 'Foto 2',
  'Veicolo 3', 'Targa 3', 'Foto 3',
  'Veicolo 4', 'Targa 4', 'Foto 4',
  'Veicolo 5', 'Targa 5', 'Foto 5',
  'Veicolo 6', 'Targa 6', 'Foto 6',
  'Modifiche', 'Club', 'Come ci conosce', 'Stato'
];


// ---------- RICEZIONE DEL FORM ----------
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var d = JSON.parse(e.postData.contents);

    if (!d.nome || !d.email || !d.veicoli || !d.veicoli.length) {
      return json({ ok: false, error: 'Dati mancanti' });
    }

    var foglio = getFoglio();
    var cartella = getCartella();
    var quando = new Date();
    var riga = [quando, d.evento || EVENTO.nome, d.nome, d.cognome, d.telefono, d.email, d.instagram, d.numero_veicoli];

    for (var i = 0; i < 6; i++) {
      var v = d.veicoli[i];
      if (!v) { riga.push('', '', ''); continue; }
      var link = '';
      if (v.foto) {
        var nomeFile = [v.targa || 'veicolo' + (i + 1), d.cognome, d.nome].join('_').replace(/[^\w\-]+/g, '_') + '.jpg';
        var blob = Utilities.newBlob(Utilities.base64Decode(v.foto), 'image/jpeg', nomeFile);
        link = cartella.createFile(blob).getUrl();
      }
      riga.push((v.marca + ' ' + v.modello).trim(), v.targa, link);
    }

    var conoscenza = d.conoscenza === 'Altro' && d.altro_conoscenza ? 'Altro: ' + d.altro_conoscenza : d.conoscenza;
    riga.push(d.modifiche, d.club, conoscenza, 'Da valutare');
    foglio.appendRow(riga);

    inviaConferma(d);
    inviaNotificaStaff(d, riga);

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Apri l'URL dello script nel browser per controllare che sia attivo
function doGet() {
  return json({ ok: true, messaggio: 'Script iscrizioni Padania Tuning attivo 🏁' });
}


// ---------- MAIL DI CONFERMA AL PILOTA ----------
function inviaConferma(d) {
  var targa = (d.veicoli[0] && d.veicoli[0].targa) || '';
  var qr = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=' + encodeURIComponent(targa);

  var html =
    '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#111;max-width:600px">' +
    '<p>Ciao ' + esc(d.nome) + ',</p>' +
    '<p>Grazie per aver inviato la tua candidatura ufficiale per l\'evento Padania Tuning, in programma <b>' + EVENTO.data + '</b> presso il <b>' + EVENTO.luogo + '</b>! 🏁🔥</p>' +
    '<p>Il nostro staff ha ricevuto correttamente i dati relativi al tuo profilo e al veicolo proposto per l\'esposizione. 🚗💨</p>' +

    '<h3>📍 DETTAGLI EVENTO</h3>' +
    '<p>📌 Luogo: ' + EVENTO.luogo + ' — ' + EVENTO.indirizzo + '<br>' +
    '🗓️ Data: ' + EVENTO.data + '<br>' +
    '🕘 Orario Raduno: ' + EVENTO.orarioRaduno + '<br>' +
    '🎶 Serata al ' + EVENTO.luogo + ': ' + EVENTO.orarioSerata + '</p>' +

    '<h3>🎁 INFO E VANTAGGI</h3>' +
    '<p>🅿️ +100 posti auto<br>' +
    '🆓 Ingresso al raduno totalmente gratuito<br>' +
    '🎟️ Se vieni con Padania Tuning, ingresso omaggio anche all\'interno della discoteca ' + EVENTO.luogo + '</p>' +

    '<h3>🔥 PROCESSO DI SELEZIONE</h3>' +
    '<p>Ti informiamo che l\'invio di questo modulo rappresenta esclusivamente una candidatura e non costituisce una conferma di partecipazione all\'evento.</p>' +
    '<p>Lo staff di Padania Tuning effettuerà una selezione dei veicoli candidati, valutando attentamente le caratteristiche e la presentazione di ogni mezzo. 🧐🔥</p>' +
    '<p>📧 L\'esito della selezione verrà comunicato tramite email all\'indirizzo inserito durante la registrazione.</p>' +
    '<p>In caso di selezione, riceverai una comunicazione contenente tutte le informazioni necessarie per partecipare all\'evento, comprese le indicazioni per l\'ingresso e il posizionamento del veicolo.</p>' +

    '<h3>✅ SE LA TUA AUTO VERRÀ SELEZIONATA:</h3>' +
    '<p>- Avrai accesso all\'area espositiva dedicata.<br>' +
    '- Riceverai tutte le indicazioni necessarie per l\'ingresso.<br>' +
    '- Riceverai le informazioni relative al posizionamento del veicolo.<br>' +
    '- Il QR Code riportato di seguito verrà utilizzato per la gestione dell\'accesso all\'area espositiva.</p>' +

    '<h3>🚫 SE INVECE NON VERRAI SELEZIONATO:</h3>' +
    '<p>- Non riceverai una conferma di partecipazione all\'area espositiva.<br>' +
    '- Potrai comunque partecipare all\'evento come visitatore e vivere la serata insieme a noi. 🏁</p>' +

    '<h3>🎫 IL TUO QR CODE</h3>' +
    '<p>Il seguente QR Code è associato alla candidatura e potrà essere utilizzato per l\'accesso all\'area espositiva solo in caso di selezione.</p>' +
    '<img src="' + qr + '" alt="QR Code ' + esc(targa) + '" style="width:250px;height:250px;display:block;margin:10px 0;" />' +

    '<p>Non vediamo l\'ora di incontrarti al ' + EVENTO.luogo + '! 🔥🏎️</p>' +

    '<h3>📋 RIEPILOGO CANDIDATURA</h3>' +
    '<p>👤 Pilota: ' + esc(d.nome) + ' ' + esc(d.cognome) + '<br>' +
    '🚗 Numero veicoli candidati: ' + esc(d.numero_veicoli) + '<br>' +
    '📸 Instagram: ' + esc(d.instagram || '-') + '</p>' +

    '<p>Ti ringraziamo per l\'interesse e per la passione che condividi con Padania Tuning.</p>' +
    '<p>In bocca al lupo per la selezione! 🍀🔥</p>' +
    '<p>Cordiali saluti,<br>Team Padania Tuning 🏁</p>' +

    '<hr style="border:0;border-top:1px solid #ddd;margin:25px 0">' +
    '<p style="font-size:12px;color:#777">Questa email è una conferma automatica di ricezione della candidatura inviata tramite Padania Tuning.<br>' +
    'La ricezione di questa email non costituisce una conferma di selezione o partecipazione all\'evento.<br>' +
    'Se non sei stato tu a compilare il modulo, puoi ignorare questo messaggio.</p>' +
    '</div>';

  MailApp.sendEmail({
    to: d.email,
    subject: '🏁 Conferma ricezione candidatura evento - ' + d.nome + ' ' + d.cognome,
    htmlBody: html,
    name: NOME_MITTENTE,
    replyTo: EMAIL_STAFF
  });
}


// ---------- NOTIFICA ALLO STAFF ----------
function inviaNotificaStaff(d, riga) {
  var righe = d.veicoli.map(function (v, i) {
    return 'VEICOLO ' + (i + 1) + ': ' + v.marca + ' ' + v.modello + ' — Targa ' + v.targa +
      (riga[10 + i * 3] ? '<br>Foto: <a href="' + riga[10 + i * 3] + '">apri</a>' : '');
  }).join('<br><br>');

  var html =
    '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">' +
    '<h2>NUOVA CANDIDATURA — ' + EVENTO.luogo + '</h2>' +
    '<p><b>Nome:</b> ' + esc(d.nome) + ' ' + esc(d.cognome) + '<br>' +
    '<b>Telefono:</b> ' + esc(d.telefono) + '<br>' +
    '<b>Email:</b> ' + esc(d.email) + '<br>' +
    '<b>Instagram:</b> ' + esc(d.instagram || '-') + '<br>' +
    '<b>Veicoli:</b> ' + esc(d.numero_veicoli) + '</p>' +
    '<p>' + righe + '</p>' +
    '<p><b>Modifiche:</b> ' + esc(d.modifiche || '-') + '<br>' +
    '<b>Club:</b> ' + esc(d.club || '-') + '<br>' +
    '<b>Come ci conosce:</b> ' + esc(d.conoscenza || '-') + ' ' + esc(d.altro_conoscenza || '') + '</p>' +
    '<p><a href="' + SpreadsheetApp.getActiveSpreadsheet().getUrl() + '">📊 Apri il foglio iscrizioni</a></p>' +
    '</div>';

  MailApp.sendEmail({
    to: EMAIL_STAFF,
    subject: 'Nuova iscrizione: ' + d.nome + ' ' + d.cognome + ' (' + (d.veicoli[0] ? d.veicoli[0].targa : '') + ')',
    htmlBody: html,
    name: NOME_MITTENTE,
    replyTo: d.email
  });
}


// ---------- FUNZIONI DI SERVIZIO ----------
function getFoglio() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(NOME_FOGLIO) || ss.insertSheet(NOME_FOGLIO);
  if (sh.getLastRow() === 0) {
    sh.appendRow(COLONNE);
    sh.getRange(1, 1, 1, COLONNE.length).setFontWeight('bold').setBackground('#111111').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

function getCartella() {
  var it = DriveApp.getFoldersByName(NOME_CARTELLA);
  return it.hasNext() ? it.next() : DriveApp.createFolder(NOME_CARTELLA);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

// Esegui questa funzione UNA volta dall'editor per dare i permessi (Gmail, Drive, Fogli)
function autorizza() {
  getFoglio();
  getCartella();
  Logger.log('Permessi OK — mail rimanenti oggi: ' + MailApp.getRemainingDailyQuota());
}
