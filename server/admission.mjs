import {RuleError} from './rules.mjs';
export const DEFAULT_OPERATOR_LIMIT=27;
export function operatorLimit(value=DEFAULT_OPERATOR_LIMIT){
 if(!Number.isSafeInteger(value)||value<1||value>1024)throw new RuleError('Host operator limit must be an integer from 1 to 1024',400);
 return value;
}
export function operatorCapacity(raids,limit=DEFAULT_OPERATOR_LIMIT){
 let used=0;for(const raid of raids.values())for(const player of raid.players.values())if(player.alive||player.pending)used++;
 return {limit,used,available:Math.max(0,limit-used),overCapacity:used>limit};
}
export function requireOperatorRoom(raids,limit,count=1){
 const capacity=operatorCapacity(raids,limit);
 if(count>capacity.available)throw new RuleError('Raid server is full. Try again after operators finish their raids.',503);
 return capacity;
}
