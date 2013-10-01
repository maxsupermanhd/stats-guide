﻿var designer_setted_timeout;

function InitDesigner() {
    
    $("#designer_select_body_button").button({
        icons: {
            primary: "ui-icon-triangle-1-s",
        }
    }).click(function (event) {
        event.preventDefault();
        ShowSeletDialog_forDataObject($("#designer_body"), Bodies, $("#designer_body_icon"));
    });

    $("#designer_select_propulsion_button").button({
        icons: {
            primary: "ui-icon-triangle-1-s",
        }
    }).click(function (event) {
        event.preventDefault();
        ShowSeletDialog_forDataObject($("#designer_propulsion"), Propulsion, $("#designer_propulsion_icon"));
    });


    $("#designer_select_weapon_button").button({
        icons: {
            primary: "ui-icon-triangle-1-s",
        }
    }).click(function (event) {
        event.preventDefault();
        ShowSeletDialog_forDataObject($("#designer_weapon"), Weapons, $("#designer_weapon_icon"));
    });

    var func_val_slider = function (value) {
        return value.toHHMMSS();
    }

    jQuery('#designer_research_slider').slider({
        min: 0,
        max: 5400,
        step: 30,
        value: 600,
        range: "min",
        slide: function (event, ui) {
            jQuery('#designer_research_progress_input').val(func_val_slider(ui.value));
            localStorage["designer_research_slider"] = ui.value;
            if (last_calculated_research_time != undefined) {
                if (designer_setted_timeout != undefined) {
                    clearTimeout(designer_setted_timeout);
                    designer_setted_timeout = undefined;
                };
                ShowLoading('designer_parameters_container');
                designer_setted_timeout = setTimeout(function () {
                    TryCalculateDesign();
                    HideLoading('designer_parameters_container');
                }, 500);
            }
        }
    });


    $("#designer_research_progress_input").val(func_val_slider($("#designer_research_slider").slider("value")));

};

var last_calculated_research_time;

var player_all_researched = 8;
var player_current_design = 0;
function Designer_PreLoad(callback_function) {
    InitDesigner();
    LoadAllObjects(function () {
        DoResearch(7200, player_all_researched, function () {
            if (localStorage["designer_designer_weapon"] != undefined) {
                setInput(Weapons, $("#designer_weapon"), localStorage["designer_designer_weapon"], $("#designer_weapon_icon"));
            }
            if (localStorage["designer_designer_body"] != undefined) {
                setInput(Bodies, $("#designer_body"), localStorage["designer_designer_body"], $("#designer_body_icon"));
            }
            if (localStorage["designer_designer_propulsion"] != undefined) {
                setInput(Propulsion, $("#designer_propulsion"), localStorage["designer_designer_propulsion"], $("#designer_propulsion_icon"));
            }

            if (localStorage["designer_research_slider"] != undefined) {
                var val = parseInt(localStorage["designer_research_slider"]);
                $("#designer_research_slider").slider('value', val);
                hs = $("#designer_research_slider").slider();
                hs.slider('option', 'slide')
                    .call(hs, null, { handle: $('.ui-slider-handle', hs), value: val });
            }

            TryCalculateDesign(callback_function);
        });

    });
}

function setInput(DataObject, input_selector, selectedRowId, input_selector_icon) {
    input_selector.attr('data-value', selectedRowId);
    input_selector.val(DataObject.loaded_data_hash[selectedRowId].name);
    localStorage["designer_" + input_selector.attr('id')] = selectedRowId;


    if (DataObject.GetIconHtml_Function != undefined) {
        input_selector_icon.html(DataObject.GetIconHtml_Function(DataObject.loaded_data_hash[selectedRowId]));
    }
}


var designer_dialogs = {};
function ShowSeletDialog_forDataObject(input_selector, DataObject, input_selector_icon) {

    if (designer_dialogs[DataObject.sysid] != undefined) {
        $(designer_dialogs[DataObject.sysid]).dialog('open');
        return;
    }

    //var container_id = "dialog_grid";
    var container_id = 'designer_dialog_' + DataObject.sysid;

    $('body').append($('<div/>', {
        id: container_id
    }));


    LoadDataObject(DataObject, function () {
        var grid = DrawGrid(DataObject, container_id, null, 575, 575);
        designer_dialogs[DataObject.sysid] = $("#" + container_id).dialog(
        {
            title: "Select an item",
            buttons:
            {
                "Ok": function () {
                    var selectedRowId = grid.jqGrid('getGridParam', 'selrow');
                    if (selectedRowId == null) {
                        alert('Sorry but you have not selected a row. Nothing will happen.');
                    } else {
                        setInput(DataObject, input_selector, selectedRowId, input_selector_icon);
                    }
                    $(this).dialog('close');
                    TryCalculateDesign();
                },
                "Cancel": function () {
                    $(this).dialog('close');
                }
            },
            modal: true,
            width: 600,
            height: 700,
            close: function () {
                //this.hide();
            },
            // position: { my: "center ce", at: "left bottom", of: window }
        });
    });
}


//var TankDesignStats = function () { };
//WeaponAbilities.prototype = (function () {
//    var me = {};
//    me.hitPoints = 0;
//    me.armourKinetic = 0;
//    return me;
//})();

