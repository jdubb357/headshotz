import {orderedSelection,describeLoadout} from './shared/raid-loadout.mjs';
import {rankProgress} from './shared/raid-progression.mjs';
import {grantCost,repairCost,usesGrantMaterials} from './shared/raid-grants.mjs';
import {inventoryFocus,restoreInventoryFocus} from './raid-quantity-ui.mjs';
import {stackable,compatibleStacks,recyclingQuote} from './shared/raid-inventory.mjs';
import {WEAPONS,MODS,UTILITIES,ARMOR,MEDICAL,armorStats,equipmentPrice,maxStack,RECIPES,CONTRACTS,stashCapacity,itemWeight} from './shared/raid-catalog.mjs';
import {ARTIFACTS,contractItemReserved} from './shared/raid-sectors.mjs';
export function baseController({api,run,button,label,getProfile,refresh,selectedLoadout,onLoadoutChanged,chooseQuantity,onPreviewLoadout=()=>{},onInspect=()=>{},onSelectionChanged=()=>{}}){
 const $=id=>document.getElementById(id);let selectionOrder=[];
 const heading=(parent,text,level='h3')=>{const el=document.createElement(level);el.textContent=text;parent.append(el);return el};
 const option=(parent,value,text)=>{const o=document.createElement('option');o.value=value;o.textContent=text;parent.append(o)};
 const execute=async action=>{try{await api('trade',{expectedRevision:getProfile().revision,...action})}catch(error){if(error.status===409)try{await refresh()}catch{}throw error}await refresh()};
 function selectLoadout(loadout){
  selectionOrder=[...(loadout.itemIds||[])];$('recovery').checked=!!loadout.recovery;
  for(const input of $('stash').querySelectorAll('input[data-equip]'))input.checked=selectionOrder.includes(input.value);
  for(const input of $('stash').querySelectorAll('input[data-insure]'))input.checked=(loadout.insureIds||[]).includes(input.value)&&selectionOrder.includes(input.value);
  risk();onSelectionChanged();
 }
 function risk(){
  const profile=getProfile();if(!profile)return;
  const loadout=selectedLoadout(),{itemIds,recovery,insureIds}=loadout,selected=describeLoadout(profile,loadout),chosen=selected.chosen,cost=chosen.filter(it=>insureIds.includes(it.id)).reduce((n,it)=>n+Math.ceil(equipmentPrice(it)*.2),0);
  $('riskSummary').textContent=recovery?'Free recovery kit: starter rifle, one medkit, 8 backpack slots. Kit equipment cannot be banked.':`At risk: ${chosen.map(label).join('; ')||'no equipment selected'}. Weight ${chosen.reduce((n,it)=>n+itemWeight(it),0).toFixed(1)}/40 kg. Insurance premium ${cost} credits. Unsecured carried items are lost on death or timeout.`;
  const active=profile.activeDeployment,effective=active?describeLoadout({items:active.equipment},{itemIds:active.equipment.map(it=>it.id)}):recovery?{primary:{kind:'weapon',weapon:'ar',condition:100,loaded:30,recovery:true},secondary:null,armor:null,weapons:[]}:selected;
  const primary=$('primaryWeapon'),current=effective.primary?.id||'';primary.replaceChildren();
  if(!effective.weapons.length)option(primary,'',recovery?'Recovery rifle':'No weapon selected');
  else for(const it of effective.weapons)option(primary,it.id,label(it));
  primary.value=current;primary.disabled=!!active||recovery||selected.weapons.length<2;
  $('weaponSlots').textContent='Primary: '+(effective.primary?label(effective.primary):'none')+' · Secondary: '+(effective.secondary?label(effective.secondary):'none')+' · Worn armor: '+(effective.armor?label(effective.armor):'none');
  $('basePreviewCaption').textContent=active?'Operator still in raid. Preview shows equipment at deployment; reconnect for current gear.':recovery?'Free recovery kit — temporary rifle, no worn armor.':effective.primary?'Selected loadout — '+WEAPONS[effective.primary.weapon].name+(effective.secondary?' / '+WEAPONS[effective.secondary.weapon].name:'')+(effective.armor?' · '+armorStats(effective.armor).name:' · no worn armor'):'Choose equipment to preview your loadout.';
  if(active)$('riskSummary').textContent='Your operator is still deployed. Reconnect to continue; returning to this screen does not extract your equipment.';
  for(const id of ['bulkSell','savePreset','applyPreset'])$(id).disabled=!!active;$('applyPreset').disabled||=!$('presets').value;
  onPreviewLoadout({...effective,recovery:active?active.recovery:recovery});
 }
 $('primaryWeapon').onchange=()=>{const id=$('primaryWeapon').value;selectionOrder=[id,...selectionOrder.filter(value=>value!==id)];risk();onSelectionChanged();run(onLoadoutChanged)};
 function filter(){
  selectedLoadout();const query=$('stashSearch').value.toLowerCase(),kind=$('stashFilter').value,sort=$('stashSort').value;
  const rows=[...$('stash').children];
  rows.sort((a,b)=>sort==='condition'?Number(a.dataset.condition)-Number(b.dataset.condition):sort==='favorite'?Number(b.dataset.favorite)-Number(a.dataset.favorite)||a.dataset.name.localeCompare(b.dataset.name):a.dataset.name.localeCompare(b.dataset.name));
  for(const row of rows){row.hidden=!row.dataset.name.includes(query)||(kind==='favorite'?row.dataset.favorite!=='1':kind!=='all'&&row.dataset.kind!==kind);$('stash').append(row)}
 }
 for(const id of ['stashSearch','stashFilter','stashSort'])$(id).addEventListener('input',filter);
 $('stash').addEventListener('change',event=>{const target=event.target;if(target.dataset.insure&&target.checked){const equip=[...$('stash').querySelectorAll('[data-equip]')].find(e=>e.value===target.value);if(equip)equip.checked=true}if(target.dataset.equip&&!target.checked){const insure=[...$('stash').querySelectorAll('[data-insure]')].find(e=>e.value===target.value);if(insure)insure.checked=false}risk();onSelectionChanged()});$('recovery').addEventListener('change',()=>{risk();onSelectionChanged()});
 $('bulkSell').onclick=()=>run(async()=>{const ids=selectedLoadout().itemIds;if(!ids.length)throw new Error('Select items to sell first');const total=ids.reduce((n,id)=>n+(getProfile().sellValues?.[id]||0),0);const starter=ids.reduce((n,id)=>n+(getProfile().items.find(it=>it.id===id)?.grantOwner?(getProfile().sellValues?.[id]||0):0),0);if(confirm(`Sell ${ids.length} selected items for ${total} credits (${starter} starter)? Favorited and reserved contract items will prevent this sale.`))await execute({type:'bulkSell',itemIds:ids})});
 $('savePreset').onclick=()=>run(async()=>{const name=$('presetName').value.trim();await execute({type:'preset',name,itemIds:selectedLoadout().itemIds});$('presets').value=name;risk()});
 $('applyPreset').onclick=()=>run(async()=>{const name=$('presets').value;if(!name||!Object.hasOwn(getProfile().presets,name))throw new Error('Choose a saved loadout first.');const ids=getProfile().presets[name],owned=new Set(getProfile().items.map(it=>it.id));selectLoadout({itemIds:ids.filter(id=>owned.has(id)),insureIds:selectedLoadout().insureIds,recovery:false});$('presetStatus').textContent=ids.some(id=>!owned.has(id))?'Some preset items are no longer in your stash. Review the remaining selection before readying.':'Preset equipment restored in its saved order. Review insurance before readying.';await onLoadoutChanged();risk()});
 $('attach').onclick=()=>run(async()=>{const mod=getProfile().items.find(it=>it.id===$('attachmentMod').value),weapon=getProfile().items.find(it=>it.id===$('attachmentWeapon').value);if(mod?.grantOwner&&!weapon?.grantOwner&&!confirm('This starter attachment will permanently bind the weapon to your operator. Attach it?'))return;await execute({type:'attach',weaponId:$('attachmentWeapon').value,itemId:$('attachmentMod').value})});
 return {risk,selectLoadout,orderedIds(ids){selectionOrder=orderedSelection(ids,selectionOrder);return [...selectionOrder]},
  async render(profile){
   const market=await api('market');if(getProfile()!==profile)return;
   const selected=selectedLoadout(),priorFocus=inventoryFocus($('stash'));$('stash').replaceChildren();
   const rank=rankProgress(profile.xp);$('stashCapacity').textContent=`${profile.items.length}/${stashCapacity(profile)} slots · Rank ${rank.level} ${rank.name} · ${rank.totalXp} XP${rank.next?' · '+rank.nextXp+' XP to '+rank.next.name:' · maximum rank'}`;
   for(const it of profile.items){
    const row=document.createElement('div');row.className='item';row.dataset.itemId=it.id;row.dataset.kind=it.kind;row.dataset.name=label(it).toLowerCase();row.dataset.condition=it.condition;row.dataset.favorite=it.favorite?'1':'0';
    const choice=document.createElement('input');choice.type='checkbox';choice.dataset.equip='1';choice.value=it.id;choice.checked=selected.itemIds.includes(it.id);choice.disabled=it.kind==='contract'||it.condition<=0||!!profile.activeDeployment;choice.setAttribute('aria-label','Select '+label(it));row.append(choice);
    const text=document.createElement('span');text.textContent=label(it)+(it.favorite?' ★':'');row.append(text);row.append(button('Inspect',()=>onInspect(it)));
    row.append(button(it.favorite?'Unfavorite':'Favorite',()=>execute({type:'favorite',itemId:it.id,favorite:!it.favorite})));for(const type of ['sell','recycle']){const quote=type==='recycle'?recyclingQuote(it):null,text=type==='sell'?'Sell · '+(profile.sellValues?.[it.id]??'?')+(it.grantOwner?' starter credits':' credits'):quote?.quantity?'Recycle · '+quote.quantity+' '+quote.material:quote?'Recycle · needs '+quote.batchSize+' rounds':'Recycle unavailable',control=button(text,()=>execute({type,itemId:it.id}));control.disabled=contractItemReserved(profile,it)||type==='recycle'&&(!quote?.quantity||it.favorite);if(contractItemReserved(profile,it))control.title='Reserved for '+(CONTRACTS[ARTIFACTS[it.artifact]?.contract]?.name||'a recovery contract');else if(type==='recycle')control.title=it.favorite?'Unfavorite before recycling':quote?.quantity?'Consumes '+quote.consumed+'; keeps '+quote.remaining+(quote.remaining?' in the original stack':''):'Ammunition needs a complete batch; salvage is used directly in crafting';row.append(control)}
    if(stackable(it)&&it.quantity>1){const split=button('Split stack',async()=>{const account=profile.id,revision=profile.revision,quantity=await chooseQuantity({label:'Split '+label(it),max:it.quantity-1,initial:Math.floor(it.quantity/2)});if(quantity==null)return;if(getProfile()?.id!==account||getProfile().revision!==revision)throw new Error('Stash changed. Review it and try again.');await execute({type:'split',itemId:it.id,quantity,expectedRevision:revision})});split.disabled=!!profile.activeDeployment;row.append(split)}
    const target=profile.items.find(other=>other.id!==it.id&&compatibleStacks(other,it)&&(other.quantity+it.quantity)<=maxStack(it));if(target){const merge=button('Merge stack',()=>execute({type:'stack',itemId:it.id,targetId:target.id,expectedRevision:profile.revision}));merge.disabled=!!profile.activeDeployment;row.append(merge)}
    if(it.kind==='contract'){const note=document.createElement('small');note.textContent=contractItemReserved(profile,it)?'Contract item · protected from sale/recycling until its contract is complete':'Contract complete · spare artifact';row.append(note)}
    if(['weapon','armor'].includes(it.kind)){
     const ins=document.createElement('input');ins.type='checkbox';ins.dataset.insure='1';ins.value=it.id;ins.checked=selected.insureIds.includes(it.id);ins.disabled=!!profile.activeDeployment;ins.setAttribute('aria-label','Insure '+label(it));const wrapper=document.createElement('label');wrapper.append(ins,document.createTextNode(' Insure'));row.append(wrapper);
     if(it.condition<100){const cost=repairCost(profile,it),bound=grantCost(profile,cost)>0||usesGrantMaterials(profile,{steel:1});row.append(button('Repair · '+cost+' credits + 1 steel'+(bound?' · binds as starter supply':''),()=>execute({type:'repair',itemId:it.id})))}
    }
    $('stash').append(row);
   }
   filter();risk();restoreInventoryFocus($('stash'),priorFocus);
   const preset=$('presets').value;$('presets').replaceChildren();for(const name of Object.keys(profile.presets))option($('presets'),name,name);if(Object.hasOwn(profile.presets,preset))$('presets').value=preset;
   $('overflow').replaceChildren();if(profile.overflow.length)heading($('overflow'),'Protected overflow — no items were sold');
   for(const it of profile.overflow){const row=document.createElement('p');row.textContent=label(it);row.append(button('Move to stash',()=>execute({type:'claimOverflow',itemId:it.id})));$('overflow').append(row)}
   $('trader').replaceChildren();
   for(const trader of market){
    const section=document.createElement('section');heading(section,`${trader.name} · reputation ${trader.reputation}/20`);const text=document.createElement('p');text.textContent=trader.description+' Stock refreshes '+new Date(trader.restockAt).toLocaleTimeString();section.append(text);
    for(const offer of trader.stock){const b=button(`Buy ${(offer.kind==='armor'?armorStats(offer).name:offer.kind==='med'?(MEDICAL[offer.medical]||MEDICAL.field).name:null)||UTILITIES[offer.utility]?.name||WEAPONS[offer.weapon]?.name||MODS[offer.mod]?.name||offer.sku} ×${offer.packQuantity} · ${offer.price} credits · ${offer.locked?'locked':offer.quantity+' left'}${grantCost(profile,offer.price)>0?' · Starter supply':''}`,()=>execute({type:'buy',trader:trader.id,sku:offer.sku}));b.disabled=offer.locked||offer.quantity<=0||!!profile.activeDeployment;section.append(b)}
    $('trader').append(section);
   }
   $('workshop').replaceChildren();
   for(const [id,recipe]of Object.entries(RECIPES)){const text=Object.entries(recipe.materials).map(([k,v])=>`${v} ${k}`).join(', '),b=button(`Craft ${recipe.name} · ${recipe.credits} credits + ${text}${recipe.rank?' · requires Rank '+recipe.rank:''}${recipe.bench?' · workbench '+recipe.bench:''}${grantCost(profile,recipe.credits)>0||usesGrantMaterials(profile,recipe.materials)?' · Starter supply':''}`,()=>execute({type:'craft',recipe:id}));b.dataset.recipe=id;b.disabled=rank.level<(recipe.rank||1)||profile.upgrades.bench<recipe.bench||!!profile.activeDeployment;$('workshop').append(b)}
   $('upgrades').replaceChildren();for(const type of ['stash','bay','bench']){const level=profile.upgrades[type],max=type==='stash'?3:2,b=button(`${type} ${level}/${max} · upgrade ${100+50*level} credits + ${2+level} steel + 1 wire`,()=>execute({type:'upgrade',upgrade:type}));b.disabled=level>=max||!!profile.activeDeployment;$('upgrades').append(b)}
   $('attachmentWeapon').replaceChildren();$('attachmentMod').replaceChildren();$('installedMods').replaceChildren();
   for(const it of profile.items){
    if(it.kind==='weapon'){option($('attachmentWeapon'),it.id,label(it));for(const mod of it.attachments||[]){const row=document.createElement('p');row.textContent=`${label(it)} · ${label(mod)}`;row.append(button('Detach',()=>execute({type:'detach',weaponId:it.id,itemId:mod.id})));$('installedMods').append(row)}}
    if(it.kind==='mod')option($('attachmentMod'),it.id,label(it));
   }
   $('contracts').replaceChildren();for(const [id,definition]of Object.entries(CONTRACTS)){
    const p=profile.contracts[id],stage=p&&!p.completed?definition.stages[p.stage]:null,section=document.createElement('section');heading(section,definition.name);
    const text=document.createElement('p');text.textContent=`${definition.description} ${p?.completed?'COMPLETE':stage?`Stage ${p.stage+1}: ${p.progress}/${stage.need} · ${stage.reward} credits + ${stage.xp} XP`:''}`;section.append(text);
    if(!p)section.append(button('Accept contract',()=>execute({type:'contract',contract:id,operation:'accept'})));
    else if(stage){if(['deliverSteel','deliverArtifact'].includes(stage.event)&&p.progress<stage.need)section.append(button(stage.event==='deliverArtifact'?'Deliver '+ARTIFACTS[stage.artifact].name:'Deliver salvage',()=>execute({type:'contract',contract:id,operation:'deliver'})));if(p.progress>=stage.need)section.append(button('Claim stage reward',()=>execute({type:'contract',contract:id,operation:'claim'})))}
    $('contracts').append(section);
   }
   $('insurance').replaceChildren();for(const claim of profile.insurance){const text=document.createElement('p');text.textContent=`${claim.label} · ${claim.status.replaceAll('_',' ')}${claim.status==='pending'?' · eligible after '+new Date(claim.due).toLocaleTimeString()+' and raid closure':''}`;$('insurance').append(text)}
  }
 };
}
