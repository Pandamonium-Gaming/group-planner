BEGIN;

-- Existing banks and catalogue entries belong to Ashes; their IDs and balances do not change.
ALTER TABLE public.guild_banks ADD COLUMN IF NOT EXISTS game_slug text NOT NULL DEFAULT 'aoc';
ALTER TABLE public.resource_catalog ADD COLUMN IF NOT EXISTS game_slug text NOT NULL DEFAULT 'aoc';
ALTER TABLE public.guild_banks DROP CONSTRAINT IF EXISTS guild_banks_group_id_key;
ALTER TABLE public.guild_banks DROP CONSTRAINT IF EXISTS guild_banks_clan_id_key;
ALTER TABLE public.resource_catalog DROP CONSTRAINT IF EXISTS resource_catalog_name_key;
ALTER TABLE public.guild_banks ADD CONSTRAINT guild_banks_group_game_key UNIQUE (group_id, game_slug);
ALTER TABLE public.resource_catalog ADD CONSTRAINT resource_catalog_game_name_key UNIQUE (game_slug, name);

CREATE FUNCTION public.prevent_bank_game_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'BANK_GAME_IMMUTABLE' USING ERRCODE = '23514';
END;
$$;
REVOKE ALL ON FUNCTION public.prevent_bank_game_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guild_banks_game_immutable
  BEFORE UPDATE OF game_slug ON public.guild_banks
  FOR EACH ROW WHEN (OLD.game_slug IS DISTINCT FROM NEW.game_slug)
  EXECUTE FUNCTION public.prevent_bank_game_change();
CREATE TRIGGER resource_catalog_game_immutable
  BEFORE UPDATE OF game_slug ON public.resource_catalog
  FOR EACH ROW WHEN (OLD.game_slug IS DISTINCT FROM NEW.game_slug)
  EXECUTE FUNCTION public.prevent_bank_game_change();

-- Child rows inherit their game's scope through the bank, including requests and audit entries.
CREATE FUNCTION public.require_bank_resource_game()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_game text;
BEGIN
  SELECT game_slug INTO v_game FROM public.guild_banks WHERE id = NEW.bank_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BANK_NOT_FOUND' USING ERRCODE = '23503';
  END IF;
  IF NEW.resource_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.resource_catalog WHERE id = NEW.resource_id AND game_slug = v_game
  ) THEN
    RAISE EXCEPTION 'BANK_RESOURCE_GAME_MISMATCH' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.require_bank_resource_game() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER bank_inventory_resource_game
  BEFORE INSERT OR UPDATE ON public.bank_inventory
  FOR EACH ROW EXECUTE FUNCTION public.require_bank_resource_game();
CREATE TRIGGER bank_transactions_resource_game
  BEFORE INSERT OR UPDATE ON public.bank_transactions
  FOR EACH ROW EXECUTE FUNCTION public.require_bank_resource_game();
CREATE TRIGGER resource_requests_resource_game
  BEFORE INSERT OR UPDATE ON public.resource_requests
  FOR EACH ROW EXECUTE FUNCTION public.require_bank_resource_game();

CREATE TRIGGER guild_banks_require_enabled_game
  BEFORE INSERT ON public.guild_banks
  FOR EACH ROW EXECUTE FUNCTION public.require_enabled_game();

-- Game deletion now removes that game's bank and its cascading inventory, history and requests.
CREATE FUNCTION public.delete_game_guild_bank()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM public.guild_banks WHERE group_id = OLD.group_id AND game_slug = OLD.game_slug;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_game_guild_bank() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER group_games_delete_bank
  AFTER DELETE ON public.group_games
  FOR EACH ROW EXECUTE FUNCTION public.delete_game_guild_bank();

