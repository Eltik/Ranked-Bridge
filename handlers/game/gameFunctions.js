const mysql = require("mysql");

let variables = require("../../handlers/variables.js");
let channels = require("../../config/channels.json");
const roles = require("../../config/roles.json");
const config = require("../../config/config.json");
const functions = require("../functions.js");

const Discord = require("discord.js");
const { joinVoiceChannel } = require("@discordjs/voice");

const axios = require("axios");

const glicko2 = require("glicko2");
var settings = {
    // tau : "Reasonable choices are between 0.3 and 1.2, though the system should
    //      be tested to decide which value results in greatest predictive accuracy."
    tau: 0.9,
    // rating : default rating
    rating: 1000,
    //rd : Default rating deviation
    //     small number = good confidence on the rating accuracy. Like kFactor
    rd: 16 * 4.69,
    //vol : Default volatility (expected fluctation on the player rating)
    vol: 0.06
};
var ranking = new glicko2.Glicko2(settings);

let con = mysql.createPool({
    connectionLimit: 1000,
    host: config.host,
    user: config.username,
    password: config.password,
    database: config.database,
    port: config.port,
    connectTimeout  : 60 * 60 * 1000,
    acquireTimeout  : 60 * 60 * 1000,
    timeout         : 60 * 60 * 1000,
    debug: false
});

module.exports.getELO = getELO;
module.exports.makeChannel = makeChannel;
module.exports.getGames = getGames;
module.exports.setGames = setGames;

module.exports.screenshareUser = screenshareUser;
module.exports.supportTicket = supportTicket;

module.exports.calcElo = calcElo;
module.exports.updateELO = updateELO;

module.exports.getName = getName;

module.exports.getRole = getRole;
module.exports.getUser = getUser;

module.exports.fixRoles = fixRoles;
module.exports.fixName = fixName;
module.exports.resetName = resetName;

module.exports.getWins = getWins;
module.exports.getLosses = getLosses;
module.exports.getWinstreak = getWinstreak;
module.exports.getBestWinstreak = getBestWinstreak;
module.exports.getStats = getStats;

module.exports.setWins = setWins;
module.exports.setLosses = setLosses;
module.exports.setWinstreak = setWinstreak;
module.exports.setBestwinstreak = setBestwinstreak;
module.exports.updateDivision = updateDivision;
module.exports.updateName = updateName;
module.exports.setUserGames = setUserGames;
module.exports.updateIGN = updateIGN;

module.exports.getTotalGames = getTotalGames;
module.exports.insertGame = insertGame;
module.exports.setGame = setGame;

module.exports.isInDb = isInDb;
module.exports.nameInDb = nameInDb;
module.exports.insertUser = insertUser;
module.exports.isBanned = isBanned;
module.exports.banUser = banUser;
module.exports.unbanUser = unbanUser;
module.exports.purgeUser = purgeUser;
module.exports.muteUser = muteUser;
module.exports.unmuteUser = unmuteUser;

module.exports.getUUID = getUUID;
module.exports.getHypixel = getHypixel;

module.exports.getLeaderboard = getLeaderboard;

module.exports.runLoops = runLoops;

module.exports.toggleRole = toggleRole;

module.exports.getPunishments = getPunishments;

module.exports.createParty = createParty;
module.exports.isInParty = isInParty;
module.exports.isPending = isPending;
module.exports.getParty = getParty;
module.exports.getPartyMember = getPartyMember;

function getParty(id) {
    for (let i = 0; i < variables.party.length; i++) {
        if (variables.party[i][0] === id || variables.party[i][1] === id) {
            return variables.party[i];
        }
    }
    return false;
}

function isPending(id, id2) {
    for (let i = 0; i < variables.pendingParty.length; i++) {
        if (variables.pendingParty[i][0] === id) {
            if (variables.pendingParty[i][1] === id2) {
                return true;
            }
        }
        if (variables.pendingParty[i][1] === id) {
            if (variables.pendingParty[i][0] === id2) {
                return true;
            }
        }
    }
    return false;
}

function isInParty(id) {
    for (let i = 0; i < variables.party.length; i++) {
        if (variables.party[i][0] === id || variables.party[i][1] === id) {
            return true;
        }
    }
    return false;
}

function getPartyMember(id) {
    if (isInParty(id)) {
        for (let i = 0; i < variables.party.length; i++) {
            if (variables.party[i][0] === id) {
                return variables.party[i][1];
            }
            if (variables.party[i][1] === id) {
                return variables.party[i][0];
            }
        }
    } else {
        return null;
    }
}

function createParty(id, id2) {
    variables.party.push([id, id2]);
}

