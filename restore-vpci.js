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

const EXCLUDED_PHONES = ['770000000', '777098468', '774297554'];

function parseDate(dateStr) {
  if (!dateStr) return null;
  if (typeof dateStr === 'number') {
      const date = new Date(Math.round((dateStr - 25569)*86400*1000));
      return date.toISOString().split('T')[0];
  }
  if (dateStr === '14/15/2026') return '2026-05-14';
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

async function restoreData() {
  try {
    console.log("Lecture du fichier kkk.xlsx pour restauration...");
    const wb = xlsx.readFile('kkk.xlsx');
    const sheetName = wb.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(wb.Sheets[sheetName]);
    
    console.log(`${data.length} lignes trouvées au total.`);

    // Obtenir l'entreprise ID pour oassurpro@gmail.com
    const { data: entreprise, error: entError } = await supabase
      .from('entreprises')
      .select('id')
      .eq('email', 'oassurpro@gmail.com')
      .single();

    if (entError || !entreprise) {
        throw new Error("L'entreprise oassurpro@gmail.com n'a pas été trouvée.");
    }
    const entrepriseId = entreprise.id;
    
    let countRestored = 0;
    let countExcluded = 0;

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        let phone = row['N° TEL'] ? String(row['N° TEL']).replace(/\s/g, '') : '';
        
        // Vérifier si le numéro est dans la liste d'exclusion
        if (EXCLUDED_PHONES.includes(phone)) {
            countExcluded++;
            continue;
        }

        // 1. Client
        const nomComplet = row['NOM'] || 'Inconnu';
        let prenom = '';
        let nom = nomComplet;
        if (nomComplet.startsWith('M. ') || nomComplet.startsWith('MME ')) {
            const parts = nomComplet.split(' ');
            prenom = parts[0] + ' ' + (parts[1] || '');
            nom = parts.slice(2).join(' ') || nomComplet;
        }

        let clientId;
        // On cherche si le client existe déjà (on ne veut pas créer de doublons s'il reste des gens)
        const { data: existingClient } = await supabase.from('clients')
            .select('id').eq('nom', nom).eq('prenom', prenom).eq('entreprise_id', entrepriseId).maybeSingle();
            
        if (existingClient) {
            clientId = existingClient.id;
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
        const immat = row['IMMAT'] || 'Non renseigné';
        let vehiculeId;
        const { data: existingVehicule } = await supabase.from('vehicules')
            .select('id').eq('immatriculation', immat).maybeSingle();
            
        if (existingVehicule) {
            vehiculeId = existingVehicule.id;
        } else {
            const { data: vehicule, error: vehErr } = await supabase.from('vehicules').insert({
                marque: row['MARQUE'] || 'Non renseigné',
                modele: row['MODELE'] || 'Non renseigné',
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
        
        const paye = parseFloat(row['payé']) || 0;
        const montantRestant = calc.primeTTC - paye;

        const { error: contratErr } = await supabase.from('contrats').insert({
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
            duree_mois: 12,
            categorie_vehicule: 'VP/CI'
        });
        
        if (contratErr) throw new Error("Erreur Contrat: " + contratErr.message);
        
        countRestored++;
        if (countRestored % 10 === 0) console.log(`${countRestored} clients restaurés...`);
    }
    
    console.log(`\n✅ Restauration terminée !`);
    console.log(`- Clients restaurés : ${countRestored}`);
    console.log(`- Clients exclus (doublons/tests) : ${countExcluded}`);
  } catch (err) {
    console.error("\n❌ ERREUR LORS DE LA RESTAURATION:", err.message);
  }
}

restoreData();
