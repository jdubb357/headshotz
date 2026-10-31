import {mapConditions} from './raid-enemies.mjs';
const clamp=value=>Math.max(0,Math.min(1,value)),smooth=(a,b,value)=>{const t=clamp((value-a)/(b-a));return t*t*(3-2*t)};
function color(a,b,t){let out=0;for(const shift of [16,8,0])out|=Math.round(((a>>shift)&255)*(1-t)+((b>>shift)&255)*t)<<shift;return out}
export function createConditionPlan(world,key){let seed=0;for(const c of key)seed=(Math.imul(seed,31)+c.charCodeAt(0))>>>0;return {version:1,startHour:[14,22,4.5,17.5][seed%4],hoursPerRaid:6.5,duration:600,weatherSeed:seed%2,frontAt:300}}
export function conditionsAt(world,plan,elapsed){
 const age=Math.max(0,elapsed),hour=(plan.startHour+plan.hoursPerRaid*clamp(age/plan.duration))%24,angle=(hour-12)/12*Math.PI,elevation=Math.cos(angle),daylight=smooth(-.12,.25,elevation),weather=mapConditions(world,plan.weatherSeed+Number(age>=plan.frontAt)),period=hour<5||hour>=20?'night':hour<8?'dawn':hour>=17?'dusk':'day',clock=String(Math.floor(hour)).padStart(2,'0')+':'+String(Math.floor((hour%1)*60)).padStart(2,'0');
 const warm=1-smooth(0,.5,Math.abs(elevation)),skyDay=color(weather.sky,0xd29c80,warm*.45),fogDay=color(weather.fog,0xb99887,warm*.35);
 return {timelineVersion:1,name:period[0].toUpperCase()+period.slice(1)+' · '+({clear:'Clear skies',rain:'Rain front',mist:'Basin mist',ash:'Drifting ash'}[weather.weather]||weather.weather),period,clock,hour,daylight,sky:color(0x101a2f,skyDay,daylight),fog:color(0x263349,fogDay,daylight),visibility:Math.max(.35,weather.visibility*(.55+.45*daylight)),light:.16+weather.light*daylight,ambient:.5+1.3*daylight,weather:weather.weather,sun:{x:Math.sin(angle)*100,y:elevation*100,z:35}};
}
