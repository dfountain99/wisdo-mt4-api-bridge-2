from _wisdo_recipe_lib import clear_scene, core_materials, box


def build():
    clear_scene()
    m = core_materials()
    graphite = m['floor']
    box('COLLIDER_TERMINAL_BASE',(0,0,0.12),(1.5,1.15,0.24),m['black'],bevel=0.08)
    box('TERMINAL_PEDESTAL',(0,0,0.78),(0.78,0.72,1.35),graphite,bevel=0.13)
    box('TERMINAL_GOLD_RING',(0,0,1.28),(0.92,0.86,0.08),m['gold'],bevel=0.025)
    box('TERMINAL_CONSOLE',(0,-0.18,1.56),(1.35,0.62,0.28),m['black'],bevel=0.10)
    screen = box('SCREEN_TERMINAL',(0,-0.505,1.65),(1.05,0.05,0.58),m['screen'],bevel=0.04,semantic='SCREEN_TERMINAL')
    screen['wisdoScreen']=True
    box('TERMINAL_SCREEN_FRAME',(0,-0.55,1.65),(1.2,0.05,0.72),graphite,bevel=0.05)
    box('TERMINAL_CYAN_TOP',(0,-0.59,2.02),(1.24,0.04,0.05),m['cyan'],bevel=0.01)
    box('TERMINAL_KEYBED',(0,-0.48,1.25),(0.96,0.34,0.09),graphite,bevel=0.025)
    for i,x in enumerate((-0.32,-0.16,0,0.16,0.32),1):
        box(f'TERMINAL_KEY_{i}',(x,-0.66,1.30),(0.10,0.08,0.04),m['cyan'] if i==3 else m['brushed'],bevel=0.01)
    interact = box('INTERACT_TERMINAL',(0,-0.69,0.98),(0.40,0.04,0.16),m['cyan'],bevel=0.02,semantic='INTERACT_TERMINAL')
    interact['wisdoInteraction']=True
