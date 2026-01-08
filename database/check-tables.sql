-- ============================================
-- SCRIPT DE VÉRIFICATION DES TABLES
-- ============================================
-- Exécutez ce script pour voir quelles tables existent
-- ============================================

-- Vérifier les tables existantes
SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('entreprises', 'clients', 'vehicules', 'contrats', 'notifications') 
        THEN '✅ Existe' 
        ELSE '❌ Manquante' 
    END as statut
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('entreprises', 'clients', 'vehicules', 'contrats', 'notifications')
ORDER BY 
    CASE table_name
        WHEN 'entreprises' THEN 1
        WHEN 'clients' THEN 2
        WHEN 'vehicules' THEN 3
        WHEN 'contrats' THEN 4
        WHEN 'notifications' THEN 5
    END;

-- Vérifier les colonnes de la table contrats (si elle existe)
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'contrats'
ORDER BY ordinal_position;

-- Vérifier les index
SELECT 
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public' 
AND tablename IN ('entreprises', 'clients', 'vehicules', 'contrats', 'notifications')
ORDER BY tablename, indexname;
