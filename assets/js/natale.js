/* =========================================================
   PADANIA TUNING — CHRISTMAS EDITION 🎄
   Neve, luminarie, cappello sul logo, striscia in alto e
   macchinina con l'albero nel footer.
   Viene caricato da site.js solo quando il tema è acceso.
   ========================================================= */
(function () {
    if (window.__ptNatale) return;
    window.__ptNatale = true;

    var page = location.pathname.split('/').pop() || 'index.html';
    var nav = document.querySelector('.pt-nav');
    var calmo = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- STRISCIA IN ALTO ---------- */
    function messaggio() {
        var oggi = new Date();
        var anno = oggi.getFullYear();
        var natale = new Date(anno, 11, 25);
        var giorni = Math.ceil((natale - new Date(anno, oggi.getMonth(), oggi.getDate())) / 864e5);
        if (oggi.getMonth() === 0) return '🎆 Buon ' + anno + ' da tutto il team Padania Tuning';
        if (giorni < 0) return '🎄 Buone feste e buon ' + (anno + 1) + ' da Padania Tuning';
        if (giorni === 0) return '🎅 Buon Natale da tutto il team Padania Tuning!';
        var conto = giorni === 1 ? 'domani è Natale' : '<b>' + giorni + '</b> giorni a Natale';
        if (page === 'shop.html') return '🎁 Idee regalo · ' + conto;
        return '🎄 Christmas Edition · ' + conto;
    }

    var bar = document.createElement('div');
    bar.className = 'xmas-bar';
    bar.innerHTML =
        '<span class="xmas-bar-txt">' + messaggio() + '</span>' +
        '<button type="button" class="xmas-snow-btn" aria-pressed="true">❄<span> Neve</span></button>';
    document.body.insertBefore(bar, document.body.firstChild);

    /* ---------- CAPPELLO SUL LOGO + LUMINARIE ---------- */
    if (nav) {
        var brand = nav.querySelector('.pt-nav-brand');
        if (brand) {
            brand.insertAdjacentHTML('beforeend',
                '<svg class="xmas-hat" viewBox="0 0 34 30" aria-hidden="true">' +
                    '<path d="M4 23 C6 9 16 2 29 6 C24 8 23 14 25 23 Z" fill="#e11d2e"/>' +
                    '<path d="M4 23 C6 9 16 2 29 6 C20 6 11 11 9 23 Z" fill="#ff4a57" opacity=".55"/>' +
                    '<rect x="1" y="20" width="27" height="8" rx="4" fill="#f6fbff"/>' +
                    '<circle cx="30" cy="7" r="4" fill="#f6fbff"/>' +
                '</svg>');
        }

        var luci = document.createElement('div');
        luci.className = 'xmas-lights';
        luci.setAttribute('aria-hidden', 'true');
        nav.appendChild(luci);
        var ultimaLarghezza = 0;
        function appendiLuci() {
            var w = nav.clientWidth;
            if (Math.abs(w - ultimaLarghezza) < 28) return;
            ultimaLarghezza = w;
            var n = Math.ceil(w / 56), html = '';
            for (var i = 0; i < n; i++) html += '<i style="left:' + (i * 56 + 28) + 'px"></i>';
            luci.innerHTML = html;
        }
        appendiLuci();
        window.addEventListener('resize', appendiLuci);
    }

    /* ---------- FOOTER: auguri + macchina con l'albero ---------- */
    var footer = document.querySelector('.pt-footer');
    if (footer) {
        var side = footer.querySelector('.pt-footer-side');
        if (side) side.insertAdjacentHTML('afterbegin', '<p class="xmas-wish">Buone feste dal team Padania Tuning 🎄</p>');

        footer.insertAdjacentHTML('afterbegin',
            '<div class="xmas-road" aria-hidden="true">' +
            '<img class="xmas-car" src="assets/img/natale-auto.webp" alt="" width="560" height="280">' +
            '</div>');
    }

    /* ---------- NEVE ---------- */
    var btn = bar.querySelector('.xmas-snow-btn');
    var canvas, ctx, fiocchi = [], raf = 0, W = 0, H = 0, dpr = 1, vento = 0;
    var CHIAVE = 'ptNeve';
    var accesa;
    try { accesa = localStorage.getItem(CHIAVE); } catch (e) { accesa = null; }
    accesa = accesa === null ? !calmo : accesa === '1';

    function misura() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth; H = window.innerHeight;
        canvas.width = W * dpr; canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        var quanti = Math.max(28, Math.min(120, Math.round(W / 11)));
        while (fiocchi.length < quanti) fiocchi.push(nuovo(true));
        fiocchi.length = quanti;
    }
    function nuovo(ovunque) {
        var z = Math.random();                       // profondità: 0 lontano, 1 vicino
        return {
            x: Math.random() * W,
            y: ovunque ? Math.random() * H : -10,
            r: 0.8 + z * 2.4,
            v: 0.35 + z * 1.15,
            a: 0.25 + z * 0.6,
            f: Math.random() * Math.PI * 2,
            s: 0.008 + Math.random() * 0.02
        };
    }
    function disegna() {
        ctx.clearRect(0, 0, W, H);
        vento += 0.002;
        var spinta = Math.sin(vento) * 0.35;
        ctx.fillStyle = '#fff';
        for (var i = 0; i < fiocchi.length; i++) {
            var p = fiocchi[i];
            p.f += p.s;
            p.y += p.v;
            p.x += Math.sin(p.f) * 0.5 + spinta * p.v;
            if (p.y > H + 6) { fiocchi[i] = nuovo(false); continue; }
            if (p.x < -6) p.x = W + 6; else if (p.x > W + 6) p.x = -6;
            ctx.globalAlpha = p.a;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, 6.2832);
            ctx.fill();
        }
        raf = requestAnimationFrame(disegna);
    }
    function avvia() {
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.className = 'xmas-snow';
            canvas.setAttribute('aria-hidden', 'true');
            document.body.appendChild(canvas);
            ctx = canvas.getContext('2d');
            window.addEventListener('resize', misura);
        }
        canvas.style.display = '';
        misura();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(disegna);
    }
    function ferma() {
        cancelAnimationFrame(raf);
        if (canvas) canvas.style.display = 'none';
    }
    function applica() {
        btn.setAttribute('aria-pressed', accesa ? 'true' : 'false');
        btn.title = accesa ? 'Ferma la neve' : 'Fai nevicare';
        if (accesa) avvia(); else ferma();
    }
    btn.addEventListener('click', function () {
        accesa = !accesa;
        try { localStorage.setItem(CHIAVE, accesa ? '1' : '0'); } catch (e) {}
        applica();
    });
    document.addEventListener('visibilitychange', function () {
        if (!accesa) return;
        if (document.hidden) cancelAnimationFrame(raf); else { cancelAnimationFrame(raf); raf = requestAnimationFrame(disegna); }
    });
    applica();
})();
