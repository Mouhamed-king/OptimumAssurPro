const db = require('../database/connection');

function toMoney(value) {
    const amount = Number(value);
    return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

function isMissingPaymentsTable(error) {
    if (!error) return false;
    const message = `${error.message || ''} ${error.details || ''}`.toLowerCase();
    return ['42p01', 'pgrst106', 'pgrst200', 'pgrst204', 'pgrst205'].includes(error.code)
        || message.includes('paiements')
        || message.includes('schema cache');
}

async function recordPaymentMovement({
    entrepriseId,
    contratId,
    clientId = null,
    montant,
    type = 'encaissement',
    source = 'manuel',
    note = null,
    datePaiement = null
}) {
    const cleanAmount = toMoney(montant);
    if (!entrepriseId || !contratId || cleanAmount === 0) {
        return { skipped: true };
    }

    const payload = {
        entreprise_id: entrepriseId,
        contrat_id: contratId,
        montant: cleanAmount,
        type,
        source,
        note
    };

    if (clientId) payload.client_id = clientId;
    if (datePaiement) payload.date_paiement = datePaiement;

    const { data, error } = await db.supabase
        .from('paiements')
        .insert(payload)
        .select()
        .single();

    if (error) {
        if (isMissingPaymentsTable(error)) {
            console.warn('Historique des paiements indisponible: migration paiements non appliquee');
            return { skipped: true, missingTable: true };
        }
        throw error;
    }

    return { data };
}

module.exports = {
    recordPaymentMovement,
    toMoney,
    isMissingPaymentsTable
};
