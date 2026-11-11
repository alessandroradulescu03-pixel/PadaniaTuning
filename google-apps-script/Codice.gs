/**
 * =========================================================
 *  PADANIA TUNING — RICEZIONE ISCRIZIONI
 *  Salva ogni candidatura nel Foglio Google, le foto su Drive,
 *  manda la mail di conferma al pilota e la notifica allo staff.
 *  Istruzioni complete: ISTRUZIONI.md
 * =========================================================
 */

// ---------- IMPOSTAZIONI ----------
var EMAIL_STAFF   = 'alessandro.radulescu03@gmail.com';   // dove arriva la notifica di ogni iscrizione (e le risposte dei piloti)
var NOME_MITTENTE = 'Padania Tuning';
var NOME_FOGLIO   = 'Iscrizioni';               // nome della scheda (in basso) del Foglio
var NOME_CARTELLA = 'Padania Tuning - Foto iscrizioni';

var EVENTO = {
  nome: 'Padania Tuning a Covo',
  luogo: 'Covo (BG)',
  indirizzo: 'Via Giacomo Gregis 46, 24050 Covo (BG)',
  data: 'Domenica 13 Dicembre 2026',
  orarioRaduno: 'dalle 13:30 alle 18:30',
  orarioSerata: ''            // lascia '' se non c'è la serata: non viene scritta
};

// Mail di conferma in versione natalizia 🎄 (metti false dopo le feste: torna quella classica)
var NATALE = true;

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
  // Le richieste dell'app check-in hanno il campo "action": vanno alla sezione API in fondo
  var richiesta;
  try { richiesta = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, error: 'Richiesta non valida' }); }
  if (richiesta.action) return api(richiesta);

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var d = richiesta;

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
var LOGO_URL = 'https://alessandroradulescu03-pixel.github.io/PadaniaTuning/assets/img/logo.jpg';
var SITO_URL = 'https://alessandroradulescu03-pixel.github.io/PadaniaTuning/';
var INSTAGRAM_URL = 'https://www.instagram.com/padaniatuning/';

