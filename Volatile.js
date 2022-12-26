// Hey there!
// This is CODE, lets you control your character with code.
// If you don't know how to code, don't worry, It's easy.
// Just set attack_mode to true and ENGAGE!

//var attack_mode=true;
var attack_mode=true;
var my_characters=["Krandoll","Syrinx","Volatile","Cinnamon"];
var monster_to_hunt="porcupine"
if(["warrior","rogue"].includes(character.ctype)){monster_to_hunt="minimush"}

var keys=Object.keys;

// --- dynamic config

function get_too_hard_monsters(){
    return [
        "iceroamer",
        "wolfie", // lethal dps
        "wolf", // lethal dps
        "cgoo", // lethal dps
        "fireroamer", // lethal dps
        "bbpompom", // lethal dps
        "mummy", // lethal dps & all attack at once.
        "stoneworm", // lethal dps
        "booboo",
        "bigbird", // lethal dps
        "mole", // lethal dps
        "scorpion",
        "porcupine", // damage return to warrior
        "ghost",
        "minimush",
        "oneeye", // lethal dps
        "rat", // rage adds
        "crabx",
        "pppompom",
        "xscorpion",
        "prat", // lethal dps
        "plantoid", // lethal dps
        "fvampire", // lethal dps
        "boar",
        "spider",
        "jr", // lethal dps
        "skeletor", // lethal dps
        "poisio",
        "osnake", // avoid greenjr rage
        "snake", // avoid greenjr rage
        "greenjr", // lethal dps
        "bat", // too much hp
        "armadillo", // damage return
    ];
}

function get_potion_prefs(){
    // potion_item_codename:{
    //     q:desired_on_hand_quanitity,
    //     s_min:minimum_price_buy_order_to_sell_to, // should be > vendor price if you don't want a loss. might be super high if you don't want to sell.
    //     s_offer:price_you_create_sell_orders_at, // should be > vendor price if you don't want a loss. might be < if trying to recover some value from unwanted pots.
    //     b_max:maximum_price_sell_order_to_buy_from, // < vendor lets you pick up potions people are selling at a loss, > vendor if you want to reward merchants for coming to you.
    //     b_offer:price_you_create_buy_orders_at // people wont be motivated to sell to you if not > vendor price
    // }
    // e.g. hpot0:{q:200,s_min:25,s_offer:25,b_max:18,b_offer:23}
    var pots={
        hpot0:{q:200,s_min:9999,s_offer:25,b_max:15,b_offer:23},
        mpot0:{q:200,s_min:9999,s_offer:25,b_max:15,b_offer:23},
        hpot1:{q:200,s_min:9999,s_offer:125,b_max:75,b_offer:115},
        mpot1:{q:200,s_min:9999,s_offer:125,b_max:75,b_offer:115},
    }
    if(character.ctype == "warrior") {pots.hpot0.q=4000;pots.hpot1.q=4000}
    if(["mage","priest"].includes(character.ctype)){pots.mpot0.q=4000;pots.mpot1.q=4000}
    if(character.ctype == "merchant") {
        pots={
            hpot0:{q:8000,s_min:23,s_offer:25,b_max:20,b_offer:18},
            mpot0:{q:8000,s_min:23,s_offer:25,b_max:20,b_offer:18},
            hpot1:{q:8000,s_min:115,s_offer:125,b_max:100,b_offer:85},
            mpot1:{q:8000,s_min:115,s_offer:125,b_max:100,b_offer:85},
        }
    }
    return pots;
}

// --- cached storage
var active_monster_hunts=null;
function get_active_monster_hunts(){
    // TODO
    if(!active_monster_hunts || get_active_monster_hunts.timestamp){}
    // = get(active_monster_hunts)
}

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

// --- Party Admin

function is_partied(){
    return Boolean(get_party()[character.name]);
}

function is_in_town(){
    return (
        character.map == "main"
        && -400 < character.x
        && character.x < 350
        && -485 < character.y
        && character.y < 238
    )
}

function on_party_invite(name){
    if(my_characters.includes(name)) accept_party_invite(name);
}

function on_party_request(name){
    if(my_characters.includes(name)) accept_party_request(name);
}

function party_on(){
    // if(is_partied()) return;
    for(player_name of my_characters){
        send_party_invite(player_name);
        send_party_request(player_name);
    }
}

// --- Targeting

