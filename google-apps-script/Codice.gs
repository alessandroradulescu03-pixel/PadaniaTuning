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
  nome: 'Padania Tuning al Qi Clubbing',
  luogo: 'Qi Clubbing',
  indirizzo: "Via dell'Industria, 83, 25030 Erbusco (BS)",
  data: 'Sabato 7 Novembre 2026',
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
      '<p class="dm-s" style="' + p + ';margin-top:14px">Abbiamo ricevuto la tua candidatura per l\'evento Padania Tuning al <b class="dm-t" style="color:' + T + '">' + EVENTO.luogo + '</b>. Lo staff ha i dati del tuo profilo e del tuo garage. &#127937;</p>' +
    '</td></tr>' +

    // EVENTO
    '<tr><td style="padding:6px 20px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="dm-l" style="' + box + '"><tr>' +
        '<td width="84" valign="middle" style="padding:14px 0 14px 14px">' +
          '<table role="presentation" cellpadding="0" cellspacing="0" width="70" class="dm-l" style="border:2px solid ' + T + ';border-radius:10px"><tr><td align="center" class="dm-t" style="padding:8px 0;' + F + 'color:' + T + ';line-height:1">' +
            '<div style="font-size:32px;font-weight:900">' + gg + '</div>' +
            '<div style="font-size:14px;font-weight:bold">' + mese + '</div>' +
            '<div class="dm-m" style="font-size:12px;color:' + M + ';margin-top:2px">' + anno + '</div>' +
          '</td></tr></table>' +
        '</td>' +
        '<td valign="middle" style="padding:14px">' +
          '<div class="dm-t" style="' + F + 'font-size:22px;font-weight:800;color:' + T + '">' + EVENTO.luogo + '</div>' +
          '<div class="dm-m" style="font-size:13px;color:' + M + ';margin-top:2px">' + EVENTO.indirizzo + '</div>' +
          '<div class="dm-t" style="font-size:14px;color:' + T + ';font-weight:bold;margin-top:6px">' + giorno + ' &middot; raduno ' + EVENTO.orarioRaduno + '<br>serata ' + EVENTO.orarioSerata + '</div>' +
        '</td>' +
      '</tr></table>' +
    '</td></tr>' +

    // VANTAGGI
    '<tr><td class="dm-s" style="padding:12px 20px 4px;font-size:14px;line-height:2;color:' + S + '">' +
      '&#127359;&#65039; +100 posti auto<br>' +
      '&#127379; Ingresso al raduno totalmente gratuito<br>' +
      '&#127903;&#65039; Con Padania Tuning ingresso omaggio anche in discoteca al ' + EVENTO.luogo +
    '</td></tr>' +

    '<tr><td style="padding:16px 20px"><div class="dm-l" style="border-top:1px solid ' + L + '"></div></td></tr>' +

    // SELEZIONE
    '<tr><td style="padding:0 20px">' +
      '<h2 class="dm-t" style="' + h + '">Cosa succede ora</h2>' +
      '<p class="dm-s" style="' + p + '">Questa mail conferma solo che la candidatura è arrivata: <b class="dm-t" style="color:' + T + '">non è ancora una conferma di partecipazione</b>. Lo staff valuterà ogni auto candidata e ti scriverà l\'esito a questo indirizzo.</p>' +
      '<p class="dm-s" style="' + p + '"><b class="dm-t" style="color:' + T + '">&#9989; Se vieni selezionato:</b> accedi all\'area espositiva e ricevi le indicazioni per ingresso e posizionamento.</p>' +
      '<p class="dm-s" style="' + p + '"><b class="dm-t" style="color:' + T + '">&#127937; Se non vieni selezionato:</b> puoi comunque venire come visitatore e vivere la serata con noi.</p>' +
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
      '<p class="dm-s" style="' + p + '">Grazie per la passione che condividi con noi. In bocca al lupo per la selezione! &#127808;&#128293;</p>' +
      '<p class="dm-t" style="' + p + ';color:' + T + '">Team Padania Tuning &#127937;</p>' +
    '</td></tr>' +
    '<tr><td style="padding:8px 20px 22px">' +
      '<a href="' + INSTAGRAM_URL + '" class="dm-btn" style="display:block;text-align:center;background:' + T + ';color:#ffffff;text-decoration:none;' + F + 'font-size:19px;font-weight:900;font-style:italic;padding:14px;border-radius:12px">Seguici su Instagram</a>' +
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
    subject: '🏁 Candidatura ricevuta — ' + EVENTO.luogo + ', ' + EVENTO.data,
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