function inviaConferma(d) {
  // Data per il riquadro (es. "Sabato 7 Novembre 2026" -> 07 / NOV / 2026)
  var m = EVENTO.data.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  var gg = m ? ('0' + m[1]).slice(-2) : '';
  var mese = m ? m[2].slice(0, 3).toUpperCase() : '';
  var anno = m ? m[3] : '';
  var giorno = EVENTO.data.split(' ')[0];

  /* Mail volutamente "semplice": un solo sfondo bianco, testo scuro, riquadri
     fatti solo di bordi. Così col tema scuro Gmail la scurisce tutta in modo
     uniforme e col tema chiaro resta bianca: segue il tema del telefono. */
  var T = '#111114', S = '#45454d', M = '#7c7c86', L = '#dedee4';
  var F = "font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;";
  var p = 'margin:0 0 14px;font-size:15px;line-height:1.6;color:' + S;
  var h = 'margin:0 0 12px;' + F + 'font-size:22px;font-style:italic;font-weight:900;color:' + T + ';text-transform:uppercase';
  var td = 'padding:11px 0;border-bottom:1px solid ' + L + ';';
  var box = 'border:1px solid ' + L + ';border-radius:14px;';
  var A = NATALE ? '#d4142a' : T;            // colore d'accento: rosso Natale oppure nero classico
  var cT = NATALE ? '' : 'dm-t';             // in versione natalizia il rosso resta rosso anche col tema scuro

  var auto = d.veicoli.map(function (v, i) {
    return '<tr><td class="dm-m dm-l" style="' + td + 'font-size:14px;color:' + M + ';width:90px">Veicolo ' + (i + 1) + '</td>' +
      '<td class="dm-t dm-l" style="' + td + 'font-size:15px;color:' + T + '"><b>' + esc(v.marca + ' ' + v.modello) + '</b> &middot; ' + esc(v.targa) + '</td></tr>';
  }).join('');

  var qrs = d.veicoli.map(function (v, i) {
    var url = 'https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=12&data=' + encodeURIComponent(v.targa || '');
    return '<div style="margin:0 auto 16px;text-align:center">' +
      '<img src="' + url + '" width="190" height="190" alt="QR Code veicolo ' + (i + 1) + '" style="display:inline-block;border-radius:12px;border:1px solid ' + L + '">' +
      (d.veicoli.length > 1 ? '<div class="dm-t" style="margin-top:8px;' + F + 'font-size:18px;font-weight:800;font-style:italic;color:' + T + '">Veicolo ' + (i + 1) + ' &middot; ' + esc(v.marca + ' ' + v.modello) + '</div>' : '') +
    '</div>';
  }).join('');

  var html =
  '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<style>' +
    // Apple Mail / Outlook col tema scuro
    '@media (prefers-color-scheme: dark){' +
      '.dm-bg{background:#121214 !important}' +
      '.dm-t,.dm-t b{color:#f2f2f4 !important}' +
      '.dm-s{color:#c9c9d0 !important}' +
      '.dm-m{color:#9a9aa3 !important}' +
      '.dm-l{border-color:#2c2c31 !important}' +
      '.dm-btn{background:#f2f2f4 !important;color:#111114 !important}' +
    '}' +
  '</style></head>' +
  '<body class="dm-bg" style="margin:0;padding:0;background:#ffffff">' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="dm-bg" style="background:#ffffff;font-family:Arial,Helvetica,sans-serif">' +
  '<tr><td align="center" style="padding:10px 6px">' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">' +

    // FASCIA NATALIZIA
    (NATALE ?
    '<tr><td style="padding:8px 12px 0">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="background:#0f6b3f;border-radius:12px 12px 0 0;padding:11px 12px;' + F + 'font-size:17px;font-weight:800;font-style:italic;color:#ffffff;text-transform:uppercase;letter-spacing:.5px">&#127876; Christmas Edition &middot; ' + gg + ' ' + mese + ' &#127876;</td></tr>' +
      '<tr><td style="background:#d4142a;height:4px;line-height:4px;font-size:0;border-radius:0 0 4px 4px">&nbsp;</td></tr></table>' +
    '</td></tr>' : '') +

    // INTESTAZIONE
    '<tr><td style="padding:18px 20px 0">' +
      '<table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
        '<td><img src="' + LOGO_URL + '" width="42" height="42" alt="Padania Tuning" style="display:block;border-radius:50%"></td>' +
        '<td class="dm-t" style="padding-left:12px;' + F + 'font-size:20px;font-style:italic;font-weight:900;color:' + T + ';text-transform:uppercase">Padania Tuning</td>' +
      '</tr></table>' +
    '</td></tr>' +

    // TITOLO
    '<tr><td style="padding:24px 20px 4px">' +
      '<div class="dm-s" style="font-size:13px;font-weight:bold;color:#1f8a4c">&#10003; Candidatura ricevuta</div>' +
      '<h1 class="dm-t" style="margin:10px 0 0;' + F + 'font-size:40px;line-height:1;font-style:italic;font-weight:900;color:' + T + ';text-transform:uppercase">Ciao ' + esc(d.nome) + ',<br>ci siamo!</h1>' +
      '<p class="dm-s" style="' + p + ';margin-top:14px">Abbiamo ricevuto la tua candidatura per <b class="dm-t" style="color:' + T + '">' + EVENTO.nome + '</b>' + (NATALE ? ', il nostro raduno di Natale' : '') + '. Lo staff ha i dati del tuo profilo e del tuo garage. ' + (NATALE ? '&#127876;' : '&#127937;') + '</p>' +
    '</td></tr>' +

    // EVENTO
    '<tr><td style="padding:6px 20px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="dm-l" style="' + box + '"><tr>' +
        '<td width="84" valign="middle" style="padding:14px 0 14px 14px">' +
          '<table role="presentation" cellpadding="0" cellspacing="0" width="70" class="' + (NATALE ? '' : 'dm-l') + '" style="border:2px solid ' + A + ';border-radius:10px"><tr><td align="center" class="' + cT + '" style="padding:8px 0;' + F + 'color:' + A + ';line-height:1">' +
            '<div style="font-size:32px;font-weight:900">' + gg + '</div>' +
            '<div style="font-size:14px;font-weight:bold">' + mese + '</div>' +
            '<div class="dm-m" style="font-size:12px;color:' + M + ';margin-top:2px">' + anno + '</div>' +
          '</td></tr></table>' +
        '</td>' +
        '<td valign="middle" style="padding:14px">' +
          '<div class="dm-t" style="' + F + 'font-size:22px;font-weight:800;color:' + T + '">' + EVENTO.luogo + '</div>' +
          '<div class="dm-m" style="font-size:13px;color:' + M + ';margin-top:2px">' + EVENTO.indirizzo + '</div>' +
          '<div class="dm-t" style="font-size:14px;color:' + T + ';font-weight:bold;margin-top:6px">' + giorno + ' &middot; raduno ' + EVENTO.orarioRaduno + (EVENTO.orarioSerata ? '<br>serata ' + EVENTO.orarioSerata : '') + '</div>' +
        '</td>' +
      '</tr></table>' +
    '</td></tr>' +

    // VANTAGGI
    '<tr><td class="dm-s" style="padding:12px 20px 4px;font-size:14px;line-height:2;color:' + S + '">' +
      '&#128663; 250+ auto<br>' +
      '&#127903;&#65039; Ingresso &euro;10<br>' +
      (NATALE ? '&#127876;' : '&#127937;') + ' Raduno di domenica pomeriggio' +
    '</td></tr>' +

    '<tr><td style="padding:16px 20px"><div class="dm-l" style="border-top:1px solid ' + L + '"></div></td></tr>' +

    // SELEZIONE
    '<tr><td style="padding:0 20px">' +
      '<h2 class="dm-t" style="' + h + '">Cosa succede ora</h2>' +
      '<p class="dm-s" style="' + p + '">Questa mail conferma solo che la candidatura è arrivata: <b class="dm-t" style="color:' + T + '">non è ancora una conferma di partecipazione</b>. Lo staff valuterà ogni auto candidata e ti scriverà l\'esito a questo indirizzo.</p>' +
      '<p class="dm-s" style="' + p + '"><b class="dm-t" style="color:' + T + '">&#9989; Se vieni selezionato:</b> accedi all\'area espositiva e ricevi le indicazioni per ingresso e posizionamento.</p>' +
      '<p class="dm-s" style="' + p + '"><b class="dm-t" style="color:' + T + '">&#127937; Se non vieni selezionato:</b> puoi comunque venire come visitatore e vivere il raduno con noi.</p>' +
    '</td></tr>' +

    '<tr><td style="padding:6px 20px 16px"><div class="dm-l" style="border-top:1px solid ' + L + '"></div></td></tr>' +

    // QR
    '<tr><td align="center" style="padding:0 20px 4px">' +
      '<h2 class="dm-t" style="' + h + ';text-align:center">' + (d.veicoli.length > 1 ? 'I tuoi QR d\'ingresso' : 'Il tuo QR d\'ingresso') + '</h2>' +
      (d.veicoli.length > 1 ? '<p class="dm-s" style="' + p + ';text-align:center">Un QR per ogni auto: all\'ingresso mostra quello dell\'auto con cui entri.</p>' : '') +
      qrs +
      '<p class="dm-m" style="' + p + ';font-size:13px;color:' + M + ';text-align:center">Valido per l\'area espositiva solo in caso di selezione.</p>' +
    '</td></tr>' +

    // RIEPILOGO
    '<tr><td style="padding:14px 20px 4px">' +
      '<h2 class="dm-t" style="' + h + '">Riepilogo</h2>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
        '<tr><td class="dm-m dm-l" style="' + td + 'font-size:14px;color:' + M + ';width:90px">Pilota</td><td class="dm-t dm-l" style="' + td + 'font-size:15px;color:' + T + '"><b>' + esc(d.nome) + ' ' + esc(d.cognome) + '</b></td></tr>' +
        (d.instagram ? '<tr><td class="dm-m dm-l" style="' + td + 'font-size:14px;color:' + M + '">Instagram</td><td class="dm-t dm-l" style="' + td + 'font-size:15px;color:' + T + '"><b>@' + esc(d.instagram) + '</b></td></tr>' : '') +
        auto +
      '</table>' +
    '</td></tr>' +

    // CHIUSURA + BOTTONI
    '<tr><td style="padding:20px 20px 6px">' +
      '<p class="dm-s" style="' + p + '">Grazie per la passione che condividi con noi. In bocca al lupo per la selezione! &#127808;&#128293;' + (NATALE ? '<br>E intanto buone feste da tutti noi. &#127876;' : '') + '</p>' +
      '<p class="dm-t" style="' + p + ';color:' + T + '">Team Padania Tuning ' + (NATALE ? '&#127877;' : '&#127937;') + '</p>' +
    '</td></tr>' +
    '<tr><td style="padding:8px 20px 22px">' +
      '<a href="' + INSTAGRAM_URL + '" class="' + (NATALE ? '' : 'dm-btn') + '" style="display:block;text-align:center;background:' + A + ';color:#ffffff;text-decoration:none;' + F + 'font-size:19px;font-weight:900;font-style:italic;padding:14px;border-radius:12px">Seguici su Instagram</a>' +
      '<a href="' + SITO_URL + '" class="dm-t dm-l" style="display:block;text-align:center;margin-top:10px;color:' + T + ';text-decoration:none;font-size:14px;font-weight:bold;padding:12px;border-radius:12px;border:1px solid ' + L + '">Vai al sito</a>' +
    '</td></tr>' +

    // NOTE
    '<tr><td class="dm-m" style="padding:6px 20px 20px;font-size:11px;line-height:1.6;color:' + M + ';text-align:center">' +
      'Conferma automatica di ricezione della candidatura inviata tramite il sito Padania Tuning. ' +
      'Non costituisce conferma di selezione o partecipazione all\'evento. ' +
      'Se non hai compilato tu il modulo, ignora questo messaggio.' +
    '</td></tr>' +

  '</table></td></tr></table></body></html>';

  MailApp.sendEmail({
    to: d.email,
    subject: (NATALE ? '🎄' : '🏁') + ' Candidatura ricevuta — ' + EVENTO.luogo + ', ' + EVENTO.data,
    htmlBody: html,
    name: NOME_MITTENTE,
    replyTo: EMAIL_STAFF
  });
}

