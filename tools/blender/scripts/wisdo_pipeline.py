from __future__ import annotations
import argparse, json, os, re, sys
from pathlib import Path
from typing import Iterable, Sequence
import bpy
from mathutils import Vector

VERSION='1.0.0'; BLENDER_UP='+Z'; BLENDER_FORWARD='-Y'; RUNTIME_UP='+Y'; RUNTIME_FORWARD='+Z'
CANONICAL_ANIMS={
'IDLE':(r'^idle$',r'idle[_ .-]?0?1',r'stand'),'IDLE_VARIANT':(r'idle.*(2|variant|look)',),
'WALK_FORWARD':(r'walk.*(forward|fwd)?$',r'^walk$'),'WALK_BACKWARD':(r'walk.*(back|reverse)',),
'STRAFE_LEFT':(r'strafe.*left',r'walk.*left'),'STRAFE_RIGHT':(r'strafe.*right',r'walk.*right'),
'JOG':(r'jog',),'SPRINT':(r'sprint',r'run.*fast'),'TURN_LEFT':(r'turn.*left',),'TURN_RIGHT':(r'turn.*right',),
'JUMP_START':(r'jump.*(start|up)',),'JUMP_LOOP':(r'jump.*(loop|air|fall)',),'LAND':(r'land',),'STOP':(r'stop',),
'INTERACT':(r'interact',r'use',r'wave'),'SIT':(r'sit',)}

def argv(extra=None):
    raw=list(sys.argv if extra is None else extra); return raw[raw.index('--')+1:] if '--' in raw else []
def base_parser(desc):
    p=argparse.ArgumentParser(description=desc); p.add_argument('--input'); p.add_argument('--output');
    p.add_argument('--type',dest='asset_type',default='prop',choices=['character','building','arcade','vehicle','vegetation','prop'])
    p.add_argument('--name',default='WISDO_ASSET'); p.add_argument('--report'); p.add_argument('--target-height',type=float); p.add_argument('--preset'); return p
def ensure_parent(path): Path(path).expanduser().resolve().parent.mkdir(parents=True,exist_ok=True)
def write_json(path,data): ensure_parent(path); Path(path).write_text(json.dumps(data,indent=2,sort_keys=True)+'\n',encoding='utf-8')
def load_preset(path): return json.loads(Path(path).read_text(encoding='utf-8')) if path else {}
def configure():
    s=bpy.context.scene; s.unit_settings.system='METRIC'; s.unit_settings.scale_length=1.0; s.render.film_transparent=True
def reset():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    for blocks in (bpy.data.meshes,bpy.data.curves,bpy.data.materials,bpy.data.images,bpy.data.armatures):
        for b in list(blocks):
            if b.users==0: blocks.remove(b)
def import_source(path):
    p=Path(path).expanduser().resolve()
    if not p.exists(): raise FileNotFoundError(str(p))
    ext=p.suffix.lower(); before=set(bpy.data.objects)
    if ext=='.fbx': bpy.ops.import_scene.fbx(filepath=str(p),automatic_bone_orientation=False,use_anim=True)
    elif ext in {'.glb','.gltf'}: bpy.ops.import_scene.gltf(filepath=str(p))
    elif ext=='.obj':
        if hasattr(bpy.ops.wm,'obj_import'): bpy.ops.wm.obj_import(filepath=str(p))
        else: bpy.ops.import_scene.obj(filepath=str(p))
    elif ext=='.blend': bpy.ops.wm.open_mainfile(filepath=str(p)); return list(bpy.context.scene.objects)
    else: raise ValueError(f'Unsupported input format: {ext}')
    out=[o for o in bpy.data.objects if o not in before]; return out or list(bpy.context.scene.objects)
def meshes(objects=None): return [o for o in (bpy.context.scene.objects if objects is None else objects) if o.type=='MESH']
def arms(objects=None): return [o for o in (bpy.context.scene.objects if objects is None else objects) if o.type=='ARMATURE']
def select_only(objects):
    bpy.ops.object.select_all(action='DESELECT'); items=list(objects)
    for o in items: o.hide_set(False); o.select_set(True)
    if items: bpy.context.view_layer.objects.active=items[0]
