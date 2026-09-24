// Manifest v1: x east, y height, z south, one unit is one meter.
// Babylon uses the same axes and units. Kept in one adapter for parity checks.
window.WISDO_WORLD_SPACE=Object.freeze({
 toBabylon({x=0,y=0,z=0}){return new BABYLON.Vector3(x,y,z)},
 fromBabylon(v){return {x:v.x,y:v.y,z:v.z}},
 metersToBabylon(n){return n},
});