// Prova grafica: manda a te una mail di conferma finta (non scrive nel Foglio)
function provaMail() {
  inviaConferma({
    nome: 'Mario', cognome: 'Rossi', instagram: 'padaniatuning', numero_veicoli: 2,
    email: Session.getActiveUser().getEmail(),
    veicoli: [{ marca: 'BMW', modello: 'M3 E46', targa: 'AB123CD' }, { marca: 'Honda', modello: 'Civic EK', targa: 'EF456GH' }]
  });
  Logger.log('Mail di prova inviata a ' + Session.getActiveUser().getEmail());
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


/* =========================================================
 *  API PER L'APP CHECK-IN (Padania-App)
 *  L'app scarica da qui la lista iscritti e sincronizza i
 *  check-in tra più telefoni. Ogni richiesta deve avere la
 *  chiave staff, salvata nelle Proprietà dello script
 *  (CHIAVE_STAFF) e quindi NON visibile nel codice su GitHub.
 *
 *  Per essere quasi istantanea l'app chiede ogni 2-3 secondi
 *  "è cambiato qualcosa?": lo script risponde subito guardando
 *  solo un numero di revisione in memoria, senza leggere il Foglio.
 * ========================================================= */
var NOME_FOGLIO_CHECKIN = 'Check-in';
var COLONNE_CHECKIN = ['Chiave', 'Nome', 'Stato', 'Primo ingresso', 'Fatto entrare da', 'Ultima uscita', 'Uscita registrata da',
  'Veicolo', 'Note', 'Storico', 'Ultima modifica da', 'Aggiornato', 'Dati (non modificare)'];
var COL_DATI = COLONNE_CHECKIN.length;   // ultima colonna

function api(d) {
  var chiave = PropertiesService.getScriptProperties().getProperty('CHIAVE_STAFF');
  if (!chiave) return json({ ok: false, error: 'Nello script manca la proprietà CHIAVE_STAFF' });
  if (d.key !== chiave) return json({ ok: false, auth: false, error: 'Chiave staff errata' });

  if (d.action === 'ping') return json({ ok: true, evento: EVENTO.nome });

  if (d.action === 'list') {
    var valori = getFoglio().getDataRange().getDisplayValues();
    return json({ ok: true, name: 'Iscrizioni ' + EVENTO.luogo, headers: valori[0], rows: valori.slice(1), at: Date.now() });
  }

  if (d.action === 'sync') {
    var ops = d.ops || [];
    // controllo veloce: niente da inviare e niente di nuovo -> risposta immediata
    if (!ops.length && d.rev && d.rev === leggiRevisione()) return json({ ok: true, same: true, rev: d.rev });

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sh = getFoglioCheckin();
      var dati = sh.getDataRange().getValues();
      var riga = {}, recs = {};
      for (var i = 1; i < dati.length; i++) {
        var k = String(dati[i][0] || '');
        if (!k) continue;
        riga[k] = i + 1;
        try { recs[k] = JSON.parse(dati[i][COL_DATI - 1]); } catch (err) {}
      }
      var cambiato = false;
      ops.forEach(function (op) {
        if (!op || !op.k || !op.r) return;
        var vecchio = recs[op.k];
        if (vecchio && (vecchio.u || 0) >= (op.r.u || 0)) return;   // vince la modifica più recente
        recs[op.k] = op.r;
        cambiato = true;
        var nuova = rigaCheckin(op.k, op.name, op.r);
        if (riga[op.k]) sh.getRange(riga[op.k], 1, 1, nuova.length).setValues([nuova]);
        else { sh.appendRow(nuova); riga[op.k] = sh.getLastRow(); }
      });
      var rev = cambiato ? scriviRevisione() : leggiRevisione();
      return json({ ok: true, recs: recs, rev: rev, at: Date.now() });
    } finally {
      lock.releaseLock();
    }
  }

  return json({ ok: false, error: 'Azione sconosciuta' });
}

