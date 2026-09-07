#!/bin/bash
# Re-target python scripts to main directories
for script in update_dashboard_theme.py fix_green_bg.py fix_all_badges.py fix_white_blocks.py fix_all_custom_hexes.py fix_admin_gray.py fix_selector.py fix_dupes2.py; do
  sed -i '' 's/"client\/src\/experimental\/pages", "client\/src\/experimental\/components"/"client\/src\/pages", "client\/src\/components"/g' $script
  sed -i '' 's/client\/src\/experimental\/components\/chat\/ChatModelSelector.tsx/client\/src\/components\/chat\/ChatModelSelector.tsx/g' $script
  sed -i '' 's/client\/src\/experimental\/pages\/PreviewAdminPanel.tsx/client\/src\/pages\/admin-panel.tsx/g' $script
  python3 $script
done