function get_party_dps(args){
    // exclude_tank=false, exclude_healer=false, include_distant=false
    var party=get_party();
    if(!party[character.name]){return 0;}
    var sum=0;
    for(player in party){
        if(party[player].type == "warrior"){continue;}
        var party_member = null;
		if(player==character.name){
			party_member = character;
		}else{
			party_member = parent.entities[player];
		}
        if(!party_member){continue;}
		var dps = party_member.attack*party_member.frequency;
        sum+=dps
    }
    return sum;
}

function is_targeting_me(target){
    var t2 = get_target_of(target);
    return t2 && t2.name == character.name;
}

function is_low_health(target){
    return target.hp < get_party_dps() *2;
}

function get_party_squish(){
    var name = character.name;
    if(get_party()[name]){
        return ["Syrinx", "Volatile"];
    }
    return [];
}

function get_party_tank(){
    if(character.name=="Krandoll") return character;
    if(get_party()["Krandoll"]) return get_player("Krandoll");
    return character;
}

function get_party_main_assist(){
    if(character.name=="Syrinx") return character;
    if(get_party()["Syrinx"]) return get_player("Syrinx");
    return character;
}

function get_main_assist_target(){
    var ma = get_party_main_assist();
    if (!ma) return null;
    if (character.name == ma.name) return null;
    return parent.entities[ma.target];
}

function get_monster_targeting_squish(){
    var party_squish=get_party_squish();
    if(!party_squish.length) return null;
    return get_nearest_monster({
        target:party_squish,
        prioritize:"low_health"
    });
}

function get_weakest_with_enough_tanked(){
    return get_monster_targeting_tank(get_party_dps()*2.5);
}

function get_monster_targeting_tank(minimum_hp=0){
    var tank=get_party_tank();
    if (!tank) return null;
    return get_nearest_monster({
        target:[tank.name],
        minimum_hp: minimum_hp,
        prioritize:"low_health"
    });
}

function get_engaged_coop_monster(){
    var target=get_nearest_monster({coop:true});
    if(target && target.target){return target;}
    return null;
}

function get_monster_nearest_main_assist(mtype=monster_to_hunt){
    var ma = get_party_main_assist();
    if (!ma) return null;
    return get_nearest_monster({
        type:mtype,
        nearest_to:ma,
        untagged:true,
        no_target:true
    });
}

function get_monster_nearest_me(mtype=monster_to_hunt){
    return get_nearest_monster({
        type:mtype,
        untagged:true,
        no_target:true
    });
}

function tank_targeting(mtype){
    var target=null
    if(!target) target=get_monster_targeting_squish();
    if(!target) target=get_weakest_with_enough_tanked();
    if(!target)
    {
        ct=get_targeted_monster(); // could weak tanked we don't want or an untanked we do.
        target = is_targeting_me(ct) ? target : ct;
    }
    if(!target){target=get_engaged_coop_monster();}
    if(!target) target=get_monster_nearest_main_assist(mtype);
    if(!target) target=get_monster_nearest_me(mtype);
    return target;
}

function default_targeting(mtype){
    // TODO execution target?
    target=null;
    if(!target){target=get_main_assist_target();}
    if(!target){target=get_monster_targeting_squish();}
    if(!target){target=get_monster_targeting_tank();}
    if(!target){target=get_targeted_monster();}
    if(!target){target=get_engaged_coop_monster();}
    if(!target){target=get_monster_nearest_main_assist(mtype);}
    if(!target){target=get_monster_nearest_me(mtype);}
    return target;
}

function get_nearest_monster(args){
    var min_d=999999,min_h=99999999999,sum_valid_hp=0,target=null;

    if(!args) args={};
    if(args && args.target && args.target.name) args.target=[args.target.name];
    if(args && args.target && typeof args.target == "string") args.target=[args.target];
    if(args && args.type=="monster") game_log("get_nearest_monster: you used monster.type, which is always 'monster', use monster.mtype instead");
    if(args && args.mtype) game_log("get_nearest_monster: you used 'mtype', you should use 'type'");

    for(id in parent.entities){
        var current=parent.entities[id];
        if(current.type!="monster" || !current.visible || current.dead) continue;
        if(args.type && current.mtype!=args.type) continue;
        if(args.coop && !current.coop){continue;}
        if(args.min_xp && current.xp<args.min_xp) continue;
        if(args.max_att && current.attack>args.max_att) continue;
        if(args.target && !args.target.includes(current.target)) continue;
        if(args.no_target && current.target && !["Volatile", "Syrinx"].includes(current.target)) continue;
        if(args.path_check && !can_move_to(current)) continue;
        if(args.prioritize && args.prioritize=="low_health"){
            var c_hp=current.hp;
            if(c_hp<min_h) min_h=c_hp,target=current;
        }
        else{
            var c_dist=parent.distance(args.nearest_to || character,current);       
            if(c_dist<min_d) min_d=c_dist,target=current;
        }
        if(args.target && args.minimum_hp){
            sum_valid_hp+=current.hp
            if(current.immune){sum_valid_hp+=100000000000;}
        }
        
    }
    if(args.target && args.minimum_hp && sum_valid_hp < args.minimum_hp) return null;
    return target;
}

