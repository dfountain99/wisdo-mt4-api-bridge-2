from __future__ import annotations
import json, os, re, socket, subprocess, time, webbrowser
from pathlib import Path
import requests, psutil
from dotenv import load_dotenv
BASE=Path(__file__).resolve().parent; load_dotenv(BASE/'.env')
CLOUD=os.environ['WISDO_CLOUD_BASE_URL'].rstrip('/'); DEVICE_ID=os.environ['WISDO_DEVICE_ID']; TOKEN=Path(os.environ.get('WISDO_DEVICE_TOKEN_FILE',str(BASE/'data/device-token')))
def headers(): return {'Authorization':f'Bearer {TOKEN.read_text().strip()}','X-Wisdo-Device-Id':DEVICE_ID,'Content-Type':'application/json'}

def worker_service_name():
  name=os.getenv('WISDO_WORKER_SERVICE_NAME','').strip()
  allowed=os.getenv('WISDO_ALLOW_WORKER_RESTART','').strip().lower() in ('1','true','yes')
  return name if os.name=='nt' and allowed and re.fullmatch(r'WISDO[A-Za-z0-9_.-]{0,60}',name) else ''

def restart_wisdo_worker():
  name=worker_service_name()
  if not name: raise RuntimeError('Restart is disabled or WISDO worker service is not allowlisted.')
  if name.casefold()==os.getenv('WISDO_AGENT_SERVICE_NAME','WISDOAgent').casefold():
    raise RuntimeError('Restarting the WISDO desktop agent service itself is prohibited.')
  service=psutil.win_service_get(name)
  service_info=service.as_dict()
  if service_info.get('status')=='running':
    subprocess.run(['sc.exe','stop',name],timeout=20,check=True,capture_output=True,text=True)
    deadline=time.monotonic()+20
    while time.monotonic()<deadline and service.status()!='stopped': time.sleep(.5)
    if service.status()!='stopped': raise RuntimeError('WISDO worker did not stop; restart was not forced.')
  subprocess.run(['sc.exe','start',name],timeout=20,check=True,capture_output=True,text=True)
  deadline=time.monotonic()+25
  while time.monotonic()<deadline and service.status()!='running': time.sleep(.5)
  if service.status()!='running': raise RuntimeError('WISDO worker failed to start.')
  return {'serviceName':name,'status':'running'}

def report_os_heartbeat():
  role='vps' if os.name=='nt' and os.getenv('WISDO_NODE_ROLE','').strip().lower()=='vps' else 'desktop'
  payload={
    'nodeId':DEVICE_ID,'name':os.getenv('WISDO_DEVICE_NAME',socket.gethostname()),'role':role,
    'metrics':{
      'cpuPercent':psutil.cpu_percent(interval=.1),
      'memoryPercent':psutil.virtual_memory().percent,
      'diskPercent':psutil.disk_usage(str(BASE.anchor or '/')).percent,
      'terminalCount':len(discover()),
    }
  }
  response=requests.post(f'{CLOUD}/api/os/v1/nodes/heartbeat',headers=headers(),json=payload,timeout=12)
  response.raise_for_status()
  return response.json()

def desktop_capabilities():
  mt4=Path(os.getenv('WISDO_MT4_EXE','').strip())
  return {
    'mt4Discovery': True,
    'open_live_manager': True,
    'workstation_status': True,
    'prepare_trading_workspace': bool(str(mt4) and mt4.is_file()),
    'windows': os.name == 'nt',
    'os_telemetry': True,
    'ops_operator': os.getenv('WISDO_OPS_OPERATOR','').strip().lower() in ('1','true','yes'),
    'restart_wisdo_worker': bool(worker_service_name()),
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
  if intent=='restart_wisdo_worker':
    try:
      result=restart_wisdo_worker()
      return 'completed',result,'Configured WISDO worker service restarted and verified running.'
    except Exception as exc:
      return 'failed',{},str(exc)
  if intent=='workstation_status':
    return 'completed',{'host':socket.gethostname(),'mt4Running':mt4_running(),'capabilities':desktop_capabilities(),'cpuPercent':psutil.cpu_percent(interval=.1),'memoryPercent':psutil.virtual_memory().percent},'Workstation status verified.'
  return 'rejected',{},f'Intent {intent} is not implemented by this desktop agent. No local action was taken.'

def loop():
  last_register=0
  last_heartbeat=0
  while True:
    try:
      if time.time()-last_register>30: register_bots(); last_register=time.time()
      if time.time()-last_heartbeat>20:
        try: report_os_heartbeat()
        except Exception as exc: print('OS heartbeat error:',str(exc)[:200])
        last_heartbeat=time.time()
      r=requests.post(f'{CLOUD}/api/agent/v1/commands/lease',headers=headers(),json={'limit':10},timeout=15); r.raise_for_status()
      for cmd in r.json().get('commands',[]):
        status,result,message=execute(cmd)
        requests.post(f'{CLOUD}/api/agent/v1/commands/{cmd["command_id"]}/complete',headers=headers(),json={'status':status,'result':result,'message':message},timeout=15).raise_for_status()
    except Exception as exc: print('agent error:',exc)
    time.sleep(1)
if __name__=='__main__': loop()
