require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Veuillez configurer SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteVPCIData() {
  try {
    console.log("Démarrage de la suppression des clients VP/CI pour oassurpro@gmail.com...");

    // 1. Trouver l'entreprise
    const { data: entreprise, error: entError } = await supabase
      .from('entreprises')
      .select('id')
      .eq('email', 'oassurpro@gmail.com')
      .single();

    if (entError || !entreprise) {
      console.error("Entreprise oassurpro@gmail.com non trouvée.");
      return;
    }

    const entrepriseId = entreprise.id;
    console.log(`Entreprise ID: ${entrepriseId}`);

    // 2. Identifier les clients liés à des contrats VP/CI
    const { data: contracts, error: contractsError } = await supabase
      .from('contrats')
      .select('client_id')
      .eq('entreprise_id', entrepriseId)
      .eq('categorie_vehicule', 'VP/CI');

    if (contractsError) throw contractsError;

    if (!contracts || contracts.length === 0) {
      console.log("Aucun contrat VP/CI trouvé pour cette entreprise.");
      return;
    }

    const clientIds = [...new Set(contracts.map(c => c.client_id))];
    console.log(`${clientIds.length} clients à supprimer.`);

    // 3. Supprimer les clients (le CASCADE s'occupe des contrats et véhicules)
    // Note: Supabase/PostgreSQL 'in' filter is limited by URL length if using many IDs, 
    // but 118 IDs should be fine. For larger sets, we could do batches.
    
    const { error: deleteError } = await supabase
      .from('clients')
      .delete()
      .in('id', clientIds);

    if (deleteError) throw deleteError;

    console.log(`✅ Succès: ${clientIds.length} clients et leurs données associées (contrats, véhicules) ont été supprimés.`);

  } catch (err) {
    console.error("❌ Erreur lors de la suppression:", err.message);
  }
}

deleteVPCIData();
