import ast
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BLENDER = ROOT / 'tools' / 'blender'
SCRIPTS = [
    'import_asset.py', 'normalize_asset.py', 'optimize_mesh.py', 'generate_lods.py',
    'setup_materials.py', 'setup_character.py', 'process_animations.py',
    'build_collision.py', 'validate_asset.py', 'export_glb.py', 'build_wisdo_asset.py',
    'wisdo_pipeline.py',
]
PRESETS = ['character.json', 'arcade.json', 'vehicle.json', 'vegetation.json', 'building.json']

class WisdoBlenderPipelineStaticTests(unittest.TestCase):
    def test_required_scripts_exist_and_parse(self):
        for name in SCRIPTS:
            path = BLENDER / 'scripts' / name
            self.assertTrue(path.exists(), name)
            source = path.read_text(encoding='utf-8')
            self.assertGreater(len(source.strip()), 80, name)
            ast.parse(source, filename=str(path))

    def test_presets_are_real_json_and_use_wisdo_axes(self):
        for name in PRESETS:
            path = BLENDER / 'presets' / name
            payload = json.loads(path.read_text(encoding='utf-8'))
            self.assertEqual(payload['runtimeUp'], '+Y')
            self.assertEqual(payload['runtimeForward'], '+Z')
            self.assertGreaterEqual(len(payload['lodRatios']), 4)
            self.assertEqual(payload['lodRatios'][0], 1.0)

    def test_character_preset_matches_current_world_scale_contract(self):
        payload = json.loads((BLENDER / 'presets' / 'character.json').read_text(encoding='utf-8'))
        self.assertAlmostEqual(payload['targetHeightMeters'], 1.82, places=2)
        self.assertEqual(payload['collision'], 'runtime_capsule')

    def test_detector_and_runner_are_present(self):
        detector = (BLENDER / 'detect_blender.mjs').read_text(encoding='utf-8')
        runner = (BLENDER / 'run_blender.mjs').read_text(encoding='utf-8')
        self.assertIn("BLENDER_NOT_FOUND", detector)
        self.assertIn("build_wisdo_asset.py", runner)
        self.assertIn("-b", runner)
        self.assertIn("-P", runner)

if __name__ == '__main__':
    unittest.main()
