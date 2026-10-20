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
var GIORNI_PREPARAZIONE = 14;   // tempo per preparare l'ordine prima della spedizione (lo leggono mail e sito)
var EMAIL_CONTATTO    = 'padaniatuning@gmail.com';   // mostrata al cliente per domande e fatture

// Dati stampati sulla ricevuta PDF (lascia vuoto quello che non c'è)
var VENDITORE = {
  nome: 'Padania Tuning',
  indirizzo: '',        // es. 'Via Roma 1, 24030 Almenno (BG)'
  piva: '',             // es. 'P.IVA 01234567890'
  email: EMAIL_CONTATTO,
  instagram: '@padaniatuning'
};

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

// GET: ?azione=catalogo  ·  ?azione=conferma&session_id=cs_...  ·  ?azione=ricevuta&session_id=cs_...
function doGet(e) {
  try {
    var azione = (e && e.parameter && e.parameter.azione) || 'stato';
    if (azione === 'catalogo') return json({ ok: true, prodotti: leggiCatalogo() });
    if (azione === 'conferma') return json(confermaOrdine(e.parameter.session_id));
    if (azione === 'ricevuta') return json(ricevutaPdf(e.parameter.session_id));
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
        altreFoto: String(p.altre_foto || '').split(',').map(function (x) { return x.trim(); }).filter(String),
        dettagli: String(p.dettagli || '').split(/\n|\|/).map(function (x) { return x.trim(); }).filter(String),
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
  add('shipping_options[' + opz + '][shipping_rate_data][metadata][tipo]', 'casa');
  add('shipping_options[' + opz + '][shipping_rate_data][delivery_estimate][minimum][unit]', 'business_day');
  add('shipping_options[' + opz + '][shipping_rate_data][delivery_estimate][minimum][value]', Math.round(GIORNI_PREPARAZIONE * 5 / 7) + 2);
  add('shipping_options[' + opz + '][shipping_rate_data][delivery_estimate][maximum][unit]', 'business_day');
  add('shipping_options[' + opz + '][shipping_rate_data][delivery_estimate][maximum][value]', Math.round(GIORNI_PREPARAZIONE * 5 / 7) + 5);
  if (RITIRO_EVENTO) {
    opz++;
    add('shipping_options[' + opz + '][shipping_rate_data][type]', 'fixed_amount');
    add('shipping_options[' + opz + '][shipping_rate_data][display_name]', 'Ritiro gratis al prossimo evento Padania Tuning');
    add('shipping_options[' + opz + '][shipping_rate_data][fixed_amount][amount]', 0);
    add('shipping_options[' + opz + '][shipping_rate_data][fixed_amount][currency]', 'eur');
    add('shipping_options[' + opz + '][shipping_rate_data][metadata][tipo]', 'ritiro');
  }

  var res = stripe('post', '/v1/checkout/sessions', f.join('&'));
  return { ok: true, url: res.url };
}


// =========================================================
//  ORDINE PAGATO: registra, scala il magazzino, manda le mail
//  (chiamata dalla pagina ordine-ok.html e, per sicurezza,
//   anche ogni 10 minuti da sincronizzaOrdini)
// =========================================================
function leggiSessione(sessionId) {
  return stripe('get', '/v1/checkout/sessions/' + encodeURIComponent(sessionId) +
    '?expand[]=line_items&expand[]=payment_intent.latest_charge&expand[]=shipping_cost.shipping_rate', null);
}

// Tutti i dati dell'ordine (per foglio, mail, scontrino e PDF)
function datiOrdine(s) {
  var info = riassunto(s);
  var ch = (s.payment_intent && s.payment_intent.latest_charge) || {};
  var card = (ch.payment_method_details && ch.payment_method_details.card) || {};
  var wallet = card.wallet && card.wallet.type ? { apple_pay: 'Apple Pay', google_pay: 'Google Pay', link: 'Link' }[card.wallet.type] || '' : '';
  info.pagamento = (wallet ? wallet + ' · ' : '') + (card.brand ? card.brand.toUpperCase() + ' •••• ' + card.last4 : 'Carta');
  info.ricevuta = ch.receipt_url || '';
  info.subtotale = (s.amount_subtotal || 0) / 100;
  info.spedizione = (s.total_details && s.total_details.amount_shipping || 0) / 100;
  info.data = s.created * 1000;
  info.test = s.livemode === false;
  return info;
}

function confermaOrdine(sessionId) {
  if (!sessionId || String(sessionId).indexOf('cs_') !== 0) return { ok: false, error: 'Ordine non valido' };

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var s = leggiSessione(sessionId);
    if (s.payment_status !== 'paid') return { ok: false, error: 'Pagamento non completato' };

    var info = datiOrdine(s);
    var foglio = getOrdini();
    var gia = foglio.getRange(1, 2, Math.max(1, foglio.getLastRow()), 1).getValues()
      .some(function (r) { return r[0] === s.id; });

    if (!gia) {
      foglio.appendRow([
        new Date(s.created * 1000), s.id, info.numero, info.nome, info.email, info.telefono,
        info.articoliTesto, info.consegna, info.ritiro ? '— (ritiro all\'evento)' : info.indirizzo,
        info.totale, 'Da preparare'
      ]);
      scalaMagazzino(s.metadata && s.metadata.carrello);
      mailCliente(info);
      mailStaff(info);
    }
    return { ok: true, ordine: {
      numero: info.numero, nome: info.nome, email: info.email, telefono: info.telefono,
      articoli: info.articoli, consegna: info.consegna, indirizzo: info.ritiro ? '' : info.indirizzo,
      ritiro: info.ritiro, subtotale: info.subtotale, spedizione: info.spedizione,
      totale: info.totale, data: info.data, pagamento: info.pagamento,
      ricevuta: info.ricevuta, test: info.test, giorniPreparazione: GIORNI_PREPARAZIONE
    } };
  } finally {
    lock.releaseLock();
  }
}

