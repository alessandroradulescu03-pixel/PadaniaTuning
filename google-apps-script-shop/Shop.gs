/**
 * =========================================================
 *  PADANIA TUNING — SHOP
 *  - Catalogo prodotti e magazzino letti dal Foglio Google
 *  - Pagamento con Stripe Checkout (prezzi sempre ricontrollati qui,
 *    mai presi dal sito, così nessuno può cambiarli)
 *  - Ogni ordine pagato: riga in "Ordini", magazzino aggiornato,
 *    mail al cliente e notifica allo staff
 *  Istruzioni complete: ISTRUZIONI-SHOP.md
 * =========================================================
 */

// ---------- IMPOSTAZIONI ----------
var SITO_URL      = 'https://alessandroradulescu03-pixel.github.io/PadaniaTuning/';
var EMAIL_STAFF   = 'alessandro.radulescu03@gmail.com';   // dove arriva la notifica di ogni ordine
var NOME_MITTENTE = 'Padania Tuning Shop';

// Consegna: il cliente sceglie al pagamento
var SPEDIZIONE_EURO   = 7.00;   // spedizione in Italia
var SPEDIZIONE_GRATIS = 80.00;  // sopra questo totale la spedizione è gratis (metti 0 per disattivare)
var RITIRO_EVENTO     = true;   // true = c'è anche "Ritiro gratis al prossimo evento"
var PAESI_SPEDIZIONE  = ['IT', 'SM', 'VA', 'CH'];

// Nomi delle schede del Foglio
var TAB_PRODOTTI  = 'Prodotti';
var TAB_MAGAZZINO = 'Magazzino';
var TAB_ORDINI    = 'Ordini';

// La chiave segreta di Stripe NON va scritta qui: si salva una volta con
// la funzione salvaChiaveStripe() (vedi istruzioni).
function chiaveStripe() {
  var k = PropertiesService.getScriptProperties().getProperty('STRIPE_SECRET_KEY');
  if (!k) throw new Error('Chiave Stripe mancante: esegui salvaChiaveStripe()');
  return k;
}


// =========================================================
//  RICHIESTE DAL SITO
// =========================================================

// GET: ?azione=catalogo   oppure   ?azione=conferma&session_id=cs_...
function doGet(e) {
  try {
    var azione = (e && e.parameter && e.parameter.azione) || 'stato';
    if (azione === 'catalogo') return json({ ok: true, prodotti: leggiCatalogo() });
    if (azione === 'conferma') return json(confermaOrdine(e.parameter.session_id));
    return json({ ok: true, messaggio: 'Shop Padania Tuning attivo 🏁' });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: String(err.message || err) });
  }
}

// POST: { azione: 'checkout', carrello: [{ id, taglia, qta }] }
function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.azione === 'checkout') return json(creaCheckout(d.carrello || []));
    return json({ ok: false, error: 'Azione sconosciuta' });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: String(err.message || err) });
  }
}


// =========================================================
//  CATALOGO
// =========================================================
function leggiCatalogo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var prod = righe(ss.getSheetByName(TAB_PRODOTTI));
  var mag = righe(ss.getSheetByName(TAB_MAGAZZINO));

  return prod
    .filter(function (p) { return String(p.attivo).toLowerCase() !== 'no' && p.id; })
    .map(function (p) {
      var taglie = mag
        .filter(function (m) { return String(m.id) === String(p.id); })
        .map(function (m) { return { taglia: String(m.taglia), disponibili: Math.max(0, Number(m.disponibili) || 0) }; });
      return {
        id: String(p.id),
        nome: String(p.nome),
        categoria: String(p.categoria),
        prezzo: Number(p.prezzo),
        descrizione: String(p.descrizione || ''),
        foto: String(p.foto || ''),
        taglie: taglie
      };
    });
}


