from wisdo_pipeline import argv,base_parser,animation_map
p=base_parser('Map WISDO canonical animation clips'); p.add_argument('--rename',action='store_true'); a=p.parse_args(argv()); print(animation_map(a.rename))
