export const MATCH_POLICY={version:1,maxPlayers:9,joinSeconds:60,spawnSeparation:28,probeValidMs:30000,gear:'open',skill:'open',fallback:'Create a fresh raid when no safe compatible session exists. No minimum population or invented human opponents.'};
export function matchPreferences(value={}){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['allowMixed','maxRttMs'].includes(k))||Object.hasOwn(value,'allowMixed')&&typeof value.allowMixed!=='boolean'||Object.hasOwn(value,'maxRttMs')&&![0,150,250,400].includes(value.maxRttMs))throw new Error('Choose valid squad-size and latency preferences');
 return {allowMixed:value.allowMixed??true,maxRttMs:value.maxRttMs??0};
}
export const squadPool=size=>['','solo','duo','trio'][size];