// --- Combat Movement & skills
function get_dps(entity){
    if(!entity || !entity.attack || !entity.frequency){return 0;}
    return entity.attack*entity.frequency;
}

function retreat_from_danger(monster){
    if(get_dps(monster) < 75){return;}
    var burn_rate=get_party_dps();
    if(!burn_rate){burn_rate=get_dps(character);}
    if(burn_rate * 2 > monster.hp){return;}
    move_safe_range(monster);
}

function move_safe_range(monster){
    var range_reduction_multiplier = 0.9; // aiming for max range puts out of range if it's walking away, this moves the target tighter. also might be rounding bugs when the distance is small, this seems to fix that.
    if(!monster || !monster.x || !monster.y) return;
    var safer_spot={"x":character.x,"y":character.y};
    var ratio = (character.range * range_reduction_multiplier) / (simple_distance(character,monster));
    var delta = {"x": character.x - monster.x, "y": character.y - monster.y};
    safer_spot.x = delta.x * ratio + monster.x;
    safer_spot.y = delta.y * ratio + monster.y;
    if(abs(safer_spot.x - monster.x) > character.range || abs(safer_spot.y - monster.y) > character.range){
        log("Bad move detected");
        log( "Ratio: " + (character.range * range_reduction_multiplier) + " / " + (max(simple_distance(character,monster), 5)) + " : " + ratio)
        log("character.x: " + character.x + " monster.x: " + monster.x + " delta.x: " + delta.x + " safer_spot.x: " + safer_spot.x);
        log("character.y: " + character.y + " monster.y: " + monster.y + " delta.y: " + delta.y + " safer_spot.y: " + safer_spot.y);
    }
    move(safer_spot.x,safer_spot.y);
}

function taunt_if_needed(target){
    if(
        character.ctype == "warrior"
        && target.target
        && target.target != character.name
        && !is_on_cooldown("taunt")
    ) 
    {use_skill("taunt");}
    
}

// --- Inventory management & Trade

function get_potion_deficits(){
    var pots=get_potion_prefs();
    var deficits={};
    for(pot in pots){
        var pot_slot=locate_item(pot);
        if(!(pot_slot>-1)) {deficit= pots[pot].q;}
        else {deficit=max(pots[pot].q - character.items[pot_slot].q,0);}
        if (deficit) deficits[pot]=deficit;
    }
    return deficits;
}

function get_empty_trade_slots(){
    var slot_quanity=4;
    var empty_slots=[];
    if(character.ctype=="merchant") slot_quanity=16;
    for(var s=1; s<=slot_quanity;s++){
        var slot = "trade" + s;
        if(!character.slots[slot]) empty_slots.push(slot);
    }
    return empty_slots;
}

function get_potion_trades(){
    var potion_trades={hpot0:null,mpot0:null,hpot1:null,mpot1:null};
    var potions = Object.keys(potion_trades);
    var slot_quanity=4;
    var empty_slots=[];
    if(character.ctype=="merchant"){slot_quanity=16;}
    for(var s=1; s<=slot_quanity;s++){
        var slot = "trade" + s;
        if(!character.slots[slot]) continue;
        var trade=character.slots[slot];
        if(potions.includes(trade.name))
        {
            potion_trades[trade.name]=trade;
            potion_trades[trade.name].slot=slot;
        }
    }
    return potion_trades;
}

function buy_offer_to_resupply(){
    var potion_trades=get_potion_trades();
    var empty_trades=get_empty_trade_slots();
    var pots=get_potion_prefs();
    var deficits= get_potion_deficits();
    for(pot in deficits){
        var deficit = deficits[pot]
        var buying_q = null;
        var trade_slot=null;
        if(potion_trades[pot] && potion_trades[pot].b)
        {
            buying_q=potion_trades[pot].q;
            trade_slot=potion_trades[pot].slot;
        }
        else{
            buying_q=0;
        }
        if(!trade_slot) continue;
        if(deficit > buying_q && buying_q + 20 > deficit){continue;}
        if(potion_trades[pot]){cancel_trade_offer(trade_slot);}
        if(!deficit){continue;}
        if(!trade_slot){trade_slot=empty_trades.pop();}
        buy_order({
            name:pot,
            trade_slot:trade_slot,
            price_each:pots[pot].b_offer,
            quantity:deficit
            })
    }
}

