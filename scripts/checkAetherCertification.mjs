import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';

const [file,expectedPr,expectedSha]=process.argv.slice(2);
if(!file||!expectedPr||!expectedSha)throw Error('Usage: node scripts/checkAetherCertification.mjs evidence.json PR HEAD_SHA');
const evidence=JSON.parse(readFileSync(file,'utf8'));
const fail=(why)=>{throw Error(`Aether certification rejected: ${why}`)};
if(!/^[a-f0-9]{40}$/.test(expectedSha))fail('expected SHA must be full length');
if(evidence.pr!==Number(expectedPr)||evidence.commit!==expectedSha)fail('PR or commit differs from current head');
if(evidence.renderer!=='aether'||!evidence.manifestHash||!/^[a-f0-9]{64}$/.test(evidence.manifestHash))fail('renderer or manifest hash missing');
if(evidence.build?.pr!==evidence.pr||evidence.build?.commit!==expectedSha||evidence.build?.manifestHash!==evidence.manifestHash)fail('preview build identity differs from evidence');
if(!evidence.reviewer||!evidence.reviewedAt||evidence.certified!==true)fail('human review is incomplete');
const required=['terrain','ocean','mountainPerimeter','towerProminence','cityComposition','forestSeparation','portalPlacement','spawnOrientation','cameraComposition'];
for(const key of required)if(evidence.checks?.[key]!=='pass')fail(`${key} did not pass`);
const observations=evidence.observations;
if(!observations||observations.generated<=0||observations.generated!==observations.rendered||observations.rendered!==observations.visible)fail('renderer observations incomplete');
for(const mode of ['desktop','portrait']){
 const view=evidence.views?.[mode];
 if(!view||view.status!=='pass'||view.viewport?.width<300||view.viewport?.height<500)fail(`${mode} view incomplete`);
 if(mode==='portrait'&&view.viewport.width>=view.viewport.height)fail('portrait viewport not portrait');
 if(mode==='desktop'&&view.viewport.width<=view.viewport.height)fail('desktop viewport not landscape');
 for(const context of ['golden','authenticatedForge']){
  const capture=view[context];
  if(!capture||capture.status!=='pass'||!capture.image||!capture.sha256||capture.commit!==expectedSha)fail(`${mode} ${context} capture missing or from another commit`);
  const absolute=path.resolve(path.dirname(file),capture.image),root=path.resolve(path.dirname(file));
  if(!absolute.startsWith(root+path.sep))fail('image outside evidence directory');
  const hash=createHash('sha256').update(readFileSync(absolute)).digest('hex');
  if(hash!==capture.sha256)fail(`${mode} ${context} image hash mismatch`);
 }
}
if(!evidence.truthReport?.persisted||evidence.truthReport.status!=='PASS')fail('persisted truth report missing');
console.log(`AETHER CERTIFICATION PASS PR #${expectedPr} ${expectedSha}`);
