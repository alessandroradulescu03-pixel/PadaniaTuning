/* =========================================================
   PADANIA TUNING — IMPOSTAZIONI EVENTO
   Cambia qui data, luogo e orari: si aggiornano da soli
   countdown, form e pagina di conferma.
   ========================================================= */
window.PT_CONFIG = {

    // Indirizzo dello script Google che salva le iscrizioni e manda le mail.
    // Lo ottieni seguendo il file google-apps-script/ISTRUZIONI.md
    SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbweHwQuH_P4cblhQDbDnI6Ri86qSEqwWyMSCgTRZJ3yFjr5KV_0Q8NpHRUUOVoqZTrjug/exec',

    // Indirizzo dello script Google dello SHOP (catalogo, pagamenti Stripe, ordini).
    // Lo ottieni seguendo google-apps-script-shop/ISTRUZIONI-SHOP.md
    SHOP_SCRIPT_URL: 'INCOLLA_QUI_URL_SCRIPT_SHOP',

    // Testi di consegna mostrati nel carrello (devono corrispondere a Shop.gs)
    SHOP: {
        spedizione: 7.00,          // € spedizione in Italia
        spedizioneGratisDa: 80.00, // € sopra cui è gratis (0 = mai)
        ritiroEvento: true         // ritiro gratis al prossimo evento
    },

    // Chiusura iscrizioni (AAAA-MM-GGTHH:MM:SS+01:00 = ora italiana invernale, +02:00 d'estate)
    CHIUSURA_ISCRIZIONI: '2026-11-06T23:59:00+01:00',

    EVENTO: {
        nome: 'Padania Tuning al Qi Clubbing',
        luogo: 'Qi Clubbing',
        indirizzo: "Via dell'Industria, 83, 25030 Erbusco (BS)",
        data: 'Sabato 7 Novembre 2026',
        orarioRaduno: 'dalle 21:00',
        orarioSerata: 'dalle 23:30',
        vantaggi: [
            '+100 posti auto',
            'Ingresso al raduno totalmente gratuito',
            'Se vieni con Padania Tuning, ingresso omaggio anche in discoteca al Qi Clubbing'
        ]
    }
};
