from __future__ import annotations
import argparse
import importlib.util
import sys
from pathlib import Path
import bpy


def parse_args():
    raw = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser(description='Run a trusted checked-in WISDO Blender recipe.')
    parser.add_argument('--recipe', required=True)
    parser.add_argument('--output', required=True)
    return parser.parse_args(raw)


def main():
    args = parse_args()
    recipe = Path(args.recipe).resolve()
    output = Path(args.output).resolve()
    if recipe.suffix.lower() != '.py' or 'tools/blender/recipes' not in recipe.as_posix():
        raise RuntimeError('Recipe must be a checked-in Python file under tools/blender/recipes.')
    if not recipe.exists():
        raise FileNotFoundError(str(recipe))
    output.parent.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(recipe.parent))
    spec = importlib.util.spec_from_file_location('wisdo_asset_recipe', recipe)
    module = importlib.util.module_from_spec(spec)
    if spec.loader is None:
        raise RuntimeError('Unable to load WISDO Blender recipe.')
    spec.loader.exec_module(module)
    build = getattr(module, 'build', None)
    if not callable(build):
        raise RuntimeError('WISDO Blender recipe must export build().')
    build()
    bpy.ops.wm.save_as_mainfile(filepath=str(output))
    print(f'[WISDO Blender Recipe] saved {output}')


if __name__ == '__main__':
    main()
