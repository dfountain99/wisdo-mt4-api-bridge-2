from __future__ import annotations
import json, os, re, subprocess, time, uuid
from pathlib import Path
import requests
from dotenv import load_dotenv

BASE=Path(__file__).resolve().parent
load_dotenv(BASE/'.env')
CLOUD=os.getenv('WISDO_CLOUD_BASE_URL','').rstrip('/')
DEVICE_ID=os.getenv('WISDO_DEVICE_ID','')
TOKEN_FILE=Path(os.getenv('WISDO_DEVICE_TOKEN_FILE',str(BASE/'data/device-token')))
AUDIO=os.getenv('WISDO_AUDIO_OUTPUT','plughw:CARD=S24c,DEV=0')

def headers(): return {'Authorization':f'Bearer {TOKEN_FILE.read_text().strip()}','X-Wisdo-Device-Id':DEVICE_ID,'Content-Type':'application/json','Accept':'application/json'}

def parse_voice(text:str):
    normalized=' '.join(text.lower().split())
    normalized=re.sub(r'^(hey|okay)\s+(wisdo|coach)[, ]*','',normalized)
    intents=[
      ('close profitable','close_profitable'),('close winners','close_profitable'),('close losing','close_losing'),('close losers','close_losing'),
      ('close all','close_all'),('protect profit','protect_profit'),('secure profit','protect_profit'),('pause','pause_entries'),('resume','resume_entries'),('status','bot_status')]
    intent=next((v for k,v in intents if k in normalized),'bot_status')
    bot=None
    for pattern in [r'tell ([a-z0-9 _-]+?) to ',r'ask ([a-z0-9 _-]+?) (?:for|to|how)',r'([a-z0-9_-]+) status']:
      m=re.search(pattern,normalized)
      if m: bot=m.group(1).strip(); break
    return {'intent':intent,'target':{'type':'bot','alias':bot or ''},'parameters':{},'spokenText':text,'source':'voice','requestId':str(uuid.uuid4())}

def issue(text:str):
    response=requests.post(f'{CLOUD}/api/device/v1/commands',headers=headers(),json=parse_voice(text),timeout=10); response.raise_for_status(); return response.json()['command']

def wait(command_id:str, timeout=45):
    end=time.time()+timeout
    while time.time()<end:
      response=requests.get(f'{CLOUD}/api/device/v1/commands/{command_id}',headers=headers(),timeout=10); response.raise_for_status(); cmd=response.json()['command']
      if cmd['status'] in ('completed','failed','rejected'): return cmd
      time.sleep(1)
    return {'status':'timeout','result_message':'The bot did not confirm before the timeout.'}

def speak(text:str):
    wav='/tmp/wisdo-result.wav'; subprocess.run(['espeak-ng','-w',wav,text],check=True); subprocess.run(['aplay','-q','-D',AUDIO,wav],check=True)

def main():
    print('Wisdo Edge command gateway ready. Type a voice transcript, or Ctrl+C.')
    while True:
      text=input('You> ').strip()
      if not text: continue
      try:
        command=issue(text); result=wait(command['command_id']); message=result.get('result_message') or ('Command completed.' if result['status']=='completed' else f"Command {result['status']}.")
      except Exception as exc: message=f'Wisdo command failed: {exc}'
      print('Wisdo>',message); speak(message)
if __name__=='__main__': main()