function CalculateTankDesign(player, weapon, body, propulsion) {

    var weapon_upgraded = jQuery.parseJSON(JSON.stringify(Upgrades[player].Weapon[weapon.index_of_datarow])); //deep copy
    var body_upgraded = jQuery.parseJSON(JSON.stringify(Upgrades[player].Body[body.index_of_datarow])); //deep copy

    var TankDesign = {}; 
    TankDesign.weapon = jQuery.parseJSON(JSON.stringify(weapon)); //deep copy
    TankDesign.weapon_upgraded = weapon;
    TankDesign.body = jQuery.parseJSON(JSON.stringify(body)); //deep copy
    TankDesign.body_upgraded = body_upgraded;
    TankDesign.propulsion = jQuery.parseJSON(JSON.stringify(propulsion)); //deep copy
    TankDesign.baseStats = {};

    /* HP, ARMOR */
    var hp = body.hitpoints + (body.hitpoints * propulsion.hitpoints) / 100 + weapon.body;
    TankDesign.baseStats.hitPoints = hp;
    TankDesign.hitPoints = hp + hp * body_upgraded.armour / 100;

    TankDesign.baseStats.armourKinetic = body.armourKinetic;
    TankDesign.armourKinetic = body_upgraded.armourKinetic + body_upgraded.armourKinetic * body_upgraded.armour / 100;

    TankDesign.baseStats.armourHeat = body.armourHeat;
    TankDesign.armourHeat = body_upgraded.armourHeat;
    

    /* SPEED */
    var weight = body.weight + (body.weight * propulsion.weight) / 100 + weapon.weight;
    var prop_modifier = PropulsionType.loaded_data_hash[propulsion.type].multiplier;
    var vtol_speed_modifier = 1;
    var speed_bonus = 1;
    if (body.powerOutput > weight) {
        speed_bonus = 1.5;
    }
    TankDesign.speed_bonus = speed_bonus;
    if (propulsion.type == 'Lift') {
        if (body.size == "HEAVY") {
            vtol_speed_modifier = 0.25;
        } else if (body.size == "MEDIUM") {
            vtol_speed_modifier = 0.75;
        }
    }
    var terrain_modifier_road = TerrainTable.loaded_data_hash["6"].speedFactor.split(',')[PropulsionType.loaded_data_hash[propulsion.type].index_of_datarow];
    var terrain_modifier_sandybush = TerrainTable.loaded_data_hash["1"].speedFactor.split(',')[PropulsionType.loaded_data_hash[propulsion.type].index_of_datarow];

    var engine_base = (body.powerOutput * prop_modifier) / 100 * vtol_speed_modifier * speed_bonus;
    var engine_upgraded = (body_upgraded.powerOutput * prop_modifier) / 100 * vtol_speed_modifier * speed_bonus;

    TankDesign.baseStats.speed_road = Math.min(propulsion.speed / 100 / 1.28, engine_base * terrain_modifier_road / weight / 100 / 1.28).toFixed(2);
    TankDesign.speed_road = Math.min(propulsion.speed / 100 / 1.28, engine_upgraded * terrain_modifier_road / weight / 100 / 1.28).toFixed(2);

    TankDesign.baseStats.speed_offroad = Math.min(propulsion.speed / 100 / 1.28, engine_base * terrain_modifier_sandybush / weight / 100 / 1.28).toFixed(2);;
    TankDesign.speed_offroad = Math.min(propulsion.speed / 100 / 1.28, engine_upgraded * terrain_modifier_sandybush / weight / 100 / 1.28).toFixed(2);

    TankDesign.baseStats.weaponClass = weapon.weaponClass;
    TankDesign.weaponClass = weapon_upgraded.weaponClass;

    TankDesign.baseStats.damage = weapon.damage;
    TankDesign.damage = weapon_upgraded.damage;

    TankDesign.baseStats.radiusDamage = weapon.radiusDamage;
    TankDesign.radiusDamage = weapon_upgraded.radiusDamage;

    TankDesign.baseStats.radius = weapon.radius;
    TankDesign.radius = weapon_upgraded.radius;

    TankDesign.baseStats.shotsPerMinute = Weapon_ShotsPerMinute(weapon);
    TankDesign.shotsPerMinute = Weapon_ShotsPerMinute(weapon_upgraded);

    TankDesign.baseStats.firePause = weapon.firePause;
    TankDesign.firePause = weapon_upgraded.firePause;

    TankDesign.baseStats.reloadTime = weapon.reloadTime;
    TankDesign.reloadTime = weapon_upgraded.reloadTime;

    TankDesign.baseStats.numRounds = weapon.numRounds;
    TankDesign.numRounds = weapon_upgraded.numRounds;

    TankDesign.baseStats.periodicalDamage = weapon.periodicalDamage;
    TankDesign.periodicalDamage = weapon_upgraded.periodicalDamage;

    TankDesign.baseStats.periodicalDamage = weapon.periodicalDamage;
    TankDesign.periodicalDamage = weapon_upgraded.periodicalDamage;

    TankDesign.baseStats.periodicalDamageTime = weapon.periodicalDamageTime;
    TankDesign.periodicalDamageTime = weapon_upgraded.periodicalDamageTime;

    TankDesign.baseStats.periodicalDamageRadius = weapon.periodicalDamageRadius;
    TankDesign.periodicalDamageRadius = weapon_upgraded.periodicalDamageRadius;

    /* PRICE, BUILD POINTS, BUILD TIME */
    var fact_build_points;
    var fact_build_points_upgraded;
    
    if (propulsion.type == 'Lift') {
        fact_build_points = Structures.loaded_data_hash['A0VTolFactory1'].productionPoints; // per second
        fact_build_points_upgraded = Upgrades[player].Building[Structures.loaded_data_hash['A0VTolFactory1'].index_of_datarow].productionPoints; // per second
    } else if (propulsion.type == 'Legged') {
        fact_build_points = Structures.loaded_data_hash['A0CyborgFactory'].productionPoints; // per second
        fact_build_points_upgraded = Upgrades[player].Building[Structures.loaded_data_hash['A0CyborgFactory'].index_of_datarow].productionPoints; // per second
    } else {
        fact_build_points = Structures.loaded_data_hash['A0LightFactory'].productionPoints; // per second
        fact_build_points_upgraded = Upgrades[player].Building[Structures.loaded_data_hash['A0LightFactory'].index_of_datarow].productionPoints; // per second
    }

    TankDesign.baseStats.price = weapon.buildPower + body.buildPower + body.buildPower * propulsion.buildPower / 100;
    TankDesign.price = weapon_upgraded.buildPower + body_upgraded.buildPower + body_upgraded.buildPower * propulsion.buildPower / 100;

    TankDesign.baseStats.buildPoints = weapon.buildPoints + body.buildPoints + body.buildPoints * propulsion.buildPoints / 100;
    TankDesign.buildPoints = weapon_upgraded.buildPoints + body_upgraded.buildPoints + body_upgraded.buildPoints * propulsion.buildPoints / 100;

    TankDesign.baseStats.buildTimeSeconds_factory_nomodules = TankDesign.baseStats.buildPoints / fact_build_points;
    TankDesign.buildTimeSeconds_factory_nomodules = TankDesign.buildPoints / fact_build_points_upgraded;

    if (propulsion.type == 'Legged') {
        TankDesign.baseStats.buildTimeSeconds_factory_with2modules = 0;
        TankDesign.buildTimeSeconds_factory_with2modules = 0;
    } else {
        TankDesign.baseStats.buildTimeSeconds_factory_with2modules = TankDesign.baseStats.buildPoints / (fact_build_points * 3);
        TankDesign.buildTimeSeconds_factory_with2modules = TankDesign.buildPoints / (fact_build_points * 2 + fact_build_points_upgraded);
    }

    TankDesign.baseStats.longRange = weapon.longRange;
    TankDesign.longRange = weapon_upgraded.longRange;
    
    /* VTOL Stuff */
    TankDesign.baseStats.vtol_numShots = (weapon.numAttackRuns == undefined ? 0 : weapon.numAttackRuns) * (weapon.numRounds == undefined ? 0 : weapon.numRounds);
    TankDesign.vtol_numShots = TankDesign.baseStats.vtol_numShots;

    return TankDesign;
}

