/* =========================================================
   PADANIA TUNING — CARRELLO
   Il carrello resta salvato nel telefono del cliente (anche se
   chiude la pagina). Il pagamento avviene su Stripe.
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

        // Crea il pagamento su Stripe e porta il cliente alla pagina sicura
        checkout: function () {
            var url = CFG.SHOP_SCRIPT_URL;
            if (!url || url.indexOf('INCOLLA') === 0) {
                return Promise.reject(new Error('I pagamenti online non sono ancora attivi. Scrivici su Instagram per ordinare!'));
            }
            return fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    azione: 'checkout',
                    carrello: items.map(function (i) { return { id: i.id, taglia: i.taglia, qta: i.qta }; })
                })
            })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (!res.ok || !res.url) throw new Error(res.error || 'Pagamento non disponibile, riprova tra poco.');
                location.href = res.url;
            });
        }
    };
})();
