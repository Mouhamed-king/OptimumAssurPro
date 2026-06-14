#!/usr/bin/env node
/**
 * Importe les clients/contrats depuis un fichier Production_Global .xlsx
 * vers la base Supabase pour un compte entreprise donné.
 *
 * Usage:
 *   node import-clients.js [fichier.xlsx] [--email oassurpro@gmail.com] [--dry-run]
 */

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const db = require('./database/connection');

const DEFAULT_EMAIL = 'oassurpro@gmail.com';
const PROJECT_ROOT = __dirname;

const COLUMN_ALIASES = {
    numeroPolice: ['NUMERO POLICE', 'NUMERO_POLICE'],
    categorie: ['CATEGORIE'],
    nom: ['NOM-PRENOM Assuré', 'NOM-PRENOM Assure', 'NOM PRENOM Assuré'],
    duree: ['DUREE'],
    dateEffet: ['DATE EFFET', 'DATE_EFFET'],
    dateEcheance: ['DATE ECHEANCE', 'DATE_ECHEANCE'],
    marque: ['MARQUE'],
    modele: ['MODELE'],
    immat: ['IMMAT', 'IMMATRICULATION'],
    energie: ['ENERGIE'],
    puissance: ['PUISSANCE'],
    chargeUtile: ['CHARGE UTILE', 'CHARGE_UTILE'],
    primeNette: ['Prime Nette', 'PRIME NETTE', 'Prime nette'],
};

function parseArgs(argv) {
    const args = { file: null, email: DEFAULT_EMAIL, dryRun: false };

    for (const arg of argv) {
        if (arg === '--dry-run') {
            args.dryRun = true;
        } else if (arg.startsWith('--email=')) {
            args.email = arg.split('=')[1];
        } else if (arg === '--email') {
            continue;
        } else if (!arg.startsWith('--') && !args.file) {
            args.file = arg;
        }
    }

    const emailIndex = argv.indexOf('--email');
    if (emailIndex !== -1 && argv[emailIndex + 1] && !argv[emailIndex + 1].startsWith('--')) {
        args.email = argv[emailIndex + 1];
    }

    return args;
}

function resolveProductionFile(fileArg) {
    if (fileArg) {
        const resolved = path.resolve(fileArg);
        if (!fs.existsSync(resolved)) {
            throw new Error(`Fichier introuvable: ${resolved}`);
        }
        return resolved;
    }

    const matches = fs
        .readdirSync(PROJECT_ROOT)
        .filter((name) => name.startsWith('Production_Global') && name.endsWith('.xlsx') && !name.startsWith('~$'))
        .sort();

    if (matches.length === 0) {
        throw new Error('Aucun fichier Production_Global*.xlsx trouvé à la racine du projet.');
    }
    if (matches.length > 1) {
        throw new Error(
            `Plusieurs fichiers Production_Global trouvés, précisez le chemin:\n${matches.map((m) => `  - ${m}`).join('\n')}`
        );
    }

    return path.join(PROJECT_ROOT, matches[0]);
}

function normalizeHeader(value) {
    return String(value || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toUpperCase();
}

function buildColumnIndex(headers) {
    const index = {};
    const normalizedHeaders = headers.map((h) => normalizeHeader(h));

    for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
        for (const alias of aliases) {
            const idx = normalizedHeaders.indexOf(normalizeHeader(alias));
            if (idx !== -1) {
                index[key] = idx;
                break;
            }
        }
    }

    const required = ['numeroPolice', 'nom', 'dateEffet', 'dateEcheance', 'immat', 'primeNette'];
    const missing = required.filter((key) => index[key] === undefined);
    if (missing.length) {
        throw new Error(`Colonnes Excel manquantes: ${missing.join(', ')}`);
    }

    return index;
}

function parseDate(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
    }

    if (typeof value === 'number') {
        const parsed = XLSX.SSF.parse_date_code(value);
        if (parsed) {
            return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
        }
    }

    const text = String(value).trim();
    const fr = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (fr) {
        return `${fr[3]}-${fr[2].padStart(2, '0')}-${fr[1].padStart(2, '0')}`;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return text;
    }

    const asDate = new Date(text);
    if (!Number.isNaN(asDate.getTime())) {
        return asDate.toISOString().slice(0, 10);
    }

    return null;
}