function Weapon_ShotsPerMinute(weapon) {
    var reloadTime = weapon.reloadTime == undefined ? 0 : weapon.reloadTime;
    var num_rounds = weapon.numRounds == undefined ? 1 : weapon.numRounds;
    if (num_rounds == 0) num_rounds = 1;
    return 600 / (weapon.firePause * num_rounds + reloadTime) * num_rounds;
}

var WeaponAbilities = function () { };
WeaponAbilities.prototype = (function () {
    var me = {};
    me.HasSplash = false;
    me.HasPeriodicalDamage = false;
    me.HeatDamage = false;
    me.Indirect = false;
    me.CanHitVtols = false;
    me.CannotHitGround = false;
    me.VTOLWeapon = false;
    me.CyborgWeapon = false;
    me.ShortRanged = false;
    me.LongRanged = false;
    me.Penetrate = false;
    me.CantFireOnMove = false;
    me.UpgradeLine = "";
    me.HitRun = false;
    return me;
})();


var BodyAbilities = function () { };
BodyAbilities.prototype = (function () {
    var me = {};
    me.SlowDesign = false; 
    me.CrossWater = false;
    me.FlyingUnit = false;
    me.Cyborg = false;
    return me;
})();

function Weapon_GetAbilities(weapon) {
    var res = new WeaponAbilities();
    res.CanHitVtols = weapon.flags == undefined ? false : weapon.flags.indexOf("ShootAir") >= 0 || weapon.flags.indexOf("AirOnly") >= 0;
    res.CannotHitGround = weapon.flags == undefined ? false : weapon.flags.indexOf("AirOnly") >= 0;
    res.CantFireOnMove = weapon.fireOnMove == undefined ? false : weapon.fireOnMove == 0 || weapon.fireOnMove == "0";
    res.CyborgWeapon = weapon.grid_id.toLowerCase().indexOf("cyborg") >= 0 || weapon.name.toLowerCase().indexOf("cyborg") >= 0 || weapon.grid_id.toLowerCase().indexOf("cyb-") >= 0 || weapon.name.toLowerCase().indexOf("cyb-") >= 0;
    res.HasPeriodicalDamage = weapon.periodicalDamage == undefined ? false : weapon.periodicalDamage > 0;
    res.HasSplash = weapon.radiusDamage == undefined ? false : weapon.radiusDamage > 0;
    res.HeatDamage = weapon.weaponClass == undefined ? false : weapon.weaponClass == "HEAT";
    res.Indirect = weapon.movement == undefined ? false : weapon.movement == "INDIRECT";
    res.LongRanged = weapon.longRange / 128 > 13;
    res.Penetrate = weapon.penetrate == undefined ? false : parseInt(weapon.penetrate) == 1;
    res.ShortRanged = weapon.longRange / 128 < 6;
    res.UpgradeLine = weapon.weaponSubClass;
    res.VTOLWeapon = weapon.numAttackRuns == undefined ? false : parseInt(weapon.numAttackRuns) > 0;
    res.HitRun = (weapon.numRounds == undefined ? false : parseInt(weapon.numRounds) > 1) && (weapon.firePause == undefined ? false : parseInt(weapon.firePause) < 20);
    return res;
}

