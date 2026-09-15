from wisdo_pipeline import argv,base_parser,optimize
p=base_parser('Optimize WISDO render mesh'); p.add_argument('--decimate',type=float,default=1.0); a=p.parse_args(argv()); print(optimize(a.decimate,a.asset_type))
