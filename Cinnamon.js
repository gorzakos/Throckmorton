// Hey there!
// This is CODE, lets you control your character with code.
// If you don't know how to code, don't worry, It's easy.
// Just set attack_mode to true and ENGAGE!

var desired_levels={
	wcap:8,
	wgloves:8,
	wattire:8,
	wbreeches:8,
	wshoes:8,
    helmet:8,
    coat:8,
    shoes:8,
	dexring:2,
	strring:3,
	intring:3,
	dexearring:2,
	strearring:3,
	intearring:3,
	dexamulet:3,
	stramulet:2,
	intamulet:3,
	quiver:8,
	wbook0:4,
	hbow:7,
	mushroomstaff:7,
	blade:7,
	carrotsword:5,
	staff:7,
	shield:4,
	wshield:7,
}

// >["secondhands"]
// <["secondhands",[{name: "quiver", level: 0, rid: "s886H"},...]]
// >["sbuy", {rid: "XAWNJ"}]
// >["merchant", {close: 1}]

var monster_level_boosts = get("monster_level_boosts");

function reset_monster_level_boosts(){set("monster_level_boosts", {});}
function observe_monster_level_boosts(){
    var additions=false;
    if(!monster_level_boosts){log("not loading, run reset_monster_level_boosts()")}
    for(id in parent.entities){
        var ent=parent.entities[id];
        if(!(ent.type=="monster")){continue;}
        if(!(ent.level>1)){continue;}
        if(monster_level_boosts[ent.mtype]){continue;}
        monster_level_boosts = get("monster_level_boosts")
        if(monster_level_boosts[ent.mtype]){continue;}
        monster_level_boosts[ent.mtype]=calculate_monster_level_boost(ent);
        log("observed level boost of "+ent.mtype)
        additions=true;
    }
    if(additions){set("monster_level_boosts", monster_level_boosts);}
}

function calculate_monster_level_boost(m){
    raw_levels=m.level-1;
    capped_levels=min(m.level,12);
    boost={raw:{level:m.level}};
    var gm=G.monsters[m.mtype];
    for(stat in gm){
        if(is_object(gm[stat])){continue;}
        if("hp"==stat){
            boost[stat]=(m["max_"+stat]-gm[stat])/raw_levels;
            boost.raw[stat]=m["max_"+stat];
            continue;
        }
        if(gm[stat] == m[stat]){continue;}
        if("xp"==stat){
            boost[stat]=(m[stat]-gm[stat])/raw_levels;
            boost.raw[stat]=m[stat];
            continue;
        }else{
            boost[stat]=(m[stat]-gm[stat])/capped_levels;
            boost.raw[stat]=m[stat];
        }
    }
    return boost;
}

function is_adventurer(entity){
    return entity.type=="character" 
        && entity.ctype!="merchant"
        && Object.keys(G.classes).includes(entity.ctype);
    
}

function get_mluck_target(){
    var players = Object.values(parent.entities).filter(is_adventurer);
    if(!players.length){return null;}
    var closest_to_leaving=9999;
    var target=null;
    for(p of players){
        if(p.s && p.s.mluck && p.s.mluck.f==character.name){continue;}
        d_to_xrange=330-distance(p,character);
        if(d_to_xrange < 0 || d_to_xrange > closest_to_leaving){continue;}
        if(d_to_xrange>40 && p.s && p.s.mluck && parent.entities[p.s.mluck.f]){continue;} // competing merchant
        target=p;
        closest_to_leaving=d_to_xrange;
    }
    return target;
}
//get_mluck_target();

function use_hp_or_mp_stingy(){
	if(is_on_cooldown("use_hp") || is_on_cooldown("use_mp")) return;
	else if(character.hp<character.max_hp) use_skill("regen_hp");
	else if(character.mp<character.max_mp) use_skill("regen_mp");
}

function open_booth(){
	parent.socket.emit("merchant",{num:0})
}

function close_booth(){
	parent.socket.emit("merchant",{close:1})
}

function is_upgradable(name){
	return Boolean(G.items[name].upgrade);
}

function is_compoundable(name){
	return Boolean(G.items[name].compound);
}

function can_upgrade(){
	if (character.q.upgrade) return false;
	if (!is_near_upgrade_forge()) return false;
    return true;
}

function should_upgrade(item_slot){
	var item = character.items[item_slot];
    if (!item || !is_upgradable(item.name)) return false;
	if(!desired_levels[item.name]) return false;
	if(!(item.level > -1) || !(item.level < desired_levels[item.name])) return false;
    return true;
}

function can_compound(){
	if (character.q.compound) return false;
	if (!is_near_upgrade_forge()) return false;
}

function should_compound(item_slot){
	var item = character.items[item_slot];
    if (!item || !is_compoundable(item.name)) return false;
	if(!desired_levels[item.name]) return false;
	if(!(item.level > -1) || !(item.level < desired_levels[item.name])) return false;
    if(locate_all_of_item(item.name,item.level).length < 3) return false;
    return true;
}

