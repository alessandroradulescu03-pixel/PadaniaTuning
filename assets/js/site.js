/* =========================================================
   PADANIA TUNING — MENU E FOOTER COMUNI
   Per aggiungere/togliere una voce di menu modifica MENU qui sotto:
   la modifica vale per tutte le pagine.
   ========================================================= */
(function () {
    var MENU = [
        { label: 'Home', href: 'index.html' },
        { label: 'La nostra storia', href: 'storia.html' },
        { label: 'Galleria Auto', href: 'galleria.html' },
        { label: 'Eventi', href: 'eventi.html' },
        { label: 'Shop', href: 'shop.html' },
        { label: 'Contatti', href: 'contatti.html' }
    ];

    // Pagine "figlie" che accendono una voce del menu
    var PARENT = {
        'qi.html': 'eventi.html',
        'collaborazioni.html': 'eventi.html',
        'conferma.html': 'eventi.html'
    };

    var page = location.pathname.split('/').pop() || 'index.html';
    var current = PARENT[page] || page;

    // --- MENU ---
    var nav = document.createElement('nav');
    nav.className = 'pt-nav';
    nav.innerHTML =
        '<div class="pt-nav-inner">' +
            '<a class="pt-nav-brand" href="index.html">' +
                '<img src="assets/img/logo.jpg" alt="Padania Tuning">' +
                '<span>Padania Tuning</span>' +
            '</a>' +
            '<button class="pt-nav-toggle" type="button" aria-label="Apri il menu" aria-expanded="false"><span></span></button>' +
            '<ul class="pt-nav-links">' +
                MENU.map(function (m) {
                    return '<li><a href="' + m.href + '"' + (m.href === current ? ' class="active"' : '') + '>' + m.label + '</a></li>';
                }).join('') +
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
            '<div class="pt-footer-social">' +
                '<a href="https://www.instagram.com/padaniatuning/" target="_blank" rel="noopener">Instagram</a>' +
                '<a href="https://www.tiktok.com/@padania.tuning" target="_blank" rel="noopener">TikTok</a>' +
                '<a href="https://whatsapp.com/channel/0029VbBnk5ELNSa4XMFhD607" target="_blank" rel="noopener">WhatsApp</a>' +
            '</div>' +
            '© ' + new Date().getFullYear() + ' Padania Tuning';
        document.body.appendChild(footer);
    }
})();