function parseDureeMois(duree, dateDebut, dateFin) {
    const text = String(duree || '').trim().toLowerCase();
    const moisMatch = text.match(/(\d+)\s*mois/);
    if (moisMatch) {
        return parseInt(moisMatch[1], 10);
    }

    if (text.includes('an')) {
        const anMatch = text.match(/(\d+)/);
        return anMatch ? parseInt(anMatch[1], 10) * 12 : 12;
    }

    if (dateDebut && dateFin) {
        const debut = new Date(dateDebut);
        const fin = new Date(dateFin);
        const diffDays = Math.abs(fin - debut) / (1000 * 60 * 60 * 24);
        return Math.max(1, Math.round(diffDays / 30));
    }

    return 12;
}

function normalizeImmat(value) {
    return String(value || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '');
}

function normalizePolice(value) {
    return String(value || '').trim();
}

function normalizeNom(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function parsePuissance(value) {
    const parsed = parseInt(String(value || '').trim(), 10);
    return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
}

function mapVehicleType(categorie, chargeUtile) {
    const cat = String(categorie || '').toUpperCase();
    const charge = String(chargeUtile || '').trim().toLowerCase();

    if (cat.includes('5')) return 'moto';
    if (charge.includes('break')) return 'break';
    if (charge.includes('sup')) return 'camion';
    if (charge.includes('inf') || charge.includes('3t')) return 'camionnette';
    return 'particulier';
}

function computeStatut(dateFin) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fin = new Date(dateFin);
    fin.setHours(0, 0, 0, 0);
    return fin < today ? 'expire' : 'actif';
}

function readProductionRows(filePath) {
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });

    if (!rows.length) {
        throw new Error('Fichier Excel vide.');
    }

    const columnIndex = buildColumnIndex(rows[0]);
    const parsedRows = [];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.every((cell) => cell === null || String(cell).trim() === '')) {
            continue;
        }

        const numeroPolice = normalizePolice(row[columnIndex.numeroPolice]);
        const nom = String(row[columnIndex.nom] || '').trim();
        const immat = normalizeImmat(row[columnIndex.immat]);
        const dateDebut = parseDate(row[columnIndex.dateEffet]);
        const dateFin = parseDate(row[columnIndex.dateEcheance]);
        const montant = parseFloat(String(row[columnIndex.primeNette] || '').replace(/\s/g, '').replace(',', '.'));

        if (!numeroPolice || !nom || !immat || !dateDebut || !dateFin || Number.isNaN(montant)) {
            parsedRows.push({
                line: i + 1,
                invalid: true,
                reason: 'Champs obligatoires manquants ou invalides',
                numeroPolice,
                nom,
                immat,
            });
            continue;
        }

        parsedRows.push({
            line: i + 1,
            invalid: false,
            numeroPolice,
            nom: normalizeNom(nom),
            immat,
            marque: String(row[columnIndex.marque] || '').trim(),
            modele: String(row[columnIndex.modele] || '').trim(),
            dureeMois: parseDureeMois(
                columnIndex.duree !== undefined ? row[columnIndex.duree] : null,
                dateDebut,
                dateFin
            ),
            dateDebut,
            dateFin,
            montant: Math.floor(montant),
            statut: computeStatut(dateFin),
            telephone: `TEMP-${numeroPolice.replace(/[^a-zA-Z0-9]/g, '')}`,
            categorieVehicule: 'VP/CI',
            typeContrat: 'Responsabilité Civile',
            puissance: columnIndex.puissance !== undefined ? parsePuissance(row[columnIndex.puissance]) : null,
            energie: columnIndex.energie !== undefined ? String(row[columnIndex.energie] || '').trim().toUpperCase() : null,
            typeVehicule: mapVehicleType(
                columnIndex.categorie !== undefined ? row[columnIndex.categorie] : null,
                columnIndex.chargeUtile !== undefined ? row[columnIndex.chargeUtile] : null
            ),
        });
    }

    return parsedRows;
}

async function resolveEntrepriseId(email) {
    const { data, error } = await db.supabase
        .from('entreprises')
        .select('id, nom, email')
        .eq('email', email)
        .maybeSingle();

    if (error) {
        throw error;
    }
    if (!data) {
        throw new Error(`Aucune entreprise trouvée pour l'email: ${email}`);
    }

    return data;
}

async function findContractByPolice(entrepriseId, numeroPolice) {
    const { data, error } = await db.supabase
        .from('contrats')
        .select('id, client_id, vehicule_id, numero_contrat, date_debut, date_fin, duree_mois, montant, statut, montant_paye, montant_restant')
        .eq('entreprise_id', entrepriseId)
        .eq('numero_contrat', numeroPolice)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
}

