# WISDO V21 — Universal Device Fabric

V21 makes WISDO device-class first instead of brand/protocol first.

A thermostat is a **THERMOSTAT** to WISDO whether the physical path is Matter, Thread, Z-Wave, Zigbee, Wi-Fi, a vendor cloud, Home Assistant, Modbus, or a legacy bridge. The same applies to lights, locks, fans, covers, alarms, media devices, sensors, and legacy appliances.

## Core rule

**Discovery is not authorization. Proximity is not authorization.**

Newly discovered components enter `approval_status=pending`. Pending and revoked components are excluded from resolution, preview, execution, presence routines, scenes, and voice/text control.

Only an explicit owner approval moves a component to `approved`.

## Universal path

```
Natural language / presence / WISDO automation
                    |
             WISDO device class
                    |
           capability + risk policy
                    |
              adapter selection
                    |
  Home Assistant / Matter controller / Z-Wave /
  Zigbee / LAN API / MQTT / vendor cloud /
  IR-RF bridge / relay / building gateway
                    |
               physical device
```

## Normalized classes

V21 currently defines LIGHT, SWITCH, OUTLET, THERMOSTAT, FAN, COVER, GARAGE, LOCK, MEDIA, VACUUM, HUMIDIFIER, WATER_HEATER, ALARM, SIREN, CAMERA, BUTTON, SCENE, AUTOMATION, SENSOR, SMOKE_CO, MOTION, CONTACT, LEAK, PERSON, TRACKER, WEATHER, IR_APPLIANCE, RF_APPLIANCE, RELAY, and GENERIC.

Brand-specific behavior is never required in the WISDO language layer. Adapters expose the actions that a particular device actually supports.

## Protocol and adapter coverage

The fabric recognizes Matter, Thread, Z-Wave, Zigbee, Wi-Fi, Ethernet, Bluetooth/BLE, MQTT, Home Assistant, SmartThings, Hubitat, Lutron, Hue, vendor cloud APIs, local APIs, Modbus, BACnet, KNX, IR, RF, relay, serial and GPIO paths.

Not every protocol is implemented as a raw radio stack inside WISDO. V21 deliberately uses approved adapters/controllers so WISDO does not need to own every radio driver or vendor credential. The live executable adapter in this release is the Home Assistant edge bridge; the fabric describes safe compatibility paths for the other transports and legacy bridges.

This means an old Z-Wave thermostat and a new Matter thermostat can present the same WISDO THERMOSTAT capabilities once their approved controller exposes them.

## Unknown/old devices

If WISDO does not know a device protocol, it does not claim direct control. The compatibility planner returns possible adapter paths:

1. Home Assistant integration
2. local LAN/API adapter
3. approved vendor cloud connector
4. IR/RF bridge for remote-controlled legacy equipment
5. purpose-built relay/dry-contact bridge for compatible legacy equipment

Unsafe equipment must not be automated through improvised relays.

## Approval lifecycle

```
discovered -> pending -> approved -> revoked
```

Re-discovery refreshes state/capabilities but does not silently change approval.

The same component ID is namespaced by its enrolled edge device, preventing two homes with identical Home Assistant entity names from colliding.

## Thermostat abstraction

Examples that target any approved THERMOSTAT-compatible device:

- “Set the thermostat to 72 degrees.”
- “Set the thermostat mode to cool.”
- “Set the thermostat fan to auto.”

The adapter translates those commands into the underlying platform's supported service calls.

## APIs

- `GET /api/control/v1/fabric` — device classes, protocols and adapters
- `POST /api/control/v1/compatibility` — determine compatible adapter path
- `GET /api/control/v1/components?approval=pending` — review quarantined discovery
- `POST /api/control/v1/components/:id/approve` — explicitly authorize
- `POST /api/control/v1/components/:id/revoke` — revoke authorization
- Existing resolve/preview/execute endpoints only operate on `approved + online` components

## Home Assistant edge behavior

The edge Home Assistant bridge:
- registers each new entity as pending,
- namespaces IDs by WISDO edge identity,
- publishes normalized capabilities/state,
- never uploads the Home Assistant token or alarm code,
- leases commands only after cloud-side approval,
- executes locally and returns a completion/failure receipt.
