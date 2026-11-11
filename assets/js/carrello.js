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

    function notify() { save(items); listeners.forEach(function (fn) { fn(items); }); }

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

        // Crea il pagamento su Stripe.
        // Con CFG.STRIPE_PK il pagamento si apre dentro il sito (Stripe incorporato);
        // senza chiave, o se qualcosa non parte, si va alla pagina sicura di Stripe.
        checkout: function () {
            var url = CFG.SHOP_SCRIPT_URL;
            if (!url || url.indexOf('INCOLLA') === 0) {
                return Promise.reject(new Error('I pagamenti online non sono ancora attivi. Scrivici su Instagram per ordinare!'));
            }
            var pk = String(CFG.STRIPE_PK || '');
            var dentro = pk.indexOf('pk_') === 0;

            function chiedi(incorporato) {
                return fetch(url, {
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

            if (!dentro) return chiedi(false).then(paginaStripe);

            return chiedi(true).then(function (res) {
                if (!res.clientSecret) return paginaStripe(res);       // script Google non ancora aggiornato
                return apriPagamento(pk, res.clientSecret).catch(function () {
                    return chiedi(false).then(paginaStripe);           // Stripe incorporato non parte: pagina esterna
                });
            });
        }
    };

    /* =========================================================
       PAGAMENTO DENTRO IL SITO (Stripe Checkout incorporato)
       I dati della carta li scrive il cliente dentro il riquadro
       di Stripe: il sito non li vede e non li salva mai.
       ========================================================= */
    var stripeJs = null, pagamento = null;

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

    function stile() {
        if (document.getElementById('ptPayStyle')) return;
        var st = document.createElement('style');
        st.id = 'ptPayStyle';
        st.textContent =
            '.pt-pay{position:fixed;inset:0;z-index:1300;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.78);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);opacity:0;transition:opacity .25s}' +
            '.pt-pay.open{opacity:1}' +
            '.pt-pay-sheet{display:flex;flex-direction:column;width:min(1040px,calc(100% - 32px));height:min(860px,calc(100% - 32px));background:var(--panel,#141216);border:1px solid var(--line,rgba(255,255,255,.1));border-radius:22px;overflow:hidden;box-shadow:0 40px 90px rgba(0,0,0,.8);transform:translateY(24px);transition:transform .32s cubic-bezier(.2,.9,.3,1)}' +
            '.pt-pay.open .pt-pay-sheet{transform:none}' +
            '.pt-pay-head{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px 12px 12px;border-bottom:1px solid var(--line,rgba(255,255,255,.1))}' +
            '.pt-pay-back{display:inline-flex;align-items:center;gap:6px;height:42px;padding:0 14px 0 10px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:none;color:var(--text,#fff);font-family:var(--body,Arial,sans-serif);font-size:15px;font-weight:600;cursor:pointer}' +
            '.pt-pay-back:hover{border-color:rgba(255,255,255,.45)}' +
            '.pt-pay-title{font-family:var(--cond,Arial,sans-serif);font-style:italic;font-weight:900;font-size:22px;text-transform:uppercase;line-height:1;white-space:nowrap}' +
            '.pt-pay-lock{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted,#9a94a0);white-space:nowrap}' +
            '.pt-pay-lock svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2.2}' +
            '.pt-pay-body{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;background:#fff;padding:14px 0 calc(14px + env(safe-area-inset-bottom))}' +
            '.pt-pay-load{padding:70px 20px;text-align:center;color:#55555c;font-family:var(--body,Arial,sans-serif);font-size:15px}' +
            '@media (max-width:700px){' +
                '.pt-pay-sheet{width:100%;height:100%;border-radius:0;border:0}' +
                '.pt-pay-head{padding-top:calc(10px + env(safe-area-inset-top))}' +
                '.pt-pay-lock span{display:none}' +
            '}';
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

    function apriPagamento(pk, clientSecret) {
        return caricaStripe().then(function () {
            stile();
            chiudiPagamento();

            var el = document.createElement('div');
            el.className = 'pt-pay';
            el.setAttribute('role', 'dialog');
            el.setAttribute('aria-modal', 'true');
            el.setAttribute('aria-label', 'Pagamento');
            el.innerHTML =
                '<div class="pt-pay-sheet">' +
                    '<div class="pt-pay-head">' +
                        '<button type="button" class="pt-pay-back" aria-label="Torna al carrello">' +
                            '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>Carrello' +
                        '</button>' +
                        '<span class="pt-pay-title">Pagamento</span>' +
                        '<span class="pt-pay-lock"><svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg><span>Protetto da Stripe</span></span>' +
                    '</div>' +
                    '<div class="pt-pay-body"><div class="pt-pay-load">Carico il pagamento sicuro…</div><div class="pt-pay-mount"></div></div>' +
                '</div>';
            document.body.appendChild(el);

            pagamento = {
                el: el, stripe: null,
                scroll: document.documentElement.style.overflow,
                esc: function (e) { if (e.key === 'Escape') chiudiPagamento(); }
            };
            var mio = pagamento;
            document.documentElement.style.overflow = 'hidden';
            document.addEventListener('keydown', mio.esc);
            el.querySelector('.pt-pay-back').addEventListener('click', chiudiPagamento);
            requestAnimationFrame(function () { el.classList.add('open'); });

            var stripe = window.Stripe(pk);
            var avvio = stripe.initEmbeddedCheckout
                ? stripe.initEmbeddedCheckout({ fetchClientSecret: function () { return Promise.resolve(clientSecret); } })
                : stripe.createEmbeddedCheckoutPage({ clientSecret: clientSecret });

            return Promise.resolve(avvio).then(function (co) {
                if (pagamento !== mio) { try { co.destroy(); } catch (e) {} return; }   // chiuso nel frattempo
                mio.stripe = co;
                var load = el.querySelector('.pt-pay-load');
                if (load) load.parentNode.removeChild(load);
                co.mount(el.querySelector('.pt-pay-mount'));
            }).catch(function (err) {
                chiudiPagamento();
                throw err;
            });
        });
    }
})();
