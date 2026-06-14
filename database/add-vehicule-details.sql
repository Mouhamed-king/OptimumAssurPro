-- Ajout des détails véhicule (puissance, énergie, type)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'vehicules' AND column_name = 'puissance'
    ) THEN
        ALTER TABLE vehicules ADD COLUMN puissance INTEGER;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'vehicules' AND column_name = 'energie'
    ) THEN
        ALTER TABLE vehicules ADD COLUMN energie VARCHAR(20);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'vehicules' AND column_name = 'type_vehicule'
    ) THEN
        ALTER TABLE vehicules ADD COLUMN type_vehicule VARCHAR(50);
    END IF;
END $$;