async function getPunishments(id) {
    return new Promise(async function (resolve, reject) {
        con.query(`SELECT * FROM punishments WHERE id='${id}'`, (err, rows) => {
            if (err) reject(err);
            resolve(rows);
        });
    });
}

async function insertPunishments(id) {
    con.query(`INSERT INTO rbridge (id, elo, name) VALUES (?, ?, ?)`, [id, 1000, name], function (err, rows, fields) {
        if (err) reject(err);
        resolve(true);
    });
}

async function strikeUser(id) {
    return new Promise(async function (resolve, reject) {
        let data = await getPunishments(id);
        if (!data) {
            resolve(null);
        } else {
            let strikes = data[0].strikes;
        }
    });
}

async function runLoops(guild) {
    joinVoiceChannel({ channelId: channels.queueChannel, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator });
    let currentTime = Date.now();
    con.query(`SELECT * FROM banned`, (err, rows) => {
        for (var i = 0; i < rows.length; i++) {
            let userID = rows[i].id;
            let timeBanned = rows[i].time;
            if (currentTime > timeBanned) {
                unbanUser(guild, userID, "Timed unban.");
                return;
            }
        }
    });
    setInterval(function () {
        joinVoiceChannel({ channelId: channels.queueChannel, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator });
        let currentTime = Date.now();
        con.query(`SELECT * FROM banned`, (err, rows) => {
            if (!rows) {
                return;
            }
            for (var i = 0; i < rows.length; i++) {
                let userID = rows[i].id;
                let timeBanned = rows[i].time;
                if (currentTime > timeBanned) {
                    unbanUser(guild, userID, "Timed unban.");
                    return;
                }
            }
        });
    }, 100000);
}

async function purgeUser(id) {
    con.query(`DELETE FROM rbridge WHERE id = '${id}'`, (erre, row) => {
        if (erre) throw erre;
    });
}

async function unbanUser(guild, id, reason) {
    let role = await getRole(guild, roles.banned);
    let unverified = await getRole(guild, roles.unverified);
    let user = await getUser(guild, id);
    
    let name = await getName(id);

    con.query(`DELETE FROM banned WHERE id = '${id}'`, (erre, row) => {
        if (erre) throw erre;
    });

    if (user != undefined) {
        user.roles.remove(role);
        user.roles.add(unverified)
    }

    const banEmbed = new Discord.EmbedBuilder()
        .setColor("#2f3136")
        .setTitle(name + " is now unbanned.")
        .setDescription("User: <@" + user + ">\nReason: ```" + reason + "```")
        .setTimestamp();
    guild.channels.cache.get(channels.bansChannel).send({ embeds: [banEmbed] });
}

async function banUser(guild, id, days, reason) {
    let role = await getRole(guild, roles.banned);
    let user = await getUser(guild, id);
    let name = await getName(id);

    let currentTime = Date.now() + days * 86400000;
    con.query(`SELECT * FROM banned WHERE id = '${id}'`, (err, rows) => {
        if (!rows.length === 0) {
            con.query(`INSERT INTO banned (id, name, time) VALUES(?, ?, ?)`, [id, name, currentTime], function (err, rows, fields) {
                if (err) return console.error(err);
                console.log("Inserted ".green + name + " into ban table.".green);
            });
        } else {
            con.query(`DELETE FROM banned WHERE id=?`, [id], function (err, rows, fields) {
                if (err) return console.error(err);
                console.log("Deleted ".red + name + " from banned table.".red);
                con.query(`INSERT INTO banned (id, name, time) VALUES(?, ?, ?)`, [id, name, currentTime], function (err, rows, fields) {
                    if (err) return console.error(err);
                    console.log("Inserted ".green + name + " into ban table.".green);
                });
            });
        }
    });

    const banEmbed = new Discord.EmbedBuilder()
        .setColor("#2f3136")
        .setTitle(name + " recieved a ban")
        .setDescription("User: <@" + id + ">\nTime: `" + days + " days`.\nReason: ```" + reason + "```")
        .setTimestamp();
    guild.channels.cache.get(channels.bansChannel).send({ embeds: [banEmbed] });
    if (!user) return;
    if (user != undefined) {
        user.roles.add(role);
        user.roles.remove(roles.rankedPlayer);
    }
}

async function unmuteUser(guild, id) {
    let role = await getRole(guild, roles.muted);
    let user = await getUser(guild, id);

    let name;
    if (user != undefined) {
        user.roles.remove(role);
        name = user.user.tag;
    } else {
        name = "Unknown";
    }

    const muteEmbed = new Discord.EmbedBuilder()
        .setColor("#2f3136")
        .setTitle(name + " is now unmuted")
        .setTimestamp();
    guild.channels.cache.get(channels.punishmentsChannel).send({ embeds: [muteEmbed] });
}