function purchase_potions(){
    if(!is_in_town()){return;}
    var deficits = get_potion_deficits();
    for(pot in deficits){
        if(!deficits[pot]){continue;}
        log("Buying "+deficits[pot]+" "+pot)
        buy(pot,deficits[pot]).then();
    }
}

function dump_loot(){
    var dump_character="Cinnamon";
    if(!parent.entities[dump_character]){return;}
    var pots=get_potion_prefs();
    send_gold(dump_character,character.gold);
    for(slot=0; slot<42; slot++){
        var item = character.items[slot];
        if (!item) continue;
        if(keys(pots).includes(item.name)){
            var surplus=max(0,item.q - pots[item.name].q)
            if(surplus){send_item(dump_character,slot,surplus);}
            continue;
        }
        send_item(dump_character,slot,item.q || 1);
    }
}

game.on("item",function(data){
    if(!(character.name==data.receiver)){return;}
    var equip_slot= get_direct_upgrade_slot(data.item);
    if(equip_slot){equip(data.num,equip_slot);}
});

function get_direct_upgrade_slot(item){
    var item_type=G.items[item.name].type;
    var equip_slots=[];
    if(keys(character.slots).includes(item_type)){equip_slots=[item_type];}
    else if(["ring","earring"].includes(item_type)){equip_slots=[item_type+"1",item_type+"2"]}
    else if(["quiver","source","shield"].includes(item_type)){equip_slots=["offhand"]}
    else if("weapon" == item_type){equip_slots=["mainhand"]} //TODO main/off/double hand based on class.
    else{log("Can't tell if items of type "+item_type+" are upgrades yet.");return false;}
    for(equip_slot of equip_slots){
        if(!(item.name==character.slots[equip_slot].name)){continue;}
        if(item.level<=character.slots[equip_slot].level){continue;}
        var equip_stat=character.slots[equip_slot].stat_type;
        if(equip_stat && item.stat_type!=equip_stat){continue;}
        log("assessed item is a direct upgrade to "+equip_slot+".");
        return equip_slot;
    }
    return false;
}

function check_inventory(){
    var is_carrying_loot = false;
    for(slot in character.items){
        swap_if_upgrade(slot);
        var it = character.items[slot];
    }
}

