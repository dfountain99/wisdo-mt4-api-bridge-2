import bpy
from wisdo_pipeline import argv,base_parser,apply_transforms,configure,ground_center,scale_height,stats
p=base_parser('Normalize WISDO scale/transforms/origin'); p.add_argument('--no-center',action='store_true'); a=p.parse_args(argv()); configure(); objects=list(bpy.context.scene.objects); target=a.target_height or (1.82 if a.asset_type=='character' else None)
if target: scale_height(objects,target)
apply_transforms(objects); ground_center(objects,not a.no_center and a.asset_type=='character'); apply_transforms(objects); print(stats(objects))
