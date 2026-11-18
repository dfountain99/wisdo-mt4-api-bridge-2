/**
 * Serve Genesis art libraries and first-party 3D vehicles.
 *
 * Assets are versioned and shipped with the application; no runtime write
 * access is exposed. Client-side visuals do not grant server-side items.
 */
import express from 'express';
import { fileURLToPath } from 'node:url';

export const genesisModelDirectory=fileURLToPath(
  new URL('../public/assets/genesis/models/',import.meta.url)
);

export const genesisTextureDirectory=fileURLToPath(
  new URL('../public/assets/genesis/textures/',import.meta.url)
);

export const genesisRealityDirectory=fileURLToPath(
  new URL('../public/assets/genesis/reality/',import.meta.url)
);

export const genesisVehicleDirectory=fileURLToPath(
  new URL('../public/assets/genesis/vehicles/',import.meta.url)
);

function assetHeaders(mimeType){
 return (res)=>{
  res.setHeader('Content-Type',mimeType);
  res.setHeader('X-Content-Type-Options','nosniff');
 };
}

export function registerGenesisAssetRoutes(app,{
 directory=genesisModelDirectory,
 textureDirectory=genesisTextureDirectory,
 realityDirectory=genesisRealityDirectory,
 vehicleDirectory=genesisVehicleDirectory,
}={}){
 const opts={index:false,dotfiles:'deny',fallthrough:false};
 app.use('/assets/genesis/models',express.static(directory,{
  ...opts,maxAge:'10m',setHeaders:assetHeaders('text/plain; charset=utf-8'),
 }));
 app.use('/assets/genesis/textures',express.static(textureDirectory,{
  ...opts,maxAge:'1d',setHeaders:assetHeaders('text/plain; charset=utf-8'),
 }));
 // The Genesis Reality Engine already requests /assets/genesis/reality/*.glb.
 // Previously, it always fell back because this directory was not mounted.
 app.use('/assets/genesis/reality',express.static(realityDirectory,{
  ...opts,maxAge:'1d',setHeaders:assetHeaders('model/gltf-binary'),
 }));
 // Separately addressable, high-poly vehicles must not join tree-model loops.
 app.use('/assets/genesis/vehicles',express.static(vehicleDirectory,{
  ...opts,maxAge:'1d',setHeaders:assetHeaders('model/gltf-binary'),
 }));
}
