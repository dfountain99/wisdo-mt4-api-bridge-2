from wisdo_pipeline import argv,base_parser,ground_center,validate_character
import bpy
a=base_parser('Validate and prepare WISDO character').parse_args(argv()); ground_center(list(bpy.context.scene.objects),True); print(validate_character())