// La ricevuta PDF di Padania, scaricabile dalla pagina "Ordine confermato"
function ricevutaPdf(sessionId) {
  if (!sessionId || String(sessionId).indexOf('cs_') !== 0) return { ok: false, error: 'Ordine non valido' };
  var s = leggiSessione(sessionId);
  if (s.payment_status !== 'paid') return { ok: false, error: 'Pagamento non completato' };
  var pdf = creaPdfRicevuta(datiOrdine(s));
  return { ok: true, nome: pdf.getName(), pdf: Utilities.base64Encode(pdf.getBytes()) };
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
  var catalogo = [];
  try { catalogo = leggiCatalogo(); } catch (err) { /* senza foto va bene lo stesso */ }
  var articoli = ((s.line_items && s.line_items.data) || []).map(function (li) {
    var parti = String(li.description).split(' — ');
    var p = catalogo.filter(function (x) { return x.nome === parti[0]; })[0];
    var foto = p && p.foto ? (p.foto.indexOf('http') === 0 ? p.foto : SITO_URL + p.foto) : '';
    return { nome: li.description, prodotto: parti[0], dettaglio: parti[1] || '', foto: foto,
             qta: li.quantity, prezzo: li.amount_total / 100 / (li.quantity || 1), totale: li.amount_total / 100 };
  });
  var spedCosto = (s.total_details && s.total_details.amount_shipping || 0) / 100;
  // Quale consegna ha scelto il cliente su Stripe
  var rate = (s.shipping_cost && s.shipping_cost.shipping_rate) || null;
  try {
    if (rate && typeof rate === 'string') rate = stripe('get', '/v1/shipping_rates/' + rate, null);
  } catch (err) { rate = null; }
  var nomeConsegna = rate && rate.display_name ? rate.display_name : (spedCosto > 0 ? 'Spedizione a casa' : 'Spedizione gratuita');
  var ritiro = !!(rate && ((rate.metadata && rate.metadata.tipo === 'ritiro') || /ritiro/i.test(rate.display_name || '')));
  var consegna = nomeConsegna + (spedCosto > 0 ? ' (' + euro(spedCosto) + ')' : '');

  return {
    id: s.id,
    numero: 'PT-' + s.id.slice(-6).toUpperCase(),
    nome: det.name || sped.name || '',
    email: det.email || '',
    telefono: det.phone || '',
    articoli: articoli,
    articoliTesto: articoli.map(function (x) { return x.qta + '× ' + x.nome; }).join('\n'),
    consegna: consegna,
    ritiro: ritiro,
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
  var T = '#111114', S = '#45454d', M = '#7c7c86', L = '#dedee4', G = '#1f8a4c';
  var F = "font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;";
  var H = F + 'font-size:22px;font-weight:900;font-style:italic;text-transform:uppercase;color:' + T + ';margin:0';
  var box = 'border:1px solid ' + L + ';border-radius:14px;padding:16px 16px';
  var oggi = new Date(o.data || Date.now());
  var entro = new Date(oggi.getTime() + GIORNI_PREPARAZIONE * 864e5);
  var settimane = GIORNI_PREPARAZIONE % 7 === 0 ? (GIORNI_PREPARAZIONE / 7) + (GIORNI_PREPARAZIONE === 7 ? ' settimana' : ' settimane') : GIORNI_PREPARAZIONE + ' giorni';
  function data(d) { return Utilities.formatDate(d, 'Europe/Rome', 'dd/MM/yyyy'); }
  function sezione(titolo, corpo) {
    return '<tr><td style="padding:10px 20px"><div class="dm-l" style="' + box + '">' +
      '<p class="dm-t" style="' + H + '">' + titolo + '</p>' + corpo + '</div></td></tr>';
  }

  // --- Tempi: 3 passaggi ---
  function step(fatto, titolo, testo, ultimo) {
    var pallino = fatto
      ? '<div style="width:22px;height:22px;border-radius:50%;background:' + G + ';color:#fff;font-size:13px;line-height:22px;text-align:center;font-weight:bold">&#10003;</div>'
      : '<div class="dm-l" style="width:18px;height:18px;border-radius:50%;border:2px solid ' + L + '"></div>';
    return '<tr><td valign="top" width="34" style="padding-top:2px">' + pallino +
      (ultimo ? '' : '<div class="dm-l" style="width:0;height:26px;margin:4px 0 0 10px;border-left:2px solid ' + L + '"></div>') + '</td>' +
      '<td valign="top" style="padding-bottom:' + (ultimo ? 0 : 10) + 'px"><div class="dm-t" style="font-size:15px;font-weight:bold;color:' + T + '">' + titolo + '</div>' +
      '<div class="dm-s" style="font-size:13px;line-height:1.5;color:' + S + '">' + testo + '</div></td></tr>';
  }
  var tempi =
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px">' +
      step(true, 'Ordine ricevuto', data(oggi) + ' · pagamento confermato') +
      step(false, 'In preparazione', 'Fino a ' + settimane + ': prepariamo e controlliamo ogni pezzo') +
      (o.ritiro
        ? step(false, 'Pronto per il ritiro', 'Lo trovi al prossimo evento Padania Tuning', true)
        : step(false, 'Spedito', 'Entro il ' + data(entro) + ', poi 2–4 giorni lavorativi per la consegna', true)) +
    '</table>' +
    (o.ritiro ? '' :
      '<div style="margin-top:14px;padding:12px 14px;border-radius:10px;border:1px dashed ' + G + ';font-size:14px;line-height:1.5;color:' + G + '">' +
      '&#128666; Spedizione prevista <b>entro il ' + data(entro) + '</b>. Ti avvisiamo quando parte.</div>');

  // --- Articoli con foto ---
  var articoli = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">' +
    o.articoli.map(function (x) {
      var img = x.foto
        ? '<img src="' + esc(x.foto) + '" width="64" height="64" alt="" style="display:block;width:64px;height:64px;object-fit:cover;border-radius:10px;border:1px solid ' + L + '">'
        : '<div style="width:64px;height:64px;border-radius:10px;background:#ececf0"></div>';
      var info = [x.dettaglio, 'Quantità ' + x.qta, x.qta > 1 ? euro(x.prezzo) + ' cad.' : ''].filter(String).join(' · ');
      return '<tr><td class="dm-l" width="76" valign="middle" style="padding:12px 0;border-bottom:1px solid ' + L + '">' + img + '</td>' +
        '<td class="dm-l" valign="middle" style="padding:12px 0;border-bottom:1px solid ' + L + '">' +
          '<div class="dm-t" style="font-size:15px;font-weight:bold;color:' + T + '">' + esc(x.prodotto || x.nome) + '</div>' +
          '<div class="dm-m" style="font-size:13px;color:' + M + ';margin-top:3px">' + esc(info) + '</div></td>' +
        '<td class="dm-t dm-l" align="right" valign="middle" style="padding:12px 0 12px 8px;border-bottom:1px solid ' + L + ';font-size:15px;font-weight:bold;color:' + T + ';white-space:nowrap">' + euro(x.totale) + '</td></tr>';
    }).join('') + '</table>';

  function riga(a, b) {
    return '<tr><td class="dm-s" style="padding:4px 0;font-size:14px;color:' + S + '">' + a + '</td>' +
      '<td class="dm-t" align="right" style="padding:4px 0;font-size:14px;color:' + T + '">' + b + '</td></tr>';
  }
  var totali = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">' +
    riga('Subtotale', euro(o.subtotale || o.totale)) +
    riga(o.ritiro ? 'Ritiro all\'evento' : 'Spedizione', o.spedizione ? euro(o.spedizione) : 'Gratis') +
    '<tr><td class="dm-t dm-l" style="padding:10px 0 0;border-top:1px solid ' + L + ';' + F + 'font-size:26px;font-weight:900;font-style:italic;color:' + T + '">TOTALE</td>' +
    '<td class="dm-t dm-l" align="right" style="padding:10px 0 0;border-top:1px solid ' + L + ';' + F + 'font-size:26px;font-weight:900;font-style:italic;color:' + T + '">' + euro(o.totale) + '</td></tr>' +
    '<tr><td class="dm-s" style="padding:12px 0 0;font-size:13px;color:' + S + '">Pagato con</td><td class="dm-t" align="right" style="padding:12px 0 0;font-size:13px;color:' + T + '">' + esc(o.pagamento || 'Carta') + '</td></tr>' +
    '</table>';

  // --- Consegna ---
  var consegna = o.ritiro
    ? '<p class="dm-s" style="margin:10px 0 0;font-size:14px;line-height:1.6;color:' + S + '"><b class="dm-t" style="color:' + T + '">Ritiro gratis al prossimo evento Padania Tuning.</b><br>Allo stand mostra questa mail o dicci il numero d\'ordine <b class="dm-t" style="color:' + T + '">' + o.numero + '</b>.</p>'
    : '<p class="dm-s" style="margin:10px 0 0;font-size:14px;line-height:1.6;color:' + S + '"><b class="dm-t" style="color:' + T + '">' + esc(o.nome) + '</b><br>' + esc(o.indirizzo) +
      (o.telefono ? '<br>Tel. ' + esc(o.telefono) : '') + '</p>';
  if (!o.ritiro) consegna += '<p class="dm-m" style="margin:10px 0 0;font-size:13px;color:' + M + '">Metodo: ' + esc(o.consegna) + '</p>';

  // --- Buono a sapere ---
  function punto(icona, testo) {
    return '<tr><td valign="top" width="28" style="padding:6px 0;font-size:16px">' + icona + '</td>' +
      '<td class="dm-s" style="padding:6px 0;font-size:14px;line-height:1.5;color:' + S + '">' + testo + '</td></tr>';
  }
  var aiuto = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">' +
    punto('&#128085;', '<b class="dm-t" style="color:' + T + '">Taglia sbagliata o qualche problema?</b> Rispondi a questa mail indicando il numero d\'ordine.') +
    punto('&#129534;', '<b class="dm-t" style="color:' + T + '">Ti serve la fattura?</b> Scrivici ragione sociale, P.IVA o codice fiscale, indirizzo e codice SDI/PEC.') +
    punto('&#128206;', 'In allegato trovi la <b class="dm-t" style="color:' + T + '">ricevuta PDF</b> del tuo ordine.') +
    punto('&#128274;', 'Pagamento gestito in sicurezza da Stripe: riceverai anche la loro ricevuta.') +
    '</table>';

  var bottoni =
    '<tr><td style="padding:14px 20px 6px">' +
      (o.ricevuta ? '<a href="' + esc(o.ricevuta) + '" class="dm-btn" style="display:block;text-align:center;background:' + T + ';color:#ffffff;text-decoration:none;' + F + 'font-size:19px;font-weight:900;font-style:italic;padding:14px;border-radius:12px;margin-bottom:10px">Ricevuta di pagamento Stripe</a>' : '') +
      '<a href="https://ig.me/m/padaniatuning" class="dm-t dm-l" style="display:block;text-align:center;border:1.5px solid ' + T + ';color:' + T + ';text-decoration:none;' + F + 'font-size:19px;font-weight:900;font-style:italic;padding:13px;border-radius:12px">Scrivici su Instagram</a>' +
    '</td></tr>';

  var html =
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>@media (prefers-color-scheme: dark){.dm-bg{background:#121214 !important}.dm-t,.dm-t b{color:#f2f2f4 !important}.dm-s{color:#c9c9d0 !important}.dm-m{color:#9a9aa3 !important}.dm-l{border-color:#2c2c31 !important}.dm-btn{background:#f2f2f4 !important;color:#111114 !important}}</style></head>' +
    '<body class="dm-bg" style="margin:0;background:#ffffff">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="dm-bg" style="background:#ffffff;font-family:Arial,Helvetica,sans-serif"><tr><td align="center" style="padding:10px 6px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">' +
      '<tr><td style="padding:18px 20px 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
        '<td><img src="' + SITO_URL + 'assets/img/logo.jpg" width="38" height="38" alt="" style="display:block;border-radius:50%"></td>' +
        '<td class="dm-t" style="padding-left:10px;' + F + 'font-size:20px;font-style:italic;font-weight:900;color:' + T + ';text-transform:uppercase">Padania Tuning Shop</td>' +
      '</tr></table></td></tr>' +
      (o.test ? '<tr><td style="padding:14px 20px 0"><div style="border:1.5px dashed #c0392b;color:#c0392b;border-radius:10px;padding:8px;text-align:center;font-size:12px;font-weight:bold">ORDINE DI PROVA · NESSUN ADDEBITO</div></td></tr>' : '') +
      '<tr><td style="padding:22px 20px 8px">' +
        '<div style="font-size:13px;font-weight:bold;color:' + G + '">&#10003; Pagamento ricevuto</div>' +
        '<h1 class="dm-t" style="margin:10px 0 0;' + F + 'font-size:42px;line-height:1;font-style:italic;font-weight:900;color:' + T + ';text-transform:uppercase">Grazie ' + esc(String(o.nome).split(' ')[0]) + '!</h1>' +
        '<p class="dm-s" style="margin:14px 0 0;font-size:15px;line-height:1.6;color:' + S + '">Abbiamo ricevuto il tuo ordine <b class="dm-t" style="color:' + T + '">' + o.numero + '</b> del ' + data(oggi) + '. Qui sotto trovi il riepilogo completo. &#127937;</p>' +
      '</td></tr>' +
      sezione('Quando arriva', tempi) +
      sezione('Cosa hai comprato', articoli + totali) +
      sezione(o.ritiro ? 'Ritiro' : 'Spedizione', consegna) +
      sezione('Buono a sapersi', aiuto) +
      bottoni +
      '<tr><td class="dm-m" style="padding:18px 20px 24px;font-size:11px;line-height:1.6;color:' + M + ';text-align:center">' +
        'Padania Tuning · <a href="' + SITO_URL + 'shop.html" class="dm-m" style="color:' + M + '">Shop</a> · <a href="https://www.instagram.com/padaniatuning/" class="dm-m" style="color:' + M + '">Instagram</a><br>' +
        'Hai ricevuto questa mail perché hai fatto un ordine sul nostro shop.</td></tr>' +
    '</table></td></tr></table></body></html>';

  var allegati = [];
  try { allegati.push(creaPdfRicevuta(o)); } catch (err) { console.error('PDF non creato', err); }

  MailApp.sendEmail({
    to: o.email,
    subject: '🏁 Ordine ' + o.numero + ' confermato — Padania Tuning',
    htmlBody: html,
    name: NOME_MITTENTE,
    replyTo: EMAIL_CONTATTO,
    attachments: allegati
  });
}

function mailStaff(o) {
  var righe = o.articoli.map(function (x) {
    return '<tr><td style="padding:6px 10px 6px 0;border-bottom:1px solid #eee">' + x.qta + '×</td>' +
      '<td style="padding:6px 10px 6px 0;border-bottom:1px solid #eee"><b>' + esc(x.prodotto || x.nome) + '</b>' + (x.dettaglio ? ' — ' + esc(x.dettaglio) : '') + '</td>' +
      '<td align="right" style="padding:6px 0;border-bottom:1px solid #eee">' + euro(x.totale) + '</td></tr>';
  }).join('');
  var entro = Utilities.formatDate(new Date((o.data || Date.now()) + GIORNI_PREPARAZIONE * 864e5), 'Europe/Rome', 'dd/MM/yyyy');
  var html =
    '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.55;max-width:560px">' +
    (o.test ? '<p style="color:#c0392b"><b>ORDINE DI PROVA (Stripe Sandbox)</b></p>' : '') +
    '<h2 style="margin:0 0 6px">Nuovo ordine ' + o.numero + ' — ' + euro(o.totale) + '</h2>' +
    '<p style="margin:0 0 14px;color:#555">' + (o.ritiro ? '📍 Ritiro al prossimo evento' : '📦 Da spedire entro il <b>' + entro + '</b>') + '</p>' +
    '<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">' + righe + '</table>' +
    '<p>Subtotale ' + euro(o.subtotale || o.totale) + ' · Spedizione ' + (o.spedizione ? euro(o.spedizione) : 'gratis') + ' · <b>Totale ' + euro(o.totale) + '</b><br>Pagato con ' + esc(o.pagamento || 'carta') + '</p>' +
    '<p><b>Cliente:</b> ' + esc(o.nome) + '<br><b>Email:</b> ' + esc(o.email) + '<br><b>Telefono:</b> ' + esc(o.telefono) + '</p>' +
    '<p><b>Consegna:</b> ' + esc(o.consegna) + (o.indirizzo && !o.ritiro ? '<br><b>Indirizzo:</b> ' + esc(o.indirizzo) : '') + '</p>' +
    '<p><a href="' + SpreadsheetApp.getActiveSpreadsheet().getUrl() + '">📊 Apri il foglio ordini</a>' + (o.ricevuta ? ' · <a href="' + o.ricevuta + '">🧾 Ricevuta Stripe</a>' : '') + '</p></div>';
  MailApp.sendEmail({ to: EMAIL_STAFF, subject: '🛒 Nuovo ordine ' + o.numero + ' (' + euro(o.totale) + ')', htmlBody: html, name: NOME_MITTENTE, replyTo: o.email || EMAIL_STAFF });
}


// =========================================================
//  RICEVUTA PDF (allegata alla mail e scaricabile dal sito)
// =========================================================
function logoBase64() {
  var cache = CacheService.getScriptCache();
  var c = cache.get('logo64');
  if (c) return c;
  try {
    var r = UrlFetchApp.fetch(SITO_URL + 'assets/img/logo.jpg', { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) return '';
    var b64 = Utilities.base64Encode(r.getContent());
    if (b64.length < 90000) cache.put('logo64', b64, 21600);
    return b64;
  } catch (err) { return ''; }
}

function htmlRicevuta(o) {
  var T = '#111114', S = '#4a4a52', M = '#8a8a93', L = '#e3e3e8';
  var data = Utilities.formatDate(new Date(o.data || Date.now()), 'Europe/Rome', 'dd/MM/yyyy HH:mm');
  var entro = Utilities.formatDate(new Date((o.data || Date.now()) + GIORNI_PREPARAZIONE * 864e5), 'Europe/Rome', 'dd/MM/yyyy');
  var logo = logoBase64();
  var th = 'padding:8px 6px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:' + M + ';border-bottom:2px solid ' + T + ';text-align:left';
  var td = 'padding:10px 6px;font-size:12px;color:' + T + ';border-bottom:1px solid ' + L;
  var venditore = [VENDITORE.indirizzo, VENDITORE.piva, VENDITORE.email, VENDITORE.instagram].filter(String).map(esc).join('<br>');

  var righe = o.articoli.map(function (x) {
    return '<tr>' +
      '<td style="' + td + '"><b>' + esc(x.prodotto || x.nome) + '</b></td>' +
      '<td style="' + td + '">' + esc(String(x.dettaglio || 'Taglia unica').replace(/^Taglia /, '')) + '</td>' +
      '<td style="' + td + ';text-align:center">' + x.qta + '</td>' +
      '<td style="' + td + ';text-align:right">' + euro(x.prezzo) + '</td>' +
      '<td style="' + td + ';text-align:right"><b>' + euro(x.totale) + '</b></td></tr>';
  }).join('');

  function tot(a, b, forte) {
    var st = forte ? 'font-size:16px;font-weight:bold;color:' + T + ';padding:10px 6px 4px;border-top:2px solid ' + T : 'font-size:12px;color:' + S + ';padding:4px 6px';
    return '<tr><td style="' + st + '">' + a + '</td><td style="' + st + ';text-align:right">' + b + '</td></tr>';
  }

  return '<html><head><meta charset="utf-8"></head><body style="margin:0;font-family:Arial,Helvetica,sans-serif;color:' + T + '">' +
    '<div style="padding:34px 40px">' +
    (o.test ? '<div style="border:1.5px dashed #c0392b;color:#c0392b;padding:6px;text-align:center;font-size:11px;font-weight:bold;margin-bottom:18px">ORDINE DI PROVA · NESSUN ADDEBITO REALE</div>' : '') +

    // Intestazione
    '<table width="100%" cellpadding="0" cellspacing="0"><tr>' +
      '<td valign="top"><table cellpadding="0" cellspacing="0"><tr>' +
        (logo ? '<td valign="middle" style="padding-right:12px"><img src="data:image/jpeg;base64,' + logo + '" width="54" height="54" style="border-radius:27px"></td>' : '') +
        '<td valign="middle"><div style="font-size:22px;font-weight:bold;font-style:italic;letter-spacing:0.5px">PADANIA TUNING</div>' +
        '<div style="font-size:10px;color:' + M + ';letter-spacing:2px;margin-top:2px">SHOP UFFICIALE</div></td>' +
      '</tr></table></td>' +
      '<td valign="top" align="right" style="font-size:10px;line-height:1.6;color:' + S + '"><b style="color:' + T + '">' + esc(VENDITORE.nome) + '</b><br>' + venditore + '</td>' +
    '</tr></table>' +

    // Titolo
    '<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:26px;border-top:3px solid ' + T + ';border-bottom:1px solid ' + L + '"><tr>' +
      '<td style="padding:14px 0;color:' + T + ';font-size:20px;font-weight:bold;font-style:italic;letter-spacing:1px">RICEVUTA D\'ORDINE</td>' +
      '<td align="right" style="padding:14px 0;color:' + S + ';font-size:11px;line-height:1.5">N. <b style="color:' + T + '">' + o.numero + '</b><br>' + data + '</td>' +
    '</tr></table>' +

    // Cliente e consegna
    '<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px"><tr>' +
      '<td valign="top" width="50%" style="padding-right:12px">' +
        '<div style="font-size:10px;letter-spacing:1px;color:' + M + ';margin-bottom:6px">CLIENTE</div>' +
        '<div style="font-size:12px;line-height:1.6"><b>' + esc(o.nome) + '</b><br>' + esc(o.email) + (o.telefono ? '<br>' + esc(o.telefono) : '') + '</div></td>' +
      '<td valign="top" width="50%">' +
        '<div style="font-size:10px;letter-spacing:1px;color:' + M + ';margin-bottom:6px">' + (o.ritiro ? 'RITIRO' : 'SPEDIZIONE') + '</div>' +
        '<div style="font-size:12px;line-height:1.6">' + (o.ritiro
          ? '<b>Ritiro gratis al prossimo evento Padania Tuning</b><br>Mostra questa ricevuta o il numero d\'ordine allo stand.'
          : '<b>' + esc(o.nome) + '</b><br>' + esc(o.indirizzo) + '<br><span style="color:' + S + '">Spedizione entro il ' + entro + '</span>') + '</div></td>' +
    '</tr></table>' +

    // Articoli
    '<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;border-collapse:collapse">' +
      '<tr><th style="' + th + '">Articolo</th><th style="' + th + '">Taglia</th><th style="' + th + ';text-align:center">Q.tà</th><th style="' + th + ';text-align:right">Prezzo</th><th style="' + th + ';text-align:right">Totale</th></tr>' +
      righe +
    '</table>' +

    // Totali
    '<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px"><tr><td width="52%"></td><td>' +
      '<table width="100%" cellpadding="0" cellspacing="0">' +
        tot('Subtotale', euro(o.subtotale || o.totale)) +
        tot(o.ritiro ? 'Ritiro all\'evento' : 'Spedizione', o.spedizione ? euro(o.spedizione) : 'Gratis') +
        tot('TOTALE', euro(o.totale), true) +
        tot('Pagato con', esc(o.pagamento || 'Carta')) +
      '</table></td></tr></table>' +

    '<table cellpadding="0" cellspacing="0" style="margin-top:14px"><tr><td style="border:2px solid #1f8a4c;color:#1f8a4c;font-weight:bold;font-size:12px;letter-spacing:2px;padding:6px 14px">PAGATO</td></tr></table>' +

    // Note
    '<div style="margin-top:30px;padding-top:14px;border-top:1px solid ' + L + ';font-size:10px;line-height:1.6;color:' + M + '">' +
      'Grazie per il tuo ordine! Per domande, cambi taglia o richiesta di fattura scrivi a ' + esc(VENDITORE.email) + ' indicando il numero d\'ordine ' + o.numero + '.<br>' +
      'Pagamento elaborato da Stripe. Documento di riepilogo dell\'ordine, non valido ai fini fiscali.' +
    '</div>' +
    '</div></body></html>';
}

function creaPdfRicevuta(o) {
  return Utilities.newBlob(htmlRicevuta(o), 'text/html', 'ricevuta.html')
    .getAs('application/pdf')
    .setName('Ricevuta-' + o.numero + '.pdf');
}

// Aggiunge al foglio Prodotti le colonne "dettagli" e "altre_foto" (se mancano)
// e riempie i dettagli dei prodotti di partenza. Si può rieseguire senza problemi.
function aggiungiDettagli() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_PRODOTTI);
  var testi = {
    maglietta: 'Cotone 100%, 180 g/m²|Grafica Padania Tuning stampata|Vestibilità regolare unisex|Lavaggio a 30° al rovescio',
    felpa: 'Felpa con cappuccio e tasca a marsupio|Interno felpato morbido|Logo Padania Tuning|Lavaggio a 30° al rovescio',
    cappellino: 'Visiera curva|Logo ricamato|Chiusura regolabile sul retro|Taglia unica'
  };
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).toLowerCase().trim(); });
  ['dettagli', 'altre_foto'].forEach(function (col) {
    if (head.indexOf(col) === -1) {
      sh.getRange(1, head.length + 1).setValue(col).setFontWeight('bold').setBackground('#111111').setFontColor('#ffffff');
      head.push(col);
    }
  });
  var cId = head.indexOf('id'), cD = head.indexOf('dettagli');
  var dati = sh.getDataRange().getValues();
  for (var r = 1; r < dati.length; r++) {
    var id = String(dati[r][cId]);
    if (testi[id] && !String(dati[r][cD] || '').trim()) sh.getRange(r + 1, cD + 1).setValue(testi[id]);
  }
  Logger.log('Colonne pronte ✅ — i dettagli si separano con |');
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
    p.appendRow(['id', 'nome', 'categoria', 'prezzo', 'descrizione', 'foto', 'attivo', 'dettagli', 'altre_foto']);
    p.appendRow(['maglietta', 'Maglietta Personalizzata', 'Magliette', 24.90, 'T-shirt in cotone 180 gr con grafica Padania Tuning.', 'assets/img/shop/maglietta.jpg', 'si']);
    p.appendRow(['felpa', 'Felpa Premium', 'Felpe', 49.90, 'Felpa calda e morbida, perfetta per i raduni serali.', 'assets/img/shop/felpa.jpg', 'si']);
    p.appendRow(['cappellino', 'Cappellino Baseball', 'Accessori', 19.90, 'Cappellino regolabile con logo ricamato.', 'assets/img/shop/cappellino.png', 'si']);
    p.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#111111').setFontColor('#ffffff');
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
  aggiungiDettagli();
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
