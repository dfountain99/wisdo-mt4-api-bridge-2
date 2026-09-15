import bpy
from wisdo_pipeline import argv,base_parser,configure,import_source,reset,sanitize,stats
p=base_parser('Import source asset into a clean WISDO scene'); a=p.parse_args(argv())
if not a.input: raise SystemExit('--input is required')
reset(); configure(); objects=import_source(a.input); sanitize(objects,a.name.upper()); print(stats(objects))
if a.output: bpy.ops.wm.save_as_mainfile(filepath=a.output)