// =========================================================
//  PAGAMENTO: crea la pagina di pagamento Stripe
// =========================================================
function creaCheckout(carrello) {
  if (!carrello.length) return { ok: false, error: 'Il carrello è vuoto' };

  var catalogo = leggiCatalogo();
  var righeStripe = [];
  var totale = 0;
  var riepilogo = [];

  for (var i = 0; i < carrello.length; i++) {
    var c = carrello[i];
    var p = catalogo.filter(function (x) { return x.id === String(c.id); })[0];
    if (!p) return { ok: false, error: 'Prodotto non più disponibile' };
    var t = p.taglie.filter(function (x) { return x.taglia === String(c.taglia); })[0];
    var qta = Math.max(1, Math.min(10, parseInt(c.qta, 10) || 1));
    if (!t || t.disponibili < qta) {
      return { ok: false, error: p.nome + (c.taglia && c.taglia !== 'Unica' ? ' (' + c.taglia + ')' : '') + ': disponibili solo ' + (t ? t.disponibili : 0) };
    }
    totale += p.prezzo * qta;
    riepilogo.push(p.id + '|' + t.taglia + '|' + qta);
    righeStripe.push({
      nome: p.nome + (t.taglia !== 'Unica' ? ' — Taglia ' + t.taglia : ''),
      centesimi: Math.round(p.prezzo * 100),
      qta: qta,
      foto: p.foto ? (p.foto.indexOf('http') === 0 ? p.foto : SITO_URL + p.foto) : ''
    });
  }

  // Parametri Stripe (formato form-urlencoded con chiavi annidate)
  var f = [];
  function add(k, v) { f.push(encodeURIComponent(k) + '=' + encodeURIComponent(v)); }

  add('mode', 'payment');
  add('locale', 'it');
  add('success_url', SITO_URL + 'ordine-ok.html?session_id={CHECKOUT_SESSION_ID}');
  add('cancel_url', SITO_URL + 'shop.html?annullato=1');
  add('phone_number_collection[enabled]', 'true');
  add('billing_address_collection', 'auto');
  add('metadata[carrello]', riepilogo.join(','));
  add('payment_intent_data[description]', 'Ordine shop Padania Tuning');

  righeStripe.forEach(function (r, i) {
    add('line_items[' + i + '][quantity]', r.qta);
    add('line_items[' + i + '][price_data][currency]', 'eur');
    add('line_items[' + i + '][price_data][unit_amount]', r.centesimi);
    add('line_items[' + i + '][price_data][product_data][name]', r.nome);
    if (r.foto) add('line_items[' + i + '][price_data][product_data][images][0]', r.foto);
  });

  // Indirizzo di spedizione + opzioni di consegna
  PAESI_SPEDIZIONE.forEach(function (paese, i) { add('shipping_address_collection[allowed_countries][' + i + ']', paese); });
  var spedizione = (SPEDIZIONE_GRATIS > 0 && totale >= SPEDIZIONE_GRATIS) ? 0 : SPEDIZIONE_EURO;
  var opz = 0;
  add('shipping_options[' + opz + '][shipping_rate_data][type]', 'fixed_amount');
  add('shipping_options[' + opz + '][shipping_rate_data][display_name]', spedizione === 0 ? 'Spedizione gratuita' : 'Spedizione a casa');
  add('shipping_options[' + opz + '][shipping_rate_data][fixed_amount][amount]', Math.round(spedizione * 100));
  add('shipping_options[' + opz + '][shipping_rate_data][fixed_amount][currency]', 'eur');
  add('shipping_options[' + opz + '][shipping_rate_data][delivery_estimate][minimum][unit]', 'business_day');
  add('shipping_options[' + opz + '][shipping_rate_data][delivery_estimate][minimum][value]', 3);
  add('shipping_options[' + opz + '][shipping_rate_data][delivery_estimate][maximum][unit]', 'business_day');
  add('shipping_options[' + opz + '][shipping_rate_data][delivery_estimate][maximum][value]', 7);
  if (RITIRO_EVENTO) {
    opz++;
    add('shipping_options[' + opz + '][shipping_rate_data][type]', 'fixed_amount');
    add('shipping_options[' + opz + '][shipping_rate_data][display_name]', 'Ritiro gratis al prossimo evento Padania Tuning');
    add('shipping_options[' + opz + '][shipping_rate_data][fixed_amount][amount]', 0);
    add('shipping_options[' + opz + '][shipping_rate_data][fixed_amount][currency]', 'eur');
  }

  var res = stripe('post', '/v1/checkout/sessions', f.join('&'));
  return { ok: true, url: res.url };
}


