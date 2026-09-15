from wisdo_pipeline import argv,base_parser,report,write_json
a=base_parser('Validate WISDO asset').parse_args(argv()); r=report(a.name,a.asset_type,a.input,a.output); print(r)
if a.report: write_json(a.report,r)
failed=[k for k,v in r['checks'].items() if v=='FAIL']
if failed: raise SystemExit('WISDO validation failed: '+', '.join(failed))
