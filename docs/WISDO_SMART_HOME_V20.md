# WISDO Smart Home V20

WISDO V20 expands the existing local smart-control stack into a Home Assistant-backed control plane. Home Assistant remains the local owner of device/vendor credentials and radio fabrics. WISDO receives normalized component state and capability-scoped actions through the enrolled Pi/Windows edge device.

## Integration model

```
Matter / Thread / Zigbee / Z-Wave / Wi-Fi / vendor integrations
                         |
                  Home Assistant
                         |
               WISDO Edge bridge
                         |
          WISDO Universal Control Plane
                         |
             Voice / text / presence
```

This lets WISDO work with ecosystems that Home Assistant can already expose without putting vendor secrets in the WISDO cloud.

Typical supported ecosystems include Matter and Thread devices, Philips Hue, Lutron, TP-Link/Kasa, Shelly, Zigbee and Z-Wave hubs, Ecobee/Nest-compatible climate devices exposed by Home Assistant, Sonos/media players, TVs, smart locks, garage controllers, security panels, cameras, vacuums, humidifiers, fans, blinds and shades, switches, sensors, smoke/CO sensors, and other Home Assistant entities in supported domains.

## Device classes

WISDO V20 normalizes these Home Assistant domains:

- lights
- switches and input booleans
- scenes, scripts and automations
- thermostats / climate
- fans
- blinds, shades, curtains and garage covers
- locks
- speakers and media players / TVs
- vacuums
- humidifiers
- water heaters
- alarm control panels
- sirens
- buttons
- number/select controls
- cameras
- read-only sensors, binary sensors, people, device trackers and weather

## Natural voice/text examples

Low-risk actions can queue directly after exact component resolution:

- “Turn on the living room lights.”
- “Dim the office lights to 35 percent.”
- “Set the thermostat to 72 degrees.”
- “Open the bedroom blinds.”
- “Set the fan to 40 percent.”
- “Pause the living room TV.”
- “Set the speaker volume to 25 percent.”
- “Start the vacuum.”
- “Trading mode.”
- “Movie mode.”
- “Sleep mode.”

Physical-security actions require explicit confirmation:

- “Unlock the front door.”
- “Open the garage door.”
- “Arm the security away.”
- “Disarm the alarm.”
- “Turn on the siren.”
- “Emergency mode.”

WISDO calculates a server-side risk floor from the registered component and action. A client cannot lower the risk level to bypass confirmation.

## Named scenes

The built-in language layer recognizes:

- Focus
- Relax
- Movie
- Trading
- Morning
- Date Night
- Party
- Sleep
- Emergency

The actual scene contents live in Home Assistant. This keeps WISDO from inventing device behavior. If `scene.trading` is registered, verified presence in the configured trading room can automatically request it while the existing workstation wake/workspace flow runs.

## Edge setup

Set these values in `pi-edge/.env`:

```
WISDO_HOME_ASSISTANT_URL=http://homeassistant.local:8123
WISDO_HOME_ASSISTANT_TOKEN=<long-lived-access-token>
WISDO_HA_SYNC_SECONDS=60
WISDO_HA_CONTROL_POLL_SECONDS=1.5
WISDO_HA_HTTP_TIMEOUT_SECONDS=8
WISDO_HA_ALARM_CODE=
```

`WISDO_HA_ALARM_CODE` is optional and stays on the local edge host. It is never registered as component metadata or uploaded to the WISDO cloud.

Re-run `pi-edge/enroll.py` after enabling Home Assistant so the device advertises `smart_home`, `home_assistant`, and `matter_thread_via_home_assistant` capabilities.

## Safety boundary

- Home Assistant tokens remain local to the edge device.
- Only normalized state attributes are registered with WISDO.
- Read-only sensors advertise no mutation actions.
- Physical-security actions require WISDO confirmation.
- The edge only leases executions for components assigned to that enrolled device.
- WISDO reports queued/delivered/completed states separately; cloud queueing is not presented as physical completion.
- Trading authorization remains on the separate Reporter/HIGHTOWER path.