function buy_order(args){
    // name: the item code for the item name, eg "mpot1" or "firestaff"
    // trades_slot: a string, eg "trade3", not an index number like item slots. adventurers have 4 (1-4) of them, merchants 16
    // price_each: money out of your pocket for EACH item. Make sure not to confuse with total cost!!!
    // quantity: is how many of the item you want people to sell you
    // level: the specific level of a compoundable or upgradable item.
    // example: buy_order({name:"mpot1",trade_slot:"trade3",price_each:125,quantity:2});
    // Manual UI for buy orders: character > Show. Left click to see/use the order, right click to cancel it.
    // to programmatically cancel it: parent.socket.emit("unequip", {slot:"trade3"});
    if(!(args.name && args.trade_slot && args.price_each && args.quantity)) return;
    trade = {
        q: args.quantity,
        slot: args.trade_slot,
        price: args.price_each,
        name: args.name
    }
    if(args.level > -1){trade["level"]=args.level;}
    parent.socket.emit("trade_wishlist", trade);
}


function is_near_upgrade_forge()
{
	return (-500 < character.x && 
		character.x < 0 &&
		-450 < character.y &&
		character.y < 50);
}

function get_upgradable_by_set(set,level_ceiling){
	for (slot in character.items){		
		item = character.items[slot]
		if (!item) continue;
		if (item.level >= level_ceiling) continue;
		if (G.items[item.name].set == set) return slot;
	}
	return null;
}

function get_upgradable_by_name(name,level_ceiling){
	for (slot in character.items){		
		item = character.items[slot]
		if (!item) continue;
		if (item.level >= level_ceiling) continue;
		if (G.items[item.name].name == name) return slot;
	}
	return null;
}

function is_trash(item){
	return (
		item
		&& item.name
		&& [
			"hpbelt",
			"hpamulet",
			"ringsj",
			"vitring",
		].includes(item.name)
		 && (
			!item.level ||
			item.level == 0
		)
		
	)
}
function locate_all_of_item(name, level=null){
	var item_slots = [];
	for(var i=0;i<character.items.length;i++)
	{
		var item = character.items[i];
		if(
			item 
			&& item.name==name
			&& (
				item.level==level
				|| !(item.level > -1)
			)
		) 
		{item_slots.push(i);}
	}
	return item_slots;
}

function sell_trash(){
	for(slot in character.items){
		var item=character.items[slot];
		if (is_trash(item)) sell(slot,1);
	}
}

function compound_item(slot){
	var item = character.items[slot]
	var compound_targets = locate_all_of_item(item.name,item.level);
	if(compound_targets.length <3) return;
	var item_slot_1=compound_targets[0];
	var item_slot_2=compound_targets[1];
	var item_slot_3=compound_targets[2];
	var grade = item_grade(character.items[item_slot_1]);
	var scroll_type = "cscroll" + grade;
	var scroll_slot = locate_item(scroll_type);
	if (scroll_slot == -1) {
        log("buying " + scroll_type);
		buy(scroll_type);
        return;
	}
    log("Compounding "+item.name+" +"+item.level+" in slots "+compound_targets);
	compound(
		item_slot_1,
		item_slot_2,
		item_slot_3,
		scroll_slot
	);
}

function upgrade_item(item_slot){
    if(!can_upgrade()){return;}
	var item = character.items[item_slot];
	var grade = item_grade(item);
	var scroll_type = "scroll" + grade;
	var scroll_slot = locate_item(scroll_type);
	if (scroll_slot == -1) {
        log("buying " + scroll_type);
		buy(scroll_type);
        return;
	}
	log("Upgrading "+item.name+" +"+item.level+" to +"+(item.level+1))
	upgrade(item_slot,scroll_slot);
}

function improve_item(slot){
	item=character.items[slot];
	if(!item || !item.name || item.q) return;
	if(!desired_levels[item.name] || !(item.level < desired_levels[item.name])) return;
	if(is_upgradable(item.name)){upgrade_item(slot);}
	else if(is_compoundable(item.name)){}
}

function improve_items(){
    var upgradable_item = null;
    var compoundable_item = null;
	for(var slot in character.items){
        if(!upgradable_item && should_upgrade(slot)){upgradable_item=slot;}
        if(!compoundable_item && should_compound(slot)){compoundable_item=slot;}
        if(upgradable_item && compoundable_item){break;}
	}
    if(upgradable_item){upgrade_item(upgradable_item);}
    if(compoundable_item){compound_item(compoundable_item);}
}

setInterval(function(){

	use_hp_or_mp_stingy();
	// upgrade_items();
	// compound_items();
	improve_items();
	sell_trash();
},1000); // Loops every second.


setInterval(function(){	
	if(character.standed && is_moving(character)) {close_booth();}
	else if(!character.standed && !is_moving(character)){open_booth();}
    var mluck=get_mluck_target();
    if(mluck){use_skill("mluck",mluck);}
},1000/4); // Loops every 1/4 second.


setInterval(function(){
    observe_monster_level_boosts();
},5000); // Loops every 5 seconds.


function give_items(c,s,q=5){
	for (i=0;i<q;i++){
		if(character.items[s+i]) send_item(c,s+i);
	}
}

function special_delivery(){
	give_items("Krandoll",35);
	give_items("Syrinx",28);
	give_items("Volatile",21);
}

function resupply(){
	var lil_hp_pot = locate_item("hpot0");
	send_item("Krandoll",lil_hp_pot,4000);
	send_item("Syrinx",lil_hp_pot,500);
	send_item("Volatile",lil_hp_pot,500);
}
// Learn Javascript: https://www.codecademy.com/learn/introduction-to-javascript
// Write your own CODE: https://github.com/kaansoral/adventureland
