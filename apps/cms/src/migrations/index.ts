import * as migration_20250502_171326_rename_layout_to_content from "./20250502_171326_rename_layout_to_content";
import * as migration_20250502_174357_move_map_settings from "./20250502_174357_move_map_settings";
import * as migration_20250502_175318_rename_maintenance_to_settings from "./20250502_175318_rename_maintenance_to_settings";
import * as migration_20250719_221257_migration from "./20250719_221257_migration";
import * as migration_20250724_194253_languages from "./20250724_194253_languages";
import * as migration_20250817_133906_migration from "./20250817_133906_migration";
import * as migration_20260529_000000_optional_room_cta from "./20260529_000000_optional_room_cta";
import * as migration_20260529_224952_accommodation_selector_card_links from "./20260529_224952_accommodation_selector_card_links";
import * as migration_20260606_194625_migrate_brand_root_paths from "./20260606_194625_migrate_brand_root_paths";
import * as migration_20260606_210000_migrate_brand_theme_colors from "./20260606_210000_migrate_brand_theme_colors";
import * as migration_20260608_000000_migrate_media_categories_to_folders from "./20260608_000000_migrate_media_categories_to_folders";

export const migrations = [
  {
    up: migration_20250502_171326_rename_layout_to_content.up,
    down: migration_20250502_171326_rename_layout_to_content.down,
    name: "20250502_171326_rename_layout_to_content",
  },
  {
    up: migration_20250502_174357_move_map_settings.up,
    down: migration_20250502_174357_move_map_settings.down,
    name: "20250502_174357_move_map_settings",
  },
  {
    up: migration_20250502_175318_rename_maintenance_to_settings.up,
    down: migration_20250502_175318_rename_maintenance_to_settings.down,
    name: "20250502_175318_rename_maintenance_to_settings",
  },
  {
    up: migration_20250719_221257_migration.up,
    down: migration_20250719_221257_migration.down,
    name: "20250719_221257_migration",
  },
  {
    up: migration_20250724_194253_languages.up,
    down: migration_20250724_194253_languages.down,
    name: "20250724_194253_languages",
  },
  {
    up: migration_20250817_133906_migration.up,
    down: migration_20250817_133906_migration.down,
    name: "20250817_133906_migration",
  },
  {
    up: migration_20260529_000000_optional_room_cta.up,
    down: migration_20260529_000000_optional_room_cta.down,
    name: "20260529_000000_optional_room_cta",
  },
  {
    up: migration_20260529_224952_accommodation_selector_card_links.up,
    down: migration_20260529_224952_accommodation_selector_card_links.down,
    name: "20260529_224952_accommodation_selector_card_links",
  },
  {
    up: migration_20260606_194625_migrate_brand_root_paths.up,
    down: migration_20260606_194625_migrate_brand_root_paths.down,
    name: "20260606_194625_migrate_brand_root_paths",
  },
  {
    up: migration_20260606_210000_migrate_brand_theme_colors.up,
    down: migration_20260606_210000_migrate_brand_theme_colors.down,
    name: "20260606_210000_migrate_brand_theme_colors",
  },
  {
    up: migration_20260608_000000_migrate_media_categories_to_folders.up,
    down: migration_20260608_000000_migrate_media_categories_to_folders.down,
    name: "20260608_000000_migrate_media_categories_to_folders",
  },
];