// =========================================================
//  ORDINE PAGATO: registra, scala il magazzino, manda le mail
//  (chiamata dalla pagina ordine-ok.html e, per sicurezza,
//   anche ogni 10 minuti da sincronizzaOrdini)
// =========================================================
function confermaOrdine(sessionId) {
  if (!sessionId || String(sessionId).indexOf('cs_') !== 0) return { ok: false, error: 'Ordine non valido' };

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var s = stripe('get', '/v1/checkout/sessions/' + encodeURIComponent(sessionId) + '?expand[]=line_items&expand[]=payment_intent.latest_charge', null);
    if (s.payment_status !== 'paid') return { ok: false, error: 'Pagamento non completato' };

    var info = riassunto(s);
    var foglio = getOrdini();
    var gia = foglio.getRange(1, 2, Math.max(1, foglio.getLastRow()), 1).getValues()
      .some(function (r) { return r[0] === s.id; });

    if (!gia) {
      foglio.appendRow([
        new Date(s.created * 1000), s.id, info.numero, info.nome, info.email, info.telefono,
        info.articoliTesto, info.consegna, info.indirizzo,
        info.totale, 'Da preparare'
      ]);
      scalaMagazzino(s.metadata && s.metadata.carrello);
      mailCliente(info);
      mailStaff(info);
    }
    // Dati per lo scontrino della pagina "Ordine confermato"
    var ch = (s.payment_intent && s.payment_intent.latest_charge) || {};
    var card = (ch.payment_method_details && ch.payment_method_details.card) || {};
    var wallet = card.wallet && card.wallet.type ? { apple_pay: 'Apple Pay', google_pay: 'Google Pay', link: 'Link' }[card.wallet.type] || '' : '';
    return { ok: true, ordine: {
      numero: info.numero, nome: info.nome, email: info.email, telefono: info.telefono,
      articoli: info.articoli, consegna: info.consegna, indirizzo: info.indirizzo,
      subtotale: (s.amount_subtotal || 0) / 100,
      spedizione: (s.total_details && s.total_details.amount_shipping || 0) / 100,
      totale: info.totale,
      data: s.created * 1000,
      pagamento: (wallet ? wallet + ' · ' : '') + (card.brand ? card.brand.toUpperCase() + ' •••• ' + card.last4 : 'Carta'),
      ricevuta: ch.receipt_url || '',
      test: s.livemode === false
    } };
  } finally {
    lock.releaseLock();
  }
}

// Controlla gli ultimi pagamenti su Stripe e registra quelli mancanti
// (es. se il cliente ha chiuso la pagina prima di tornare sul sito)
function sincronizzaOrdini() {
  var lista = stripe('get', '/v1/checkout/sessions?limit=30&status=complete', null);
  (lista.data || []).forEach(function (s) {
    if (s.payment_status === 'paid') {
      try { confermaOrdine(s.id); } catch (err) { console.error(err); }
    }
  });
}