/* numero di revisione: cambia a ogni modifica dei check-in */
function leggiRevisione() {
  var c = CacheService.getScriptCache().get('rev');
  if (c) return c;
  var p = PropertiesService.getScriptProperties().getProperty('REV_CHECKIN') || '0';
  CacheService.getScriptCache().put('rev', p, 21600);
  return p;
}
function scriviRevisione() {
  var r = String(Date.now());
  PropertiesService.getScriptProperties().setProperty('REV_CHECKIN', r);
  CacheService.getScriptCache().put('rev', r, 21600);
  return r;
}

function rigaCheckin(k, nome, r) {
  var log = r.l || [];
  var chi = function (e) { return e[2] || r.d || ''; };
  var primoIn = null, ultimoOut = null;
  log.forEach(function (e) {
    if (e[1] === 'i' && !primoIn) primoIn = e;
    if (e[1] === 'o') ultimoOut = e;
  });
  var ora = function (t) { return Utilities.formatDate(new Date(t), 'Europe/Rome', 'HH:mm'); };
  var storico = log.map(function (e) {
    return ora(e[0]) + ' ' + (e[1] === 'i' ? 'entrata' : e[1] === 'o' ? 'uscita' : 'annullato') + (chi(e) ? ' (' + chi(e) + ')' : '');
  }).join(' · ');
  var stato = !r.t ? 'Non entrato' : r.o ? 'Uscito' : 'Dentro';
  return [
    k, nome || '', stato,
    r.t ? new Date(r.t) : '', r.t && primoIn ? chi(primoIn) : '',
    r.o ? new Date(r.o) : '', r.o && ultimoOut ? chi(ultimoOut) : '',
    r.v || '', r.n || '', storico, r.d || '',
    new Date(r.u || Date.now()), JSON.stringify(r)
  ];
}

