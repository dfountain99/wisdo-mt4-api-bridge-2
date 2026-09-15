from _wisdo_recipe_lib import clear_scene, core_materials, box, portal


def build():
    clear_scene()
    m = core_materials()
    box('FLOOR_MAIN',(0,0,-0.18),(28,20,0.36),m['floor'],bevel=0.02)
    box('COLLIDER_WALL_NORTH',(0,10,2.75),(28,0.35,5.5),m['wall'])
    box('COLLIDER_WALL_WEST',(-14,0,2.75),(0.35,20,5.5),m['wall'])
    box('COLLIDER_WALL_EAST',(14,0,2.75),(0.35,20,5.5),m['wall'])
    for i,x in enumerate((-10.5,-7,-3.5,0,3.5,7,10.5),1):
        box(f'GLASS_BACK_{i}',(x,-9.82,2.8),(3.0,0.14,5.2),m['glass'],bevel=0.015)
    for i,(x,y) in enumerate(((-10,-6),(10,-6),(-10,0),(10,0),(-10,6),(10,6)),1):
        box(f'COLUMN_{i}',(x,y,2.7),(0.72,0.72,5.4),m['brushed'],bevel=0.08)
        box(f'GOLD_COLUMN_TRIM_{i}',(x,y,4.9),(0.86,0.86,0.12),m['gold'],bevel=0.025)
    for i,y in enumerate((-8,-4,0,4,8),1):
        box(f'CEILING_BEAM_{i}',(0,y,5.55),(27.5,0.34,0.34),m['black'],bevel=0.04)
        box(f'CEILING_LIGHT_{i}',(0,y,5.34),(19.0,0.06,0.06),m['cyan'],bevel=0.01)
    box('PLATFORM_MAIN',(0,-1,0.08),(8.8,6.4,0.22),m['stone'],bevel=0.08)
    box('PLATFORM_TRIM_FRONT',(0,-4.12,0.19),(8.9,0.08,0.12),m['gold'],bevel=0.02)
    box('PLATFORM_TRIM_BACK',(0,2.12,0.19),(8.9,0.08,0.12),m['gold'],bevel=0.02)
    box('SCREEN_WELCOME_HOME',(0,-4.18,2.45),(7.4,0.16,3.2),m['screen'],bevel=0.06,semantic='SCREEN_WELCOME_HOME')
    box('SCREEN_WELCOME_FRAME',(0,-4.30,2.45),(8.0,0.24,3.72),m['black'],bevel=0.09)
    box('LIGHT_CYAN_WELCOME',(0,-4.43,4.22),(8.15,0.07,0.07),m['cyan'],bevel=0.02)
    spawn=box('SPAWN_MAIN',(0,3.0,0.035),(0.16,0.16,0.07),m['cyan'],bevel=0.01,semantic='SPAWN_MAIN')
    spawn['wisdoSpawn']=True
    portal('INTERACT_TRADING_TOWER',(-7.8,8.9,0),m,accent='cyan')
    portal('INTERACT_MARKET_ARCADE',(0,8.9,0),m,accent='gold')
    portal('INTERACT_REPORTER_COMMAND',(7.8,8.9,0),m,accent='cyan')
    portal('INTERACT_SMART_HOME',(-7.8,-8.9,0),m,accent='gold')
    portal('INTERACT_VAULT',(7.8,-8.9,0),m,accent='gold')
    portal('INTERACT_INTELLIGENCE',(13.0,0,0),m,width=3.6,depth=0.25,accent='cyan')
    for i,x in enumerate((-6.2,6.2),1):
        box(f'BENCH_BASE_{i}',(x,2.7,0.34),(3.1,0.78,0.42),m['black'],bevel=0.12)
        box(f'BENCH_SEAT_{i}',(x,2.7,0.73),(3.0,0.84,0.18),m['fabric'],bevel=0.08)
    box('HOLOGRAM_PROJECTOR_BASE',(0,0.7,0.38),(1.6,1.6,0.76),m['black'],bevel=0.16)
    box('HOLOGRAM_PROJECTOR_CORE',(0,0.7,1.10),(0.82,0.82,0.65),m['cyan'],bevel=0.18,semantic='WORLD_HOLOGRAM_CORE')
    for i,y in enumerate((-5.5,-2.7,0.1,2.9,5.7),1):
        box(f'SERVER_RACK_{i}',(-12.5,y,1.4),(1.2,1.1,2.8),m['black'],bevel=0.08)
        box(f'SERVER_RACK_LIGHT_{i}',(-11.86,y,1.4),(0.04,0.82,2.2),m['cyan'],bevel=0.008)
