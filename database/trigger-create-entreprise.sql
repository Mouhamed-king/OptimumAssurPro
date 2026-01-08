-- ============================================
-- TRIGGER POUR CRÉER AUTOMATIQUEMENT UN ENREGISTREMENT DANS entreprises
-- ============================================
-- Ce trigger crée automatiquement un enregistrement dans la table entreprises
-- quand un utilisateur est créé dans auth.users
-- À exécuter dans le SQL Editor de Supabase Dashboard
-- ============================================

-- Fonction qui sera appelée par le trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Créer un enregistrement dans entreprises avec les données de l'utilisateur
    INSERT INTO public.entreprises (
        id,
        nom,
        email,
        telephone,
        adresse,
        email_verified
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nom', 'Utilisateur'),
        NEW.email,
        NULLIF(NEW.raw_user_meta_data->>'telephone', ''),
        NULLIF(NEW.raw_user_meta_data->>'adresse', ''),
        (NEW.email_confirmed_at IS NOT NULL)
    )
    ON CONFLICT (id) DO UPDATE SET
        email = NEW.email,
        email_verified = (NEW.email_confirmed_at IS NOT NULL);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger sur auth.users
-- Note: Ce trigger nécessite des permissions spéciales
-- Si vous ne pouvez pas créer le trigger directement, utilisez le mécanisme de retry dans le code

-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--     AFTER INSERT ON auth.users
--     FOR EACH ROW
--     EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- ALTERNATIVE : Trigger sur email_confirmed_at pour mettre à jour email_verified
-- ============================================

-- Fonction pour mettre à jour email_verified quand l'email est confirmé
CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS TRIGGER AS $$
BEGIN
    -- Mettre à jour email_verified dans entreprises
    UPDATE public.entreprises
    SET email_verified = (NEW.email_confirmed_at IS NOT NULL)
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Les triggers sur auth.users nécessitent des permissions spéciales
-- Si vous ne pouvez pas les créer, le code backend gère déjà ces cas
