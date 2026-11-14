/**
 * Serve only the public, CC0 Genesis model library.
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

export function registerGenesisAssetRoutes(app,{directory=genesisModelDirectory}={}){
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
}