function Body_GetAbilities(Tank) {
    var res = new BodyAbilities();
    res.SlowDesign = Tank.speed_road < Tank.propulsion.speed/128 * 0.7 || Tank.speed_bonus < 1.3;
    res.CrossWater = Tank.propulsion.type == 'Hover' || Tank.propulsion.type == 'Propellor';
    res.FlyingUnit = Tank.propulsion.type == 'Lift';
    res.Cyborg = Tank.propulsion.type == 'Legged' || (Tank.body.class == undefined ? false : Tank.body.class == 'Cyborgs');
    return res;
}


function Abilities_Description(ability_name) {
    var res = {};
    res.name = "";
    res.descr = "";
    res.icon_class = "";
    switch (ability_name) {
        case "CanHitVtols":
            res.name = "Can Attack VTOLs";
            res.descr = "This unis can attack and kill flying enemy units. Warzone units can't attack VTOLs by default.";
            res.icon_class = "ui-icon ui-icon-star";
            break;
        case "CannotHitGround":
            res.name = "Can't attack ground units";
            res.descr = "This is Anti-Air unit. This unit can attack <b>only</b> flying units.";
            res.icon_class = "ui-icon ui-icon-alert";
            break;
        case "CantFireOnMove":
            res.name = "Can't fire on move";
            res.descr = "This unit need stop moving before attack.";
            res.icon_class = "ui-icon ui-icon-shuffle";
            break;
        case "CyborgWeapon":
            res.name = "Cyborg Weapon";
            res.descr = "This weapon can be used only by cyborgs. ";
            res.icon_class = "ui-icon ui-icon-alert";
            break;
        case "HasPeriodicalDamage":
            res.name = "Overtime damage";
            res.descr = "This unit has additional continious damage";
            res.icon_class = "ui-icon ui-icon-star";
            break;
        case "HasSplash":
            res.name = "Area damage";
            res.descr = "This unit has additional area damage. Area damage inflicts all units nearby main target of attack";
            res.icon_class = "ui-icon ui-icon-star";
            break;
        case "HeatDamage":
            res.name = "Thermal (heat) kind of attack";
            res.descr = "This unit attacks by thermal (heat) damage, so enemy tank should have good thermal armor";
            res.icon_class = "ui-icon ui-icon-shuffle";
            break;
        case "Indirect":
            res.name = "Indirect (artillery)";
            res.descr = "This unit can be attached to sensor and can attack through terrain and enemy tanks.";
            res.icon_class = "ui-icon ui-icon-shuffle";
            break;
        case "LongRanged":
            res.name = "Long ranged";
            res.descr = "This unit has high range of fire.";
            res.icon_class = "ui-icon ui-icon-star";
            break;
        case "Penetrate":
            res.name = "Penetrate";
            res.descr = "Each projectile of this unit can hit several enemy unis on one line";
            res.icon_class = "ui-icon ui-icon-star";
            break;
        case "ShortRanged":
            res.name = "Short raged";
            res.descr = "Attacks from very short distance";
            res.icon_class = "ui-icon ui-icon-alert";
            break;
        case "UpgradeLine":
            res.name = "Weapon Line";
            res.descr = "";
            break;
        case "VTOLWeapon":
            res.name = "VTOL weapon";
            res.descr = "This weapon can be used only on VTOL-units.";
            res.icon_class = "ui-icon ui-icon-alert";
            break;
        case "HitRun":
            res.name = "Hit&Run";
            res.descr = "This weapon is usable in hit&run tactic because it can shoot more than 1 projectile per time.";
            res.icon_class = "ui-icon ui-icon-star";
            break;

            
        case "SlowDesign":
            res.name = "Slow";
            res.descr = "Speed of this unit is very slow (comparing to maximum speed for propulsion)";
            res.icon_class = "ui-icon ui-icon-alert";
            break;
        case "CrossWater":
            res.name = "Can cross water";
            res.descr = "This unit can cross water tiles.";
            res.icon_class = "ui-icon ui-icon-star";
            break;
        case "FlyingUnit":
            res.name = "Flying units (VTOL)";
            res.descr = "This is VTOl-unit.";
            res.icon_class = "ui-icon ui-icon-shuffle";
            break;
        case "Cyborg":
            res.name = "Cyborg";
            res.descr = "This is robotic warrior (selected cyborg body anr/or cyborg propulsion)";
            res.icon_class = "ui-icon ui-icon-shuffle";
            break;
        default:
            break;
    }
    return res;
}

