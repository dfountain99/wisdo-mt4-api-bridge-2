export class WisdoBrainV2 {
  normalize(text='') { return String(text).toLowerCase().replace(/cell only/g,'sell only').replace(/sale only/g,'sell only').replace(/bye only|by only/g,'buy only').replace(/trees/g,'trades').replace(/draw down/g,'drawdown').replace(/\s+/g,' ').trim(); }
  classify(text='') {
    const input=this.normalize(text); let intent='status', confidence=0;
    const pick=(i,c)=>{ if(c>confidence){intent=i;confidence=c;} };
    if(/health|how.*looking|status|balance|equity/.test(input)) pick('health',95);
    if(/sell only|short only/.test(input)) pick('sell_only',98);
    if(/buy only|long only/.test(input)) pick('buy_only',98);
    if(/pause|freeze|halt/.test(input)) pick('pause',92);
    if(/resume|unpause|continue/.test(input)) pick('resume',92);
    if(/close all|close everything/.test(input)) pick('close_all',90);
    if(/takeover|walking away|walk away|protect account/.test(input)) pick('takeover',94);
    if(/copy future|follow leader/.test(input)) pick('copy_future',88);
    if(/mute.*signal|quiet.*signal/.test(input)) pick('mute_signals',88);
    return { input, intent, confidence, risk: ['close_all'].includes(intent)?'red':['sell_only','buy_only','pause','resume','takeover','copy_future'].includes(intent)?'yellow':'green' };
  }
}
