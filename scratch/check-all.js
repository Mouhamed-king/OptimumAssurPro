require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkAllEntreprises() {
  try {
    const { data: entreprises } = await supabase.from('entreprises').select('id, email, nom');
    console.log("Entreprises en base:");
    for (const ent of entreprises) {
        const { count: clientCount } = await supabase.from('clients').select('*', { count: 'exact', head: true }).eq('entreprise_id', ent.id);
        const { count: contratCount } = await supabase.from('contrats').select('*', { count: 'exact', head: true }).eq('entreprise_id', ent.id);
        console.log(`- ${ent.email} (${ent.id}): ${clientCount} clients, ${contratCount} contrats`);
        
        // Break down by category
        const { count: vpCount } = await supabase.from('contrats').select('*', { count: 'exact', head: true }).eq('entreprise_id', ent.id).eq('categorie_vehicule', 'VP/CI');
        const { count: tpvCount } = await supabase.from('contrats').select('*', { count: 'exact', head: true }).eq('entreprise_id', ent.id).eq('categorie_vehicule', 'TPV');
        console.log(`  - VP/CI: ${vpCount}, TPV: ${tpvCount}`);
    }
  } catch (err) {
    console.error(err);
  }
}

checkAllEntreprises();
