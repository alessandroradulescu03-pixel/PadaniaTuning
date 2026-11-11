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
    SHOP_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbx0aCVeNQaC3Tz4yhLUIbR0TCuUzjzeMVPA_xzWqCJw-GiMRNzWOrU2bUPip8bFP5m0fg/exec',

    // Chiave PUBBLICA di Stripe (inizia con pk_test_... per le prove, pk_live_... per vendere davvero).
    // Con la chiave, il pagamento si apre DENTRO il sito. Lasciala vuota ('') per tornare
    // alla pagina di pagamento esterna di Stripe. La trovi su Stripe: Sviluppatori → Chiavi API.
    // (La chiave pubblica si può scrivere qui senza rischi; quella SEGRETA sk_... mai.)
    STRIPE_PK: 'pk_test_51UQsPfC0Td4LDolLCTiefW1qKVWfWjTfWkaWmGxUGrd9QOVJQYHV2P6Tz1hR1hOrHdTBIfG7teY2EIa0hvX03Zut00d2ZI1yYu',   // chiave di PROVA (sandbox): per vendere davvero metti la pk_live_...

    // Testi di consegna mostrati nel carrello (devono corrispondere a Shop.gs)
    SHOP: {
        spedizione: 7.00,          // € spedizione in Italia
        spedizioneGratisDa: 80.00, // € sopra cui è gratis (0 = mai)
        ritiroEvento: true,        // ritiro gratis al prossimo evento
        giorniPreparazione: 14     // tempo di preparazione prima della spedizione
    },

    // Chiusura iscrizioni (AAAA-MM-GGTHH:MM:SS+01:00 = ora italiana invernale, +02:00 d'estate)
    CHIUSURA_ISCRIZIONI: '2026-12-12T23:59:00+01:00',

    EVENTO: {
        nome: 'Padania Tuning a Covo',
        luogo: 'Covo (BG)',
        indirizzo: 'Via Giacomo Gregis 46, 24050 Covo (BG)',
        data: 'Domenica 13 Dicembre 2026',
        orarioRaduno: 'dalle 13:30 alle 18:30',
        orarioSerata: '',          // lascia '' se non c'è la serata: non viene mostrata
        vantaggi: [
            '250+ auto',
            'Ingresso €10',
            'Raduno di domenica pomeriggio'
        ]
    }
};