function riassunto(s) {
  var det = s.customer_details || {};
  var sped = (s.shipping_details || (s.collected_information && s.collected_information.shipping_details)) || {};
  var a = sped.address || {};
  var articoli = ((s.line_items && s.line_items.data) || []).map(function (li) {
    return { nome: li.description, qta: li.quantity, totale: li.amount_total / 100 };
  });
  var spedCosto = (s.total_details && s.total_details.amount_shipping || 0) / 100;
  var consegna = spedCosto > 0 ? 'Spedizione (' + euro(spedCosto) + ')' : 'Spedizione gratuita / ritiro';
  try {
    if (s.shipping_cost && s.shipping_cost.shipping_rate) {
      var rate = stripe('get', '/v1/shipping_rates/' + s.shipping_cost.shipping_rate, null);
      consegna = rate.display_name + (spedCosto > 0 ? ' (' + euro(spedCosto) + ')' : '');
    }
  } catch (err) { /* va bene il testo generico */ }

  return {
    id: s.id,
    numero: 'PT-' + s.id.slice(-6).toUpperCase(),
    nome: det.name || sped.name || '',
    email: det.email || '',
    telefono: det.phone || '',
    articoli: articoli,
    articoliTesto: articoli.map(function (x) { return x.qta + '× ' + x.nome; }).join('\n'),
    consegna: consegna,
    indirizzo: [a.line1, a.line2, (a.postal_code || '') + ' ' + (a.city || ''), a.state, a.country].filter(function (x) { return x && String(x).trim(); }).join(', '),
    totale: s.amount_total / 100
  };
}

function scalaMagazzino(carrello) {
  if (!carrello) return;
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_MAGAZZINO);
  var dati = sh.getDataRange().getValues();
  var head = dati[0].map(function (h) { return String(h).toLowerCase().trim(); });
  var cId = head.indexOf('id'), cT = head.indexOf('taglia'), cD = head.indexOf('disponibili');
  carrello.split(',').forEach(function (voce) {
    var p = voce.split('|');
    for (var r = 1; r < dati.length; r++) {
      if (String(dati[r][cId]) === p[0] && String(dati[r][cT]) === p[1]) {
        var nuovo = Math.max(0, (Number(dati[r][cD]) || 0) - (parseInt(p[2], 10) || 0));
        sh.getRange(r + 1, cD + 1).setValue(nuovo);
        dati[r][cD] = nuovo;
      }
    }
  });
}


