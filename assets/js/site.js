/* =========================================================
   PADANIA TUNING — MENU, FOOTER E FUNZIONI COMUNI
   Per aggiungere/togliere una voce di menu modifica MENU:
   la modifica vale per tutte le pagine.
   ========================================================= */
(function () {
    var MENU = [
        { label: 'Home', href: 'index.html' },
        { label: 'La nostra storia', href: 'storia.html' },
        { label: 'Galleria', href: 'galleria.html' },
        { label: 'Eventi', href: 'eventi.html' },
        { label: 'Shop', href: 'shop.html' },
        { label: 'Contatti', href: 'contatti.html' }
    ];
    var CTA = { label: 'Iscrivi la tua auto', href: 'qi.html' };

    // Pagine "figlie" che accendono una voce del menu
    var PARENT = {
        'collaborazioni.html': 'eventi.html',
        'conferma.html': 'eventi.html',
        'ordine-ok.html': 'shop.html'
    };

    var page = location.pathname.split('/').pop() || 'index.html';
    var current = PARENT[page] || page;

    // --- MENU ---
    var nav = document.createElement('nav');
    nav.className = 'pt-nav';
    nav.innerHTML =
        '<div class="pt-nav-inner">' +
            '<a class="pt-nav-brand" href="index.html">' +
                '<img src="assets/img/logo.jpg" alt="">' +
                '<span>Padania <em>Tuning</em></span>' +
            '</a>' +
            '<button class="pt-nav-toggle" type="button" aria-label="Apri il menu" aria-expanded="false"><span></span></button>' +
            '<ul class="pt-nav-links">' +
                MENU.map(function (m) {
                    return '<li><a href="' + m.href + '"' + (m.href === current ? ' class="active" aria-current="page"' : '') + '>' + m.label + '</a></li>';
                }).join('') +
                '<li class="pt-nav-cta"><a href="' + CTA.href + '"' + (page === CTA.href ? ' class="active"' : '') + '>' + CTA.label + '</a></li>' +
            '</ul>' +
        '</div>';
    document.body.insertBefore(nav, document.body.firstChild);

    var btn = nav.querySelector('.pt-nav-toggle');
    btn.addEventListener('click', function () {
        var open = nav.classList.toggle('open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    // --- FOOTER ---
    if (!document.body.hasAttribute('data-no-footer')) {
        var footer = document.createElement('footer');
        footer.className = 'pt-footer';
        footer.innerHTML =
            '<div class="pt-footer-inner">' +
                '<div class="pt-footer-big">Padania<br><em>Tuning</em></div>' +
                '<div class="pt-footer-side">' +
                    '<div class="pt-footer-social">' +
                        '<a href="https://www.instagram.com/padaniatuning/" target="_blank" rel="noopener">Instagram</a>' +
                        '<a href="https://www.tiktok.com/@padania.tuning" target="_blank" rel="noopener">TikTok</a>' +
                        '<a href="https://whatsapp.com/channel/0029VbBnk5ELNSa4XMFhD607" target="_blank" rel="noopener">WhatsApp</a>' +
                    '</div>' +
                    '<div class="pt-footer-copy">© ' + new Date().getFullYear() + ' Padania Tuning · Passione e motori dal 2025</div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(footer);
    }

    // --- FUNZIONI COMUNI (usate da Home, Eventi, Form, Conferma) ---
    window.PT = {
        // Riquadro argento con la data: "Sabato 7 Novembre 2026" -> 07 / NOV / 2026
        dateBox: function (testo) {
            var m = testo.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
            return m
                ? '<b>' + ('0' + m[1]).slice(-2) + '</b><small>' + m[2].slice(0, 3) + '</small><em>' + m[3] + '</em>'
                : '<b>' + testo + '</b>';
        },

        // Luogo, indirizzo e orari
        where: function (ev) {
            var giorno = ev.data.split(' ')[0];
            return '<b>' + ev.luogo + '</b>' +
                '<span>' + ev.indirizzo + '</span>' +
                '<span class="times">' + giorno + ' · raduno ' + ev.orarioRaduno + ', serata ' + ev.orarioSerata + '</span>';
        },

        // Countdown a blocchi giorni/ore/minuti/secondi
        countdown: function (el, quando, testoFine) {
            var fine = new Date(quando).getTime();
            function pad(n) { return n < 10 ? '0' + n : n; }
            function tick() {
                var d = fine - Date.now();
                if (d <= 0) {
                    el.innerHTML = '<div class="pt-count-closed">' + (testoFine || 'Iscrizioni chiuse') + '</div>';
                    clearInterval(t);
                    return;
                }
                el.innerHTML =
                    '<div><b>' + Math.floor(d / 864e5) + '</b><small>giorni</small></div>' +
                    '<div><b>' + pad(Math.floor(d % 864e5 / 36e5)) + '</b><small>ore</small></div>' +
                    '<div><b>' + pad(Math.floor(d % 36e5 / 6e4)) + '</b><small>minuti</small></div>' +
                    '<div><b>' + pad(Math.floor(d % 6e4 / 1e3)) + '</b><small>secondi</small></div>';
            }
            var t = setInterval(tick, 1000);
            tick();
        }
    };
})();
