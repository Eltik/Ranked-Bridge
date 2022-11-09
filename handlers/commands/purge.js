const Discord = require("discord.js");

const gameFunctions = require("../../handlers/game/gameFunctions.js");
const functions = require("../functions.js");
const configColors = require("../../config/colors.json");
const roles = require("../../config/roles.json");

module.exports.run = async (interaction) => {
    let user = interaction.options.getString("user");
    if (interaction.member.roles.cache.has(roles.staff)) {
        const name = await gameFunctions.getName(user);
        await gameFunctions.purgeUser(user);
        const banEmbed = new Discord.EmbedBuilder()
            .setColor(configColors.success)
            .setTitle(name + " has been purged.")
            .setTimestamp();
        interaction.reply({ embeds: [banEmbed] });
    } else {
        const errorEmbed = new Discord.EmbedBuilder()
            .setColor(configColors.error)
            .setDescription("You don't have permission to use this command!")
            .setTimestamp();
        interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
};