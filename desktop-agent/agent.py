from __future__ import annotations
import json, os, socket, subprocess, time
from pathlib import Path
import requests, psutil
from dotenv import load_dotenv
BASE=Path(__file__).resolve().parent; load_dotenv(BASE/'.env')
CLOUD=os.environ['WISDO_CLOUD_BASE_URL'].rstrip('/'); DEVICE_ID=os.environ['WISDO_DEVICE_ID']; TOKEN=Path(os.environ.get('WISDO_DEVICE_TOKEN_FILE',str(BASE/'data/device-token')))
def headers(): return {'Authorization':f'Bearer {TOKEN.read_text().strip()}','X-Wisdo-Device-Id':DEVICE_ID,'Content-Type':'application/json'}
def discover():
  bots=[]
  for p in psutil.process_iter(['pid','name','exe']):
    name=(p.info.get('name') or '').lower()
    if name in ('terminal.exe','terminal64.exe'):
      terminal=Path(p.info.get('exe') or '').parent.name or name
      bots.append({'botId':f'{DEVICE_ID}:{p.info["pid"]}','botName':terminal,'aliases':[terminal.lower(),'mt4','trading bot'],'terminalName':terminal,'capabilities':{'bot_status':True,'protect_profit':True,'close_profitable':True,'close_losing':True,'close_all':True,'pause_entries':True,'resume_entries':True},'metadata':{'pid':p.info['pid'],'exe':p.info.get('exe')}})
  return bots

def register_bots():
  for bot in discover():
    r=requests.post(f'{CLOUD}/api/device/v1/bots/register',headers=headers(),json=bot,timeout=10); r.raise_for_status()

def execute(cmd):
  intent=cmd['intent']; target=cmd.get('target_id'); params=cmd.get('parameters') or {}
  # Safe adapter boundary: local bot/reporters can replace this with named-pipe, file queue, or localhost API execution.
  allowed={'bot_status','protect_profit','close_profitable','close_losing','close_all','pause_entries','resume_entries'}
  if intent not in allowed: return 'rejected',{},f'Intent {intent} is not supported by this desktop agent.'
  result={'intent':intent,'target':target,'parameters':params,'host':socket.gethostname(),'executedAt':time.time()}
  # Current integration writes a durable local command inbox consumed by the Reporter upgrade.
  inbox=BASE/'runtime'/'command-inbox.jsonl'; inbox.parent.mkdir(parents=True,exist_ok=True)
  with inbox.open('a',encoding='utf-8') as f: f.write(json.dumps({'commandId':cmd['command_id'],**result})+'\n')
  return 'completed',result,f'{target or "The selected bot"} confirmed {intent.replace("_"," ")}.'

def loop():
  last_register=0
  while True:
    try:
      if time.time()-last_register>30: register_bots(); last_register=time.time()
      r=requests.post(f'{CLOUD}/api/agent/v1/commands/lease',headers=headers(),json={'limit':10},timeout=15); r.raise_for_status()
      for cmd in r.json().get('commands',[]):
        status,result,message=execute(cmd)
        requests.post(f'{CLOUD}/api/agent/v1/commands/{cmd["command_id"]}/complete',headers=headers(),json={'status':status,'result':result,'message':message},timeout=15).raise_for_status()
    except Exception as exc: print('agent error:',exc)
    time.sleep(1)
if __name__=='__main__': loop()
