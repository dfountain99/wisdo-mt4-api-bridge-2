from __future__ import annotations
import bpy


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.images):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0


def _set_input(bsdf, names, value):
    for name in names:
        socket = bsdf.inputs.get(name)
        if socket is not None:
            socket.default_value = value
            return True
    return False


def material(name, color, *, metallic=0.0, roughness=0.5, emission=None, emission_strength=0.0, alpha=1.0, transmission=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(node for node in mat.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
    _set_input(bsdf, ('Base Color',), (*color, 1.0))
    _set_input(bsdf, ('Metallic',), metallic)
    _set_input(bsdf, ('Roughness',), roughness)
    if emission is not None:
        _set_input(bsdf, ('Emission Color', 'Emission'), (*emission, 1.0))
        _set_input(bsdf, ('Emission Strength',), emission_strength)
    if transmission:
        _set_input(bsdf, ('Transmission Weight', 'Transmission'), transmission)
    if alpha < 1.0:
        _set_input(bsdf, ('Alpha',), alpha)
        if hasattr(mat, 'surface_render_method'):
            try: mat.surface_render_method = 'DITHERED'
            except Exception: pass
        elif hasattr(mat, 'blend_method'):
            try: mat.blend_method = 'BLEND'
            except Exception: pass
        mat.diffuse_color = (*color, alpha)
    return mat


def box(name, location, dimensions, mat, *, bevel=0.035, semantic=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        modifier = obj.modifiers.new('WISDO_BEVEL', 'BEVEL')
        modifier.width = min(bevel, min(dimensions) * 0.18)
        modifier.segments = 2
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    if mat is not None:
        obj.data.materials.append(mat)
    if semantic:
        obj['wisdoSemantic'] = semantic
    return obj


def portal(prefix, center, mats, *, width=4.6, height=4.4, depth=0.34, accent='cyan'):
    x, y, z = center
    frame = mats['black']
    glow = mats[accent]
    box(f'{prefix}_LEFT', (x-width/2, y, z+height/2), (0.28, depth, height), frame)
    box(f'{prefix}_RIGHT', (x+width/2, y, z+height/2), (0.28, depth, height), frame)
    box(f'{prefix}_TOP', (x, y, z+height), (width+0.28, depth, 0.28), glow)
    node = box(prefix, (x, y, z+0.13), (width-0.42, depth*0.7, 0.16), glow, semantic=prefix)
    node['wisdoInteraction'] = True
    return node


def core_materials():
    return {
        'floor': material('WISDO_FLOOR_GRAPHITE', (0.09,0.11,0.14), metallic=0.18, roughness=0.46),
        'wall': material('WISDO_WALL_GRAPHITE', (0.055,0.07,0.09), metallic=0.28, roughness=0.38),
        'black': material('WISDO_BLACK_METAL', (0.025,0.04,0.06), metallic=0.86, roughness=0.25),
        'brushed': material('WISDO_BRUSHED_METAL', (0.28,0.32,0.36), metallic=0.92, roughness=0.29),
        'gold': material('WISDO_GOLD', (0.72,0.48,0.12), metallic=0.96, roughness=0.22),
        'cyan': material('WISDO_CYAN_ENERGY', (0.05,0.48,0.72), metallic=0.22, roughness=0.2, emission=(0.02,0.55,0.82), emission_strength=3.0),
        'screen': material('WISDO_SCREEN', (0.01,0.08,0.13), metallic=0.2, roughness=0.18, emission=(0.01,0.22,0.34), emission_strength=2.0),
        'glass': material('WISDO_GLASS', (0.08,0.22,0.30), metallic=0.05, roughness=0.08, alpha=0.36, transmission=0.72),
        'stone': material('WISDO_STONE', (0.30,0.32,0.34), metallic=0.05, roughness=0.68),
        'fabric': material('WISDO_DARK_FABRIC', (0.035,0.045,0.06), metallic=0.02, roughness=0.78),
    }