// =========================================================
//  MAIL
// =========================================================
function mailCliente(o) {
  if (!o.email) return;
  var T = '#111114', S = '#45454d', M = '#7c7c86', L = '#dedee4';
  var F = "font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;";
  var td = 'padding:10px 0;border-bottom:1px solid ' + L + ';font-size:15px;';
  var righeHtml = o.articoli.map(function (x) {
    return '<tr><td class="dm-t dm-l" style="' + td + 'color:' + T + '">' + x.qta + '× ' + esc(x.nome) + '</td>' +
      '<td class="dm-t dm-l" align="right" style="' + td + 'color:' + T + ';white-space:nowrap">' + euro(x.totale) + '</td></tr>';
  }).join('');

  var html =
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>@media (prefers-color-scheme: dark){.dm-bg{background:#121214 !important}.dm-t,.dm-t b{color:#f2f2f4 !important}.dm-s{color:#c9c9d0 !important}.dm-m{color:#9a9aa3 !important}.dm-l{border-color:#2c2c31 !important}.dm-btn{background:#f2f2f4 !important;color:#111114 !important}}</style></head>' +
    '<body class="dm-bg" style="margin:0;background:#ffffff">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="dm-bg" style="background:#ffffff;font-family:Arial,Helvetica,sans-serif"><tr><td align="center" style="padding:10px 6px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">' +
      '<tr><td class="dm-t" style="padding:18px 20px 0;' + F + 'font-size:20px;font-style:italic;font-weight:900;color:' + T + ';text-transform:uppercase">Padania Tuning Shop</td></tr>' +
      '<tr><td style="padding:22px 20px 6px">' +
        '<div style="font-size:13px;font-weight:bold;color:#1f8a4c">&#10003; Pagamento ricevuto</div>' +
        '<h1 class="dm-t" style="margin:10px 0 0;' + F + 'font-size:40px;line-height:1;font-style:italic;font-weight:900;color:' + T + ';text-transform:uppercase">Grazie ' + esc(o.nome.split(' ')[0]) + '!</h1>' +
        '<p class="dm-s" style="margin:14px 0 0;font-size:15px;line-height:1.6;color:' + S + '">Il tuo ordine <b class="dm-t" style="color:' + T + '">' + o.numero + '</b> è confermato. Ti scriviamo appena è pronto. &#127937;</p>' +
      '</td></tr>' +
      '<tr><td style="padding:16px 20px">' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + righeHtml +
          '<tr><td class="dm-m" style="padding:10px 0;font-size:14px;color:' + M + '">Consegna: ' + esc(o.consegna) + '</td><td></td></tr>' +
          '<tr><td class="dm-t" style="padding:6px 0;' + F + 'font-size:24px;font-weight:900;font-style:italic;color:' + T + '">Totale</td>' +
          '<td class="dm-t" align="right" style="padding:6px 0;' + F + 'font-size:24px;font-weight:900;font-style:italic;color:' + T + '">' + euro(o.totale) + '</td></tr>' +
        '</table>' +
      '</td></tr>' +
      (o.indirizzo ? '<tr><td class="dm-s" style="padding:0 20px 10px;font-size:14px;line-height:1.5;color:' + S + '"><b class="dm-t" style="color:' + T + '">Indirizzo:</b> ' + esc(o.indirizzo) + '</td></tr>' : '') +
      '<tr><td style="padding:16px 20px 22px"><a href="https://ig.me/m/padaniatuning" class="dm-btn" style="display:block;text-align:center;background:' + T + ';color:#ffffff;text-decoration:none;' + F + 'font-size:19px;font-weight:900;font-style:italic;padding:14px;border-radius:12px">Domande? Scrivici su Instagram</a></td></tr>' +
      '<tr><td class="dm-m" style="padding:0 20px 20px;font-size:11px;line-height:1.6;color:' + M + ';text-align:center">Riceverai anche la ricevuta di pagamento da Stripe.</td></tr>' +
    '</table></td></tr></table></body></html>';

  MailApp.sendEmail({
    to: o.email,
    subject: '🏁 Ordine ' + o.numero + ' confermato — Padania Tuning',
    htmlBody: html,
    name: NOME_MITTENTE,
    replyTo: EMAIL_STAFF
  });
}

function mailStaff(o) {
  var html =
    '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.55">' +
    '<h2>Nuovo ordine ' + o.numero + ' — ' + euro(o.totale) + '</h2>' +
    '<p><b>Cliente:</b> ' + esc(o.nome) + '<br><b>Email:</b> ' + esc(o.email) + '<br><b>Telefono:</b> ' + esc(o.telefono) + '</p>' +
    '<p><b>Articoli:</b><br>' + esc(o.articoliTesto).replace(/\n/g, '<br>') + '</p>' +
    '<p><b>Consegna:</b> ' + esc(o.consegna) + (o.indirizzo ? '<br><b>Indirizzo:</b> ' + esc(o.indirizzo) : '') + '</p>' +
    '<p><a href="' + SpreadsheetApp.getActiveSpreadsheet().getUrl() + '">📊 Apri il foglio ordini</a></p></div>';
  MailApp.sendEmail({ to: EMAIL_STAFF, subject: '🛒 Nuovo ordine ' + o.numero + ' (' + euro(o.totale) + ')', htmlBody: html, name: NOME_MITTENTE, replyTo: o.email || EMAIL_STAFF });
}


// =========================================================
//  FUNZIONI DI SERVIZIO
// =========================================================
function stripe(metodo, percorso, corpo) {
  var opt = {
    method: metodo,
    headers: { Authorization: 'Bearer ' + chiaveStripe() },
    muteHttpExceptions: true
  };
  if (corpo) { opt.payload = corpo; opt.contentType = 'application/x-www-form-urlencoded'; }
  var r = UrlFetchApp.fetch('https://api.stripe.com' + percorso, opt);
  var j = JSON.parse(r.getContentText());
  if (r.getResponseCode() >= 300) throw new Error('Stripe: ' + (j.error && j.error.message || r.getResponseCode()));
  return j;
}

function righe(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getDataRange().getValues();
  var head = v[0].map(function (h) { return String(h).toLowerCase().trim(); });
  return v.slice(1).filter(function (r) { return r.join('') !== ''; }).map(function (r) {
    var o = {}; head.forEach(function (h, i) { o[h] = r[i]; }); return o;
  });
}

function getOrdini() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB_ORDINI) || ss.insertSheet(TAB_ORDINI);
  if (sh.getLastRow() === 0) {
    var col = ['Data', 'ID Stripe', 'N. ordine', 'Cliente', 'Email', 'Telefono', 'Articoli', 'Consegna', 'Indirizzo', 'Totale €', 'Stato'];
    sh.appendRow(col);
    sh.getRange(1, 1, 1, col.length).setFontWeight('bold').setBackground('#111111').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.setColumnWidth(7, 260);
    sh.setColumnWidth(9, 260);
  }
  return sh;
}