def apply_transforms(objects):
    for o in list(objects):
        if o.type not in {'MESH','EMPTY','ARMATURE','CURVE'}: continue
        select_only([o])
        try: bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
        except RuntimeError: pass
def bounds(objects):
    pts=[]
    for o in objects:
        if hasattr(o,'bound_box'): pts += [o.matrix_world@Vector(c) for c in o.bound_box]
    if not pts: return Vector((0,0,0)),Vector((0,0,0))
    return Vector((min(p.x for p in pts),min(p.y for p in pts),min(p.z for p in pts))),Vector((max(p.x for p in pts),max(p.y for p in pts),max(p.z for p in pts)))
def scale_height(objects,target):
    objects=list(objects); lo,hi=bounds(objects); current=hi.z-lo.z
    if current<=1e-6: raise ValueError('Asset has no measurable height')
    factor=target/current
    for o in objects:
        if o.parent is None: o.scale*=factor
    bpy.context.view_layer.update(); apply_transforms(objects); return factor
def ground_center(objects,center_xy=True):
    objects=list(objects); lo,hi=bounds(objects); dx=-(lo.x+hi.x)/2 if center_xy else 0; dy=-(lo.y+hi.y)/2 if center_xy else 0; dz=-lo.z
    for o in objects:
        if o.parent is None: o.location.x+=dx; o.location.y+=dy; o.location.z+=dz
    bpy.context.view_layer.update()
def sanitize(objects,prefix):
    used=set()
    for i,o in enumerate(objects,1):
        raw=re.sub(r'[^A-Za-z0-9_]+','_',o.name).strip('_') or f'OBJECT_{i:03d}'; name=raw if raw.upper().startswith(prefix.upper()) else f'{prefix}_{raw}'; candidate=name[:60]; n=2
        while candidate in used: candidate=f'{name[:54]}_{n:02d}'; n+=1
        o.name=candidate; used.add(candidate)
def tris(o):
    if o.type!='MESH': return 0
    o.data.calc_loop_triangles(); return len(o.data.loop_triangles)
def materials(objects=None):
    out=set()
    for o in meshes(objects):
        for slot in o.material_slots:
            if slot.material: out.add(slot.material)
    return out
def images(mats):
    out=set()
    for m in mats:
        if m.use_nodes and m.node_tree:
            for n in m.node_tree.nodes:
                if n.type=='TEX_IMAGE' and getattr(n,'image',None): out.add(n.image)
    return out
def stats(objects=None):
    objects=list(bpy.context.scene.objects if objects is None else objects); ms=meshes(objects); ar=arms(objects); mats=materials(objects); imgs=images(mats); lo,hi=bounds(objects)
    return {'objects':len(objects),'meshes':len(ms),'skinnedMeshes':sum(1 for o in ms if any(m.type=='ARMATURE' for m in o.modifiers)),'armatures':len(ar),'bones':sum(len(a.data.bones) for a in ar),'triangles':sum(tris(o) for o in ms),'materials':len(mats),'textures':len(imgs),'animations':len(bpy.data.actions),'animationNames':sorted(a.name for a in bpy.data.actions),'boundsMeters':{'min':[round(v,5) for v in lo],'max':[round(v,5) for v in hi],'size':[round(hi[i]-lo[i],5) for i in range(3)]}}
def ensure_principled(mat):
    mat.use_nodes=True; nodes=mat.node_tree.nodes; links=mat.node_tree.links; bsdf=next((n for n in nodes if n.type=='BSDF_PRINCIPLED'),None) or nodes.new('ShaderNodeBsdfPrincipled'); out=next((n for n in nodes if n.type=='OUTPUT_MATERIAL'),None) or nodes.new('ShaderNodeOutputMaterial')
    if not any(l.to_node==out and l.to_socket.name=='Surface' for l in links): links.new(bsdf.outputs['BSDF'],out.inputs['Surface'])
    return bsdf
def setup_materials():
    result=[]
    for m in materials():
        b=ensure_principled(m); label=m.name.lower()
        if 'glass' in label: b.inputs['Roughness'].default_value=min(b.inputs['Roughness'].default_value,.18); b.inputs['Metallic'].default_value=0
        elif re.search(r'cloth|fabric|shirt|hood|jacket|pants|trouser',label): b.inputs['Roughness'].default_value=max(b.inputs['Roughness'].default_value,.55); b.inputs['Metallic'].default_value=0
        result.append({'material':m.name,'textures':[n.image.name for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image]})
    return result
