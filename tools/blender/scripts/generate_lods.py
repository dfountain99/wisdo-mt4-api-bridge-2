from wisdo_pipeline import argv,base_parser,generate_lods,tris
p=base_parser('Generate WISDO LOD geometry'); p.add_argument('--ratios',default='1,.55,.28,.12'); a=p.parse_args(argv()); ratios=[max(.03,min(1,float(x))) for x in a.ratios.split(',')]; lods=generate_lods(ratios); print({k:{'ratio':ratios[int(k[3:])],'triangles':sum(tris(o) for o in v)} for k,v in lods.items()})
