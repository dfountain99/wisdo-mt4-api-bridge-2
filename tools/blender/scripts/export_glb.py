from wisdo_pipeline import argv,base_parser,export_glb,report,write_json
a=base_parser('Export WISDO runtime GLB').parse_args(argv())
if not a.output: raise SystemExit('--output is required')
export_glb(a.output,None,True); r=report(a.name,a.asset_type,a.input,a.output); r['checks']['glbExport']='PASS'; print(r)
if a.report: write_json(a.report,r)