def clean_mesh(o,merge=.00005):
    select_only([o]); bpy.context.view_layer.objects.active=o; bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    try: bpy.ops.mesh.remove_doubles(threshold=merge)
    except Exception: pass
    try: bpy.ops.mesh.delete_loose(use_verts=True,use_edges=True,use_faces=False)
    except Exception: pass
    bpy.ops.object.mode_set(mode='OBJECT')
    for p in o.data.polygons: p.use_smooth=True
def optimize(decimate=1.0,asset_type='prop'):
    before=sum(tris(o) for o in meshes())
    for o in meshes():
        clean_mesh(o)
        if decimate<.999 and asset_type!='character':
            md=o.modifiers.new('WISDO_DECIMATE','DECIMATE'); md.ratio=max(.05,min(1,decimate)); select_only([o]); bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=md.name)
    return {'trianglesBefore':before,'trianglesAfter':sum(tris(o) for o in meshes())}
def validate_character():
    ar=arms(); sk=[o for o in meshes() if any(m.type=='ARMATURE' and m.object for m in o.modifiers)]
    if not ar: raise RuntimeError('Character has no armature')
    if not sk: raise RuntimeError('Character has no skinned mesh with Armature modifier')
    weight={}
    for o in sk:
        missing=sum(1 for v in o.data.vertices if not v.groups); total=len(o.data.vertices); weight[o.name]={'unweightedVertices':missing,'vertexCount':total}
        if total and missing/total>.02: raise RuntimeError(f'{o.name} has more than 2% unweighted vertices')
    return {'armatures':[a.name for a in ar],'skinnedMeshes':[o.name for o in sk],'weights':weight}
def animation_map(rename=False):
    fps=bpy.context.scene.render.fps/max(1,bpy.context.scene.render.fps_base); actions=list(bpy.data.actions); used=set(); mapping={}; roots=[]
    for canon,patterns in CANONICAL_ANIMS.items():
        a=next((x for x in actions if x.name not in used and any(re.search(p,x.name,re.I) for p in patterns)),None)
        if a:
            s,e=a.frame_range; mapping[canon]={'source':a.name,'durationSeconds':round((e-s)/fps,3)}; used.add(a.name); a.use_fake_user=True
            if rename: a.name=canon
    for a in actions:
        for c in a.fcurves:
            path=c.data_path.lower()
            if 'location' in path and any(t in path for t in ('root','hips','pelvis')):
                vals=[p.co.y for p in c.keyframe_points]
                if vals and max(vals)-min(vals)>.02: roots.append(a.name); break
    return {'mapping':mapping,'unmapped':[a.name for a in actions if a.name not in used],'rootMotionCandidates':sorted(set(roots))}
def generate_lods(ratios):
    source=[o for o in meshes() if '_LOD' not in o.name.upper() and 'COLLISION' not in o.name.upper()]; sets={'LOD0':source}
    for level,ratio in enumerate(ratios[1:],1):
        curr=[]
        for src in source:
            o=src.copy(); o.data=src.data.copy(); o.name=f'{src.name}_LOD{level}'; bpy.context.collection.objects.link(o); o.matrix_world=src.matrix_world.copy(); o.parent=src.parent
            md=o.modifiers.new(f'WISDO_LOD{level}','DECIMATE'); md.ratio=ratio; md.use_collapse_triangulate=True; select_only([o]); bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=md.name); curr.append(o)
        sets[f'LOD{level}']=curr
    return sets
def build_collision(asset_type='prop',ratio=.08):
    if asset_type=='character': return {'collision':'RUNTIME_CAPSULE','generated':[]}
    generated=[]
    for src in [o for o in meshes() if 'COLLISION' not in o.name.upper() and not o.hide_render]:
        o=src.copy(); o.data=src.data.copy(); o.name=f'UCX_{src.name}_COLLISION'; bpy.context.collection.objects.link(o); o.matrix_world=src.matrix_world.copy(); md=o.modifiers.new('WISDO_COLLISION_DECIMATE','DECIMATE'); md.ratio=max(.02,min(.5,ratio)); select_only([o]); bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=md.name); o.display_type='WIRE'; o.hide_render=True; generated.append(o.name)
    return {'collision':'GENERATED','generated':generated}
