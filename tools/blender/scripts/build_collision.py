from wisdo_pipeline import argv,base_parser,build_collision
p=base_parser('Generate simplified WISDO collision'); p.add_argument('--ratio',type=float,default=.08); a=p.parse_args(argv()); print(build_collision(a.asset_type,a.ratio))