-- Starter WoW catalogue; identical item names in Ashes remain independent records.
INSERT INTO public.resource_catalog (game_slug, name, category, subcategory) VALUES
  ('wowforever', 'Copper Ore', 'raw_material', 'metal'),
  ('wowforever', 'Tin Ore', 'raw_material', 'metal'),
  ('wowforever', 'Silver Ore', 'raw_material', 'metal'),
  ('wowforever', 'Iron Ore', 'raw_material', 'metal'),
  ('wowforever', 'Gold Ore', 'raw_material', 'metal'),
  ('wowforever', 'Mithril Ore', 'raw_material', 'metal'),
  ('wowforever', 'Truesilver Ore', 'raw_material', 'metal'),
  ('wowforever', 'Thorium Ore', 'raw_material', 'metal'),
  ('wowforever', 'Copper Bar', 'processed', 'metal'),
  ('wowforever', 'Bronze Bar', 'processed', 'metal'),
  ('wowforever', 'Iron Bar', 'processed', 'metal'),
  ('wowforever', 'Steel Bar', 'processed', 'metal'),
  ('wowforever', 'Mithril Bar', 'processed', 'metal'),
  ('wowforever', 'Thorium Bar', 'processed', 'metal'),
  ('wowforever', 'Linen Cloth', 'raw_material', 'cloth'),
  ('wowforever', 'Wool Cloth', 'raw_material', 'cloth'),
  ('wowforever', 'Silk Cloth', 'raw_material', 'cloth'),
  ('wowforever', 'Mageweave Cloth', 'raw_material', 'cloth'),
  ('wowforever', 'Runecloth', 'raw_material', 'cloth'),
  ('wowforever', 'Light Leather', 'raw_material', 'leather'),
  ('wowforever', 'Medium Leather', 'raw_material', 'leather'),
  ('wowforever', 'Heavy Leather', 'raw_material', 'leather'),
  ('wowforever', 'Thick Leather', 'raw_material', 'leather'),
  ('wowforever', 'Rugged Leather', 'raw_material', 'leather'),
  ('wowforever', 'Peacebloom', 'raw_material', 'herb'),
  ('wowforever', 'Silverleaf', 'raw_material', 'herb'),
  ('wowforever', 'Earthroot', 'raw_material', 'herb'),
  ('wowforever', 'Mageroyal', 'raw_material', 'herb'),
  ('wowforever', 'Briarthorn', 'raw_material', 'herb'),
  ('wowforever', 'Bruiseweed', 'raw_material', 'herb'),
  ('wowforever', 'Wild Steelbloom', 'raw_material', 'herb'),
  ('wowforever', 'Kingsblood', 'raw_material', 'herb'),
  ('wowforever', 'Liferoot', 'raw_material', 'herb'),
  ('wowforever', 'Fadeleaf', 'raw_material', 'herb'),
  ('wowforever', 'Goldthorn', 'raw_material', 'herb'),
  ('wowforever', 'Sungrass', 'raw_material', 'herb'),
  ('wowforever', 'Blindweed', 'raw_material', 'herb'),
  ('wowforever', 'Gromsblood', 'raw_material', 'herb'),
  ('wowforever', 'Golden Sansam', 'raw_material', 'herb'),
  ('wowforever', 'Dreamfoil', 'raw_material', 'herb'),
  ('wowforever', 'Mountain Silversage', 'raw_material', 'herb'),
  ('wowforever', 'Plaguebloom', 'raw_material', 'herb'),
  ('wowforever', 'Icecap', 'raw_material', 'herb'),
  ('wowforever', 'Black Lotus', 'raw_material', 'herb'),
  ('wowforever', 'Strange Dust', 'raw_material', 'enchanting'),
  ('wowforever', 'Soul Dust', 'raw_material', 'enchanting'),
  ('wowforever', 'Vision Dust', 'raw_material', 'enchanting'),
  ('wowforever', 'Dream Dust', 'raw_material', 'enchanting'),
  ('wowforever', 'Illusion Dust', 'raw_material', 'enchanting'),
  ('wowforever', 'Large Brilliant Shard', 'raw_material', 'enchanting'),
  ('wowforever', 'Major Healing Potion', 'consumable', 'potion'),
  ('wowforever', 'Major Mana Potion', 'consumable', 'potion')
ON CONFLICT (game_slug, name) DO NOTHING;

INSERT INTO public.migration_history(filename) VALUES ('024_game_scoped_guild_banks.sql') ON CONFLICT DO NOTHING;
COMMIT;
