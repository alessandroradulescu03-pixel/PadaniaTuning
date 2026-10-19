/* =========================================================
   PADANIA TUNING — IMPOSTAZIONI EVENTO
   Cambia qui data, luogo e orari: si aggiornano da soli
   countdown, form e pagina di conferma.
   ========================================================= */
window.PT_CONFIG = {

    // Indirizzo dello script Google che salva le iscrizioni e manda le mail.
    // Lo ottieni seguendo il file google-apps-script/ISTRUZIONI.md
    SCRIPT_URL: 'INCOLLA_QUI_URL_APPS_SCRIPT',

    // Chiusura iscrizioni (formato AAAA-MM-GGTHH:MM:SS, ora italiana)
    CHIUSURA_ISCRIZIONI: '2027-11-06T23:59:00',

    EVENTO: {
        nome: 'Padania Tuning al Qi Clubbing',
        luogo: 'Qi Clubbing',
        indirizzo: "Via dell'Industria, 83, 25030 Erbusco (BS)",
        data: 'Domenica 7 Novembre 2027',
        orarioRaduno: 'dalle 21:00',
        orarioSerata: 'dalle 23:30',
        vantaggi: [
            '+100 posti auto',
            'Ingresso al raduno totalmente gratuito',
            'Se vieni con Padania Tuning, ingresso omaggio anche in discoteca al Qi Clubbing'
        ]
    }
};
