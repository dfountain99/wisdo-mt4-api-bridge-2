from wisdo_pipeline import argv,base_parser,setup_materials
a=base_parser('Normalize WISDO PBR materials').parse_args(argv()); print(setup_materials())
