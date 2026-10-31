export const RAID_PROTOCOL=9;
export const RECEIPT_LIMIT=64;
export const ACTION_FIELDS={move:['x','z','yaw','pitch'],fire:['yaw','pitch'],throw:['itemId','yaw','pitch'],jump:[],reload:[],equip:['itemId'],wear:['itemId'],removeArmor:[],drop:['itemId'],stack:['itemId','targetId'],split:['itemId','quantity'],unsecure:['itemId'],revive:['targetId'],carry:['targetId'],use:['itemId'],search:['sourceId'],take:['sourceId','itemId','quantity'],secure:['itemId'],call:['exitId'],unlock:['exitId'],extract:['exitId'],ping:['kind','exitId']};
const COMMON=['type','seq','protocol','raidId','deploymentId','includeState'];
export function validateAction(message,{wire=false}={}){
 const reject=text=>{throw new Error(text)};
 if(!message||typeof message!=='object'||Array.isArray(message)||!Object.hasOwn(ACTION_FIELDS,message.type))reject('Unknown or invalid action');
 if(message.protocol!=null&&message.protocol!==RAID_PROTOCOL||wire&&message.protocol!==RAID_PROTOCOL)reject('Client update required. Reload to use the current game protocol.');
 if(!Number.isSafeInteger(message.seq)||message.seq<1)reject('Invalid action sequence');
 const allowed=new Set(COMMON.concat(ACTION_FIELDS[message.type]));if(Object.keys(message).some(key=>!allowed.has(key)))reject('Unknown action field');
 for(const [key,value]of Object.entries(message)){
  if(['type','protocol','seq'].includes(key))continue;
  if(['x','z','yaw','pitch'].includes(key)){if(!Number.isFinite(value)||Math.abs(value)>1e6)reject('Invalid movement or aim')}
  else if(key==='quantity'){if(!Number.isSafeInteger(value)||value<1||value>200)reject('Invalid quantity')}
  else if(key==='includeState'){if(typeof value!=='boolean')reject('Invalid state request')}
  else if(typeof value!=='string'||value.length<1||value.length>80||!/^[a-zA-Z0-9_-]+$/.test(value))reject('Invalid action identifier');
 }
 if(message.type==='move'&&['x','z','yaw'].some(key=>!Number.isFinite(message[key])))reject('Invalid movement');
 if(wire&&(!message.raidId||!message.deploymentId))reject('Raid and deployment identity required');
 const sorted={};for(const key of Object.keys(message).filter(key=>key!=='includeState').sort())sorted[key]=message[key];return JSON.stringify(sorted);
}
