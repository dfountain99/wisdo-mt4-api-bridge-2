import os,secrets,socket
from pathlib import Path
import requests
from dotenv import load_dotenv
BASE=Path(__file__).resolve().parent; load_dotenv(BASE/'.env'); token=Path(os.getenv('WISDO_DEVICE_TOKEN_FILE',str(BASE/'data/device-token'))); token.parent.mkdir(parents=True,exist_ok=True)
if not token.exists(): token.write_text(secrets.token_urlsafe(48))
payload={'enrollmentCode':os.environ['WISDO_DEVICE_ENROLLMENT_CODE'],'deviceId':os.environ['WISDO_DEVICE_ID'],'deviceName':os.getenv('WISDO_DEVICE_NAME',socket.gethostname()),'deviceType':'desktop-agent','token':token.read_text().strip(),'capabilities':{'mt4Discovery':True,'commandRelay':True,'windows':True}}
r=requests.post(os.environ['WISDO_CLOUD_BASE_URL'].rstrip('/')+'/api/device/v1/enroll',json=payload,timeout=15); r.raise_for_status(); print(r.json())
