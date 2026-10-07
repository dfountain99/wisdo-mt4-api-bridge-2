import { PresenceStudioService } from '../services/presenceStudioService.js';

export function registerPresenceStudioRoutes(app,{pool,getCurrentUser,voiceService}){
  const service=new PresenceStudioService(pool);
  const auth=(req,res,next)=>{const user=getCurrentUser(req);if(!user?.id)return res.status(401).json({ok:false,error:'Login required.'});req.presenceOwner=String(user.id);res.set('Cache-Control','private, no-store');next();};
  const mutation=(req,res,next)=>{if(req.headers['x-wisdo-intent']!=='presence-studio'||req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({ok:false,error:'Same-origin presence request required.'});next();};
  const handle=fn=>async(req,res)=>{try{await fn(req,res);}catch(error){res.status(error.statusCode||500).json({ok:false,error:error.statusCode?error.message:'Presence service unavailable. Please retry.'});}};
  app.get('/api/presence-studio',auth,handle(async(req,res)=>res.json({ok:true,...await service.snapshot(req.presenceOwner)})));
  app.put('/api/presence-studio',auth,mutation,handle(async(req,res)=>res.json({ok:true,settings:await service.save(req.presenceOwner,req.body)})));
  app.post('/api/presence-studio/sources',auth,mutation,handle(async(req,res)=>res.status(201).json({ok:true,...await service.createSource(req.presenceOwner,req.body)})));
  app.delete('/api/presence-studio/sources/:id',auth,mutation,handle(async(req,res)=>{await service.revoke(req.presenceOwner,req.params.id);res.json({ok:true});}));
  app.post('/api/presence-studio/events/:id',handle(async(req,res)=>res.json({ok:true,...await service.ingest(req.params.id,String(req.headers.authorization||'').replace(/^Bearer /,''),req.body||{})})));
  const speechBusy=new Set();
  app.post('/api/presence-studio/speech',auth,mutation,handle(async(req,res)=>{
    const text=req.body?.text;
    if(typeof text!=='string'||!text.trim()||text.length>1500)return res.status(400).json({ok:false,error:'Speech requires 1–1500 characters.'});
    if(speechBusy.has(req.presenceOwner))return res.status(429).json({ok:false,error:'Please wait before requesting more speech.'});
    speechBusy.add(req.presenceOwner);
    try{const speech=await voiceService.synthesize({text});res.type(speech.contentType).send(speech.audio);}finally{setTimeout(()=>speechBusy.delete(req.presenceOwner),3000).unref();}
  }));
  return service;
}
