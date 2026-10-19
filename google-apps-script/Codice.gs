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
var LOGO_URL = 'https://alessandroradulescu03-pixel.github.io/PadaniaTuning/assets/img/logo.jpg';
var SITO_URL = 'https://alessandroradulescu03-pixel.github.io/PadaniaTuning/';
var INSTAGRAM_URL = 'https://www.instagram.com/padaniatuning/';

function inviaConferma(d) {
  var targa = (d.veicoli[0] && d.veicoli[0].targa) || '';
  var qr = 'https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=0&data=' + encodeURIComponent(targa);

  // Data per il riquadro rosa (es. "Domenica 7 Novembre 2027" -> 07 / NOV / 2027)
  var m = EVENTO.data.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  var gg = m ? ('0' + m[1]).slice(-2) : '';
  var mese = m ? m[2].slice(0, 3).toUpperCase() : '';
  var anno = m ? m[3] : '';
  var giorno = EVENTO.data.split(' ')[0];

  var auto = d.veicoli.map(function (v, i) {
    return '<tr><td style="padding:10px 0;border-bottom:1px solid #2a262d;font-size:14px;color:#9a94a0;width:90px">Veicolo ' + (i + 1) + '</td>' +
      '<td style="padding:10px 0;border-bottom:1px solid #2a262d;font-size:15px;color:#f4f2f5;font-weight:bold">' + esc(v.marca + ' ' + v.modello) +
      ' <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:4px;background:#f5f5f2;color:#111;font-size:12px;letter-spacing:1px;border-left:6px solid #003399">' + esc(v.targa) + '</span></td></tr>';
  }).join('');

  var p = 'margin:0 0 14px;font-size:15px;line-height:1.6;color:#d6d0da';
  var h = 'margin:0 0 12px;font-family:Arial Narrow,Arial,sans-serif;font-size:20px;font-style:italic;font-weight:900;color:#ffffff;text-transform:uppercase;letter-spacing:.5px';

  var html =
  '<div style="margin:0;padding:0;background:#0a0a0a">' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:24px 10px;font-family:Arial,Helvetica,sans-serif">' +
  '<tr><td align="center">' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#141216;border-radius:20px;overflow:hidden;border:1px solid #2a262d">' +

    // INTESTAZIONE
    '<tr><td style="padding:22px 26px 0">' +
      '<table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
        '<td><img src="' + LOGO_URL + '" width="44" height="44" alt="Padania Tuning" style="display:block;border-radius:50%;border:1px solid #333"></td>' +
        '<td style="padding-left:12px;font-size:13px;font-weight:bold;letter-spacing:2px;color:#ffffff">PADANIA TUNING</td>' +
      '</tr></table>' +
    '</td></tr>' +

    // TITOLO
    '<tr><td style="padding:26px 26px 8px">' +
      '<div style="display:inline-block;padding:5px 12px;border-radius:100px;background:#1f3a29;color:#35e06f;font-size:12px;font-weight:bold">&#10003; Candidatura ricevuta</div>' +
      '<h1 style="margin:16px 0 0;font-family:Arial Narrow,Arial,sans-serif;font-size:44px;line-height:1;font-style:italic;font-weight:900;color:#ffffff;text-transform:uppercase">Ciao ' + esc(d.nome) + ',<br><span style="color:#ff69b4">ci siamo!</span></h1>' +
      '<p style="' + p + ';margin-top:16px">Abbiamo ricevuto la tua candidatura per l\'evento Padania Tuning al <b style="color:#fff">' + EVENTO.luogo + '</b>. Lo staff ha i dati del tuo profilo e del tuo garage. &#127937;</p>' +
    '</td></tr>' +

    // BIGLIETTO EVENTO
    '<tr><td style="padding:10px 26px 6px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1b181e;border-radius:16px;border:1px dashed #3a3440">' +
      '<tr>' +
        '<td width="96" valign="middle" style="padding:16px 0 16px 16px">' +
          '<table role="presentation" cellpadding="0" cellspacing="0" width="80" style="background:#ff69b4;border-radius:12px"><tr><td align="center" style="padding:10px 0;font-family:Arial Narrow,Arial,sans-serif;color:#1a0010;line-height:1">' +
            '<div style="font-size:36px;font-weight:900">' + gg + '</div>' +
            '<div style="font-size:15px;font-weight:bold">' + mese + '</div>' +
            '<div style="font-size:12px;opacity:.75;margin-top:2px">' + anno + '</div>' +
          '</td></tr></table>' +
        '</td>' +
        '<td valign="middle" style="padding:16px">' +
          '<div style="font-size:20px;font-weight:bold;color:#ffffff">' + EVENTO.luogo + '</div>' +
          '<div style="font-size:13px;color:#9a94a0;margin-top:3px">' + EVENTO.indirizzo + '</div>' +
          '<div style="font-size:14px;color:#f4f2f5;font-weight:bold;margin-top:8px">' + giorno + ' &middot; raduno ' + EVENTO.orarioRaduno + '<br>serata al ' + EVENTO.luogo + ' ' + EVENTO.orarioSerata + '</div>' +
        '</td>' +
      '</tr></table>' +
    '</td></tr>' +

    // VANTAGGI
    '<tr><td style="padding:12px 26px 8px;font-size:14px;line-height:2;color:#ffd1e8">' +
      '&#127359;&#65039; +100 posti auto<br>' +
      '&#127379; Ingresso al raduno totalmente gratuito<br>' +
      '&#127903;&#65039; Con Padania Tuning ingresso omaggio anche in discoteca al ' + EVENTO.luogo +
    '</td></tr>' +

    // SEPARATORE
    '<tr><td style="padding:14px 26px"><div style="border-top:1px solid #2a262d"></div></td></tr>' +

    // SELEZIONE
    '<tr><td style="padding:0 26px">' +
      '<h2 style="' + h + '">Cosa succede ora</h2>' +
      '<p style="' + p + '">Questa mail conferma solo che la candidatura è arrivata: <b style="color:#fff">non è ancora una conferma di partecipazione</b>. Lo staff valuterà ogni auto candidata e ti scriverà l\'esito a questo indirizzo.</p>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 8px">' +
        '<tr><td valign="top" width="50%" style="padding:14px;background:#17241c;border-radius:12px;font-size:14px;line-height:1.5;color:#cfe9d8">' +
          '<b style="color:#35e06f">&#9989; Se vieni selezionato</b><br>Accedi all\'area espositiva e ricevi le indicazioni per ingresso e posizionamento.' +
        '</td><td width="10"></td>' +
        '<td valign="top" width="50%" style="padding:14px;background:#1b181e;border-radius:12px;font-size:14px;line-height:1.5;color:#d6d0da">' +
          '<b style="color:#fff">&#127937; Se non vieni selezionato</b><br>Puoi comunque venire come visitatore e vivere la serata con noi.' +
        '</td></tr>' +
      '</table>' +
    '</td></tr>' +

    // QR
    '<tr><td align="center" style="padding:24px 26px 6px">' +
      '<h2 style="' + h + ';text-align:center">Il tuo QR d\'ingresso</h2>' +
      '<table role="presentation" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px"><tr><td align="center" style="padding:16px">' +
        '<img src="' + qr + '" width="180" height="180" alt="QR Code ' + esc(targa) + '" style="display:block">' +
        '<div style="margin-top:12px;display:inline-block;padding:6px 14px;border:2px solid #222;border-left:14px solid #003399;border-right:14px solid #003399;border-radius:6px;font-family:Arial Narrow,Arial,sans-serif;font-size:22px;font-weight:bold;letter-spacing:3px;color:#111">' + esc(targa) + '</div>' +
      '</td></tr></table>' +
      '<p style="' + p + ';font-size:13px;color:#9a94a0;margin-top:12px;text-align:center">Valido per l\'area espositiva solo in caso di selezione. Tienilo a portata di mano.</p>' +
    '</td></tr>' +

    // RIEPILOGO
    '<tr><td style="padding:18px 26px 4px">' +
      '<h2 style="' + h + '">Riepilogo</h2>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
        '<tr><td style="padding:10px 0;border-bottom:1px solid #2a262d;font-size:14px;color:#9a94a0;width:90px">Pilota</td><td style="padding:10px 0;border-bottom:1px solid #2a262d;font-size:15px;color:#f4f2f5;font-weight:bold">' + esc(d.nome) + ' ' + esc(d.cognome) + '</td></tr>' +
        (d.instagram ? '<tr><td style="padding:10px 0;border-bottom:1px solid #2a262d;font-size:14px;color:#9a94a0">Instagram</td><td style="padding:10px 0;border-bottom:1px solid #2a262d;font-size:15px;color:#f4f2f5;font-weight:bold">@' + esc(d.instagram) + '</td></tr>' : '') +
        auto +
      '</table>' +
    '</td></tr>' +

    // CHIUSURA
    '<tr><td style="padding:22px 26px 6px">' +
      '<p style="' + p + '">Grazie per la passione che condividi con noi. In bocca al lupo per la selezione! &#127808;&#128293;</p>' +
      '<p style="' + p + ';margin:0">Team Padania Tuning &#127937;</p>' +
    '</td></tr>' +

    // BOTTONI
    '<tr><td style="padding:22px 26px 26px">' +
      '<a href="' + INSTAGRAM_URL + '" style="display:block;text-align:center;background:#ff69b4;color:#1a0010;text-decoration:none;font-family:Arial Narrow,Arial,sans-serif;font-size:18px;font-weight:900;font-style:italic;padding:15px;border-radius:12px">Seguici su Instagram</a>' +
      '<a href="' + SITO_URL + '" style="display:block;text-align:center;margin-top:10px;color:#f4f2f5;text-decoration:none;font-size:14px;font-weight:bold;padding:12px;border-radius:12px;border:1px solid #3a3440">Vai al sito</a>' +
    '</td></tr>' +

  '</table>' +

  // NOTE LEGALI
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td style="padding:18px 20px;font-size:11px;line-height:1.6;color:#6f6975;text-align:center">' +
    'Conferma automatica di ricezione della candidatura inviata tramite il sito Padania Tuning.<br>' +
    'Non costituisce conferma di selezione o partecipazione all\'evento.<br>' +
    'Se non hai compilato tu il modulo, ignora questo messaggio.' +
  '</td></tr></table>' +

  '</td></tr></table></div>';

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