function euro(n) { return '€' + Number(n).toFixed(2).replace('.', ','); }

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}


// =========================================================
//  DA ESEGUIRE UNA VOLTA DALL'EDITOR (vedi istruzioni)
// =========================================================

// 1) Crea le schede Prodotti / Magazzino / Ordini con i prodotti attuali
function preparaFoglio() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss.getSheetByName(TAB_PRODOTTI)) {
    var p = ss.insertSheet(TAB_PRODOTTI);
    p.appendRow(['id', 'nome', 'categoria', 'prezzo', 'descrizione', 'foto', 'attivo']);
    p.appendRow(['maglietta', 'Maglietta Personalizzata', 'Magliette', 24.90, 'T-shirt in cotone 180 gr con grafica Padania Tuning.', 'assets/img/shop/maglietta.jpg', 'si']);
    p.appendRow(['felpa', 'Felpa Premium', 'Felpe', 49.90, 'Felpa calda e morbida, perfetta per i raduni serali.', 'assets/img/shop/felpa.jpg', 'si']);
    p.appendRow(['cappellino', 'Cappellino Baseball', 'Accessori', 19.90, 'Cappellino regolabile con logo ricamato.', 'assets/img/shop/cappellino.png', 'si']);
    p.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#111111').setFontColor('#ffffff');
    p.setFrozenRows(1);
    p.getRange('D2:D').setNumberFormat('0.00');
  }

  if (!ss.getSheetByName(TAB_MAGAZZINO)) {
    var m = ss.insertSheet(TAB_MAGAZZINO);
    m.appendRow(['id', 'taglia', 'disponibili']);
    ['S', 'M', 'L', 'XL'].forEach(function (t) { m.appendRow(['maglietta', t, 10]); });
    ['S', 'M', 'L', 'XL'].forEach(function (t) { m.appendRow(['felpa', t, 10]); });
    m.appendRow(['cappellino', 'Unica', 20]);
    m.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#111111').setFontColor('#ffffff');
    m.setFrozenRows(1);
  }

  getOrdini();
  var vuoto = ss.getSheetByName('Foglio1') || ss.getSheetByName('Sheet1');
  if (vuoto && vuoto.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(vuoto);
  Logger.log('Foglio pronto ✅');
}

// 2) Salva la chiave segreta di Stripe (sk_test_... per le prove, sk_live_... per vendere davvero)
function salvaChiaveStripe() {
  var CHIAVE = 'INCOLLA_QUI_LA_CHIAVE_SEGRETA';   // <-- incolla, esegui, poi CANCELLA la chiave da questa riga e salva
  if (CHIAVE.indexOf('sk_') !== 0) throw new Error('La chiave deve iniziare con sk_test_ oppure sk_live_');
  PropertiesService.getScriptProperties().setProperty('STRIPE_SECRET_KEY', CHIAVE);
  Logger.log('Chiave salvata (' + (CHIAVE.indexOf('sk_test_') === 0 ? 'MODALITÀ TEST' : 'MODALITÀ REALE') + '). Ora cancellala dalla riga sopra e salva.');
}

// 3) Attiva il controllo automatico degli ordini ogni 10 minuti
function attivaControlloOrdini() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sincronizzaOrdini') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sincronizzaOrdini').timeBased().everyMinutes(10).create();
  Logger.log('Controllo ordini attivo ogni 10 minuti ✅');
}
