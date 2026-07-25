#!/usr/bin/env node

require('dotenv').config();

const { spawnSync } = require('child_process');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const DEFAULT_EMAIL = 'oassurpro@gmail.com';
const DEFAULT_FILE = path.join(
    process.cwd(),
    'bordereau',
    'prod',
    '1Production_Global  du 2026-06-01 au 2026-06-30.xlsx'
);

function getArgValue(name, fallback) {
    const prefix = `${name}=`;
    const arg = process.argv.slice(2).find(value => value.startsWith(prefix));
    return arg ? arg.slice(prefix.length) : fallback;
}

function normalizeText(value) {
    return value === null || value === undefined ? '' : String(value).trim();
}

function normalizeKey(value) {
    return normalizeText(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ');
}

function parseMoney(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return Math.round(value * 100) / 100;
    const cleaned = String(value).replace(/\s/g, '').replace(',', '.');
    const amount = Number(cleaned);
    return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

function parseDurationMonths(value, startDate, endDate) {
    const text = normalizeKey(value);
    const monthMatch = text.match(/(\d+)\s*MOIS/);
    if (monthMatch) return Number(monthMatch[1]);
    if (text.includes('AN')) return 12;

    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
            return Math.max(1, Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24 * 30)));
        }
    }

    return 12;
}

function contractStatus(endDate) {
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return end < today ? 'expire' : 'actif';
}

function categoryFromRow(row) {
    const charge = normalizeKey(row.charge_utile);
    return charge ? 'TPV' : 'VP/CI';
}

function vehicleTypeFromRow(row) {
    const charge = normalizeKey(row.charge_utile);
    if (charge.includes('SUP') || charge.includes('TPC')) return 'camion';
    if (charge.includes('BREAK')) return 'break';
    return 'particulier';
}

function schemaMissingColumn(error) {
    if (!error || error.code !== 'PGRST204') return null;
    const match = String(error.message || '').match(/'([^']+)'\s+column/i);
    return match ? match[1] : null;
}

async function runWithSchemaFallback(payload, operation) {
    const safePayload = { ...payload };

    while (true) {
        const result = await operation(safePayload);
        const missingColumn = schemaMissingColumn(result.error);
        if (!missingColumn || !Object.prototype.hasOwnProperty.call(safePayload, missingColumn)) {
            return result;
        }

        delete safePayload[missingColumn];
    }
}

function readWorkbook(filePath) {
    const python = String.raw`
import json
import sys
from datetime import datetime, date
from pathlib import Path

import openpyxl

path = Path(sys.argv[1])
wb = openpyxl.load_workbook(path, data_only=True)
ws = wb.active
headers = [ws.cell(row=1, column=col).value for col in range(1, ws.max_column + 1)]

def norm(value):
    return "" if value is None else " ".join(str(value).strip().upper().split())

def first_col(name):
    target = norm(name)
    for index, header in enumerate(headers, start=1):
        if norm(header) == target:
            return index
    return None

def value(row, name):
    col = first_col(name)
    return ws.cell(row=row, column=col).value if col else None

def iso_date(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = str(value).strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            pass
    return text

rows = []
for row_idx in range(2, ws.max_row + 1):
    numero = value(row_idx, "NUMERO POLICE")
    nom = value(row_idx, "NOM-PRENOM Assuré")
    if not numero and not nom:
        continue
    rows.append({
        "numero_police": None if numero is None else str(numero).strip(),
        "nom": None if nom is None else str(nom).strip(),
        "duree": value(row_idx, "DUREE"),
        "date_debut": iso_date(value(row_idx, "DATE EFFET")),
        "date_fin": iso_date(value(row_idx, "DATE ECHEANCE")),
        "marque": value(row_idx, "MARQUE"),
        "modele": value(row_idx, "MODELE"),
        "immatriculation": value(row_idx, "IMMAT"),
        "energie": value(row_idx, "ENERGIE"),
        "puissance": value(row_idx, "PUISSANCE"),
        "charge_utile": value(row_idx, "CHARGE UTILE"),
        "prime_nette": value(row_idx, "Prime Nette"),
    })

wb.close()
print(json.dumps(rows, ensure_ascii=False, default=str))
`;

    const result = spawnSync('python', ['-c', python, filePath], {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024
    });

    if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || 'Lecture Excel impossible');
    }

    return JSON.parse(result.stdout);
}

