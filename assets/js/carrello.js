/* =========================================================
   PADANIA TUNING — CARRELLO
   Il carrello resta salvato nel telefono del cliente (anche se
   chiude la pagina). Il pagamento avviene con Stripe, dentro il sito.
   ========================================================= */
(function () {
    var KEY = 'pt-carrello-v1';
    var CFG = window.PT_CONFIG || {};
    var listeners = [];

    function load() {
        try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
    }
    function save(items) {
        try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { /* modalità privata: resta in memoria */ }
    }

    var items = load();

    function notify() { save(items); listeners.forEach(function (fn) { fn(items); }); carrelloCambiato(); }

    function euro(n) { return '€' + Number(n).toFixed(2).replace('.', ','); }

    window.PTCart = {
        items: function () { return items.slice(); },
        count: function () { return items.reduce(function (s, i) { return s + i.qta; }, 0); },
        total: function () { return items.reduce(function (s, i) { return s + i.prezzo * i.qta; }, 0); },
        euro: euro,
        onChange: function (fn) { listeners.push(fn); fn(items); },

        add: function (p, taglia, max) {
            var found = items.filter(function (i) { return i.id === p.id && i.taglia === taglia; })[0];
            if (found) {
                if (found.qta >= Math.min(10, max)) return false;
                found.qta++;
            } else {
                items.push({ id: p.id, nome: p.nome, prezzo: p.prezzo, foto: p.foto, taglia: taglia, qta: 1 });
            }
            notify();
            return true;
        },
        setQty: function (idx, qta, max) {
            if (!items[idx]) return;
            if (qta <= 0) items.splice(idx, 1);
            else items[idx].qta = Math.min(qta, max || 10, 10);
            notify();
        },
        remove: function (idx) { items.splice(idx, 1); notify(); },
        clear: function () { items = []; notify(); },

        // Aggiorna prezzi e nomi con il catalogo appena caricato
        sync: function (catalogo) {
            items = items.filter(function (i) {
                var p = catalogo.filter(function (x) { return x.id === i.id; })[0];
                if (!p) return false;
                i.nome = p.nome; i.prezzo = p.prezzo; i.foto = p.foto;
                return true;
            });
            notify();
        },

        // Prepara il pagamento in anticipo (chiamata quando si apre il carrello):
        // così quando il cliente preme "paga" è già pronto.
        prepara: function () { preparaPagamento(); },

        // Crea il pagamento su Stripe.
        // Con CFG.STRIPE_PK il pagamento si apre dentro il sito (Stripe incorporato);
        // senza chiave, o se qualcosa non parte, si va alla pagina sicura di Stripe.
        checkout: function () {
            if (!scriptOk()) {
                return Promise.reject(new Error('I pagamenti online non sono ancora attivi. Scrivici su Instagram per ordinare!'));
            }
            if (!dentroSito()) return chiedi(false).then(paginaStripe);

            // Apro subito la schermata (con il caricamento) e intanto preparo tutto
            var schermata = apriSchermata();
            var sessione = sessionePronta();

            sessione.then(function (res) {
                if (!res.clientSecret) { chiudiPagamento(); return paginaStripe(res); }     // script Google non aggiornato
                return caricaStripe().then(function () { return montaStripe(schermata, res.clientSecret); })
                    .catch(function () {                                                   // Stripe incorporato non parte: pagina esterna
                        pronta = null;
                        if (pagamento !== schermata) return;                               // chiuso dal cliente
                        return chiedi(false).then(function (r) { chiudiPagamento(); return paginaStripe(r); });
                    });
            }).catch(function (err) {
                if (pagamento !== schermata) return;
                erroreSchermata(schermata, (err && err.message) || 'Pagamento non disponibile, riprova tra poco.');
            });

            return Promise.resolve();        // la schermata è aperta: il bottone del carrello torna normale
        }
    };

    /* =========================================================
       PAGAMENTO DENTRO IL SITO (Stripe Checkout incorporato)
       I dati della carta li scrive il cliente dentro il riquadro
       di Stripe: il sito non li vede e non li salva mai.
       ========================================================= */
    var stripeJs = null, pagamento = null, pronta = null, attesa = null;

    function scriptOk() { var u = CFG.SHOP_SCRIPT_URL; return !!u && u.indexOf('INCOLLA') !== 0; }
    function dentroSito() { return String(CFG.STRIPE_PK || '').indexOf('pk_') === 0; }
    function firmaCarrello() { return items.map(function (i) { return i.id + '|' + i.taglia + '|' + i.qta; }).join(','); }

    function chiedi(incorporato) {
        return fetch(CFG.SHOP_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                azione: 'checkout',
                incorporato: incorporato,
                carrello: items.map(function (i) { return { id: i.id, taglia: i.taglia, qta: i.qta }; })
            })
        })
        .then(function (r) { return r.json(); })
        .then(function (res) {
            if (!res.ok) throw new Error(res.error || 'Pagamento non disponibile, riprova tra poco.');
            return res;
        });
    }
    function paginaStripe(res) {
        if (!res.url) throw new Error('Pagamento non disponibile, riprova tra poco.');
        location.href = res.url;
        return new Promise(function () {});      // la pagina sta cambiando: resta in attesa
    }

    // Una richiesta di pagamento già pronta per questo carrello (vale 20 minuti)
    function sessionePronta() {
        var firma = firmaCarrello();
        if (pronta && pronta.firma === firma && Date.now() - pronta.t < 20 * 60000) return pronta.p;
        var mia = { firma: firma, t: Date.now(), p: null };
        mia.p = chiedi(true);
        mia.p.catch(function () { if (pronta === mia) pronta = null; });
        pronta = mia;
        return mia.p;
    }
    function preparaPagamento() {
        if (!scriptOk() || !dentroSito() || !items.length) return;
        caricaStripe().catch(function () {});
        sessionePronta().catch(function () {});
    }
    function carrelloCambiato() {
        pronta = null;
        clearTimeout(attesa);
        var w = document.getElementById('cartWrap');
        if (w && w.classList.contains('open')) attesa = setTimeout(preparaPagamento, 900);   // carrello aperto: riparto
    }

    function caricaStripe() {
        if (window.Stripe) return Promise.resolve();
        if (!stripeJs) {
            stripeJs = new Promise(function (ok, ko) {
                var s = document.createElement('script');
                s.src = 'https://js.stripe.com/v3/';
                s.onload = ok;
                s.onerror = function () { stripeJs = null; ko(new Error('Stripe non raggiungibile')); };
                document.head.appendChild(s);
            });
        }
        return stripeJs;
    }

    var ICO = {
        indietro: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
        lucchetto: '<svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
        fatto: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
        camion: '<svg viewBox="0 0 24 24"><path d="M3 6h11v9H3z"/><path d="M14 9h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg>',
        luogo: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
        carta: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10.5h18"/></svg>'
    };

    function stile() {
        if (document.getElementById('ptPayStyle')) return;
        var st = document.createElement('style');
        st.id = 'ptPayStyle';
        st.textContent = [
            '.pt-pay{position:fixed;inset:0;z-index:1300;display:flex;align-items:center;justify-content:center;background:rgba(4,4,6,.82);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);opacity:0;transition:opacity .22s}',
            '.pt-pay.open{opacity:1}',
            '.pt-pay svg{fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}',
            '.pt-pay-sheet{position:relative;display:flex;flex-direction:column;width:min(1080px,calc(100% - 40px));height:min(880px,calc(100% - 40px));background:linear-gradient(180deg,var(--panel-2,#1b181e),var(--panel,#141216) 220px);border:1px solid var(--pink-line,rgba(220,220,228,.3));border-radius:26px;overflow:hidden;box-shadow:0 50px 110px rgba(0,0,0,.85),0 0 0 1px rgba(0,0,0,.6);transform:translateY(28px) scale(.985);transition:transform .34s cubic-bezier(.2,.9,.3,1)}',
            '.pt-pay.open .pt-pay-sheet{transform:none}',
            '.pt-pay-sheet::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:var(--chrome-btn,linear-gradient(90deg,#fff,#b9b9c1,#fff));opacity:.9}',

            '.pt-pay-head{flex:0 0 auto;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;padding:16px 18px 12px}',
            '.pt-pay-back{justify-self:start;display:inline-flex;align-items:center;gap:6px;height:42px;padding:0 15px 0 10px;border-radius:100px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.04);color:var(--text,#fff);font-family:var(--body,Arial,sans-serif);font-size:15px;font-weight:600;cursor:pointer;transition:border-color .2s,background .2s}',
            '.pt-pay-back:hover{border-color:rgba(255,255,255,.45);background:rgba(255,255,255,.08)}',
            '.pt-pay-back svg{width:18px;height:18px}',
            '.pt-pay-brand{display:flex;align-items:center;gap:10px;font-family:var(--cond,Arial,sans-serif);font-style:italic;font-weight:900;font-size:24px;text-transform:uppercase;line-height:1;white-space:nowrap;color:var(--text,#fff)}',
            '.pt-pay-brand img{width:34px;height:34px;border-radius:50%;object-fit:cover;border:1px solid rgba(255,255,255,.2)}',
            '.pt-pay-lock{justify-self:end;display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 12px;border-radius:100px;font-family:var(--body,Arial,sans-serif);font-size:12.5px;font-weight:600;color:#bff0cf;background:rgba(53,224,111,.1);border:1px solid rgba(53,224,111,.28);white-space:nowrap}',
            '.pt-pay-lock svg{width:14px;height:14px}',

            '.pt-pay-steps{flex:0 0 auto;display:flex;align-items:center;justify-content:center;gap:10px;margin:0;padding:2px 18px 16px;list-style:none;font-family:var(--body,Arial,sans-serif);font-size:13px;font-weight:600;color:var(--muted,#9a94a0)}',
            '.pt-pay-steps li{display:flex;align-items:center;gap:7px;white-space:nowrap}',
            '.pt-pay-steps i{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;font-style:normal;font-size:12px;font-weight:800;border:1px solid rgba(255,255,255,.2)}',
            '.pt-pay-steps i svg{width:13px;height:13px;stroke-width:3}',
            '.pt-pay-steps .ok{color:var(--soft,#d6d0da)}',
            '.pt-pay-steps .ok i{background:rgba(53,224,111,.16);border-color:rgba(53,224,111,.45);color:#7df0a6}',
            '.pt-pay-steps .now{color:var(--text,#fff)}',
            '.pt-pay-steps .now i{background:var(--chrome-btn,#e6e6ea);border-color:transparent;color:var(--pay-ink,#0a0a0a)}',
            '.pt-pay-steps b{flex:0 0 28px;height:2px;border-radius:2px;background:rgba(255,255,255,.14)}',
            '.pt-pay-steps b.ok{background:rgba(53,224,111,.5)}',
            'html.natale .pt-pay{--pay-ink:#fff}',

            '.pt-pay-body{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:0 18px 18px}',
            '.pt-pay-card{background:#fff;border-radius:18px;min-height:100%;padding:10px 0;box-shadow:0 14px 40px rgba(0,0,0,.45);overflow:hidden}',

            '.pt-pay-load{padding:34px 26px 40px;font-family:var(--body,Arial,sans-serif)}',
            '.pt-pay-spin{width:46px;height:46px;margin:6px auto 16px;border-radius:50%;border:3px solid #e6e6ea;border-top-color:#111;animation:ptPaySpin .8s linear infinite}',
            '.pt-pay-load p{margin:0 0 4px;text-align:center;font-size:17px;font-weight:700;color:#141216}',
            '.pt-pay-load small{display:block;text-align:center;font-size:13.5px;color:#77777f;margin-bottom:28px}',
            '.pt-pay-sk{height:46px;border-radius:10px;margin:0 auto 12px;max-width:520px;background:linear-gradient(90deg,#f0f0f3 0%,#e2e2e7 50%,#f0f0f3 100%);background-size:200% 100%;animation:ptPayShim 1.2s linear infinite}',
            '.pt-pay-sk.s{height:16px;width:38%;margin-left:max(0px,calc(50% - 260px));margin-bottom:8px;margin-top:18px}',
            '.pt-pay-sk.b{height:52px;margin-top:22px;background:linear-gradient(90deg,#dcdce2 0%,#c9c9d1 50%,#dcdce2 100%);background-size:200% 100%}',
            '@keyframes ptPaySpin{to{transform:rotate(360deg)}}',
            '@keyframes ptPayShim{to{background-position:-200% 0}}',

            '.pt-pay-err{padding:46px 24px;text-align:center;font-family:var(--body,Arial,sans-serif)}',
            '.pt-pay-err b{display:block;font-size:19px;color:#141216;margin-bottom:8px}',
            '.pt-pay-err span{display:block;font-size:15px;line-height:1.5;color:#55555c;max-width:380px;margin:0 auto 22px}',
            '.pt-pay-err button{height:48px;padding:0 24px;border-radius:12px;border:0;background:#111;color:#fff;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer}',

            '.pt-pay-foot{flex:0 0 auto;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px 22px;margin:0;padding:12px 18px calc(14px + env(safe-area-inset-bottom));list-style:none;border-top:1px solid var(--line,rgba(255,255,255,.09));font-family:var(--body,Arial,sans-serif);font-size:12.5px;color:var(--muted,#9a94a0)}',
            '.pt-pay-foot li{display:flex;align-items:center;gap:7px;white-space:nowrap}',
            '.pt-pay-foot svg{width:15px;height:15px;color:var(--soft,#d6d0da)}',

            '@media (max-width:700px){',
                '.pt-pay-sheet{width:100%;height:100%;border-radius:0;border:0}',
                '.pt-pay-head{padding:calc(12px + env(safe-area-inset-top)) 12px 10px;gap:8px}',
                '.pt-pay-back{height:40px;padding:0 13px 0 8px;font-size:14.5px}',
                '.pt-pay-brand{font-size:21px}',
                '.pt-pay-brand img{width:30px;height:30px}',
                '.pt-pay-lock{width:34px;padding:0;justify-content:center}',
                '.pt-pay-lock span{display:none}',
                '.pt-pay-steps{gap:7px;padding:0 12px 12px;font-size:12.5px}',
                '.pt-pay-steps b{flex-basis:16px}',
                '.pt-pay-body{padding:0 8px 10px}',
                '.pt-pay-card{border-radius:16px;padding:6px 0}',
                '.pt-pay-foot{gap:6px 16px;padding-top:10px;font-size:12px}',
                '.pt-pay-foot .extra{display:none}',
            '}',
            '@media (prefers-reduced-motion:reduce){.pt-pay,.pt-pay-sheet{transition:none}.pt-pay-spin,.pt-pay-sk{animation:none}}'
        ].join('');
        document.head.appendChild(st);
    }

    function chiudiPagamento() {
        if (!pagamento) return;
        var p = pagamento; pagamento = null;
        try { if (p.stripe) p.stripe.destroy(); } catch (e) { /* già chiuso */ }
        document.removeEventListener('keydown', p.esc);
        document.documentElement.style.overflow = p.scroll;
        p.el.classList.remove('open');
        setTimeout(function () { if (p.el.parentNode) p.el.parentNode.removeChild(p.el); }, 260);
    }

    // Apre subito la schermata di pagamento con il caricamento
    function apriSchermata() {
        stile();
        chiudiPagamento();

        var S = CFG.SHOP || {};
        var piede =
            '<li>' + ICO.lucchetto + 'Dati della carta protetti da Stripe</li>' +
            '<li>' + ICO.carta + 'Carta, Apple Pay, Google Pay</li>' +
            (S.spedizione != null ? '<li class="extra">' + ICO.camion + 'Spedizione ' + euro(S.spedizione) + (S.spedizioneGratisDa ? ', gratis da ' + euro(S.spedizioneGratisDa) : '') + '</li>' : '') +
            (S.ritiroEvento ? '<li class="extra">' + ICO.luogo + 'Ritiro gratis agli eventi</li>' : '');

        var el = document.createElement('div');
        el.className = 'pt-pay';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-label', 'Pagamento');
        el.innerHTML =
            '<div class="pt-pay-sheet">' +
                '<div class="pt-pay-head">' +
                    '<button type="button" class="pt-pay-back" aria-label="Torna al carrello">' + ICO.indietro + 'Carrello</button>' +
                    '<div class="pt-pay-brand"><img src="assets/img/logo.jpg" alt=""><span>Checkout</span></div>' +
                    '<span class="pt-pay-lock">' + ICO.lucchetto + '<span>Pagamento sicuro</span></span>' +
                '</div>' +
                '<ol class="pt-pay-steps" aria-label="Passaggi">' +
                    '<li class="ok"><i>' + ICO.fatto + '</i>Carrello</li><b class="ok"></b>' +
                    '<li class="now" aria-current="step"><i>2</i>Pagamento</li><b></b>' +
                    '<li><i>3</i>Conferma</li>' +
                '</ol>' +
                '<div class="pt-pay-body"><div class="pt-pay-card">' +
                    '<div class="pt-pay-load" role="status">' +
                        '<div class="pt-pay-spin"></div>' +
                        '<p>Preparo il tuo ordine…</p><small>Ancora un attimo, sto aprendo il pagamento sicuro</small>' +
                        '<div class="pt-pay-sk s"></div><div class="pt-pay-sk"></div>' +
                        '<div class="pt-pay-sk s"></div><div class="pt-pay-sk"></div>' +
                        '<div class="pt-pay-sk b"></div>' +
                    '</div>' +
                    '<div class="pt-pay-mount"></div>' +
                '</div></div>' +
                '<ul class="pt-pay-foot">' + piede + '</ul>' +
            '</div>';
        document.body.appendChild(el);

        var mia = {
            el: el, stripe: null,
            scroll: document.documentElement.style.overflow,
            esc: function (e) { if (e.key === 'Escape') chiudiPagamento(); }
        };
        pagamento = mia;
        document.documentElement.style.overflow = 'hidden';
        document.addEventListener('keydown', mia.esc);
        el.querySelector('.pt-pay-back').addEventListener('click', chiudiPagamento);
        requestAnimationFrame(function () { el.classList.add('open'); });
        return mia;
    }

    // Mette il modulo di Stripe dentro la schermata
    function montaStripe(mia, clientSecret) {
        if (pagamento !== mia) return Promise.resolve();          // chiusa nel frattempo
        var stripe = window.Stripe(String(CFG.STRIPE_PK));
        var avvio = stripe.initEmbeddedCheckout
            ? stripe.initEmbeddedCheckout({ fetchClientSecret: function () { return Promise.resolve(clientSecret); } })
            : stripe.createEmbeddedCheckoutPage({ clientSecret: clientSecret });

        return Promise.resolve(avvio).then(function (co) {
            if (pagamento !== mia) { try { co.destroy(); } catch (e) {} return; }
            mia.stripe = co;
            co.mount(mia.el.querySelector('.pt-pay-mount'));
            // tolgo il caricamento quando il modulo di Stripe ha preso spazio (al massimo dopo 6 secondi)
            var load = mia.el.querySelector('.pt-pay-load'), mount = mia.el.querySelector('.pt-pay-mount'), giri = 0;
            (function controlla() {
                if (!load || !load.parentNode) return;
                if (mount.offsetHeight > 120 || ++giri > 60) { load.parentNode.removeChild(load); return; }
                setTimeout(controlla, 100);
            })();
        });
    }

    function erroreSchermata(mia, testo) {
        var card = mia.el.querySelector('.pt-pay-card');
        card.innerHTML = '<div class="pt-pay-err" role="alert"><b>Non riesco ad aprire il pagamento</b><span></span><button type="button">Torna al carrello</button></div>';
        card.querySelector('span').textContent = testo;
        card.querySelector('button').addEventListener('click', chiudiPagamento);
    }
})();
