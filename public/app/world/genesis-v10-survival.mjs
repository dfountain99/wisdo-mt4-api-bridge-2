/* WISDO Genesis V10 — survival/crafting engine (standalone, opt-in).
   Import as ES module; no automatic DOM, scene, or save mutations. */
export const MATERIALS = Object.freeze(["wood","stone","iron","steel","gold"]);
export const RECIPES = Object.freeze({
  crafting_table:{wood:4},
  wood_wall:{wood:3},wood_floor:{wood:3},wood_roof:{wood:4},
  stone_wall:{stone:5},stone_floor:{stone:4},stone_roof:{stone:6},
  iron_wall:{iron:5},iron_floor:{iron:4},iron_roof:{iron:6},
  steel_wall:{steel:5},steel_floor:{steel:4},steel_roof:{steel:6},
  gold_wall:{gold:5},gold_floor:{gold:4},gold_roof:{gold:6}
});
const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,n));
export class GenesisSurvival {
 constructor(snapshot={}){
   this.inventory={wood:0,stone:0,iron:0,steel:0,gold:0,water:0,food:0,...snapshot.inventory};
   this.stats={health:100,hunger:100,thirst:100,warmth:60,stamina:100,...snapshot.stats};
   this.weather=snapshot.weather||"clear";this.temperatureC=snapshot.temperatureC??22;
   this.structures=Array.isArray(snapshot.structures)?snapshot.structures:[];this.stations=snapshot.stations||0;
   this.prism={mood:"curious",energy:100,trust:50,...snapshot.prism};
   this.events=[];
 }
 emit(type,data={}){const event={type,...data};this.events.push(event);return event;}
 tick(seconds,{sheltered=false,nearFire=false,active=false}={}){
   const s=clamp(seconds,0,3600),cold=this.temperatureC<8,hot=this.temperatureC>32;
   this.stats.hunger=clamp(this.stats.hunger-s/100);
   this.stats.thirst=clamp(this.stats.thirst-s/(hot?55:80));
   const target=nearFire?85:sheltered?65:cold?20:hot?85:60;
   this.stats.warmth=clamp(this.stats.warmth+(target-this.stats.warmth)*Math.min(1,s/180));
   this.stats.stamina=clamp(this.stats.stamina+(active?-s/15:s/8));
   if(this.stats.hunger===0||this.stats.thirst===0||this.stats.warmth<10)this.stats.health=clamp(this.stats.health-s/45);
   this.prism.energy=clamp(this.prism.energy+(active?-s/20:s/15));
   this.prism.mood=this.stats.health<30?"concerned":this.weather==="storm"?"alert":this.prism.energy<25?"tired":"curious";
   return this.snapshot();
 }
 setWeather(weather,temperatureC){if(!["clear","rain","snow","storm","heatwave","fog"].includes(weather))throw Error("Unknown weather");this.weather=weather;this.temperatureC=temperatureC;return this.emit("weather_changed",{weather,temperatureC});}
 harvest(kind,{tool="hands",amount=1}={}){
   const resource={tree:"wood",rock:"stone",iron_ore:"iron",gold_ore:"gold"}[kind];
   if(!resource)throw Error("Unknown harvestable");
   if(kind!=="tree"&&tool!=="pickaxe")throw Error("A pickaxe is required to mine");
   if(kind==="tree"&&!["hands","axe"].includes(tool))throw Error("Invalid woodcutting tool");
   if(this.stats.stamina<5)throw Error("Too exhausted");
   const qty=Math.max(1,Math.min(20,Math.floor(amount)))*(tool==="axe"&&kind==="tree"?2:1);
   this.inventory[resource]+=qty;this.stats.stamina=clamp(this.stats.stamina-5);
   return this.emit("harvest",{kind,resource,amount:qty,animation:kind==="tree"?"chop_tree":"strike_ore"});
 }
 craft(recipe){
   const cost=RECIPES[recipe];if(!cost)throw Error("Unknown recipe");
   if(recipe!=="crafting_table"&&this.stations<1)throw Error("Build a crafting table first");
   if(!Object.entries(cost).every(([item,n])=>(this.inventory[item]||0)>=n))throw Error("Missing resources");
   for(const [item,n] of Object.entries(cost))this.inventory[item]-=n;
   if(recipe==="crafting_table")this.stations++;
   else this.inventory[recipe]=(this.inventory[recipe]||0)+1;
   return this.emit("crafted",{recipe});
 }
 place(recipe,position,rotation=0){
   if(!/_wall$|_floor$|_roof$/.test(recipe)||!RECIPES[recipe])throw Error("Invalid structure");
   if((this.inventory[recipe]||0)<1)throw Error("Craft structure first");
   if(!position||!["x","y","z"].every(k=>Number.isFinite(position[k])))throw Error("Invalid position");
   this.inventory[recipe]--;
   const structure={id:"s"+(this.structures.length+1),type:recipe,position:{...position},rotation};
   this.structures.push(structure);return this.emit("structure_placed",{structure});
 }
 consume(kind,amount=1){if(!["water","food"].includes(kind))throw Error("Invalid consumable");if((this.inventory[kind]||0)<amount)throw Error("Insufficient supplies");this.inventory[kind]-=amount;this.stats[kind==="food"?"hunger":"thirst"]=clamp(this.stats[kind==="food"?"hunger":"thirst"]+amount*20);return this.emit("consumed",{kind,amount});}
 snapshot(){return JSON.parse(JSON.stringify({inventory:this.inventory,stats:this.stats,weather:this.weather,temperatureC:this.temperatureC,structures:this.structures,stations:this.stations,prism:this.prism}));}
}
