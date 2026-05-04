require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const FILENAME = 'Production_Global  du 2025-01-01 au 2026-05-02.xlsx';
const ENTREPRISE_EMAIL = 'oassurpro@gmail.com';
const CATEGORIE = 'VP/CI';

function parseDate(dateStr) {
    if (!dateStr) return null;
    if (typeof dateStr === 'number') {
        const date = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
        return date.toISOString().split('T')[0];
    }
    const parts = String(dateStr).split('/');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
}

function calculateContractValues(primeNette) {
    const frais = 3000;
    const fga = Math.round((primeNette * 0.025) * 100) / 100;
    const taxes = Math.round(((primeNette + frais) * 0.14) * 100) / 100;
    const primeTTC = Math.round((primeNette + frais + taxes + fga) * 100) / 100;
    const commission = Math.round((primeNette * 0.25) * 100) / 100;
    const netAVerser = Math.round((primeTTC - frais - commission) * 100) / 100;
    return { frais, taxes, fga, primeTTC, commission, netAVerser };
}

function getStatut(dateFin) {
    if (!dateFin) return 'actif';
    return new Date(dateFin) < new Date() ? 'expire' : 'actif';
}

function countInfo(row) {
    let score = 0;
    if (row.NOM) score++;
    if (row.TEL) score++;
    if (row.MARQUE && row.MARQUE !== 'Non renseigné') score++;
    if (row.MODELE && row.MODELE !== 'Non renseigné') score++;
    if (row.IMMAT && row.IMMAT !== 'Non renseigné') score++;
    if (row['Prime Nette']) score++;
    return score;
}

async function importGlobal() {
    try {
        console.log(`Lecture du fichier ${FILENAME}...`);
        const wb = xlsx.readFile(FILENAME);
        const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        console.log(`${data.length} lignes trouvées.`);

        const { data: entreprise } = await supabase.from('entreprises').select('id').eq('email', ENTREPRISE_EMAIL).single();
        if (!entreprise) throw new Error(`Entreprise ${ENTREPRISE_EMAIL} non trouvée.`);
        const entrepriseId = entreprise.id;

        // 1. Déduplication locale dans le fichier Excel
        const uniqueRows = new Map();
        for (const row of data) {
            const dateEffet = parseDate(row['DATE EFFET']);
            const immat = String(row['IMMAT'] || '').trim().toUpperCase();
            const nom = String(row['NOM'] || '').trim();
            const key = `${nom}|${immat}|${dateEffet}`;

            if (uniqueRows.has(key)) {
                if (countInfo(row) > countInfo(uniqueRows.get(key))) {
                    uniqueRows.set(key, row);
                }
            } else {
                uniqueRows.set(key, row);
            }
        }
        const filteredData = Array.from(uniqueRows.values());
        console.log(`${filteredData.length} lignes après déduplication locale.`);

        for (let i = 0; i < filteredData.length; i++) {
            const row = filteredData[i];
            const nomComplet = String(row['NOM'] || 'Inconnu').trim();
            let phone = row['TEL'] ? String(row['TEL']).replace(/\s/g, '') : '';
            const immat = String(row['IMMAT'] || 'NON_RENSEIGNE').trim().toUpperCase();
            const dateEffet = parseDate(row['DATE EFFET']);
            const dateEcheance = parseDate(row['DATE ECHEANCE']);
            
            console.log(`[${i+1}/${filteredData.length}] Traitement: ${nomComplet} (${immat})`);

            // 1. Gérer le Client
            let clientId;
            const { data: existingClient } = await supabase.from('clients')
                .select('id, telephone').eq('nom', nomComplet).eq('entreprise_id', entrepriseId).maybeSingle();

            if (existingClient) {
                clientId = existingClient.id;
                // Si on a plus d'info (un numéro de tel alors qu'il n'y en avait pas), on met à jour
                if (!existingClient.telephone && phone) {
                    await supabase.from('clients').update({ telephone: phone }).eq('id', clientId);
                    console.log(`   - Client mis à jour avec le téléphone: ${phone}`);
                }
            } else {
                const { data: client, error } = await supabase.from('clients').insert({
                    nom: nomComplet,
                    prenom: '',
                    telephone: phone,
                    entreprise_id: entrepriseId
                }).select().single();
                if (error) throw error;
                clientId = client.id;
                console.log(`   - Nouveau client créé.`);
            }

            // 2. Gérer le Véhicule
            let vehiculeId;
            const { data: existingVehicule } = await supabase.from('vehicules')
                .select('id').eq('immatriculation', immat).maybeSingle();

            if (existingVehicule) {
                vehiculeId = existingVehicule.id;
                // Mise à jour de la marque/modèle si vides
                await supabase.from('vehicules').update({
                    marque: row['MARQUE'] || 'Non renseigné',
                    modele: row['MODELE'] || 'Non renseigné'
                }).eq('id', vehiculeId);
            } else {
                const { data: vehicule, error } = await supabase.from('vehicules').insert({
                    marque: row['MARQUE'] || 'Non renseigné',
                    modele: row['MODELE'] || 'Non renseigné',
                    immatriculation: immat,
                    client_id: clientId
                }).select().single();
                if (error) throw error;
                vehiculeId = vehicule.id;
                console.log(`   - Nouveau véhicule créé.`);
            }

            // 3. Gérer le Contrat (Renouvellement ou nouveau)
            const primeNette = parseFloat(row['Prime Nette']) || 0;
            const paye = parseFloat(row['Payé']) || 0;
            const calc = calculateContractValues(primeNette);
            const numeroContrat = row['N°'] ? `P-${row['N°']}` : `C-${Date.now().toString().slice(-6)}`;
            const montantRestant = calc.primeTTC - paye;

            // Vérifier si ce contrat exact existe déjà (même client, véhicule et date début)
            const { data: existingContrat } = await supabase.from('contrats')
                .select('id, statut').eq('client_id', clientId).eq('vehicule_id', vehiculeId).eq('date_debut', dateEffet).maybeSingle();

            if (existingContrat) {
                console.log(`   - Contrat existe déjà, mise à jour du statut.`);
                await supabase.from('contrats').update({
                    statut: getStatut(dateEcheance),
                    montant_paye: paye,
                    montant_restant: montantRestant > 0 ? montantRestant : 0
                }).eq('id', existingContrat.id);
            } else {
                // Vérifier s'il y a un contrat précédent (Renouvellement)
                const { data: prevContrat } = await supabase.from('contrats')
                    .select('id').eq('client_id', clientId).eq('vehicule_id', vehiculeId).lt('date_debut', dateEffet).maybeSingle();

                const statut = getStatut(dateEcheance);
                
                await supabase.from('contrats').insert({
                    numero_contrat: numeroContrat,
                    date_debut: dateEffet,
                    date_fin: dateEcheance,
                    montant: primeNette,
                    montant_paye: paye,
                    montant_restant: montantRestant > 0 ? montantRestant : 0,
                    statut: statut,
                    vehicule_id: vehiculeId,
                    client_id: clientId,
                    entreprise_id: entrepriseId,
                    type_contrat: 'Annuel',
                    duree_mois: 12,
                    categorie_vehicule: CATEGORIE
                });

                if (prevContrat) {
                    await supabase.from('contrats').update({ statut: 'renouvele' }).eq('id', prevContrat.id);
                    console.log(`   - Contrat précédent marqué comme renouvelé.`);
                }
                console.log(`   - Nouveau contrat créé (${statut}).`);
            }
        }

        console.log(`\n🎉 Importation globale terminée avec succès !`);
    } catch (err) {
        console.error(`\n❌ ERREUR:`, err.message);
    }
}

importGlobal();
