"""Compile the CURRENT receiver/module in a small deterministic C++ compatibility shim.
This validates scheduling/protocol logic, not MQL4 compilation or broker behavior.
No copied embedded module: changes to shipped source are exercised on every run.
"""
from pathlib import Path
import re, subprocess, tempfile
root = Path(__file__).resolve().parents[1]
source = (root/'mql4/HIGHTOWER_UNITY_CAMPAIGN_v6_21.mq4').read_text()
start = source.index('// HIGHTOWER v6.20 CAMPAIGN TASK ENGINE')
module = source[start:source.index('int OnInit()', start)]
for name in ['WISDO_CampaignProtocol.mqh', 'WISDO_H620Receiver.mqh']:
    module = module.replace(f'#include "include/{name}"', (root/'mql4/include'/name).read_text())
prototypes = '\n'.join(m.group(1)+';' for m in re.finditer(r'^((?:void|bool|int|double|string) \w+\([^\n]*?\))\s*\{', module, re.M))
cpp = (root/'tests/mt4/compatibility-shim.cpp').read_text() + '\n' + prototypes + '\n' + module + '\n' + (root/'tests/mt4/receiver-scenarios.cpp').read_text()
with tempfile.TemporaryDirectory() as temp:
    path=Path(temp)/'receiver.cpp'; path.write_text(cpp)
    subprocess.run(['g++','-std=c++17','-O0',str(path),'-o',str(Path(temp)/'test')],check=True)
    subprocess.run([str(Path(temp)/'test')],check=True)
