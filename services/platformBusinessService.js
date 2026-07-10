import fs from 'node:fs/promises';
import path from 'node:path';
export class PlatformBusinessService{
 constructor(config={}){this.dataDir=config.dataDir||'data/operator-desks';this.filePath=path.join(this.dataDir,'platform-business.json');}
 async load(){try{return {marketplace:{products:[]},commissions:[],academy:{progress:{}},alerts:{},...JSON.parse(await fs.readFile(this.filePath,'utf8'))};}catch{return {marketplace:{products:[]},commissions:[],academy:{progress:{}},alerts:{}};}}
 async save(data){await fs.mkdir(this.dataDir,{recursive:true});const tmp=`${this.filePath}.tmp`;await fs.writeFile(tmp,JSON.stringify(data,null,2));await fs.rename(tmp,this.filePath);}
 defaultProducts(){return [{name:'DFSAUCE FINAL AI',priceUsd:3000,type:'bot'},{name:'DF HANDSFREE',priceUsd:997,type:'bot'},{name:'DEADSHOT',priceUsd:997,type:'bot'},{name:'Copy Trading Leader Access',priceUsd:97,type:'membership'}];}
 async marketplace(){const data=await this.load(); if(!data.marketplace.products.length){data.marketplace.products=this.defaultProducts(); await this.save(data);} return data.marketplace;}
 async academy(userId){const modules=['Connect MT4','Use WISDO safely','Choose risk','Copy trading rules','Backtest and submit results'];const data=await this.load();const done=data.academy.progress[userId]||[];return {modules:modules.map(m=>({title:m,done:done.includes(m)})),rank:done.length>=5?'Operator':done.length>=3?'Apprentice':'Beginner'};}
 async addAlert(userId, alert){const data=await this.load();data.alerts[userId]||=[];data.alerts[userId].unshift({id:`alert_${Date.now()}`,...alert,createdAt:new Date().toISOString()});data.alerts[userId]=data.alerts[userId].slice(0,100);await this.save(data);return data.alerts[userId][0];}
 async alerts(userId){const data=await this.load();return data.alerts[userId]||[];}
}
