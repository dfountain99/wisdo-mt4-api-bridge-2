from wisdo_pipeline import argv,base_parser,build
p=base_parser('Build complete WISDO runtime asset'); p.add_argument('--lod-ratios'); p.add_argument('--save-blend'); a=p.parse_args(argv()); build(a)