async function findVehicleByImmat(immat) {
    const { data, error } = await db.supabase
        .from('vehicules')
        .select('id, client_id, marque, modele, immatriculation, clients(id, entreprise_id, nom, telephone)')
        .eq('immatriculation', immat)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
}

async function findClientByNom(entrepriseId, nom) {
    const normalizedNom = normalizeNom(nom);

    const { data, error } = await db.supabase
        .from('clients')
        .select('id, nom, telephone, prenom')
        .eq('entreprise_id', entrepriseId)
        .eq('prenom', '')
        .ilike('nom', normalizedNom)
        .limit(5);

    if (error) {
        throw error;
    }

    if (!data?.length) {
        return null;
    }

    return (
        data.find((client) => normalizeNom(client.nom).toLowerCase() === normalizedNom.toLowerCase()) ||
        data[0]
    );
}

function contractNeedsUpdate(existing, row) {
    return (
        existing.date_debut !== row.dateDebut ||
        existing.date_fin !== row.dateFin ||
        Number(existing.duree_mois) !== row.dureeMois ||
        Number(existing.montant) !== row.montant ||
        existing.statut !== row.statut
    );
}

async function updateExistingContract(existing, row, dryRun) {
    if (!contractNeedsUpdate(existing, row)) {
        return 'ignored';
    }

    if (dryRun) {
        return 'updated';
    }

    const { error } = await db.supabase
        .from('contrats')
        .update({
            date_debut: row.dateDebut,
            date_fin: row.dateFin,
            duree_mois: row.dureeMois,
            montant: row.montant,
            statut: row.statut,
        })
        .eq('id', existing.id);

    if (error) {
        throw error;
    }

    return 'updated';
}

async function updateVehicle(vehiculeId, row, dryRun) {
    if (dryRun) {
        return;
    }

    const { error: vehiculeError } = await db.supabase
        .from('vehicules')
        .update({
            marque: row.marque,
            modele: row.modele,
            puissance: row.puissance,
            energie: row.energie,
            type_vehicule: row.typeVehicule,
        })
        .eq('id', vehiculeId);

    if (vehiculeError) {
        throw vehiculeError;
    }
}

async function createVehicle(clientId, row, dryRun) {
    if (dryRun) {
        return null;
    }

    const existingVehicle = await findVehicleByImmat(row.immat);
    if (existingVehicle) {
        return existingVehicle.id;
    }

    const { data, error } = await db.supabase
        .from('vehicules')
        .insert({
            client_id: clientId,
            marque: row.marque,
            modele: row.modele,
            immatriculation: row.immat,
            puissance: row.puissance,
            energie: row.energie,
            type_vehicule: row.typeVehicule,
        })
        .select('id')
        .single();

    if (error) {
        if (error.code === '23505') {
            const fallbackVehicle = await findVehicleByImmat(row.immat);
            if (fallbackVehicle) {
                return fallbackVehicle.id;
            }
        }
        throw error;
    }

    return data.id;
}

async function createClientVehicleContract(entrepriseId, row, dryRun) {
    if (dryRun) {
        return { clientId: null, vehiculeId: null, contratId: null };
    }

    let clientId;
    const existingClient = await findClientByNom(entrepriseId, row.nom);

    if (existingClient) {
        clientId = existingClient.id;
    } else {
        const { data: newClient, error: clientError } = await db.supabase
            .from('clients')
            .insert({
                entreprise_id: entrepriseId,
                nom: row.nom,
                prenom: '',
                telephone: row.telephone,
            })
            .select('id')
            .single();

        if (clientError) {
            if (clientError.code === '23505') {
                const fallbackClient = await findClientByNom(entrepriseId, row.nom);
                if (!fallbackClient) {
                    throw clientError;
                }
                clientId = fallbackClient.id;
            } else {
                throw clientError;
            }
        } else {
            clientId = newClient.id;
        }
    }

    const vehiculeId = await createVehicle(clientId, row, dryRun);

    const { data: newContrat, error: contratError } = await db.supabase
        .from('contrats')
        .insert({
            client_id: clientId,
            vehicule_id: vehiculeId,
            entreprise_id: entrepriseId,
            numero_contrat: row.numeroPolice,
            type_contrat: row.typeContrat,
            duree_mois: row.dureeMois,
            date_debut: row.dateDebut,
            date_fin: row.dateFin,
            montant: row.montant,
            montant_paye: 0,
            montant_restant: 0,
            statut: row.statut,
            categorie_vehicule: row.categorieVehicule,
        })
        .select('id')
        .single();

    if (contratError) {
        throw contratError;
    }

    return {
        clientId,
        vehiculeId,
        contratId: newContrat.id,
    };
}

