import {randomUUID} from 'node:crypto';
import {WEAPONS} from '../shared/raid-catalog.mjs';
export class RuleError extends Error {constructor(message,status=409){super(message);this.status=status}}
export const requireRule=(value,message,status)=>{if(!value)throw new RuleError(message,status)};
export const item=(kind,extra={})=>({id:randomUUID(),kind,condition:100,quantity:1,...(kind==='weapon'?{loaded:WEAPONS[extra.weapon]?.mag||30,attachments:[]}:{}),...extra});
