from __future__ import annotations
import json, os, socket, subprocess, time, webbrowser
from pathlib import Path
import requests, psutil
from dotenv import load_dotenv
BASE=Path(__file__).resolve().parent; load_dotenv(BASE/'.env')
CLOUD=os.environ['WISDO_CLOUD_BASE_URL'].rstrip('/'); DEVICE_ID=os.environ['WISDO_DEVICE_ID']; TOKEN=Path(os.environ.get('WISDO_DEVICE_TOKEN_FILE',str(BASE/'data/device-token')))
def headers(): return {'Authorization':f'Bearer {TOKEN.read_text().strip()}','X-Wisdo-Device-Id':DEVICE_ID,'Content-Type':'application/json'}
def desktop_capabilities():
  mt4=Path(os.getenv('WISDO_MT4_EXE','').strip())
  return {
    'mt4Discovery': True,
    'open_live_manager': True,
    'workstation_status': True,
    'prepare_trading_workspace': bool(str(mt4) and mt4.is_file()),
    'windows': os.name == 'nt',
  }

def discover():
  bots=[]
  for p in psutil.process_iter(['pid','name','exe']):
    name=(p.info.get('name') or '').lower()
    if name in ('terminal.exe','terminal64.exe'):
      terminal=Path(p.info.get('exe') or '').parent.name or name
      # Bot discovery is observational. Trading mutations stay on the verified
      # Reporter/HIGHTOWER command path and are not claimed by this desktop agent.
      bots.append({'botId':f'{DEVICE_ID}:{p.info["pid"]}','botName':terminal,'aliases':[terminal.lower(),'mt4','trading bot'],'terminalName':terminal,'capabilities':{'bot_status':True},'metadata':{'pid':p.info['pid'],'exe':p.info.get('exe')}})
  return bots

def register_bots():
  for bot in discover():
    r=requests.post(f'{CLOUD}/api/device/v1/bots/register',headers=headers(),json=bot,timeout=10); r.raise_for_status()

def mt4_running():
  configured=os.getenv('WISDO_MT4_EXE','').strip().lower()
  for p in psutil.process_iter(['name','exe']):
    name=(p.info.get('name') or '').lower()
    exe=(p.info.get('exe') or '').lower()
    if name in ('terminal.exe','terminal64.exe') and (not configured or exe==configured):
      return True
  return False

def open_live_manager():
  url=os.getenv('WISDO_LIVE_MANAGER_URL','').strip() or f'{CLOUD}/app/command-center'
  if not webbrowser.open(url,new=0,autoraise=True):
    raise RuntimeError('The operating system did not accept the Live Manager launch request.')
  return url

def prepare_trading_workspace():
  mt4_path=Path(os.getenv('WISDO_MT4_EXE','').strip())
  if not str(mt4_path) or not mt4_path.is_file():
    raise RuntimeError('WISDO_MT4_EXE is not configured to a real MetaTrader executable.')
  launched=False
  if not mt4_running():
    subprocess.Popen([str(mt4_path)],cwd=str(mt4_path.parent))
    launched=True
  url=open_live_manager()
  return {'mt4Path':str(mt4_path),'mt4Launched':launched,'liveManagerUrl':url,'host':socket.gethostname()}

def execute(cmd):
  intent=str(cmd.get('intent') or '').lower()
  if intent=='open_live_manager':
    url=open_live_manager()
    return 'completed',{'url':url,'host':socket.gethostname()},'Live Manager opened on the trading workstation.'
  if intent=='prepare_trading_workspace':
    try:
      result=prepare_trading_workspace()
      return 'completed',result,'Trading workspace verified: MetaTrader and WISDO Live Manager are available on the workstation.'
    except Exception as exc:
      return 'failed',{},str(exc)
  if intent=='workstation_status':
    return 'completed',{'host':socket.gethostname(),'mt4Running':mt4_running(),'capabilities':desktop_capabilities(),'cpuPercent':psutil.cpu_percent(interval=.1),'memoryPercent':psutil.virtual_memory().percent},'Workstation status verified.'
  return 'rejected',{},f'Intent {intent} is not implemented by this desktop agent. No local action was taken.'

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
