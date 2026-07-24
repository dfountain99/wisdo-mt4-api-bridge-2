import json, os, secrets, socket
from pathlib import Path
import requests
from dotenv import load_dotenv
BASE=Path(__file__).resolve().parent; load_dotenv(BASE/'.env')
DEVICE_ID=os.getenv('WISDO_DEVICE_ID') or f'pi-{socket.gethostname()}'
TOKEN_FILE=Path(os.getenv('WISDO_DEVICE_TOKEN_FILE',str(BASE/'data/device-token'))); TOKEN_FILE.parent.mkdir(parents=True,exist_ok=True)
if not TOKEN_FILE.exists(): TOKEN_FILE.write_text(secrets.token_urlsafe(48)); TOKEN_FILE.chmod(0o600)
payload={'enrollmentCode':os.environ['WISDO_DEVICE_ENROLLMENT_CODE'],'deviceId':DEVICE_ID,'deviceName':os.getenv('WISDO_DEVICE_NAME','Wisdo Office Pi'),'deviceType':'pi-edge','token':TOKEN_FILE.read_text().strip(),'capabilities':{'wakeWords':['hey wisdo','hey coach'],'voice':True,'presence':True}}
r=requests.post(os.environ['WISDO_CLOUD_BASE_URL'].rstrip('/')+'/api/device/v1/enroll',json=payload,timeout=15); r.raise_for_status(); print(json.dumps(r.json(),indent=2))
