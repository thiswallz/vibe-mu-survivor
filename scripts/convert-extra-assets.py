"""Convert accessory/pet assets only, preserving the bundled world and character assets."""
import importlib.util
import json
from pathlib import Path

root = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('mu_assets', root / 'convert-assets.py')
converter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(converter)
assets = {
    'ring-ice': 'Item/Ring01.bmd',
    'ring-fire': 'Item/Ring02.bmd',
    'pendant-lightning': 'Item/Necklace01.bmd',
    'shield-round': 'Item/Shield01.bmd',
    'wings-angel': 'Item/Wing02.bmd',
    'pet-angel': 'Player/Helper01.bmd',
    'pet-satan': 'Player/Helper02.bmd',
}
for item, source in assets.items():
    converter.convert('loot-' + item, [converter.SOURCE / source], animate=item.startswith(('pet-', 'wings-')), animationSamples=7)
manifest_path = converter.OUT / 'manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest.update(converter.manifest)
manifest_path.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
(converter.OUT / 'accessory-catalog.json').write_text(json.dumps({
    'sourceClient': 'Nexus MU Online',
    'items': {item: {'source': source, 'model': 'loot-' + item} for item, source in assets.items()},
}, indent=2), encoding='utf-8')
