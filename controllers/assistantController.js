const db = require('../database/connection');
const { callOpenAIJson } = require('../services/openaiClient');
const { recordPaymentMovement, toMoney } = require('../services/paymentLedger');

const SAFE_LIMIT = 10;

function cleanText(value) {
    return value === null || value === undefined ? '' : String(value).trim();
}

function buildSuggestions(items) {
    return items.filter(Boolean).slice(0, 6);
}

function getDefaultSuggestions() {
    return buildSuggestions([
        'Donne-moi les infos du client',
        'Quels clients ont un reste a payer ?',
        'Donne-moi les echeances du client',
        'Resume la caisse du jour',
        'Je veux modifier un paiement',
        'Je veux changer le telephone d un client'
    ]);
}

function normalizeSearchValue(value) {
    return cleanText(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function cleanAssistantQuery(query) {
    const stopWords = new Set([
        'donne', 'moi', 'les', 'des', 'infos', 'info', 'information', 'informations',
        'du', 'de', 'la', 'le', 'un', 'une', 'client', 'cliente', 'clients',
        'cherche', 'chercher', 'recherche', 'rechercher', 'trouve', 'trouver',
        'matricule', 'immatriculation', 'plaque', 'numero', 'numéro', 'police',
        'contrat', 'contrats', 'vehicule', 'vehicules', 'véhicule', 'véhicules',
        'voiture', 'voitures', 'echeance', 'echeances', 'échéance', 'échéances',
        'date', 'dates', 'detail', 'details', 'm', 'mr', 'mme', 'mlle', 'monsieur',
        'madame', 'pour', 'sur'
    ]);

    const normalized = normalizeSearchValue(query);
    return normalized
        .split(' ')
        .filter(token => token.length > 1 && !stopWords.has(token))
        .join(' ');
}

function buildClientSearchText(client) {
    return normalizeSearchValue([
        client.nom,
        client.prenom,
        client.telephone,
        ...(client.vehicules || []).flatMap(vehicle => [
            vehicle.immatriculation,
            vehicle.marque,
            vehicle.modele
        ]),
        ...(client.contrats || []).flatMap(contract => [
            contract.numero_contrat,
            contract.type_contrat,
            contract.categorie_vehicule,
            contract.vehicules?.immatriculation
        ])
    ].filter(Boolean).join(' '));
}

function getClientSearchScore(client, query) {
    const rawSearch = normalizeSearchValue(query);
    const cleanedSearch = cleanAssistantQuery(query);
    const tokens = cleanedSearch.split(' ').filter(Boolean);
    const haystack = buildClientSearchText(client);

    if (!rawSearch && !cleanedSearch) return 1;

    let score = 0;
    if (rawSearch && haystack.includes(rawSearch)) score += 20;
    if (cleanedSearch && haystack.includes(cleanedSearch)) score += 40;

    tokens.forEach(token => {
        if (haystack.split(' ').includes(token)) {
            score += 12;
        } else if (haystack.includes(token)) {
            score += 6;
        }
    });

    if (tokens.length && tokens.every(token => haystack.includes(token))) {
        score += 30;
    }

    return score;
}

function normalizeAction(action) {
    const allowed = new Set([
        'show_menu',
        'search_client',
        'get_client_info',
        'list_unpaid_clients',
        'get_cash_report',
        'prepare_update_payment',
        'prepare_update_client'
    ]);
    return allowed.has(action) ? action : 'unknown';
}

function formatMoney(amount) {
    return `${new Intl.NumberFormat('fr-FR', {
        maximumFractionDigits: 0
    }).format(toMoney(amount))} FCFA`;
}

function getClientFullName(client = {}) {
    return `${client.nom || ''} ${client.prenom || ''}`.trim() || 'Client';
}

function formatDate(value) {
    if (!value) return '-';
    const parts = String(value).slice(0, 10).split('-').map(Number);
    const date = parts.length === 3 && parts.every(Number.isFinite)
        ? new Date(parts[0], parts[1] - 1, parts[2])
        : new Date(value);

    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('fr-FR').format(date);
}

function getDaysUntil(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return Math.round((date - today) / (1000 * 60 * 60 * 24));
}

function formatDaysUntil(value) {
    const days = getDaysUntil(value);
    if (days === null) return 'delai inconnu';
    if (days < 0) return `expire depuis ${Math.abs(days)} jour(s)`;
    if (days === 0) return 'expire aujourd hui';
    return `dans ${days} jour(s)`;
}

function getLatestContract(client = {}) {
    const contracts = client.contrats || [];
    return [...contracts].sort((a, b) => new Date(b.date_fin || 0) - new Date(a.date_fin || 0))[0] || null;
}

function getSortedContracts(client = {}) {
    return [...(client.contrats || [])].sort((a, b) => new Date(b.date_fin || 0) - new Date(a.date_fin || 0));
}

function getVehicleContracts(client = {}, vehicle = {}) {
    return getSortedContracts(client).filter(contract => {
        if (vehicle.id && contract.vehicule_id === vehicle.id) return true;
        if (vehicle.id && contract.vehicules?.id === vehicle.id) return true;
        if (vehicle.immatriculation && contract.vehicules?.immatriculation === vehicle.immatriculation) return true;
        return false;
    });
}

function describeVehicleLine(client, vehicle, index) {
    const contracts = getVehicleContracts(client, vehicle);
    const latest = contracts[0] || null;
    const identity = [
        vehicle.immatriculation || 'sans immatriculation',
        [vehicle.marque, vehicle.modele].filter(Boolean).join(' ')
    ].filter(Boolean).join(' - ');
    const details = [
        vehicle.type_vehicule ? `type ${vehicle.type_vehicule}` : null,
        vehicle.puissance ? `${vehicle.puissance} CV` : null,
        vehicle.energie ? vehicle.energie : null
    ].filter(Boolean).join(', ');

    return [
        `${index + 1}. ${identity || 'Vehicule'}`,
        details ? `   Details: ${details}` : null,
        latest
            ? `   Derniere echeance: ${formatDate(latest.date_fin)} (${formatDaysUntil(latest.date_fin)}) - police ${latest.numero_contrat || '-'}`
            : '   Aucun contrat associe trouve.',
        latest ? `   Paiement: paye ${formatMoney(latest.montant_paye || 0)} / reste ${formatMoney(latest.montant_restant || 0)}` : null
    ].filter(Boolean).join('\n');
}

function buildClientInfoSuggestions(client) {
    const name = getClientFullName(client);
    return buildSuggestions([
        `Liste les echeances de ${name}`,
        `Quel est le reste a payer de ${name} ?`,
        `Prepare un paiement pour ${name}`,
        `Modifier le telephone de ${name}`,
        'Chercher un autre client',
        'Afficher le menu assistant'
    ]);
}

function formatClientFullProfile(client) {
    const vehicles = client.vehicules || [];
    const contracts = getSortedContracts(client);
    const activeContracts = contracts.filter(contract => {
        const days = getDaysUntil(contract.date_fin);
        return days === null || days >= 0;
    });
    const totalRemaining = contracts.reduce((sum, contract) => sum + toMoney(contract.montant_restant || 0), 0);
    const nextContract = [...contracts]
        .filter(contract => {
            const days = getDaysUntil(contract.date_fin);
            return days !== null && days >= 0;
        })
        .sort((a, b) => new Date(a.date_fin || 0) - new Date(b.date_fin || 0))[0] || null;

    const lines = [
        `Fiche client - ${getClientFullName(client)}`,
        `Telephone: ${client.telephone || '-'}`,
        client.email ? `Email: ${client.email}` : null,
        client.adresse ? `Adresse: ${client.adresse}` : null,
        `Vehicules: ${vehicles.length}`,
        `Contrats: ${contracts.length} (${activeContracts.length} actif(s))`,
        `Reste total a payer: ${formatMoney(totalRemaining)}`,
        nextContract ? `Prochaine echeance: ${formatDate(nextContract.date_fin)} (${formatDaysUntil(nextContract.date_fin)}) - ${nextContract.vehicules?.immatriculation || 'vehicule'} / police ${nextContract.numero_contrat || '-'}` : 'Prochaine echeance: aucune echeance active trouvee',
        '',
        vehicles.length ? 'Vehicules et echeances:' : 'Vehicules: aucun vehicule enregistre',
        ...vehicles.map((vehicle, index) => describeVehicleLine(client, vehicle, index))
    ].filter(line => line !== null);

    if (contracts.length) {
        lines.push('', 'Contrats recents:');
        contracts.slice(0, 5).forEach((contract, index) => {
            lines.push(`${index + 1}. ${contract.numero_contrat || '-'} - ${contract.vehicules?.immatriculation || 'vehicule'} - echeance ${formatDate(contract.date_fin)} (${formatDaysUntil(contract.date_fin)}) - reste ${formatMoney(contract.montant_restant || 0)}`);
        });
    }

    return lines.join('\n');
}

function describeContract(contract) {
    if (!contract) return 'Aucun contrat trouve.';
    return [
        `Police: ${contract.numero_contrat || '-'}`,
        `Prime nette: ${formatMoney(contract.montant || 0)}`,
        `Payé: ${formatMoney(contract.montant_paye || 0)}`,
        `Reste: ${formatMoney(contract.montant_restant || 0)}`,
        `Échéance: ${contract.date_fin || '-'}`
    ].join('\n');
}

async function findClients(entrepriseId, query, limit = SAFE_LIMIT) {
    const search = cleanAssistantQuery(query);
    let request = db.supabase
        .from('clients')
        .select(`
            id,
            nom,
            prenom,
            telephone,
            vehicules (*),
            contrats (*, vehicules (*))
        `)
        .eq('entreprise_id', entrepriseId)
        .order('created_at', { ascending: false })
        .limit(1000);

    const { data, error } = await request;
    if (error) throw error;

    const clients = data || [];
    if (!search) return clients.slice(0, limit);

    return clients
        .map(client => ({ client, score: getClientSearchScore(client, query) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.client)
        .slice(0, limit);
}

function requireSingleClient(clients) {
    if (!clients.length) {
        return { error: 'Aucun client correspondant trouvé.' };
    }

    if (clients.length > 1) {
        return {
            multiple: true,
            reply: [
                'J’ai trouvé plusieurs clients. Précise lequel tu veux:',
                ...clients.map(client => {
                    const contract = getLatestContract(client);
                    return `- ${getClientFullName(client)} · ${client.telephone || '-'} · ${contract?.numero_contrat || 'sans police'}`;
                })
            ].join('\n')
        };
    }

    return { client: clients[0] };
}

async function classifyMessage(message) {
    const system = `
Tu es le routeur d'un assistant de gestion assurance auto.
Retourne uniquement du JSON valide.
Actions possibles:
- show_menu: proposer les questions possibles. Champs: aucun.
- search_client: rechercher un client. Champs: query.
- get_client_info: donner les infos d'un client. Champs: query.
- list_unpaid_clients: clients avec reste a payer. Champs: min_remaining optionnel.
- get_cash_report: rapport caisse. Champs: filter = today | two_days | month | year | all.
- prepare_update_payment: preparer modification du montant paye. Champs: query, montant_paye, montant_restant optionnel.
- prepare_update_client: preparer modification client. Champs: query, fields avec nom, telephone, immatriculation optionnels.
Comprends "matricule" comme "immatriculation".
Dans query, garde seulement le nom, telephone, numero de police ou immatriculation utile. Enleve "cherche", "donne moi", "infos", "client".
Si l'utilisateur demande aide, menu, options, questions ou ce que tu peux faire: action show_menu.
Si l'utilisateur demande les infos, details, voitures, vehicules, echeances ou dates d'un client: action get_client_info.
Si la demande est floue: action show_menu.
Ne promets jamais une modification directe.
`;

    const { data, error } = await callOpenAIJson([
        { role: 'system', content: system },
        { role: 'user', content: message }
    ]);

    if (error === 'missing_api_key') {
        return fallbackClassify(message);
    }

    return data;
}

function fallbackClassify(message) {
    const text = cleanText(message);
    const lower = text.toLowerCase();

    if (
        lower.includes('aide') ||
        lower.includes('menu') ||
        lower.includes('option') ||
        lower.includes('question') ||
        lower.includes('que peux') ||
        lower.includes('quoi faire')
    ) {
        return { action: 'show_menu' };
    }

    if (lower.includes('reste') || lower.includes('doit') || lower.includes('impay')) {
        return { action: 'list_unpaid_clients', min_remaining: 0 };
    }

    if (lower.includes('rapport') || lower.includes('caisse') || lower.includes('encaisse')) {
        const filter = lower.includes('2') || lower.includes('deux') ? 'two_days' : 'today';
        return { action: 'get_cash_report', filter };
    }

    const amountMatch = text.match(/(\d[\d\s.,]*)\s*(?:fcfa|f|xof)?/i);
    if ((lower.includes('montant') || lower.includes('pay')) && amountMatch) {
        const amount = Number(amountMatch[1].replace(/\s/g, '').replace(',', '.'));
        const query = text
            .replace(amountMatch[0], '')
            .replace(/mets|mettre|met|jour|à|a|montant|pay[eé]|client|de|du|la|le/gi, ' ')
            .trim();
        return { action: 'prepare_update_payment', query, montant_paye: amount };
    }

    const phoneMatch = text.match(/(?:telephone|téléphone|tel)\D+([\d\s+.-]{6,})/i);
    if (phoneMatch) {
        const query = text.slice(0, phoneMatch.index).replace(/mets|mettre|modifie|change|client|de|du|la|le/gi, ' ').trim();
        return { action: 'prepare_update_client', query, fields: { telephone: phoneMatch[1].trim() } };
    }

    if (
        lower.includes('info') ||
        lower.includes('detail') ||
        lower.includes('voiture') ||
        lower.includes('vehicule') ||
        lower.includes('véhicule') ||
        lower.includes('echeance') ||
        lower.includes('échéance') ||
        lower.includes('date')
    ) {
        return { action: 'get_client_info', query: text };
    }

    return { action: 'search_client', query: text };
}

function showMenuAction() {
    return {
        reply: [
            'Dis-moi ce que tu veux faire. Je peux te guider avec ces questions:',
            '- Donne-moi les infos du client [nom / telephone / immatriculation]',
            '- Combien de vehicules a ce client ?',
            '- Quelles sont les echeances de ses vehicules ?',
            '- Quels clients ont un reste a payer ?',
            '- Resume la caisse du jour',
            '- Prepare un paiement pour [client] a [montant]'
        ].join('\n'),
        suggestions: getDefaultSuggestions()
    };
}

async function searchClientAction(req, payload) {
    const clients = await findClients(req.entrepriseId, payload.query);
    if (!clients.length) {
        const extracted = cleanAssistantQuery(payload.query);
        return { reply: extracted ? `Aucun client trouvé pour: ${extracted}` : 'Aucun client trouvé.' };
    }

    return {
        reply: [
            `J’ai trouvé ${clients.length} client(s):`,
            ...clients.map(client => {
                const contract = getLatestContract(client);
                return `- ${getClientFullName(client)} · ${client.telephone || '-'} · ${contract?.numero_contrat || 'sans police'} · reste ${formatMoney(contract?.montant_restant || 0)}`;
            })
        ].join('\n')
    };
}

async function getClientInfoAction(req, payload) {
    const match = requireSingleClient(await findClients(req.entrepriseId, payload.query));
    if (match.error || match.multiple) {
        const extracted = cleanAssistantQuery(payload.query);
        return { reply: match.multiple ? match.reply : `Aucun client correspondant trouvé${extracted ? ` pour: ${extracted}` : ''}.` };
    }

    const client = match.client;
    const contract = getLatestContract(client);
    const vehicles = client.vehicules || [];

    return {
        reply: [
            `${getClientFullName(client)}`,
            `Téléphone: ${client.telephone || '-'}`,
            `Véhicule: ${vehicles[0]?.immatriculation || contract?.vehicules?.immatriculation || '-'}`,
            describeContract(contract)
        ].join('\n')
    };
}

async function listUnpaidClientsAction(req, payload) {
    const minRemaining = toMoney(payload.min_remaining || 0);
    const { data, error } = await db.supabase
        .from('contrats')
        .select(`
            id,
            numero_contrat,
            montant_paye,
            montant_restant,
            date_fin,
            clients (nom, prenom, telephone)
        `)
        .eq('entreprise_id', req.entrepriseId)
        .gt('montant_restant', minRemaining)
        .order('montant_restant', { ascending: false })
        .limit(10);

    if (error) throw error;
    const contracts = data || [];
    if (!contracts.length) return { reply: 'Aucun reste à payer trouvé.' };

    return {
        reply: [
            `Clients avec reste à payer${minRemaining ? ` supérieur à ${formatMoney(minRemaining)}` : ''}:`,
            ...contracts.map(contract => {
                const client = contract.clients || {};
                return `- ${getClientFullName(client)} · ${client.telephone || '-'} · ${contract.numero_contrat || '-'} · reste ${formatMoney(contract.montant_restant)}`;
            })
        ].join('\n')
    };
}

async function getCashReportAction(req, payload) {
    const filter = payload.filter || 'today';
    const params = new URLSearchParams({ filter, limit: '5' });
    const fakeReq = { ...req, query: Object.fromEntries(params.entries()) };
    const reportController = require('./reportController');

    let jsonPayload = null;
    const fakeRes = {
        json(data) { jsonPayload = data; },
        status() { return this; }
    };

    await reportController.getSummary(fakeReq, fakeRes);
    if (!jsonPayload) return { reply: 'Impossible de charger le rapport de caisse.' };

    return {
        reply: [
            `État de caisse (${filter}):`,
            `Encaissé: ${formatMoney(jsonPayload.totalPaid || 0)}`,
            `Bénéfice estimé: ${formatMoney(jsonPayload.totalProfit || 0)}`,
            `Net à verser: ${formatMoney(jsonPayload.totalNetAVerser || 0)}`,
            `Contrats payés: ${jsonPayload.totalContracts || 0}`,
            `Clients payeurs: ${jsonPayload.totalClients || 0}`
        ].join('\n')
    };
}

async function searchClientGuidedAction(req, payload) {
    const clients = await findClients(req.entrepriseId, payload.query);
    if (!clients.length) {
        const extracted = cleanAssistantQuery(payload.query);
        return {
            reply: extracted ? `Aucun client trouve pour: ${extracted}` : 'Aucun client trouve.',
            suggestions: getDefaultSuggestions()
        };
    }

    return {
        reply: [
            `J'ai trouve ${clients.length} client(s):`,
            ...clients.map(client => {
                const contract = getLatestContract(client);
                const vehicleCount = (client.vehicules || []).length;
                return `- ${getClientFullName(client)} - ${client.telephone || '-'} - ${vehicleCount} vehicule(s) - ${contract?.numero_contrat || 'sans police'} - echeance ${formatDate(contract?.date_fin)} - reste ${formatMoney(contract?.montant_restant || 0)}`;
            })
        ].join('\n'),
        suggestions: buildSuggestions([
            clients[0] ? `Donne-moi les infos de ${getClientFullName(clients[0])}` : null,
            clients[0] ? `Liste les echeances de ${getClientFullName(clients[0])}` : null,
            'Chercher un autre client',
            'Quels clients ont un reste a payer ?',
            'Afficher le menu assistant'
        ])
    };
}

async function getClientInfoGuidedAction(req, payload) {
    const match = requireSingleClient(await findClients(req.entrepriseId, payload.query));
    if (match.error || match.multiple) {
        const extracted = cleanAssistantQuery(payload.query);
        return {
            reply: match.multiple ? match.reply : `Aucun client correspondant trouve${extracted ? ` pour: ${extracted}` : ''}.`,
            suggestions: getDefaultSuggestions()
        };
    }

    return {
        reply: formatClientFullProfile(match.client),
        suggestions: buildClientInfoSuggestions(match.client)
    };
}

async function listUnpaidClientsGuidedAction(req, payload) {
    const result = await listUnpaidClientsAction(req, payload);
    return {
        ...result,
        suggestions: buildSuggestions([
            'Donne-moi les infos du client',
            'Resume la caisse du jour',
            'Afficher le menu assistant'
        ])
    };
}

async function getCashReportGuidedAction(req, payload) {
    const result = await getCashReportAction(req, payload);
    return {
        ...result,
        suggestions: buildSuggestions([
            'Etat de caisse du mois',
            'Quels clients ont un reste a payer ?',
            'Afficher le menu assistant'
        ])
    };
}

async function prepareUpdatePaymentAction(req, payload) {
    const match = requireSingleClient(await findClients(req.entrepriseId, payload.query));
    if (match.error || match.multiple) return { reply: match.error || match.reply };

    const client = match.client;
    const contract = getLatestContract(client);
    if (!contract) return { reply: 'Ce client n’a pas de contrat à mettre à jour.' };

    const newPaid = toMoney(payload.montant_paye);
    if (newPaid < 0) return { reply: 'Le montant payé ne peut pas être négatif.' };

    const oldPaid = toMoney(contract.montant_paye);
    const newRemaining = payload.montant_restant !== undefined
        ? toMoney(payload.montant_restant)
        : Math.max(toMoney(contract.montant) - newPaid, 0);

    return {
        reply: [
            `Je peux préparer cette mise à jour pour ${getClientFullName(client)}.`,
            `Police: ${contract.numero_contrat || '-'}`,
            `Ancien payé: ${formatMoney(oldPaid)}`,
            `Nouveau payé: ${formatMoney(newPaid)}`,
            `Mouvement caisse: ${formatMoney(newPaid - oldPaid)}`,
            `Nouveau reste: ${formatMoney(newRemaining)}`,
            'Confirme pour appliquer.'
        ].join('\n'),
        confirmationRequired: true,
        action: {
            type: 'update_payment',
            params: {
                contrat_id: contract.id,
                client_id: client.id,
                montant_paye: newPaid,
                montant_restant: newRemaining
            }
        }
    };
}

async function prepareUpdateClientAction(req, payload) {
    const fields = payload.fields || {};
    const allowedFields = {};
    if (fields.nom !== undefined) allowedFields.nom = cleanText(fields.nom);
    if (fields.telephone !== undefined) allowedFields.telephone = cleanText(fields.telephone);
    if (fields.immatriculation !== undefined) allowedFields.immatriculation = cleanText(fields.immatriculation);

    if (!Object.keys(allowedFields).length) {
        return { reply: 'Dis-moi quelle donnée client modifier: nom, téléphone ou immatriculation.' };
    }

    const match = requireSingleClient(await findClients(req.entrepriseId, payload.query));
    if (match.error || match.multiple) return { reply: match.error || match.reply };

    const client = match.client;
    return {
        reply: [
            `Je peux modifier ${getClientFullName(client)}:`,
            ...Object.entries(allowedFields).map(([key, value]) => `- ${key}: ${value}`),
            'Confirme pour appliquer.'
        ].join('\n'),
        confirmationRequired: true,
        action: {
            type: 'update_client',
            params: {
                client_id: client.id,
                fields: allowedFields
            }
        }
    };
}

async function executePreparedAction(req, action) {
    if (!action || !action.type || !action.params) {
        return { reply: 'Action invalide.' };
    }

    if (action.type === 'update_payment') {
        const { contrat_id, montant_paye, montant_restant } = action.params;
        const { data: existing, error: findError } = await db.supabase
            .from('contrats')
            .select('id, client_id, montant_paye')
            .eq('id', contrat_id)
            .eq('entreprise_id', req.entrepriseId)
            .single();

        if (findError || !existing) return { reply: 'Contrat introuvable.' };

        const oldPaid = toMoney(existing.montant_paye);
        const newPaid = toMoney(montant_paye);
        const movement = toMoney(newPaid - oldPaid);

        const { error } = await db.supabase
            .from('contrats')
            .update({
                montant_paye: newPaid,
                montant_restant: toMoney(montant_restant)
            })
            .eq('id', contrat_id)
            .eq('entreprise_id', req.entrepriseId);

        if (error) throw error;

        if (movement !== 0) {
            await recordPaymentMovement({
                entrepriseId: req.entrepriseId,
                contratId: contrat_id,
                clientId: existing.client_id,
                montant: movement,
                type: movement > 0 ? 'encaissement' : 'correction',
                source: 'assistant_ia',
                note: 'Mise a jour via assistant IA'
            });
        }

        return { reply: `Paiement mis à jour. Mouvement caisse: ${formatMoney(movement)}.` };
    }

    if (action.type === 'update_client') {
        const { client_id, fields } = action.params;
        const clientUpdate = {};
        if (fields.nom !== undefined) clientUpdate.nom = cleanText(fields.nom);
        if (fields.telephone !== undefined) clientUpdate.telephone = cleanText(fields.telephone);

        if (Object.keys(clientUpdate).length) {
            const { error } = await db.supabase
                .from('clients')
                .update(clientUpdate)
                .eq('id', client_id)
                .eq('entreprise_id', req.entrepriseId);
            if (error) throw error;
        }

        if (fields.immatriculation !== undefined) {
            const { data: vehicle, error: vehicleError } = await db.supabase
                .from('vehicules')
                .select('id')
                .eq('client_id', client_id)
                .limit(1)
                .maybeSingle();
            if (vehicleError) throw vehicleError;

            if (vehicle) {
                const { error } = await db.supabase
                    .from('vehicules')
                    .update({ immatriculation: cleanText(fields.immatriculation) })
                    .eq('id', vehicle.id);
                if (error) throw error;
            }
        }

        return { reply: 'Données client mises à jour.' };
    }

    return { reply: 'Action non prise en charge.' };
}

const chat = async (req, res) => {
    try {
        const message = cleanText(req.body.message);
        if (!message) return res.status(400).json({ error: 'Message requis' });

        const intent = await classifyMessage(message);
        const action = normalizeAction(intent.action);

        const handlers = {
            show_menu: showMenuAction,
            search_client: searchClientGuidedAction,
            get_client_info: getClientInfoGuidedAction,
            list_unpaid_clients: listUnpaidClientsGuidedAction,
            get_cash_report: getCashReportGuidedAction,
            prepare_update_payment: prepareUpdatePaymentAction,
            prepare_update_client: prepareUpdateClientAction
        };

        if (!handlers[action]) {
            return res.json(intent.reply
                ? { reply: intent.reply, suggestions: getDefaultSuggestions() }
                : showMenuAction());
        }

        if (!handlers[action]) {
            return res.json({
                reply: intent.reply || 'Je peux chercher un client, consulter ses infos, préparer un paiement, modifier ses données ou afficher la caisse.'
            });
        }

        const result = await handlers[action](req, intent);
        res.json(result);
    } catch (error) {
        console.error('Erreur assistant IA', error.message);
        res.status(500).json({ error: 'Erreur assistant IA' });
    }
};

const execute = async (req, res) => {
    try {
        const result = await executePreparedAction(req, req.body.action);
        res.json(result);
    } catch (error) {
        console.error('Erreur execution assistant IA', error.message);
        res.status(500).json({ error: 'Erreur execution assistant IA' });
    }
};

module.exports = {
    chat,
    execute
};