def export_glb(path,objects=None,animations=True):
    ensure_parent(path)
    if objects is not None: select_only(objects)
    kw={'filepath':str(Path(path).expanduser().resolve()),'export_format':'GLB','use_selection':objects is not None,'export_apply':True,'export_yup':True,'export_animations':animations,'export_skins':True,'export_morph':True,'export_materials':'EXPORT','export_image_format':'AUTO'}
    try: bpy.ops.export_scene.gltf(**kw)
    except TypeError: bpy.ops.export_scene.gltf(filepath=kw['filepath'],export_format='GLB',use_selection=kw['use_selection'],export_animations=animations)
def report(name,asset_type,source=None,output=None):
    s=stats(); minz=s['boundsMeters']['min'][2]; transforms=all(all(abs(v-1)<.001 for v in o.scale) and all(abs(v)<.001 for v in o.rotation_euler) for o in bpy.context.scene.objects if o.type in {'MESH','ARMATURE','EMPTY'}); coll=[o.name for o in bpy.context.scene.objects if 'COLLISION' in o.name.upper() or o.name.upper().startswith('UCX_')]
    armok=s['armatures']>0 if asset_type=='character' else True
    return {'pipeline':f'WISDO Blender {VERSION}','asset':name,'type':asset_type,'source':source,'output':output,'coordinateConvention':{'blenderUp':BLENDER_UP,'blenderForward':BLENDER_FORWARD,'runtimeUp':RUNTIME_UP,'runtimeForward':RUNTIME_FORWARD,'units':'meters'},'checks':{'scale':'PASS' if s['boundsMeters']['size'][2]>0 else 'FAIL','ground':'PASS' if abs(minz)<=.005 else 'FAIL','transforms':'PASS' if transforms else 'FAIL','armature':'PASS' if armok else 'FAIL','collision':'PASS' if coll or asset_type=='character' else 'WARN','glbExport':'PENDING','runtimeValidation':'NOT_RUN'},'collisionObjects':coll,**s}
def build(args):
    if not args.input or not args.output: raise SystemExit('--input and --output are required')
    preset=load_preset(args.preset); reset(); configure(); objs=import_source(args.input); sanitize(objs,args.name.upper()); target=args.target_height or preset.get('targetHeightMeters') or (1.82 if args.asset_type=='character' else None)
    if target: scale_height(objs,float(target))
    apply_transforms(objs); ground_center(objs,center_xy=args.asset_type in {'character','vehicle','vegetation','prop'}); apply_transforms(objs); optimize(asset_type=args.asset_type); setup_materials()
    char=None
    if args.asset_type=='character': char=validate_character()
    ratios_text=getattr(args,'lod_ratios',None) or preset.get('lodRatios') or [1,.55,.28,.12]; ratios=[float(x) for x in (ratios_text.split(',') if isinstance(ratios_text,str) else ratios_text)]; ratios=[max(.03,min(1,x)) for x in ratios_text] if False else [max(.03,min(1,x)) for x in ratios]
    lods=generate_lods(ratios); collision=build_collision(args.asset_type,float(preset.get('collisionRatio',.08)))
    output=Path(args.output).expanduser().resolve(); output.parent.mkdir(parents=True,exist_ok=True); arms_all=arms(); export_glb(str(output),lods['LOD0']+arms_all,True); rep=report(args.name,args.asset_type,args.input,str(output)); rep['checks']['glbExport']='PASS'; rep['lods']={}; rep['collisionBuild']=collision; rep['character']=char; rep['animations']=animation_map(False)
    stem=output.with_suffix('')
    for label,items in lods.items():
        idx=int(label[3:]); p=str(output) if idx==0 else f'{stem}_lod{idx}.glb'
        if idx: export_glb(p,items+arms_all,args.asset_type=='character')
        rep['lods'][label]={'ratio':ratios[idx],'file':p,'triangles':sum(tris(o) for o in items)}
    report_path=args.report or str(output.with_suffix('.report.json')); write_json(report_path,rep)
    save=getattr(args,'save_blend',None)
    if save: ensure_parent(save); bpy.ops.wm.save_as_mainfile(filepath=str(Path(save).resolve()))
    print(json.dumps(rep,indent=2)); return rep