function cancel_trade_offer(trade_slot){
    parent.socket.emit("unequip", {slot:trade_slot});
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

// --- Recovery
function use_lil_hp_pot(){
    var potion_slot=locate_item("hpot0");
    if(potion_slot==-1){potion_slot=locate_item("hpot1");}
    if(potion_slot==-1){use_skill("regen_hp");return;}
    consume(potion_slot);
    return;
}
function use_big_hp_pot(){
    var potion_slot=locate_item("hpot1");
    if(potion_slot==-1){potion_slot=locate_item("hpot0");}
    if(potion_slot==-1){use_skill("regen_hp");return;}
    consume(potion_slot);
    return;
}
function use_lil_mp_pot(){
    var potion_slot=locate_item("mpot0");
    if(potion_slot==-1){potion_slot=locate_item("mpot1");}
    if(potion_slot==-1){use_skill("regen_mp");return;}
    consume(potion_slot);
    return;
}
function use_big_mp_pot(){
    var potion_slot=locate_item("mpot1");
    if(potion_slot==-1){potion_slot=locate_item("mpot0");}
    if(potion_slot==-1){use_skill("regen_mp");return;}
    consume(potion_slot);
    return;
}
function is_damaged(){return character.hp<character.max_hp;}
function is_drained(){return character.mp<character.max_mp;}
function is_minorly_damaged(){
    return Boolean(
        character.hp/character.max_hp < 0.9
        && character.hp + 200 < character.max_hp
    );
}
function is_minorly_drained(){
    return Boolean(
        character.mp/character.max_mp < 0.9
        && character.mp + 300 < character.max_mp);
}
function is_moderately_damaged(){
    return Boolean(
        character.hp/character.max_hp < 0.7
        && character.hp + 200 < character.max_hp
    );
    }
function is_moderately_drained(){
    return Boolean(
        character.mp/character.max_mp < 0.7
        && character.mp + 300 < character.max_mp);
}
function is_critically_damaged(){
    return Boolean(
        character.hp/character.max_hp < 0.2
        && character.hp + 400 < character.max_hp
    );
    }
function is_critically_drained(){
    return Boolean(
        character.mp/character.max_mp < 0.2
        && character.mp + 500 < character.max_mp);
}

function use_hp_or_mp(){
	if(safeties && mssince(last_potion)<min(200,character.ping*3)) return;
	var used=false;
	if(character.rip || new Date()<parent.next_skill.use_hp) return;
    var health_fraction=character.hp/character.max_hp;
    var mana_fraction=character.mp/character.max_mp;
    
	if(is_critically_drained()) use_big_mp_pot(),used=true; 
    
    else if(is_moderately_damaged() && health_fraction < mana_fraction) {use_big_hp_pot();used=true;}
    else if(is_moderately_drained() && mana_fraction < health_fraction) {use_big_mp_pot();used=true;}
    
    else if(is_minorly_damaged() && health_fraction < mana_fraction) {use_lil_hp_pot();used=true;}
    else if(is_minorly_drained() && mana_fraction < health_fraction) {use_lil_mp_pot();used=true;}
    
    else if(is_damaged() && health_fraction < mana_fraction) {use_skill("regen_hp");used=true;}
    else if(is_drained() && mana_fraction < health_fraction) {use_skill("regen_mp");used=true;}
    
    else if(is_damaged()) {use_skill("regen_hp");used=true;}
    else if(is_drained()) {use_skill("regen_mp");used=true;}
	if(used) last_potion=new Date();
}

function use_hp_or_mp_stingy(){
    if(character.rip || is_on_cooldown("use_hp") || is_on_cooldown("use_mp")) return;
    var REGEN_MP_AMOUNT=100;
    var REGEN_HP_AMOUNT=50;
    if(character.hp/character.max_hp<0.4) use('use_hp'),used=true;
    else if(character.mp + REGEN_MP_AMOUNT<character.max_mp) use_skill("regen_mp");
    else if(character.hp + REGEN_HP_AMOUNT<character.max_hp) use_skill("regen_hp");
    else if(character.hp<character.max_hp) use_skill("regen_hp");
    else if(character.mp<character.max_mp) use_skill("regen_mp");
}

// --- Objectives

function hunt(mtype=monster_to_hunt){
    var targeting_style=default_targeting;
    if(character.ctype == "warrior" && is_partied()) targeting_style=tank_targeting;
    var target=targeting_style(mtype);
    if(target) {change_target(target);}
    else
    {
        set_message("No Monsters");
        if(!is_moving(character)){smart_move(mtype);}
        return;
    }
    taunt_if_needed(target);
    if(!is_in_range(target) && !is_moving(character))
    {
        move_safe_range(target);
    }
    else if(can_attack(target))
    {
        set_message("Attacking");
        attack(target);
        if(is_targeting_me(target) && !is_moving(character))
        {
            retreat_from_danger(target);
        }
    }
}

function is_on_monster_hunt(p){
    var pc = p ? p : character;
    return Boolean(pc && pc.s && pc.s.monsterhunt);
}
function is_near_mhunt_npc(){
    return (
        character.map == "main"
        && 0 < character.x
        && character.x < 250
        && -550 < character.y
        && character.y < -300
    )
    
}
function start_monster_hunt_quest(){parent.socket.emit('monsterhunt');}
function complete_monster_hunt_quest(){parent.socket.emit('monsterhunt');}

function monster_hunting(){
    if(!is_on_monster_hunt()){
        if(!is_moving(character)){smart_move(find_npc("monsterhunter"));}
        if(is_near_mhunt_npc()){start_monster_hunt_quest();}
    }else{
        var count=character.s.monsterhunt.c;
        if(!count){
            if(is_near_mhunt_npc()){complete_monster_hunt_quest();}
            else if(!is_moving(character)){smart_move(find_npc("monsterhunter"));
            return true;}
        }
        var mtype=character.s.monsterhunt.id;
        var skip_these_monsters=get_too_hard_monsters();
        if(skip_these_monsters.includes(mtype)){return false;}
        // var minutes=character.s.monsterhunt.ms/60000;
        // log("I have to kill "+count+" more "+ mtype +" in "+minutes+" minutes.");
        hunt(mtype);
    }
    return true;
}

setInterval(function(){
    //use_hp_or_mp_stingy();
    use_hp_or_mp();
    loot();
    if(!attack_mode || character.rip) return;
    monster_hunting() || hunt();
},1000/4); // Loops every 1/4 seconds.

setInterval(function(){
    observe_monster_level_boosts();
    purchase_potions();
    buy_offer_to_resupply();
    dump_loot();
},10000); // Loops every 10 seconds.

// runs once on load
party_on();
