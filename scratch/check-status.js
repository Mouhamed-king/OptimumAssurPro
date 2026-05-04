require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkStatus() {
  try {
    const { data: entreprise } = await supabase.from('entreprises').select('id').eq('email', 'oassurpro@gmail.com').single();
    if (!entreprise) {
        console.log("Entreprise non trouvée.");
        return;
    }
    const entrepriseId = entreprise.id;

    const { count: vpCount } = await supabase.from('contrats').select('*', { count: 'exact', head: true }).eq('entreprise_id', entrepriseId).eq('categorie_vehicule', 'VP/CI');
    const { count: tpvCount } = await supabase.from('contrats').select('*', { count: 'exact', head: true }).eq('entreprise_id', entrepriseId).eq('categorie_vehicule', 'TPV');
    const { count: clientCount } = await supabase.from('clients').select('*', { count: 'exact', head: true }).eq('entreprise_id', entrepriseId);

    console.log(`Entreprise: oassurpro@gmail.com (${entrepriseId})`);
    console.log(`Clients restants: ${clientCount}`);
    console.log(`Contrats VP/CI restants: ${vpCount}`);
    console.log(`Contrats TPV restants: ${tpvCount}`);
    
    // Check all categories in contrats
    const { data: categories } = await supabase.from('contrats').select('categorie_vehicule').eq('entreprise_id', entrepriseId);
    const uniqueCats = [...new Set(categories?.map(c => c.categorie_vehicule))];
    console.log(`Catégories présentes: ${uniqueCats.join(', ')}`);

  } catch (err) {
    console.error(err);
  }
}

checkStatus();
