export const PING_TYPES={rally:'Rally here',danger:'Danger',loot:'Loot here',extract:'Prepare to extract',needAmmo:'Need ammunition',needMed:'Need medicine'};
export const REPORT_REASONS=['voice_abuse','harassment','cheating','other'];
export const VOICE_SCOPES=['squad','proximity','both'];
export const hearsSquad=scope=>scope==='squad'||scope==='both';
export const hearsProximity=scope=>scope==='proximity'||scope==='both';
