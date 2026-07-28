import {WisdoRoomStateService} from '../services/wisdoRoomStateService.js';
function bearer(req){const v=String(req.headers.authorization||'');return v.toLowerCase().startsWith('bearer ')?v.slice(7).trim():'';}
export function registerRoomStateRoutes(app,{commandBusService,pool,logger}={}){
 const service=new WisdoRoomStateService({pool,logger});
 async function auth(req,res,next){try{const d=await commandBusService.authenticateDevice(req.headers['x-wisdo-device-id'],bearer(req));if(!d)return res.status(401).json({ok:false,error:'Invalid device credentials.'});req.wisdoDevice=d;next();}catch(e){next(e);}}
 app.get('/health/room-intelligence',async(_q,res,next)=>{try{res.json(await service.health());}catch(e){next(e);}});
 app.post('/api/edge/v1/rooms/:roomId/state',auth,async(req,res,next)=>{try{res.json({ok:true,room:await service.upsert(req.wisdoDevice,req.params.roomId,req.body||{})});}catch(e){next(e);}});
 app.get('/api/edge/v1/rooms',auth,async(req,res,next)=>{try{res.json({ok:true,rooms:await service.list(req.wisdoDevice)});}catch(e){next(e);}});
 app.get('/api/edge/v1/rooms/:roomId',auth,async(req,res,next)=>{try{const room=await service.get(req.wisdoDevice,req.params.roomId);if(!room)return res.status(404).json({ok:false,error:'Room not found.'});res.json({ok:true,room});}catch(e){next(e);}});
 return service;
}
