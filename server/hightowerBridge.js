import { readFileSync } from 'node:fs';
import { HT_ACTIONS, HT_COMMAND, validateHightowerScope, hightowerMatches } from '../services/hightowerRouting.js';

export function registerHightowerBridge(app, deps) {
  const { mt4SyncService: sync, mt4CommandService: commands, getRequestAccess, resolveDeliveryIds, scheduleHeartbeat } = deps;
  const wrap = fn => async (req, res) => { try { await fn(req,res); } catch(error) { res.status(error.statusCode || 400).json({ok:false,error:String(error.message).slice(0,240)}); } };
  const assert = (ok, message) => { if(!ok) throw new Error(message); };
  async function bind(req) {
    const b=req.body || {}; const scope=validateHightowerScope(b);
    assert(typeof b.pairingCode==='string' && b.pairingCode.length<=1024,'Pairing code required');
    await sync.validateReporterAuth(req.headers,{pairingCode:b.pairingCode});
    const pair=await sync.getOrRecoverPairingCode(b.pairingCode);
    assert(pair?.discordUserId && pair.accountId && pair.status!=='expired','Use the copier code for an already linked account');
    const userIds=await resolveDeliveryIds(pair);
    const account=await accountFor(userIds,pair.accountId);
    assert(account && String(account.accountNumber)===String(b.accountNumber) && String(account.brokerServer || account.server)===String(b.brokerServer),'Pairing/account/broker mismatch');
    assert(/^[A-Za-z0-9_-]{12,100}$/.test(b.receiverId || ''),'Receiver identity required');
    return {...scope,executionTarget:'hightower',accountId:pair.accountId,accountNumber:String(b.accountNumber),pairingCode:b.pairingCode,receiverId:b.receiverId,userIds,account};
  }
  async function accountFor(ids, id) {
    for(const userId of ids) {
      const rows=await sync.repository.getAccessibleMt4Accounts(userId);
      const row=rows.find(a=>String(a.accountId)===String(id) && !a.shared);
      if(row)return row;
    }
    return null;
  }
  app.get('/member/hightower-control',wrap(async(req,res)=>{
    const access=await getRequestAccess(req);assert(access.identity?.loggedIn,'Sign in first');
    res.type('html').send(readFileSync(new URL('../public/hightower-control.html',import.meta.url),'utf8'));
  }));
  app.get('/api/wisdo/hightower/accounts',wrap(async(req,res)=>{
    const access=await getRequestAccess(req);assert(access.identity?.loggedIn,'Sign in first');
    const rows=await sync.repository.getAccessibleMt4Accounts(access.identity.userId);
    res.json({ok:true,accounts:rows.filter(a=>!a.shared).map(a=>({accountId:a.accountId,accountNumber:String(a.accountNumber),brokerServer:String(a.brokerServer || a.server)}))});
  }));
  app.post('/mt4-bot-poll',wrap(async(req,res)=>{
    const scope=await bind(req);
    scheduleHeartbeat({userId:scope.userIds[0],accountId:scope.accountId,terminal:'MT4',receiverId:scope.receiverId,meta:{executor:'hightower',symbol:scope.symbol,magicNumber:scope.magicNumber,paused:req.body.paused===true,emergency:req.body.emergency===true,positions:Number(req.body.positions)||0,version:'6.22'}});
    const {command}=await commands.claimHightower(scope.userIds,scope);
    const envelope={ok:true,protocol:1,hasCommand:!!command,accountNumber:scope.accountNumber,brokerServer:String(scope.account.brokerServer || scope.account.server),symbol:scope.symbol,magicNumber:scope.magicNumber,serverNow:Math.floor(Date.now()/1000)};
    if(command)Object.assign(envelope,{commandId:command.id,action:command.payload.action,expiresEpoch:Math.floor(new Date(command.expiresAt).getTime()/1000)});
    res.json(envelope);
  }));
  app.post('/mt4-bot-complete',wrap(async(req,res)=>{
    const scope=await bind(req); const b=req.body;
    const record=await commands.getCommandStatus(b.commandId);
    assert(record && scope.userIds.includes(String(record.userId)) && hightowerMatches(record,scope) && record.payload._receiverId===scope.receiverId,'Command receipt identity mismatch');
    assert(typeof b.success==='boolean' && typeof b.message==='string' && b.message.length<=240,'Explicit execution result required');
    if(['completed','failed'].includes(record.status))return res.json({ok:true,duplicate:true});
    assert(record.status==='delivered' || record.status==='expired','Command was not delivered');
    const result={success:b.success,message:b.message,changed:Number(b.changed)||0,requested:Number(b.requested)||0,receiverId:scope.receiverId};
    await commands.markCommandCompleteForAnyUser(scope.userIds,record.id,result,scope.accountId);
    res.json({ok:true});
  }));
  // Existing signed-in identity and existing command persistence/confirmation rules.
  app.post('/api/wisdo/hightower/command',wrap(async(req,res)=>{
    const access=await getRequestAccess(req); const uid=access.identity?.userId;
    assert(access.identity?.loggedIn && uid,'Sign in first');
    const b=req.body || {}; const target=validateHightowerScope(b);
    assert(HT_ACTIONS.includes(b.action),'Unsupported HIGHTOWER action');
    const account=await accountFor([uid],b.accountId);
    assert(account,'Select an account you own');
    const preview={accountId:account.accountId,accountNumber:String(account.accountNumber),...target,action:b.action};
    if(b.confirmed!==true)return res.json({ok:true,confirmationRequired:true,preview});
    const row=await commands.queueCommandForAccount(uid,account.accountId,HT_COMMAND,{...preview,confirmation:'confirmed',ttlMinutes:2});
    res.json({ok:true,commandId:row.id,status:row.status,executionConfirmed:false});
  }));
  app.get('/api/wisdo/hightower/receipt/:id',wrap(async(req,res)=>{
    const access=await getRequestAccess(req);assert(access.identity?.loggedIn,'Sign in first');
    const row=await commands.getCommandStatus(access.identity.userId,req.params.id);
    assert(row?.command===HT_COMMAND && String(row.userId)===String(access.identity.userId),'Command not found');
    res.json({ok:true,status:row.status,result:row.result || null});
  }));
}
