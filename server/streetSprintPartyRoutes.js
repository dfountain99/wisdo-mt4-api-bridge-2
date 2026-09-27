import {getSessionUser} from './security.js';
import {StreetSprintPartyService} from '../services/streetSprintPartyService.js';

function currentUser(req){
  const session=getSessionUser(req);
  if(session?.id)return session;
  if(process.env.NODE_ENV==='test'&&req.headers['x-wisdo-test-user'])return{id:String(req.headers['x-wisdo-test-user'])};
  return null;
}
function auth(req,res,next){const user=currentUser(req);if(!user)return res.status(401).json({ok:false,code:'authentication_required'});req.raceUser=user;next();}
function respond(res,error){res.status(error.statusCode||500).json({ok:false,code:error.code||'party_unavailable',error:error.statusCode?error.message:'Party service unavailable.'});}
const wrap=(fn)=>(req,res)=>Promise.resolve().then(()=>fn(req,res)).catch(error=>respond(res,error));

export function registerStreetSprintPartyRoutes(app,{pool}={}){
  const parties=new StreetSprintPartyService({pool});
  app.use('/api/world/race-parties',auth,(_req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
  app.get('/api/world/race-parties',wrap(async(req,res)=>res.json({ok:true,parties:await parties.list(req.raceUser.id)})));
  app.post('/api/world/race-parties',wrap(async(req,res)=>res.status(201).json({ok:true,party:await parties.create(req.raceUser.id,req.body?.durationMinutes)})));
  app.get('/api/world/race-parties/:id',wrap(async(req,res)=>res.json({ok:true,party:await parties.get(req.params.id,req.raceUser.id)})));
  app.post('/api/world/race-parties/:id/invitations',wrap(async(req,res)=>res.json({ok:true,party:await parties.invite(req.params.id,req.raceUser.id,req.body?.userId)})));
  app.post('/api/world/race-parties/:id/join',wrap(async(req,res)=>res.json({ok:true,party:await parties.join(req.params.id,req.raceUser.id)})));
  app.post('/api/world/race-parties/:id/ready',wrap(async(req,res)=>res.json({ok:true,party:await parties.ready(req.params.id,req.raceUser.id,req.body?.ready)})));
  app.post('/api/world/race-parties/:id/leave',wrap(async(req,res)=>res.json({ok:true,...await parties.leave(req.params.id,req.raceUser.id)})));
  // The browser race cannot authoritatively prove position, pickups, hits, or banking.
  // Do not start a fake shared match or credit its self-reported result.
  app.post('/api/world/race-parties/:id/start',wrap(async(req,res)=>{
    await parties.get(req.params.id,req.raceUser.id);
    res.status(503).json({ok:false,code:'race_match_host_unavailable',error:'A synchronized race host is required before a party can start.'});
  }));
  app.post('/api/world/race-parties/:id/results',wrap(async(req,res)=>{
    await parties.get(req.params.id,req.raceUser.id);
    res.status(409).json({ok:false,code:'race_result_unverified',error:'Browser-reported results cannot award Culture Coins or XP.'});
  }));
  return parties;
}