async function findEntreprise(supabase, email) {
    const { data, error } = await supabase
        .from('entreprises')
        .select('id,email,nom')
        .eq('email', email)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error(`Entreprise introuvable pour ${email}`);
    return data;
}

async function findOrCreateClient(supabase, entrepriseId, row, dryRun) {
    const name = normalizeText(row.nom) || 'Client';
    const { data: existing, error } = await supabase
        .from('clients')
        .select('id')
        .eq('entreprise_id', entrepriseId)
        .eq('nom', name)
        .order('created_at', { ascending: true })
        .limit(1);

    if (error) throw error;
    if (existing && existing[0]) return { id: existing[0].id, created: false };
    if (dryRun) return { id: `dry-client-${name}`, created: true };

    const { data, error: insertError } = await runWithSchemaFallback(
        {
            entreprise_id: entrepriseId,
            nom: name,
            prenom: '',
            telephone: 'Non renseigne'
        },
        payload => supabase
            .from('clients')
            .insert(payload)
            .select('id')
            .single()
    );

    if (insertError) throw insertError;
    return { id: data.id, created: true };
}

async function findOrCreateVehicle(supabase, clientId, row, dryRun) {
    const immatriculation = normalizeText(row.immatriculation) || 'Non renseigne';
    const { data: existing, error } = await supabase
        .from('vehicules')
        .select('id, client_id')
        .eq('immatriculation', immatriculation)
        .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    if (existing) {
        if (!dryRun) {
            const { error: updateError } = await runWithSchemaFallback(
                {
                    marque: normalizeText(row.marque) || 'Non renseigne',
                    modele: normalizeText(row.modele) || 'Non renseigne',
                    puissance: row.puissance === null || row.puissance === undefined ? null : Number(row.puissance),
                    energie: normalizeText(row.energie) || null,
                    type_vehicule: vehicleTypeFromRow(row)
                },
                payload => supabase.from('vehicules').update(payload).eq('id', existing.id)
            );
            if (updateError) throw updateError;
        }

        return { id: existing.id, created: false };
    }

    if (dryRun) return { id: `dry-vehicle-${immatriculation}`, created: true };

    const { data, error: insertError } = await runWithSchemaFallback(
        {
            client_id: clientId,
            immatriculation,
            marque: normalizeText(row.marque) || 'Non renseigne',
            modele: normalizeText(row.modele) || 'Non renseigne',
            puissance: row.puissance === null || row.puissance === undefined ? null : Number(row.puissance),
            energie: normalizeText(row.energie) || null,
            type_vehicule: vehicleTypeFromRow(row)
        },
        payload => supabase
            .from('vehicules')
            .insert(payload)
            .select('id')
            .single()
    );

    if (insertError) throw insertError;
    return { id: data.id, created: true };
}

