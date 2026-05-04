require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Veuillez configurer SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function parseDate(dateStr) {
  if (!dateStr) return null;
  if (typeof dateStr === 'number') {
      // Excel date
      const date = new Date(Math.round((dateStr - 25569)*86400*1000));
      return date.toISOString().split('T')[0];
  }
  if (dateStr === '14/15/2026') return '2026-05-14'; // Typo in excel
  const parts = String(dateStr).split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
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
    return new Date(dateFin) < new Date() ? 'expiré' : 'actif';
}

async function importData() {
  try {
    console.log("Lecture du fichier kkk.xlsx...");
    const wb = xlsx.readFile('kkk.xlsx');
    const sheetName = wb.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(wb.Sheets[sheetName]);
    
    console.log(`${data.length} lignes trouvées.`);

    // Obtenir une entreprise ID (spécifique à oassurpro@gmail.com)
    const { data: entreprises, error: entError } = await supabase.from('entreprises').select('id, email').eq('email', 'oassurpro@gmail.com').limit(1);
    
    let entrepriseId;
    if (entError || !entreprises || entreprises.length === 0) {
        console.warn("L'entreprise oassurpro@gmail.com n'a pas été trouvée, recherche de la première entreprise disponible...");
        const { data: anyEnt } = await supabase.from('entreprises').select('id').limit(1);
        if (anyEnt && anyEnt.length > 0) {
            entrepriseId = anyEnt[0].id;
        } else {
            throw new Error("Aucune entreprise trouvée dans la base de données.");
        }
    } else {
        entrepriseId = entreprises[0].id;
    }
    
    console.log(`Utilisation de l'entreprise_id: ${entrepriseId}`);

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        console.log(`\nImportation de la ligne ${i+1}: ${row['NOM']}`);
        
        // 1. Client
        const nomComplet = row['NOM'] || 'Inconnu';
        let prenom = '';
        let nom = nomComplet;
        if (nomComplet.startsWith('M. ') || nomComplet.startsWith('MME ')) {
            const parts = nomComplet.split(' ');
            prenom = parts[0] + ' ' + (parts[1] || '');
            nom = parts.slice(2).join(' ') || nomComplet;
        }

        let phone = row['N° TEL'] ? String(row['N° TEL']).replace(/\s/g, '') : '';
        if (phone && !phone.startsWith('+')) {
            // Assume format local if no +
            // On peut laisser tel quel ou ajouter indicatif
        }

        let clientId;
        const { data: existingClient } = await supabase.from('clients')
            .select('id').eq('nom', nom).eq('prenom', prenom).eq('entreprise_id', entrepriseId).maybeSingle();
            
        if (existingClient) {
            clientId = existingClient.id;
            console.log(`Client ${nomComplet} existe déjà.`);
        } else {
            const { data: client, error: clientErr } = await supabase.from('clients').insert({
                nom: nom,
                prenom: prenom,
                telephone: phone,
                entreprise_id: entrepriseId
            }).select().single();
            if (clientErr) throw new Error("Erreur Client: " + clientErr.message);
            clientId = client.id;
        }
        
        // 2. Vehicule
        const marque = row['MARQUE'] || 'Non renseigné';
        const modele = row['MODELE'] || 'Non renseigné';
        const immat = row['IMMAT'] || 'Non renseigné';
        
        let vehiculeId;
        const { data: existingVehicule } = await supabase.from('vehicules')
            .select('id').eq('immatriculation', immat).maybeSingle();
            
        if (existingVehicule) {
            vehiculeId = existingVehicule.id;
            console.log(`Véhicule ${immat} existe déjà.`);
        } else {
            const { data: vehicule, error: vehErr } = await supabase.from('vehicules').insert({
                marque: marque,
                modele: modele,
                immatriculation: immat,
                client_id: clientId
            }).select().single();
            if (vehErr) throw new Error("Erreur Vehicule: " + vehErr.message);
            vehiculeId = vehicule.id;
        }

        // 3. Contrat
        const dateEffet = parseDate(row['DATE EFFET']);
        const dateEcheance = parseDate(row['DATE ECHEANCE']);
        const primeNette = parseFloat(row['Prime Nette']) || 0;
        
        const calc = calculateContractValues(primeNette);
        const numeroContrat = `C-${Date.now().toString().slice(-6)}-${Math.floor(Math.random()*1000)}`;
        
        let contratId;
        const { data: existingContrat } = await supabase.from('contrats')
            .select('id').eq('client_id', clientId).eq('vehicule_id', vehiculeId).eq('date_debut', dateEffet).maybeSingle();
            
        if (existingContrat) {
            contratId = existingContrat.id;
            console.log(`Contrat existe déjà.`);
        } else {
            const paye = parseFloat(row['payé']) || 0;
            const montantRestant = calc.primeTTC - paye;
            const { data: contrat, error: contratErr } = await supabase.from('contrats').insert({
                numero_contrat: numeroContrat,
                date_debut: dateEffet,
                date_fin: dateEcheance,
                montant: primeNette,
                montant_paye: paye,
                montant_restant: montantRestant > 0 ? montantRestant : 0,
                statut: getStatut(dateEcheance),
                vehicule_id: vehiculeId,
                client_id: clientId,
                entreprise_id: entrepriseId,
                type_contrat: 'Annuel',
                duree_mois: 12
            }).select().single();
            if (contratErr) throw new Error("Erreur Contrat: " + contratErr.message);
            contratId = contrat.id;
        }

        // 4. Paiement

        
        console.log(`✅ ${nomComplet} importé avec succès!`);
    }
    
    console.log("\n🎉 Importation terminée avec succès !");
  } catch (err) {
    console.error("\n❌ ERREUR LORS DE L'IMPORTATION:", err.message);
  }
}

importData();