function Form_Weapon_Abilities_html(weapon) {
    var abils_html = "";
    var abils = Weapon_GetAbilities(weapon);
    for (var ability in abils) {
        if (typeof abils[ability] == "boolean") {
            if (abils[ability]) {
                var des = Abilities_Description(ability);
                abils_html += '<div class="ui-widget-content ui-corner-all" style="padding:5px">';
                if (des.icon_class != undefined && des.icon_class != "") {
                    abils_html += '<span style="display:inline-block; margin-right:2px" class="' + des.icon_class + '"></span>';
                }
                abils_html += '<div style="display:inline-block;"><b>' + des.name + '</b></div>';
                abils_html += '<div style="font-size:0.8em;">' + des.descr + '</div>';
                abils_html += '</div>'
            }
        } else {
            abils_html += '<div class="ui-widget-content ui-corner-all" style="padding:5px;">' + ability + ': <b>' + abils[ability] + '</b></div>';
        }
    }
    return abils_html;
}

function FormAbilitiesHtml(TankDesign) {

    var abils_html = Form_Weapon_Abilities_html(TankDesign.weapon);
    var abils = Body_GetAbilities(TankDesign);
    for (var ability in abils) {
        if (typeof abils[ability] == "boolean") {
            if (abils[ability]) {
                var des = Abilities_Description(ability);
                abils_html += '<div class="ui-widget-content ui-corner-all" style="padding:5px;">';
                if (des.icon_class != undefined && des.icon_class != "") {
                    abils_html += '<span style="display:inline-block;" class="' + des.icon_class + '"></span>';
                }
                abils_html += '<div style="display:inline-block;"><b>' + des.name + '</b></div>';
                abils_html += '<div style="font-size:0.8em;">' + des.descr + '</div>';
                abils_html += '</div>'
            }
        } else {
            abils_html += '<div class="ui-widget-content ui-corner-all" style="padding:5px;">' + ability + ': <b>' + abils[ability] + '</b></div>';
        }
    }
    return abils_html;
}

function Form_ResearchRequirements_Html(weapon_id, body_id, propulsion_id) {

    var res = "";
    var resComp = ResearchedComponents[player_all_researched];
    var can_research = resComp[weapon_id] != undefined && resComp[body_id] != undefined && resComp[propulsion_id] != undefined;
    if(can_research)
    {
        var minTime = Math.max(resComp[weapon_id].time_seconds, resComp[body_id].time_seconds, resComp[propulsion_id].time_seconds);
        //res += '<div style="padding:5px;">Min time to research: <span style="float:right; display:inline"><b>' + minTime.toHHMMSS() + '</b></span></div>';
        if (ResearchTimeState[player_current_design] < minTime) {
            res += '<span style="display:inline-block;" class="ui-icon ui-icon-alert"></span>' + '<div style="display:inline-block;padding:5px;"><b>This design is not available on current selected research time</b></div>';
        }
    }else{
        res += '<span style="display:inline-block;" class="ui-icon ui-icon-alert"></span>' + '<div style="display:inline-block;padding:5px;"><b>I do not know is this design researchable or not</b></div>';
    }

    var wep_time = resComp[weapon_id] == undefined ? "don't know" : resComp[weapon_id].time_seconds.toHHMMSS();
    var wep_name = Weapons.loaded_data_hash[weapon_id] == undefined ? "unknown" : Weapons.loaded_data_hash[weapon_id].name;
    res += '<div class="ui-widget-content ui-corner-all" style="padding:5px;">';
    res += '<div>Weapon "' + wep_name + '" : <span style="float:right; display:inline"><b>' + wep_time + '</b></span></div>';
    res += '</div>'

    var bod_time = resComp[body_id] == undefined ? "don't know" : resComp[body_id].time_seconds.toHHMMSS();
    var bod_name = Bodies.loaded_data_hash[body_id] == undefined ? "unknown" : Bodies.loaded_data_hash[body_id].name;
    res += '<div class="ui-widget-content ui-corner-all" style="padding:5px;">';
    res += '<div>Body "' + bod_name + '" : <span style="float:right; display:inline"><b>' + bod_time + '</b></span></div>';
    res += '</div>'

    var prop_time = resComp[propulsion_id] == undefined ? "don't know" : resComp[propulsion_id].time_seconds.toHHMMSS();
    var prop_name = Propulsion.loaded_data_hash[propulsion_id] == undefined ? "unknown" : Propulsion.loaded_data_hash[propulsion_id].name;
    res += '<div class="ui-widget-content ui-corner-all" style="padding:5px;">';
    res += '<div>Propulsion "' + prop_name + '" : <span style="float:right; display:inline"><b>' + prop_time + '</b></span></div>';
    res += '</div>'

    return res;

}


