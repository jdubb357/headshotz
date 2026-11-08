// HeadShotz v104: throw and flamethrower rules. No rendering, so tests can import this directly.
export function isInfinite(w){return !!(w&&w.inf)}
export function needsReload(w){return !(w&&(w.melee||w.inf))}
export function hitDamage(w,head){if(!w)return 0;return head?w.head:w.body}
export function throwMotion(w){return {speed:+w.spd||40,grav:+w.grav||8}}
// A tag burns for 2s, ticking 4 damage every half second. It does not stack into a bigger tick.
export function startBurn(now){return {until:now+2,next:now+.5,dps:4,step:.5}}
export function burnStep(burn,now){
 if(!burn||now>burn.until)return {done:true,dmg:0};
 if(now<burn.next)return {done:false,dmg:0,next:burn.next};
 return {done:false,dmg:burn.dps,next:now+burn.step};
}