async function createContractForExistingClient(entrepriseId, clientId, vehiculeId, row, dryRun) {
    if (dryRun) {
        return null;
    }

    const { data, error } = await db.supabase
        .from('contrats')
        .insert({
            client_id: clientId,
            vehicule_id: vehiculeId,
            entreprise_id: entrepriseId,
            numero_contrat: row.numeroPolice,
            type_contrat: row.typeContrat,
            duree_mois: row.dureeMois,
            date_debut: row.dateDebut,
            date_fin: row.dateFin,
            montant: row.montant,
            montant_paye: 0,
            montant_restant: 0,
            statut: row.statut,
            categorie_vehicule: row.categorieVehicule,
        })
        .select('id')
        .single();

    if (error) {
        throw error;
    }

    return data.id;
}

async function processRow(entrepriseId, row, dryRun) {
    if (row.invalid) {
        return { action: 'error', message: row.reason };
    }

    const existingContract = await findContractByPolice(entrepriseId, row.numeroPolice);

    if (existingContract) {
        const action = await updateExistingContract(existingContract, row, dryRun);
        await updateVehicle(existingContract.vehicule_id, row, dryRun);
        return {
            action,
            message:
                action === 'ignored'
                    ? 'Contrat déjà à jour'
                    : `Contrat ${row.numeroPolice} mis à jour (${row.dateDebut} → ${row.dateFin})`,
        };
    }

    const existingVehicle = await findVehicleByImmat(row.immat);

    if (existingVehicle) {
        const client = existingVehicle.clients;
        if (!client || client.entreprise_id !== entrepriseId) {
            return {
                action: 'error',
                message: `Immatriculation ${row.immat} déjà utilisée par une autre entreprise`,
            };
        }

        await updateVehicle(existingVehicle.id, row, dryRun);
        await createContractForExistingClient(entrepriseId, client.id, existingVehicle.id, row, dryRun);

        return {
            action: 'created',
            message: `Nouveau contrat ${row.numeroPolice} pour client existant (${row.nom})`,
        };
    }

    const existingClientByNom = await findClientByNom(entrepriseId, row.nom);
    await createClientVehicleContract(entrepriseId, row, dryRun);

    return {
        action: 'created',
        message: existingClientByNom
            ? `Nouveau véhicule/contrat ${row.numeroPolice} pour client existant (${row.nom})`
            : `Nouveau client ${row.nom} / contrat ${row.numeroPolice}`,
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const filePath = resolveProductionFile(args.file);

    console.log('Import Production_Global → Supabase');
    console.log(`Fichier    : ${filePath}`);
    console.log(`Entreprise : ${args.email}`);
    if (args.dryRun) {
        console.log('Mode       : dry-run (aucune écriture)');
    }

    await db.connect();
    const entreprise = await resolveEntrepriseId(args.email);
    console.log(`Compte     : ${entreprise.nom} (${entreprise.id})\n`);

    const rows = readProductionRows(filePath);
    const stats = { created: 0, updated: 0, ignored: 0, errors: 0 };

    for (const row of rows) {
        try {
            const result = await processRow(entreprise.id, row, args.dryRun);
            stats[result.action === 'error' ? 'errors' : result.action] += 1;

            const prefix =
                result.action === 'created'
                    ? '+'
                    : result.action === 'updated'
                      ? '~'
                      : result.action === 'ignored'
                        ? '='
                        : '!';

            const label = row.invalid ? `Ligne ${row.line}` : `Ligne ${row.line} (${row.nom})`;
            console.log(`${prefix} ${label}: ${result.message}`);
        } catch (error) {
            stats.errors += 1;
            const label = row.invalid ? `Ligne ${row.line}` : `Ligne ${row.line} (${row.nom || '?'})`;
            console.error(`! ${label}: ${error.message}`);
        }
    }

    console.log('\n--- Résumé ---');
    console.log(`Créés     : ${stats.created}`);
    console.log(`Mis à jour: ${stats.updated}`);
    console.log(`Ignorés   : ${stats.ignored}`);
    console.log(`Erreurs   : ${stats.errors}`);

    if (args.dryRun) {
        console.log('\nDry-run terminé, aucune modification en base.');
    }

    process.exit(stats.errors > 0 ? 1 : 0);
}

main().catch((error) => {
    console.error('Erreur fatale:', error.message);
    process.exit(1);
});
