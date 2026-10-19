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
  var targa = (d.veicoli[0] && d.veicoli[0].targa) || '';

  // Data per il riquadro argento (es. "Sabato 7 Novembre 2026" -> 07 / NOV / 2026)
  var m = EVENTO.data.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  var gg = m ? ('0' + m[1]).slice(-2) : '';
  var mese = m ? m[2].slice(0, 3).toUpperCase() : '';
  var anno = m ? m[3] : '';
  var giorno = EVENTO.data.split(' ')[0];

  /* La mail è chiara di base: nel tema scuro le app di posta la scuriscono
     da sole (Gmail) oppure usano gli stili "dark" qui sotto (Apple Mail, Outlook).
     Così segue sempre il tema del telefono. */
  var C = {
    bg: '#f1f1f4', card: '#ffffff', line: '#e5e5ea', text: '#111114', soft: '#4a4a52', muted: '#7a7a84',
    silver: '#e6e6eb', dark: '#111114'
  };
  var F = "font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;";
  var p = 'margin:0 0 14px;font-size:15px;line-height:1.6;color:' + C.soft;
  var h = 'margin:0 0 12px;' + F + 'font-size:22px;font-style:italic;font-weight:900;color:' + C.text + ';text-transform:uppercase';
  var td = 'padding:11px 0;border-bottom:1px solid ' + C.line + ';';

  var auto = d.veicoli.map(function (v, i) {
    return '<tr><td class="em-muted em-line" style="' + td + 'font-size:14px;color:' + C.muted + ';width:90px">Veicolo ' + (i + 1) + '</td>' +
      '<td class="em-text em-line" style="' + td + 'font-size:15px;color:' + C.text + ';font-weight:bold">' + esc(v.marca + ' ' + v.modello) +
      ' <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:4px;background:#ffffff;color:#111;font-size:12px;letter-spacing:1px;border:1px solid #222;border-left:6px solid #003399">' + esc(v.targa) + '</span></td></tr>';
  }).join('');

  var html =
  '<!DOCTYPE html><html><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">' +
  '<style>' +
    ':root{color-scheme:light dark;supported-color-schemes:light dark}' +
    '@media (prefers-color-scheme: dark){' +
      '.em-bg{background:#0a0a0a !important}' +
      '.em-card{background:#141216 !important;border-color:#2a262d !important}' +
      '.em-box{background:#1b181e !important;border-color:#2a262d !important}' +
      '.em-text,.em-text b{color:#f4f2f5 !important}' +
      '.em-soft{color:#d6d0da !important}' +
      '.em-muted{color:#9a94a0 !important}' +
      '.em-line{border-color:#2a262d !important}' +
      '.em-green{color:#35e06f !important}' +
      '.em-btn{background:#e6e6eb !important;color:#0a0a0a !important}' +
      '.em-btn2{color:#f4f2f5 !important;border-color:#3a3440 !important}' +
    '}' +
    '[data-ogsc] .em-text{color:#f4f2f5 !important}[data-ogsc] .em-soft{color:#d6d0da !important}' +
  '</style></head>' +
  '<body class="em-bg" style="margin:0;padding:0;background:' + C.bg + '">' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-bg" style="background:' + C.bg + ';padding:24px 10px;font-family:Arial,Helvetica,sans-serif">' +
  '<tr><td align="center">' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-card" style="max-width:560px;background:' + C.card + ';border-radius:20px;border:1px solid ' + C.line + '">' +

    // INTESTAZIONE
    '<tr><td style="padding:22px 26px 0">' +
      '<table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
        '<td><img src="' + LOGO_URL + '" width="44" height="44" alt="Padania Tuning" style="display:block;border-radius:50%"></td>' +
        '<td class="em-text" style="padding-left:12px;' + F + 'font-size:20px;font-style:italic;font-weight:900;color:' + C.text + ';text-transform:uppercase">Padania Tuning</td>' +
      '</tr></table>' +
    '</td></tr>' +

    // TITOLO
    '<tr><td style="padding:24px 26px 6px">' +
      '<div style="display:inline-block;padding:5px 12px;border-radius:100px;background:#e3f6ea;color:#127a3a;font-size:12px;font-weight:bold">&#10003; Candidatura ricevuta</div>' +
      '<h1 class="em-text" style="margin:16px 0 0;' + F + 'font-size:42px;line-height:1;font-style:italic;font-weight:900;color:' + C.text + ';text-transform:uppercase">Ciao ' + esc(d.nome) + ',<br>ci siamo!</h1>' +
      '<p class="em-soft" style="' + p + ';margin-top:16px">Abbiamo ricevuto la tua candidatura per l\'evento Padania Tuning al <b class="em-text" style="color:' + C.text + '">' + EVENTO.luogo + '</b>. Lo staff ha i dati del tuo profilo e del tuo garage. &#127937;</p>' +
    '</td></tr>' +

    // BIGLIETTO EVENTO
    '<tr><td style="padding:8px 26px 6px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-box" style="background:#f6f6f8;border-radius:16px;border:1px dashed #c9c9d1">' +
      '<tr>' +
        '<td width="96" valign="middle" style="padding:16px 0 16px 16px">' +
          '<table role="presentation" cellpadding="0" cellspacing="0" width="80" style="background:' + C.silver + ';background-image:linear-gradient(180deg,#ffffff 0%,#e6e6ea 45%,#b9b9c1 55%,#ececf0 100%);border-radius:12px;border:1px solid #c9c9d1"><tr><td align="center" style="padding:10px 0;' + F + 'color:#0a0a0a;line-height:1">' +
            '<div style="font-size:36px;font-weight:900;color:#0a0a0a">' + gg + '</div>' +
            '<div style="font-size:15px;font-weight:bold;color:#0a0a0a">' + mese + '</div>' +
            '<div style="font-size:12px;color:#44444c;margin-top:2px">' + anno + '</div>' +
          '</td></tr></table>' +
        '</td>' +
        '<td valign="middle" style="padding:16px">' +
          '<div class="em-text" style="' + F + 'font-size:22px;font-weight:800;color:' + C.text + '">' + EVENTO.luogo + '</div>' +
          '<div class="em-muted" style="font-size:13px;color:' + C.muted + ';margin-top:3px">' + EVENTO.indirizzo + '</div>' +
          '<div class="em-text" style="font-size:14px;color:' + C.text + ';font-weight:bold;margin-top:8px">' + giorno + ' &middot; raduno ' + EVENTO.orarioRaduno + '<br>serata al ' + EVENTO.luogo + ' ' + EVENTO.orarioSerata + '</div>' +
        '</td>' +
      '</tr></table>' +
    '</td></tr>' +

    // VANTAGGI
    '<tr><td class="em-soft" style="padding:12px 26px 6px;font-size:14px;line-height:2;color:' + C.soft + '">' +
      '&#127359;&#65039; +100 posti auto<br>' +
      '&#127379; Ingresso al raduno totalmente gratuito<br>' +
      '&#127903;&#65039; Con Padania Tuning ingresso omaggio anche in discoteca al ' + EVENTO.luogo +
    '</td></tr>' +

    '<tr><td style="padding:14px 26px"><div class="em-line" style="border-top:1px solid ' + C.line + '"></div></td></tr>' +

    // SELEZIONE
    '<tr><td style="padding:0 26px">' +
      '<h2 class="em-text" style="' + h + '">Cosa succede ora</h2>' +
      '<p class="em-soft" style="' + p + '">Questa mail conferma solo che la candidatura è arrivata: <b class="em-text" style="color:' + C.text + '">non è ancora una conferma di partecipazione</b>. Lo staff valuterà ogni auto candidata e ti scriverà l\'esito a questo indirizzo.</p>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 8px"><tr>' +
        '<td valign="top" width="50%" class="em-box" style="padding:14px;background:#eef8f1;border-radius:12px;border:1px solid #d3eedb;font-size:14px;line-height:1.5;color:' + C.soft + '">' +
          '<b class="em-green" style="color:#127a3a">&#9989; Se vieni selezionato</b><br><span class="em-soft">Accedi all\'area espositiva e ricevi le indicazioni per ingresso e posizionamento.</span>' +
        '</td><td width="10"></td>' +
        '<td valign="top" width="50%" class="em-box" style="padding:14px;background:#f6f6f8;border-radius:12px;border:1px solid ' + C.line + ';font-size:14px;line-height:1.5;color:' + C.soft + '">' +
          '<b class="em-text" style="color:' + C.text + '">&#127937; Se non vieni selezionato</b><br><span class="em-soft">Puoi comunque venire come visitatore e vivere la serata con noi.</span>' +
        '</td>' +
      '</tr></table>' +
    '</td></tr>' +

    // QR: uno per ogni auto candidata (ogni QR contiene la targa di quell'auto)
    '<tr><td align="center" style="padding:24px 26px 6px">' +
      '<h2 class="em-text" style="' + h + ';text-align:center">' + (d.veicoli.length > 1 ? 'I tuoi QR d\'ingresso' : 'Il tuo QR d\'ingresso') + '</h2>' +
      (d.veicoli.length > 1 ? '<p class="em-soft" style="' + p + ';text-align:center;margin-top:-4px">Un QR per ogni auto: all\'ingresso mostra quello dell\'auto con cui stai entrando.</p>' : '') +
      d.veicoli.map(function (v, i) {
        var qrAuto = 'https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=0&data=' + encodeURIComponent(v.targa || '');
        return '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 14px;background:#ffffff;border-radius:16px;border:1px solid #d9d9df"><tr><td align="center" style="padding:16px">' +
          '<img src="' + qrAuto + '" width="180" height="180" alt="QR Code veicolo ' + (i + 1) + '" style="display:block">' +
          (d.veicoli.length > 1 ? '<div style="margin-top:10px;' + F + 'font-size:18px;font-weight:800;font-style:italic;color:#111">Veicolo ' + (i + 1) + ' &middot; ' + esc(v.marca + ' ' + v.modello) + '</div>' : '') +
        '</td></tr></table>';
      }).join('') +
      '<p class="em-muted" style="' + p + ';font-size:13px;color:' + C.muted + ';margin-top:2px;text-align:center">Valido per l\'area espositiva solo in caso di selezione. Tienilo a portata di mano.</p>' +
    '</td></tr>' +

    // RIEPILOGO
    '<tr><td style="padding:18px 26px 4px">' +
      '<h2 class="em-text" style="' + h + '">Riepilogo</h2>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
        '<tr><td class="em-muted em-line" style="' + td + 'font-size:14px;color:' + C.muted + ';width:90px">Pilota</td><td class="em-text em-line" style="' + td + 'font-size:15px;color:' + C.text + ';font-weight:bold">' + esc(d.nome) + ' ' + esc(d.cognome) + '</td></tr>' +
        (d.instagram ? '<tr><td class="em-muted em-line" style="' + td + 'font-size:14px;color:' + C.muted + '">Instagram</td><td class="em-text em-line" style="' + td + 'font-size:15px;color:' + C.text + ';font-weight:bold">@' + esc(d.instagram) + '</td></tr>' : '') +
        auto +
      '</table>' +
    '</td></tr>' +

    // CHIUSURA
    '<tr><td style="padding:22px 26px 6px">' +
      '<p class="em-soft" style="' + p + '">Grazie per la passione che condividi con noi. In bocca al lupo per la selezione! &#127808;&#128293;</p>' +
      '<p class="em-text" style="' + p + ';margin:0;color:' + C.text + '">Team Padania Tuning &#127937;</p>' +
    '</td></tr>' +

    // BOTTONI
    '<tr><td style="padding:22px 26px 26px">' +
      '<a href="' + INSTAGRAM_URL + '" class="em-btn" style="display:block;text-align:center;background:' + C.dark + ';color:#ffffff;text-decoration:none;' + F + 'font-size:19px;font-weight:900;font-style:italic;padding:15px;border-radius:12px">Seguici su Instagram</a>' +
      '<a href="' + SITO_URL + '" class="em-btn2" style="display:block;text-align:center;margin-top:10px;color:' + C.text + ';text-decoration:none;font-size:14px;font-weight:bold;padding:12px;border-radius:12px;border:1px solid #cfcfd6">Vai al sito</a>' +
    '</td></tr>' +

  '</table>' +

  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td class="em-muted" style="padding:18px 20px;font-size:11px;line-height:1.6;color:' + C.muted + ';text-align:center">' +
    'Conferma automatica di ricezione della candidatura inviata tramite il sito Padania Tuning.<br>' +
    'Non costituisce conferma di selezione o partecipazione all\'evento.<br>' +
    'Se non hai compilato tu il modulo, ignora questo messaggio.' +
  '</td></tr></table>' +

  '</td></tr></table></body></html>';

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