function Designer_Draw_DPSTable(container_id, Tank, enemy_player_number) {
    
    $('#designer_dps_header').html('[NOT TESTED>>>] </br>DPS (Damage per second) : Research Time=' + last_calculated_research_time.toHHMMSS());

    var designs = [];

    designs.push(CalculateDesign_fromIDs(enemy_player_number, "Cannon1Mk1", "Body1REC", "wheeled01")); //viper wheels
    designs.push(CalculateDesign_fromIDs(enemy_player_number, "Cannon1Mk1", "Body1REC", "HalfTrack")); //viper half-tracks

    designs.push(CalculateDesign_fromIDs(enemy_player_number, "Cannon1Mk1", "Body5REC", "wheeled01")); //cobra half-tracks
    designs.push(CalculateDesign_fromIDs(enemy_player_number, "Cannon1Mk1", "Body5REC", "hover01")); //cobra hover
    designs.push(CalculateDesign_fromIDs(enemy_player_number, "Cannon1Mk1", "Body8MBT", "tracked01")); //scorpion tracks

    designs.push(CalculateDesign_fromIDs(enemy_player_number, "Cannon1Mk1", "Body11ABT", "HalfTrack")); //python half-tracks
    designs.push(CalculateDesign_fromIDs(enemy_player_number, "Cannon1Mk1", "Body11ABT", "hover01")); //python hover
    designs.push(CalculateDesign_fromIDs(enemy_player_number, "Cannon1Mk1", "Body12SUP", "tracked01")); //mantis tracks
    designs.push(CalculateDesign_fromIDs(enemy_player_number, "Cannon1Mk1", "Body9REC", "hover01")); //tiger hover

    designs.push(CalculateDesign_fromIDs(enemy_player_number, "Cannon1Mk1", "Body5REC", "V-Tol")); //VTOL cobra

    var grid_data = [];
    for (var i = 0; i < designs.length; i++) {
        var dps_360s = calculate_damage(Tank, designs[i], 360);
        grid_data[i] = {};
        grid_data[i].id = i;
        grid_data[i].group = designs[i].body.size;
        grid_data[i].weapon = designs[i].weapon.name;
        grid_data[i].body = designs[i].body.name;
        grid_data[i].propulsion = designs[i].propulsion.name;
        grid_data[i].dps = (dps_360s / 360).toFixed(1);
    }

    var grid_element_id = ResetGridContainer(container_id, false);
    var grid = $(grid_element_id);
    grid.jqGrid
    ({
        datatype: "local",
        data: grid_data,
        rowNum: grid_data.length,
        height: 'auto',
        colModel:
            [
                { label: "", name: "id", width: '1px', key:true, hidden:true },
                { label: "Class", name: "group",  width: '100px' },
                { label: "Body", name: "body",  width: '100px' },
                { label: "Propulsion", name: "propulsion", width: '100px' },
                { label: "Weapon", name: "weapon", width: '100px' },
                { label: "DPS (damage per second)", name: "dps", width: '100px' },
            ],
        onSelectRow: function (rowid) {
        },
        loadonce: true,
        ignoreCase: true, //make search case insensitive
        grouping: true,
        groupingView: {
            groupField: ['group'],
            groupText: ['<b> {0} </b>'],
            groupColumnShow: [false]
        },
    });

}

function calculate_damage(TankFrom, TankTo, time_seconds) {
    
    var tank1_abils = Weapon_GetAbilities(TankFrom.weapon);
    var tank2_abils = Body_GetAbilities(TankTo);
    if (tank2_abils.FlyingUnit) {
        if (!tank1_abils.CanHitVtols) {
            return 0;
        }
    }
    if (tank1_abils.CannotHitGround && tank1_abils.CanHitVtols) {
        if (!tank2_abils.FlyingUnit) {
            return 0;
        }
    }

    var armor_direct;
    var armor_periodical = TankTo.armourHeat;
    if (tank1_abils.HeatDamage) {
        armor_direct = TankTo.armourHeat;
    }else{
        armor_direct = TankTo.armourKinetic;
    }

    var propulsion_modifier = parseInt(PropulsionModifiers.loaded_data_hash[TankFrom.weapon.weaponEffect][TankTo.propulsion.type]);

    var shots_count = TankFrom.shotsPerMinute * (time_seconds / 60);
    var clean_damage = TankFrom.damage * propulsion_modifier / 100;
    var per_second_damage = 0;
    if (tank1_abils.HasPeriodicalDamage) {
        var clean_damage_incendiary_per_second = TankFrom.periodicalDamage; //version 3.1.0 100% incen damage + //будем считать что шанс поджесь 100%, потом надо будет переделать на мин. и макс. урон
        per_second_damage = clean_damage_incendiary_per_second - armor_periodical;
    } else {
        per_second_damage = 0;
    }

    var one_shot_damage = Math.max(clean_damage / 3, clean_damage - armor_direct);

    return one_shot_damage * shots_count + per_second_damage * time_seconds; 
}

function CalculateDesign_fromIDs(player, weapon_id, body_id, propulsion_id) {
    var weapon = Weapons.loaded_data_hash[weapon_id];
    var body = Bodies.loaded_data_hash[body_id];
    var propulsion = Propulsion.loaded_data_hash[propulsion_id];
    return CalculateTankDesign(player, weapon, body, propulsion);
}

