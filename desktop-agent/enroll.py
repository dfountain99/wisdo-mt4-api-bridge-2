import os,secrets,socket
from pathlib import Path
import requests
from dotenv import load_dotenv
BASE=Path(__file__).resolve().parent; load_dotenv(BASE/'.env'); token=Path(os.getenv('WISDO_DEVICE_TOKEN_FILE',str(BASE/'data/device-token'))); token.parent.mkdir(parents=True,exist_ok=True)
if not token.exists(): token.write_text(secrets.token_urlsafe(48))
mt4_exe=os.getenv('WISDO_MT4_EXE','').strip()
payload={'enrollmentCode':os.environ['WISDO_DEVICE_ENROLLMENT_CODE'],'deviceId':os.environ['WISDO_DEVICE_ID'],'deviceName':os.getenv('WISDO_DEVICE_NAME',socket.gethostname()),'deviceType':'desktop-agent','token':token.read_text().strip(),'capabilities':{'mt4Discovery':True,'open_live_manager':True,'workstation_status':True,'prepare_trading_workspace':bool(mt4_exe and Path(mt4_exe).is_file()),'windows':os.name=='nt','os_telemetry':True,'ops_operator':os.getenv('WISDO_OPS_OPERATOR','').lower() in ('1','true','yes'),'restart_wisdo_worker':os.name=='nt' and os.getenv('WISDO_ALLOW_WORKER_RESTART','').lower() in ('1','true','yes') and bool(__import__('re').fullmatch(r'WISDO[A-Za-z0-9_.-]{0,60}',os.getenv('WISDO_WORKER_SERVICE_NAME','').strip()))}}
r=requests.post(os.environ['WISDO_CLOUD_BASE_URL'].rstrip('/')+'/api/device/v1/enroll',json=payload,timeout=15); r.raise_for_status(); print(r.json())
