import {randomBytes} from 'node:crypto';

/**
 * In-memory presence for one Genesis server process. This is a first milestone,
 * NOT distributed multiplayer: multiple workers need a shared presence store.
 */
export class GenesisMultiplayerPresence {
  constructor({capacity=100,ttlMs=30000,radius=140,maxVisible=24,clock=Date.now}={}){
    this.capacity=capacity;
    this.ttlMs=ttlMs;
    this.radius=radius;
    this.maxVisible=maxVisible;
    this.clock=clock;
    this.players=new Map();
  }

  get(userId){return this.players.get(String(userId));}

  prune(now=this.clock()){
    for(const [id,p] of this.players)
      if(now-p.seenAt>this.ttlMs)this.players.delete(id);
  }

  join(userId,{speed,now=this.clock()}={}){
    this.prune(now);
    const id=String(userId);
    let p=this.players.get(id);
    if(!p){
      if(this.players.size>=this.capacity)
        throw Object.assign(new Error('Genesis world has reached its '+this.capacity+'-player limit.'),{status:503});
      const initial=Number.isFinite(speed)&&speed>0?speed:5.3;
      p={x:0,z:0,at:now,seenAt:now,speed:initial,
        publicId:randomBytes(6).toString('hex'),
        credit:Math.max(1.7,initial*.6),creditAt:now};
      this.players.set(id,p);
    }
    if(Number.isFinite(speed)&&speed>0)p.speed=speed;
    p.seenAt=now;
    return p;
  }

  // Movement credit accumulates with elapsed time, never with request count.
  move(userId,{x,z},now=this.clock()){
    if(!Number.isFinite(x)||!Number.isFinite(z))
      throw new TypeError('Finite coordinates required');
    const p=this.join(userId,{now});
    const elapsed=Math.min(3000,Math.max(0,now-p.creditAt))/1000;
    p.credit=Math.min(Math.max(1.7,p.speed*3.2),p.credit+p.speed*elapsed);
    p.creditAt=now;
    const distance=Math.hypot(x-p.x,z-p.z);
    if(distance>p.credit+.001)
      return {ok:false,position:{x:p.x,z:p.z}};
    p.credit=Math.max(0,p.credit-distance);
    p.x=x;p.z=z;p.at=now;
    return {ok:true,position:{x,z}};
  }

  teleport(userId,{x,z},now=this.clock()){
    const p=this.join(userId,{now});
    p.x=x;p.z=z;p.at=now;p.credit=0;p.creditAt=now;
    return p;
  }

  nearby(userId,now=this.clock()){
    const me=this.join(userId,{now});
    const nearby=[];
    for(const [id,p] of this.players){
      if(id===String(userId))continue;
      const d=(p.x-me.x)**2+(p.z-me.z)**2;
      if(d<=this.radius**2)nearby.push({id:p.publicId,x:p.x,z:p.z,d});
    }
    nearby.sort((a,b)=>a.d-b.d);
    return {ok:true,online:this.players.size,capacity:this.capacity,
      players:nearby.slice(0,this.maxVisible).map(({id,x,z})=>({id,x,z}))};
  }
}