function TryCalculateDesign(callback_function) {

    ShowLoading('tabs_left');

    LoadAllObjects(function () {

        var player = 0;
        HideLoading('tabs_left');
        
        var weapon_id = $("#designer_weapon").attr('data-value');
        var weapon = Weapons.loaded_data_hash[weapon_id];
        //if (weapon == undefined) return;
        

        var body_id = $("#designer_body").attr('data-value');
        var body = Bodies.loaded_data_hash[body_id];
        //if (body == undefined) return;
        

        var propulsion_id = $("#designer_propulsion").attr('data-value');
        var propulsion = Propulsion.loaded_data_hash[propulsion_id];
        //if (propulsion == undefined) return;

        is_unfinished_design = weapon == undefined || body == undefined || propulsion == undefined;


        var show_params_method = function () {
            //this method should be called when research processes 
            //var weapon_upgraded = Upgrades[player].Weapon[weapon.index_of_datarow];
            //var body_upgraded = Upgrades[player].Body[body.index_of_datarow];

            var Tank = CalculateTankDesign(player, weapon, body, propulsion);

            var grid_data = [];

            /* PRICE & BUILD POINTS */
            {
                var row = new Object;
                row.name = 'Tank price';
                row.base = Tank.baseStats.price.toFixed(0);
                row.upgraded = Tank.price.toFixed(0);
                row.group = '1: Price';
                grid_data.push(row);
            }

            {
                var row = new Object;
                row.name = 'Time to build in Factory: no modules';
                row.base = Tank.baseStats.buildTimeSeconds_factory_nomodules.toMMSS();
                row.upgraded = Tank.buildTimeSeconds_factory_nomodules.toMMSS();
                row.upgrade_change = (Tank.buildTimeSeconds_factory_nomodules - Tank.baseStats.buildTimeSeconds_factory_nomodules) / Tank.baseStats.buildTimeSeconds_factory_nomodules;
                row.group = '2: Build time';
                grid_data.push(row);
            }

            {
                var row = new Object;
                row.name = 'Time to build in Factory: with 2 modules';
                row.base = Tank.baseStats.buildTimeSeconds_factory_with2modules.toMMSS();
                row.upgraded = Tank.buildTimeSeconds_factory_with2modules.toMMSS();
                row.upgrade_change = (Tank.buildTimeSeconds_factory_with2modules - Tank.baseStats.buildTimeSeconds_factory_with2modules) / Tank.baseStats.buildTimeSeconds_factory_with2modules;
                row.group = '2: Build time';
                grid_data.push(row);
            }

            {
                var row = new Object;
                row.name = 'Build points';
                row.base = Tank.baseStats.buildPoints;
                row.upgraded = Tank.buildPoints;
                row.upgrade_change = (row.upgraded - row.base) / row.base;
                row.group = '2: Build time';
                grid_data.push(row);
            }

            /* Armor */
            {
                var row = new Object;
                row.name = 'Health Points';
                row.base = Tank.baseStats.hitPoints;
                row.upgraded = Tank.hitPoints;
                row.upgrade_change = (row.upgraded - row.base) / row.base;
                row.group = '3: Armor';
                grid_data.push(row);
            }
            {
                var row = new Object;
                row.name = 'Kinetic armor';
                row.base = Tank.baseStats.armourKinetic;
                row.upgraded = Tank.armourKinetic;
                row.upgrade_change = (row.upgraded - row.base) / row.base;
                row.group = '3: Armor';
                grid_data.push(row);
            }
            {
                var row = new Object;
                row.name = 'Thermal armor';
                row.base = Tank.baseStats.armourHeat.toFixed(0);
                row.upgraded = Tank.armourHeat.toFixed(0);
                row.upgrade_change = ((row.upgraded - row.base) / row.base).toFixed(0);
                row.group = '3: Armor';
                grid_data.push(row);
            }

            /* DAMAGE */
            {
                var row = new Object;
                row.name = 'Damage';
                row.base = Tank.baseStats.damage;
                row.upgraded = Tank.damage;
                row.upgrade_change = (row.upgraded - row.base) / row.base;
                row.group = '4: Damage';
                grid_data.push(row);
            }
            {
                var row = new Object;
                row.name = 'Damage Type';
                row.base = Tank.baseStats.weaponClass;
                row.upgraded = '';
                row.group = '4: Damage';
                grid_data.push(row);
            }
            {
                var row = new Object;
                row.name = 'Splash Damage';
                row.base = Tank.baseStats.radiusDamage;
                row.upgraded = Tank.radiusDamage;
                row.upgrade_change = (row.upgraded - row.base) / row.base;
                row.group = '4: Damage';
                grid_data.push(row);
            }
            {
                var row = new Object;
                row.name = 'Splash Radius (tiles)';
                row.base = Tank.baseStats.radius / 128;
                row.upgraded = Tank.radius / 128;
                row.upgrade_change = (row.upgraded - row.base) / row.base;
                row.group = '4: Damage';
                grid_data.push(row);
            }
            {
                var row = new Object;
                row.name = 'Shots per Minute <br />(Firepause)'; 
                row.base = Tank.baseStats.shotsPerMinute.toFixed(2);
                row.upgraded = Tank.shotsPerMinute.toFixed(2);
                row.upgrade_change = (row.upgraded - row.base) / row.base;
                row.group = '4: Damage';
                grid_data.push(row);
            }

            {
                var row = new Object;
                row.name = 'Periodical damage';
                row.base = Tank.baseStats.periodicalDamage;
                row.upgraded = Tank.periodicalDamage;
                row.upgrade_change = (row.upgraded - row.base) / row.base;
                row.group = '4: Damage';
                grid_data.push(row);
            }

            {
                var row = new Object;
                row.name = 'Periodical damage duration <br />(seconds)';
                row.base = Tank.baseStats.periodicalDamageTime / 10;
                row.upgraded = Tank.periodicalDamageTime / 10;
                row.upgrade_change = (row.upgraded - row.base) / row.base;
                row.group = '4: Damage';
                grid_data.push(row);
            }

            {
                var row = new Object;
                row.name = 'Periodical damage radius (tiles)';
                row.base = Tank.baseStats.periodicalDamageRadius / 128;
                row.upgraded = Tank.periodicalDamageRadius / 128;
                row.upgrade_change = (row.upgraded - row.base) / row.base;
                row.group = '4: Damage';
                grid_data.push(row);
            }
            /* RANGE */
            {
                var row = new Object;
                row.name = 'Range (tiles)';
                row.base = Tank.baseStats.longRange / 128;
                row.upgraded = Tank.longRange / 128;
                row.upgrade_change = (row.upgraded - row.base) / row.base;
                row.group = '5: Range';
                grid_data.push(row);
            }

            /* SPEED */
            {
                var row = new Object;
                row.name = 'Speed Road';
                row.base = Tank.baseStats.speed_road;
                row.upgraded = Tank.speed_road;
                row.upgrade_change = (row.upgraded - row.base) / row.base;
                row.group = '6: Speed';
                grid_data.push(row);
            }
            {
                var row = new Object;
                row.name = 'Speed Off-Road';
                row.base = Tank.baseStats.speed_offroad;
                row.upgraded = Tank.speed_offroad;
                row.upgrade_change = (row.upgraded - row.base) / row.base;
                row.group = '6: Speed';
                grid_data.push(row);
            }

            $("#designer_abilities_container").html(FormAbilitiesHtml(Tank));
            

            Designer_Draw_DPSTable('designer_dps_container', Tank, 0);

            var container_id = "designer_parameters_container";
            var grid_element_id = ResetGridContainer(container_id, true);
            var grid_toolbar_id = grid_element_id + "_toolbar";
            var grid = $(grid_element_id);
            grid.jqGrid
            ({
                datatype: "local",
                data: grid_data,
                rowNum: grid_data.length,
                //height: $(window).height() - $("#" + container_id).offset().top - 60,
                height: 'auto',
                colModel:
                    [
                        { name: "", width: '20px', sortable: false, search: false },
                        { name: "name", key: true, width: '200px' },
                        {
                            name: "base", width: '100px',
                            formatter: function (cellvalue, options, rowObject) {
                                if (typeof cellvalue != "string" && isNaN(cellvalue)) {
                                    return '';
                                }
                                return cellvalue;
                            }
                        },
                        { name: "group", width: '100px' },
                        {
                            name: "upgraded", width: '100px',
                            formatter: function (cellvalue, options, rowObject) {
                                if (typeof cellvalue != "string" && isNaN(cellvalue)) {
                                    return '';
                                }
                                if (cellvalue == rowObject.base) {
                                    return '';
                                }
                                return cellvalue;
                            }
                        },
                        {
                            name: "upgrade_change", width: '100px',
                            formatter: function (cellvalue, options, rowObject) {
                                if (isNaN(cellvalue)) {
                                    return '';
                                } else {
                                    var fl = (parseFloat(cellvalue) * 100).toFixed(0);
                                    if (fl == 0) {
                                        return '';
                                    } else {
                                        return "<label>" + fl + "%</label>";
                                    }
                                }
                            },

                        },
                    ],
                onSelectRow: function (rowid) {

                },
                loadonce: true,
                recordtext: "records: {2}",
                ignoreCase: true, //make search case insensitive
                grouping: true,
                groupingView: {
                    groupField: ['group'],
                    groupText: ['<b> {0} </b>'],
                    groupColumnShow: [false]
                },
            });
            grid.jqGrid('filterToolbar', { stringResult: true, searchOnEnter: true, defaultSearch: "cn" });

        };
        
        var research_time = $('#designer_research_slider').slider("option", "value");

        if (last_calculated_research_time != research_time) {
            ShowLoading('tabs_left');
            DoResearch(research_time, 0, function (finished_research) {
                HideLoading('tabs_left');
                last_calculated_research_time = research_time;
                if (is_unfinished_design) {
                    if (weapon != null) {
                        $("#designer_abilities_container").html(Form_Weapon_Abilities_html(weapon));
                    }
                }else{
                    show_params_method();
                }
                $("#designer_research_requirements").html(Form_ResearchRequirements_Html(weapon_id, body_id, propulsion_id));
            });
        } else {
            if (is_unfinished_design) {
                if (weapon != null) {
                    $("#designer_abilities_container").html(Form_Weapon_Abilities_html(weapon));
                }
            }else{
                show_params_method();
            }
            $("#designer_research_requirements").html(Form_ResearchRequirements_Html(weapon_id, body_id, propulsion_id));
        }

        if (callback_function != undefined) {
            callback_function();
        }
    });
}


function Stats_Damage_Base(weapon_id) {

}

function Stats_Damage_Upgraded(weapon_id, research_time) {

}


function Stats_SpeedRoad_Base(weapon_row, body_row, propulsion_row) {


}


function GetStatsItem_Slow(DataObject, id) {

    for (var i = 0; i < DataObject.loaded_data.length; i++) {
        if (DataObject.loaded_data[i].grid_id == id) {
            return DataObject.loaded_data[i];
        }
    }
    return null;
}