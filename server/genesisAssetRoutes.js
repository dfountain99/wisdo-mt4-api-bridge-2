/**
 * Serve self-hosted Genesis art: CC0 fallbacks, photo textures, and optional
 * licensed reality-grade GLB replacements.
 *
 * The client deliberately loads these through /assets/genesis/models/*.glb.b64.
 * Without this mount, all art requests returned 404 and the game silently fell
 * back to primitive fallback spheres and the cuboid character.
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

export function registerGenesisAssetRoutes(app,{
 directory=genesisModelDirectory,
 textureDirectory=genesisTextureDirectory,
 realityDirectory=genesisRealityDirectory
}={}){
 // Explicit mount is required: production does not expose /public generically.
 app.use('/assets/genesis/reality',express.static(realityDirectory,{
  index:false,dotfiles:'deny',fallthrough:false,redirect:false,maxAge:'1h',
  setHeaders(res,file){
   if(file.endsWith('.glb'))res.setHeader('Content-Type','model/gltf-binary');
   res.setHeader('X-Content-Type-Options','nosniff');
  },
 }));
 app.use('/assets/genesis/models',express.static(directory,{
  index:false,
  dotfiles:'deny',
  fallthrough:false,
  maxAge:'10m',
  setHeaders(res){
   res.setHeader('Content-Type','text/plain; charset=utf-8');
   res.setHeader('X-Content-Type-Options','nosniff');
  },
 }));
 app.use('/assets/genesis/textures',express.static(textureDirectory,{
  index:false,dotfiles:'deny',fallthrough:false,maxAge:'1d',
  setHeaders(res){
   res.setHeader('Content-Type','text/plain; charset=utf-8');
   res.setHeader('X-Content-Type-Options','nosniff');
  },
 }));
}