function getFoglioCheckin() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(NOME_FOGLIO_CHECKIN) || ss.insertSheet(NOME_FOGLIO_CHECKIN);
  if (sh.getLastRow() === 0) { intestaCheckin(sh); return sh; }

  // se la scheda è stata creata con la versione precedente (colonne diverse), la riscrive nel formato nuovo
  var intest = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  if (intest.join('|') !== COLONNE_CHECKIN.join('|')) {
    var colDati = intest.indexOf('Dati (non modificare)');
    var vecchie = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues() : [];
    var nuove = [];
    vecchie.forEach(function (v) {
      try { var r = JSON.parse(v[colDati]); nuove.push(rigaCheckin(String(v[0]), v[1], r)); } catch (err) {}
    });
    sh.clear();
    sh.showColumns(1, sh.getMaxColumns());
    intestaCheckin(sh);
    if (nuove.length) sh.getRange(2, 1, nuove.length, COLONNE_CHECKIN.length).setValues(nuove);
  }
  return sh;
}
function intestaCheckin(sh) {
  sh.getRange(1, 1, 1, COLONNE_CHECKIN.length).setValues([COLONNE_CHECKIN])
    .setFontWeight('bold').setBackground('#111111').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  sh.hideColumns(COL_DATI);
}

// Prova veloce dall'editor: controlla che la chiave staff sia impostata
function provaApp() {
  var chiave = PropertiesService.getScriptProperties().getProperty('CHIAVE_STAFF');
  Logger.log(chiave ? 'CHIAVE_STAFF impostata ✅' : 'Manca CHIAVE_STAFF ❌ (Impostazioni progetto → Proprietà script)');
  getFoglioCheckin();
  Logger.log('Iscritti nel foglio: ' + Math.max(0, getFoglio().getLastRow() - 1));
}