async function upsertContract(supabase, entrepriseId, clientId, vehicleId, row, dryRun) {
    const numero = normalizeText(row.numero_police);
    const amount = parseMoney(row.prime_nette);
    const duration = parseDurationMonths(row.duree, row.date_debut, row.date_fin);
    const payload = {
        client_id: clientId,
        vehicule_id: vehicleId,
        entreprise_id: entrepriseId,
        numero_contrat: numero,
        type_contrat: 'AC',
        duree_mois: duration,
        date_debut: row.date_debut,
        date_fin: row.date_fin,
        montant: amount,
        montant_paye: amount,
        montant_restant: 0,
        statut: contractStatus(row.date_fin),
        categorie_vehicule: categoryFromRow(row)
    };

    const { data: existing, error } = await supabase
        .from('contrats')
        .select('id,montant_paye')
        .eq('numero_contrat', numero)
        .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    if (dryRun) {
        return {
            id: existing ? existing.id : `dry-contract-${numero}`,
            created: !existing,
            paymentDelta: existing ? amount - parseMoney(existing.montant_paye) : amount
        };
    }

    if (existing) {
        const previousPaid = parseMoney(existing.montant_paye);
        const { error: updateError } = await runWithSchemaFallback(
            payload,
            safePayload => supabase.from('contrats').update(safePayload).eq('id', existing.id)
        );
        if (updateError) throw updateError;
        return { id: existing.id, created: false, paymentDelta: amount - previousPaid };
    }

    const { data, error: insertError } = await runWithSchemaFallback(
        payload,
        safePayload => supabase
            .from('contrats')
            .insert(safePayload)
            .select('id')
            .single()
    );

    if (insertError) throw insertError;
    return { id: data.id, created: true, paymentDelta: amount };
}

async function recordPayment(supabase, entrepriseId, clientId, contractId, amount, dryRun) {
    const cleanAmount = parseMoney(amount);
    if (!cleanAmount) return { skipped: true };
    if (dryRun) return { skipped: false };

    const { error } = await supabase
        .from('paiements')
        .insert({
            entreprise_id: entrepriseId,
            contrat_id: contractId,
            client_id: clientId,
            montant: cleanAmount,
            type: cleanAmount > 0 ? 'encaissement' : 'correction',
            source: 'import_production',
            note: 'Import Production_Global'
        });

    if (error) {
        const message = `${error.message || ''} ${error.details || ''}`.toLowerCase();
        if (['42p01', 'pgrst200', 'pgrst204', 'pgrst205'].includes(error.code) || message.includes('paiements')) {
            return { skipped: true, missingTable: true };
        }
        throw error;
    }

    return { skipped: false };
}

function isImportableRow(row) {
    const numero = normalizeKey(row.numero_police);
    return Boolean(
        numero &&
        numero !== 'ANNULATION' &&
        normalizeText(row.nom) &&
        normalizeText(row.immatriculation) &&
        normalizeText(row.date_debut) &&
        normalizeText(row.date_fin) &&
        parseMoney(row.prime_nette) > 0
    );
}

async function main() {
    const email = getArgValue('--email', DEFAULT_EMAIL);
    const filePath = path.resolve(getArgValue('--file', DEFAULT_FILE));
    const dryRun = process.argv.includes('--dry-run');

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Variables SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquantes');
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    const entreprise = await findEntreprise(supabase, email);
    const rows = readWorkbook(filePath);
    const stats = {
        file: filePath,
        email,
        entreprise_id: entreprise.id,
        read: rows.length,
        skipped: 0,
        clients_created: 0,
        vehicles_created: 0,
        contracts_created: 0,
        contracts_updated: 0,
        payments_recorded: 0,
        payments_skipped: 0,
        dry_run: dryRun
    };

    for (const row of rows) {
        if (!isImportableRow(row)) {
            stats.skipped += 1;
            continue;
        }

        const client = await findOrCreateClient(supabase, entreprise.id, row, dryRun);
        if (client.created) stats.clients_created += 1;

        const vehicle = await findOrCreateVehicle(supabase, client.id, row, dryRun);
        if (vehicle.created) stats.vehicles_created += 1;

        const contract = await upsertContract(supabase, entreprise.id, client.id, vehicle.id, row, dryRun);
        if (contract.created) {
            stats.contracts_created += 1;
        } else {
            stats.contracts_updated += 1;
        }

        const payment = await recordPayment(
            supabase,
            entreprise.id,
            client.id,
            contract.id,
            contract.paymentDelta,
            dryRun
        );
        if (payment.skipped) {
            stats.payments_skipped += 1;
        } else {
            stats.payments_recorded += 1;
        }
    }

    console.log(JSON.stringify(stats, null, 2));
}

main().catch(error => {
    console.error(error.message || error);
    process.exit(1);
});