async function muteUser(guild, id, minutes, reason) {
    let role = await getRole(guild, roles.muted);
    let user = await getUser(guild, id);

    let name;
    if (user != undefined) {
        user.roles.add(role);
        name = user.user.tag;
    } else {
        name = "Unknown";
    }

    const muteEmbed = new Discord.EmbedBuilder()
        .setColor("#2f3136")
        .setTitle(name + " recieved a mute")
        .setDescription("User: <@" + id + ">\nTime: `" + minutes + " minutes`.\nReason: ```" + reason + "```")
        .setTimestamp();
    guild.channels.cache.get(channels.punishmentsChannel).send({ embeds: [muteEmbed] });

    setTimeout(async function() {
        let user = await getUser(guild, id);
        if (!user) {
            return;
        }
        user.roles.remove(role);
    }, minutes * 60000);
}

async function isBanned(id) {
    return new Promise(async function (resolve, reject) {
        con.query(`SELECT * FROM banned WHERE id = '${id}'`, (err, rows) => {
            if (err) reject(err);
            if (rows.length === 0) {
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}

async function getLeaderboard(type) {
    return new Promise(async function (resolve, reject) {
        con.query(`SELECT * FROM rbridge ORDER BY ${type} DESC LIMIT 10`, (err, rows) => {
            if (err) throw err;
            if (!rows[0]) {
                resolve(null);
                return;
            }
            resolve(rows);
        });
    });
}

async function insertUser(id, name) {
    return new Promise(async function (resolve, reject) {
        let isName = await nameInDb(name);
        if (!isName) {
            con.query(`INSERT INTO rbridge (id, elo, name) VALUES (?, ?, ?)`, [id, 1000, name], function (err, rows, fields) {
                if (err) reject(err);
                resolve(true);
            });
        } else {
            con.query(`UPDATE rbridge SET id=? WHERE name=?`, [id, name], function (err, rows, fields) {
                if (err) reject(err);
                resolve(true);
            });
        }
    });
}

async function updateName(id, name) {
    con.query(`UPDATE rbridge SET id=? WHERE name=?`, [id, name], function (err, rows, fields) {
        if (err) reject(err);
        resolve(true);
    });
}

async function updateIGN(id, name) {
    con.query(`UPDATE rbridge SET name=? WHERE id=?`, [name, id], function (err, rows, fields) {
        if (err) return console.error(err);
    });
}

async function getUUID(username) {
    return new Promise(async function (resolve, reject) {
        let uuidURL = "https://api.mojang.com/users/profiles/minecraft/" + username;
        axios.get(uuidURL, {
        }).then(async (res) => {
            resolve({ "name": res.data.name, "uuid": res.data.id })
        }).catch((err) => {
            reject(err);
        });
    });
}

async function getHypixel(id) {
    return new Promise(async function (resolve, reject) {
        let uuidURL = `https://api.hypixel.net/player?uuid=${id}&key=${config.apiKey}`;
        axios.get(uuidURL, {
        }).then(async (res) => {
            resolve(res.data);
        }).catch((err) => {
            reject(err);
        });
    });
}

async function isInDb(id) {
    return new Promise(async function (resolve, reject) {
        con.query(`SELECT * FROM rbridge WHERE id = '${id}'`, (err, rows) => {
            if (err) reject(err);
            if (!rows || rows.length === 0) {
                resolve(false);
                return;
            }
    
            resolve(true);
        });
    });
}

async function nameInDb(name) {
    return new Promise(async function (resolve, reject) {
        con.query(`SELECT * FROM rbridge WHERE name = '${name}'`, (err, rows) => {
            if (err) reject(err);
            if (!rows || rows.length === 0) {
                resolve(false);
                return;
            }
    
            resolve(true);
        });
    });
}

async function insertGame(id, id2, gameId) {
    con.query(`INSERT INTO games (winnerid, loserid, winnerelo, loserelo, gameid) VALUES ('${id}', '${id2}', 0, 0, ${gameId})`, (err) => {
        if (err) throw err;
    });
}

async function setGame(id, id2, elo, elo2, gameId) {
    sql = `UPDATE games SET winnerid='${id}' WHERE gameid=${gameId}`;
    con.query(sql, (err) => {
        if (err) throw err;
    });
    sql = `UPDATE games SET loserid='${id2}' WHERE gameid=${gameId}`;
    con.query(sql, (err) => {
        if (err) throw err;
    });

    sql = `UPDATE games SET winnerelo=${elo} WHERE gameid=${gameId}`;
    con.query(sql, (err) => {
        if (err) throw err;
    });
    sql = `UPDATE games SET loserelo=${elo2} WHERE gameid=${gameId}`;
    con.query(sql, (err) => {
        if (err) throw err;
    });
}

function getTotalGames() {
    return new Promise(async function (resolve, reject) {
        con.query(`SELECT * FROM games`, (err, rows) => {
            if (err) reject(err);
            if (!rows || rows.length === 0) {
                resolve(null);
                return;
            }
            resolve(rows[rows.length - 1].gameid);
        });
    });
}

async function updateELO(id, elo) {
    con.query(`UPDATE rbridge SET elo = ${elo}, division = "COAL" WHERE id='${id}'`, (err, rows) => {
        if (err) return console.error(err);
    });
}

async function updateDivision(id) {
    let elo = await getELO(id);
    let sql;
    if (elo <= 999) {
        sql = `UPDATE rbridge SET division = "COAL" WHERE id='${id}'`;
    } else if (elo < 1100 && elo >= 1000) {
        sql = `UPDATE rbridge SET division = "IRON" WHERE id='${id}'`;
    } else if (elo < 1200 && elo >= 1100) {
        sql = `UPDATE rbridge SET division = "GOLD" WHERE id='${id}'`;
    } else if (elo < 1400 && elo >= 1200) {
        sql = `UPDATE rbridge SET division = "DIAMOND" WHERE id='${id}'`;
    } else if (elo < 1600 && elo >= 1400) {
        sql = `UPDATE rbridge SET division = "EMERALD" WHERE id='${id}'`;
    } else if (elo < 1800 && elo >= 1600) {
        sql = `UPDATE rbridge SET division = "OBSIDIAN" WHERE id='${id}'`;
    } else if (elo >= 1800) {
        sql = `UPDATE rbridge SET division = "CRYSTAL" WHERE id='${id}'`;
    } else if (elo < 1000) {
        sql = `UPDATE rbridge SET division = "COAL" WHERE id='${id}'`;
    }
    con.query(sql);
}

async function fixRoles(interaction, id) {
    let elo = await getELO(id);
    let user = await getUser(interaction.guild, id);
    let coal = await getRole(interaction.guild, roles.coalDivision);
    let iron = await getRole(interaction.guild, roles.ironDivision);
    let gold = await getRole(interaction.guild, roles.goldDivision);
    let diamond = await getRole(interaction.guild, roles.diamondDivision);
    let emerald = await getRole(interaction.guild, roles.emeraldDivision);
    let obsidian = await getRole(interaction.guild, roles.obsidianDivision);
    let crystal = await getRole(interaction.guild, roles.crystalDivision);

    if (!user || !user.roles) {
        return;
    }
    if (elo <= 999) {
        user.roles.add(coal);
        user.roles.remove(iron);
        user.roles.remove(obsidian);
        user.roles.remove(diamond);
        user.roles.remove(gold);
        user.roles.remove(emerald);
        user.roles.remove(crystal);
    } else if (elo < 1100 && elo >= 1000) {
        user.roles.add(iron);
        user.roles.remove(diamond);
        user.roles.remove(obsidian);
        user.roles.remove(gold);
        user.roles.remove(coal);
        user.roles.remove(emerald);
        user.roles.remove(crystal);
    } else if (elo < 1200 && elo >= 1100) {
        user.roles.add(gold);
        user.roles.remove(iron);
        user.roles.remove(diamond);
        user.roles.remove(coal);
        user.roles.remove(obsidian);
        user.roles.remove(emerald);
        user.roles.remove(crystal);
    } else if (elo < 1400 && elo >= 1200) {
        user.roles.add(diamond);
        user.roles.remove(obsidian);
        user.roles.remove(gold);
        user.roles.remove(coal);
        user.roles.remove(emerald);
        user.roles.remove(crystal);
    } else if (elo < 1600 && elo >= 1400) {
        user.roles.add(emerald);
        user.roles.remove(diamond);
        user.roles.remove(gold);
        user.roles.remove(coal);
        user.roles.remove(obsidian);
        user.roles.remove(crystal);
    } else if (elo < 1800 && elo >= 1600) {
        user.roles.add(obsidian);
        user.roles.remove(diamond);
        user.roles.remove(gold);
        user.roles.remove(coal);
        user.roles.remove(emerald);
        user.roles.remove(crystal);
    } else if (elo >= 1800) {
        user.roles.add(crystal);
        user.roles.remove(diamond);
        user.roles.remove(gold);
        user.roles.remove(coal);
        user.roles.remove(obsidian);
        user.roles.remove(emerald);
    } else if (elo < 1000) {
        user.roles.remove(obsidian);
        user.roles.remove(diamond);
        user.roles.remove(gold);
        user.roles.add(coal);
        user.roles.remove(crystal);
    }
}

async function resetName(interaction, id) {
    let member = await getUser(interaction.guild, id);
    if (!member) {
        return;
    }
    let elo = await getELO(id);
    let name = await getName(id);
    member.setNickname("[" + elo + "] " + name);
}

async function fixName(interaction, id) {
    let member = await getUser(interaction.guild, id);
    if (!member) {
        return;
    }
    let elo = await getELO(id);
    let name = await getName(id);
    let nick = member.displayName;
    if (nick.includes("[") && !nick.includes("(")) {
        interaction.guild.members.fetch(id).then((user) => user.setNickname("[" + elo + "] " + name)).catch((err) => console.error(err));;
    } else if (nick.includes("[") && nick.includes("(")) {
        let split = nick.split(" ");
        let restNick = "";
        for (let i = 0; i < split.length; i++) {
            restNick += split[i];
        }
        interaction.guild.members.fetch(id).then((user) => user.setNickname("[" + elo + "] " + restNick).catch((e) => console.log("Error setting the nickname!")));
    }
}

async function getUser(guild, id) {
    return new Promise(async function (resolve, reject) {
        await guild.members.fetch(id).then((user) => {
            if (!user) {
                resolve(null);
                return;
            }
            resolve(user);
            return;
        }).catch((err) => {
            resolve(null);
        });
    });
}

async function getRole(guild, id) {
    return new Promise(async function (resolve, reject) {
        await guild.roles.fetch(id).then((role) => {
            resolve(role);
            return;
        }).catch((err) => {
            console.error(err);
            reject(err);
        });
    });
}

async function calcElo(winner, winnerTeammate, loser, loserTeammate, winnerScore, loserScore) {
    let p1 = await getELO(winner);
    let p2 = await getELO(winnerTeammate);
    let p3 = await getELO(loser);
    let p4 = await getELO(loserTeammate);

    let average1 = (p1 + p2) / 2;
    let average2 = (p3 + p4) / 2;

    let p1Ranking = ranking.makePlayer(average1);
    let p2Ranking = ranking.makePlayer(average2);


    var matches = [];
    matches.push([p1Ranking, p2Ranking, 1])
    ranking.updateRatings(matches);

    var p1_elo = p1Ranking.getRating();

    var eloChange = Math.abs(p1_elo - p1);

    let change1 = Math.round(p1 + eloChange + (winnerScore / 4));
    let change2 = Math.round(p2 + eloChange + (winnerScore / 4));
    
    let change3 = Math.round(p3 - eloChange + (loserScore / 2));
    let change4 = Math.round(p4 - eloChange + (loserScore / 2));

    if (change3 > p3) {
        change3 = p3 - 2;
    }
    if (change4 > p4) {
        change4 = p4 - 2;
    }
    
    return [change1, change2, change3, change4];
}

async function getName(id) {
    return new Promise(async function (resolve, reject) {
        con.query(`SELECT * FROM rbridge WHERE id = '${id}'`, (err, rows) => {
            if (err) reject(err);
            if (!rows || rows.length === 0) {
                resolve(null);
                return;
            }
    
            resolve(rows[0].name);
        });
    });
}

function getELO(id) {
    return new Promise(async function (resolve, reject) {
        con.query(`SELECT * FROM rbridge WHERE id = '${id}'`, (err, rows) => {
            if (err) reject(err);
            if (!rows || rows.length === 0) {
                resolve(null);
                return;
            }
    
            resolve(rows[0].elo);
        });
    });
}

function getStats(id) {
    return new Promise(async function (resolve, reject) {
        con.query(`SELECT * FROM rbridge WHERE id = '${id}'`, (err, rows) => {
            if (err) reject(err);
            if (!rows || rows.length === 0) {
                resolve(null);
                return;
            }
            resolve(rows[0]);
        });
    });
}

async function getWins(id) {
    return new Promise(async function (resolve, reject) {
        con.query(`SELECT * FROM rbridge WHERE id = '${id}'`, (err, rows) => {
            if (err) reject(err);
            if (!rows || rows.length === 0) {
                resolve(null);
                return;
            }
    
            resolve(rows[0].wins);
        });
    });
}

async function getLosses(id) {
    return new Promise(async function (resolve, reject) {
        con.query(`SELECT * FROM rbridge WHERE id = '${id}'`, (err, rows) => {
            if (err) reject(err);
            if (!rows || rows.length === 0) {
                resolve(null);
                return;
            }
    
            resolve(rows[0].losses);
        });
    });
}

async function getWinstreak(id) {
    return new Promise(async function (resolve, reject) {
        con.query(`SELECT * FROM rbridge WHERE id = '${id}'`, (err, rows) => {
            if (err) reject(err);
            if (!rows || rows.length === 0) {
                resolve(null);
                return;
            }
    
            resolve(rows[0].winstreak);
        });
    });
}

async function getBestWinstreak(id) {
    return new Promise(async function (resolve, reject) {
        con.query(`SELECT * FROM rbridge WHERE id = '${id}'`, (err, rows) => {
            if (err) reject(err);
            if (!rows || rows.length === 0) {
                resolve(null);
                return;
            }
    
            resolve(rows[0].bestws);
        });
    });
}

async function getGames(id) {
    return new Promise(async function (resolve, reject) {
        con.query(`SELECT * FROM rbridge WHERE id = '${id}'`, (err, rows) => {
            if (err) reject(err);
            if (!rows || rows.length === 0) {
                resolve(null);
                return;
            }
            resolve(rows[0].games);
        });
    });
}

async function setWins(id, wins) {
    return new Promise(async function (resolve, reject) {
        con.query(`UPDATE rbridge SET wins = ${wins} WHERE id='${id}'`, (err, rows) => {
            if (err) reject(err);
            if (!rows || rows.length === 0) {
                resolve(false);
                return;
            }
            resolve(true);
        });
    });
}

async function setLosses(id, losses) {
    return new Promise(async function (resolve, reject) {
        con.query(`UPDATE rbridge SET losses = ${losses} WHERE id='${id}'`, (err, rows) => {
            if (err) reject(err);
            if (!rows || rows.length === 0) {
                resolve(false);
                return;
            }
            resolve(true);
        });
    });
}

async function setWinstreak(id, winstreak) {
    return new Promise(async function (resolve, reject) {
        con.query(`UPDATE rbridge SET winstreak = ${winstreak} WHERE id='${id}'`, (err, rows) => {
            if (err) reject(err);
            if (!rows || rows.length === 0) {
                resolve(false);
                return;
            }
            resolve(true);
        });
    });
}

async function setBestwinstreak(id, bestws) {
    return new Promise(async function (resolve, reject) {
        con.query(`UPDATE rbridge SET bestws = ${bestws} WHERE id='${id}'`, (err, rows) => {
            if (err) reject(err);
            if (!rows || rows.length === 0) {
                resolve(false);
                return;
            }
            resolve(true);
        });
    });
}

async function setUserGames(id, games) {
    return new Promise(async function (resolve, reject) {
        con.query(`UPDATE rbridge SET games = ${games} WHERE id='${id}'`, (err, rows) => {
            if (err) reject(err);
            if (!rows || rows.length === 0) {
                resolve(false);
                return;
            }
            resolve(true);
        });
    });
}

async function toggleRole(guild, member, id) {
    return new Promise(async function (resolve, reject) {
        var role = guild.roles.cache.get(id);
        if (!role) {
            resolve(null);
            return;
        }
        if (!member.roles.cache.has(role.id)) {
            member.roles.add(role);
            resolve(false);
        } else {
            member.roles.remove(role);
            resolve(true);
        }
    });
}

async function supportTicket(guild, member) {
    return new Promise(async function (resolve, reject) {
        let name = member.user.username;
        guild.channels.create("support-" + name, {
            permissionOverwrites: [
                {
                    id: guild.roles.everyone, //To make it be seen by a certain role, user an ID instead
                    deny: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'], //Deny permissions
                },
                {
                    // But allow the two users to view the channel, send messages, and read the message history.
                    id: member.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
                },
                {
                    id: roles.staff,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
                },
            ],
        }).then((msg) => {
            msg.send("<@&" + roles.staff + ">").then((message) => {
                if (message != undefined) {
                    message.delete();
                }
            });
            var channelID = msg.id;
            const supportEmbed = new Discord.EmbedBuilder()
                .setColor("#36699c")
                .setTitle(`Please state your issue!`)
                .setDescription("Staff will be with you shortly.")
                .setTimestamp();
            msg.send({ embeds: [supportEmbed], content: "<@&" + member.id + ">" });
            resolve(channelID);
        });
    });
}

async function screenshareUser(guild, member, member2) {
    return new Promise(async function (resolve, reject) {
        let name = await getName(member.id);
        guild.channels.create("screenshare-" + name, {
            permissionOverwrites: [
                {
                    id: guild.roles.everyone, //To make it be seen by a certain role, user an ID instead
                    deny: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'], //Deny permissions
                },
                {
                    // But allow the two users to view the channel, send messages, and read the message history.
                    id: member.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
                },
                {
                    // But allow the two users to view the channel, send messages, and read the message history.
                    id: member2.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
                },
                {
                    id: roles.screensharer,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
                },
                {
                    id: roles.staff,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
                },
                {
                    id: roles.jrScreensharer,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
                },
                {
                    id: roles.srScreensharer,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
                },
            ],
        }).then((msg) => {
            var channelID = msg.id;
            const ssEmbed = new Discord.EmbedBuilder()
                .setColor("#36699c")
                .setTitle(`Please fill out the following:`)
                .setDescription(
                    "`1.` The user you want to screenshare.\n`2.` What hacks they might be using.\n`3.` Screenshot of you asking the user not to log.\n**If a Screensharer does not appear within 15 minutes, <@" + member.id + "> is allowed to log.**"
                )
                .setTimestamp();
            msg.send({ embeds: [ssEmbed], content: "<@&" + roles.screensharer + ">" });
            guild.channels.create("SS " + name, {
                type: 2,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone, //To make it be seen by a certain role, user an ID instead
                        deny: ['ViewChannel', 'Connect', 'Speak'], //Deny permissions
                    },
                    {
                        id: member.id,
                        allow: ['ViewChannel', 'Connect', 'Speak'],
                    },
                    {
                        id: roles.staff,
                        allow: ['ViewChannel', 'Connect', 'Speak'],
                    },
                    {
                        id: roles.jrScreensharer,
                        allow: ['ViewChannel', 'Connect', 'Speak'],
                    },
                    {
                        id: roles.screensharer,
                        allow: ['ViewChannel', 'Connect', 'Speak'],
                    },
                    {
                        id: roles.srScreensharer,
                        allow: ['ViewChannel', 'Connect', 'Speak'],
                    },
                ],
            }).then((vc) => {
                msg.send("<@" + member.id + ">, please join <#" + vc.id + ">.");
                resolve(channelID);
            });
        });
    });
}

async function makeChannel(message, id, id2, id3, id4) {
    message.guild.members.fetch(config.clientId).then((member) => {
        member.setNickname("[" + variables.queue.length + "/4]");
    }).catch((e) => console.log("Error setting the nickname!"));
    await getUser(message.guild, id).then(async(user) => {
        if (user != null && user != undefined) {
            await getUser(message.guild, id2).then(async(user2) => {
                if (user2 != null && user2 != undefined) {
                    await getUser(message.guild, id3).then(async(user3) => {
                        if (user3 != null && user3 != undefined) {
                            await getUser(message.guild, id4).then(async(user4) => {
                                if (user4 != null && user4 != undefined) {
                                    console.log("Starting a game for ".yellow + user.user.tag + " and ".yellow + user2.user.tag + " vs ".yellow + user3.user.tag + " and ".yellow + user4.user.tag + "...".yellow);
                                    let gameId = await getTotalGames();
                                    gameId = parseInt(gameId + 1);

                                    await message.guild.channels.create("game-" + gameId, {
                                        permissionOverwrites: [
                                            {
                                                id: message.guild.roles.everyone, //To make it be seen by a certain role, user an ID instead
                                                deny: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] //Deny permissions
                                            },
                                            {
                                                // But allow the two users to view the channel, send messages, and read the message history.
                                                id: id,
                                                allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                                            },
                                            {
                                                id: id2,
                                                allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                                            },
                                            {
                                                id: id3,
                                                allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                                            },
                                            {
                                                id: id4,
                                                allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                                            },
                                            {
                                                id: roles.staff,
                                                allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                                            },
                                            {
                                                id: roles.scorer,
                                                allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                                            }
                                        ],
                                    });

                                    await message.guild.channels.create("Game " + gameId + " Team 1", {
                                        type: 2,
                                        permissionOverwrites: [
                                            {
                                                id: message.guild.roles.everyone, //To make it be seen by a certain role, user an ID instead
                                                deny: ['Connect', 'Speak'] //Deny permissions
                                            },
                                            {
                                                id: id,
                                                allow: ['ViewChannel', 'Connect', 'Speak']
                                            },
                                            {
                                                id: id2,
                                                allow: ['ViewChannel', 'Connect', 'Speak']
                                            },
                                            {
                                                id: id3,
                                                allow: ['ViewChannel']
                                            },
                                            {
                                                id: id4,
                                                allow: ['ViewChannel']
                                            },
                                            {
                                                id: roles.staff,
                                                allow: ['ViewChannel', 'Connect', 'Speak']
                                            },
                                            {
                                                id: roles.scorer,
                                                allow: ['ViewChannel', 'Connect', 'Speak']
                                            }
                                        ],
                                    });

                                    await message.guild.channels.create("Game " + gameId + " Team 2", {
                                        type: 2,
                                        permissionOverwrites: [
                                            {
                                                id: message.guild.roles.everyone, //To make it be seen by a certain role, user an ID instead
                                                deny: ['Connect', 'Speak'] //Deny permissions
                                            },
                                            {
                                                id: id,
                                                allow: ['ViewChannel']
                                            },
                                            {
                                                id: id2,
                                                allow: ['ViewChannel']
                                            },
                                            {
                                                id: id3,
                                                allow: ['ViewChannel', 'Connect', 'Speak']
                                            },
                                            {
                                                id: id4,
                                                allow: ['ViewChannel', 'Connect', 'Speak']
                                            },
                                            {
                                                id: roles.staff,
                                                allow: ['ViewChannel', 'Connect', 'Speak']
                                            },
                                            {
                                                id: roles.scorer,
                                                allow: ['ViewChannel', 'Connect', 'Speak']
                                            }
                                        ],
                                    });

                                    var vc1 = message.guild.channels.cache.find(c => c.name === "Game " + gameId + " Team 1");
                                    var vc2 = message.guild.channels.cache.find(c => c.name === "Game " + gameId + " Team 2");

                                    if (!vc1) {
                                        console.log("Can't get VC 1!".red);
                                    }
                                    if (!vc2) {
                                        console.log("Can't get VC 2!".red);
                                    }

                                    let team1 = vc1.id;
                                    let team2 = vc2.id;

                                    var textChannel = message.guild.channels.cache.find(c => c.name === "game-" + gameId);
                                    if (!textChannel) {
                                        console.log("Can't get the message channel!".red);
                                    }

                                    let messageChannel = textChannel.id;

                                    // Send the embed.
                                    const channelEmbed = new Discord.EmbedBuilder()
                                        .setColor('#36699c')
                                        .setTitle(`Game #${gameId}`)
                                        .setDescription('Duel the other person using `/duel <user> bridge`. Once the game is done, send a screenshot of the score using `/score`. Remember, games are best of 1.')
                                        .setTimestamp()
                                    message.guild.channels.cache.get(messageChannel).send({ content: "<@" + id + "> <@" + id2 + ">", embeds: [channelEmbed] });

                                    await insertGame(id, id2, gameId);

                                    variables.curGames.push([id, id2, messageChannel]);
                                    variables.curGames.push([id2, id, messageChannel]);
                                    variables.curGames.push([id3, id4, messageChannel]);
                                    variables.curGames.push([id4, id3, messageChannel]);

                                    await user.voice.setChannel(team1).catch((err) => console.error(err));
                                    await user2.voice.setChannel(team1).catch((err) => console.error(err));
                                    await user3.voice.setChannel(team2).catch((err) => console.error(err));
                                    await user4.voice.setChannel(team2).catch((err) => console.error(err));

                                    let invis1 = await message.guild.channels.cache.find((name) => name.name === id);
                                    let invis2 = await message.guild.channels.cache.find((name) => name.name === id2);
                                    let invis3 = await message.guild.channels.cache.find((name) => name.name === id3);
                                    let invis4 = await message.guild.channels.cache.find((name) => name.name === id4);
                                    
                                    if (invis1 != undefined) {
                                        invis1.delete().catch((err) => console.error(err));
                                    }
                                
                                    if (invis2 != undefined) {
                                        invis2.delete().catch((err) => console.error(err));
                                    }

                                    if (invis3 != undefined) {
                                        invis3.delete().catch((err) => console.error(err));
                                    }
                                
                                    if (invis4 != undefined) {
                                        invis4.delete().catch((err) => console.error(err));
                                    }
                                    console.log("Game ".green + "#" + gameId + " has been started.".green);
                                }
                            }).catch((err) => {
                                console.error(err);
                            });
                        }
                    }).catch((err) => {
                        console.error(err);
                    });
                }
            }).catch((err) => {
                console.error(err);
            });
        }
    }).catch((err) => {
        console.error(err);
    });
}

function setGames() {
    con.query(`SELECT * FROM games`, (err, rows) => {
        if (err) throw err;
        for (let i = 0; i < rows.length; i++) {
            variables.games.push(rows[i].gameid);
        }
    });
}