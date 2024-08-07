import { Interaction } from "discord.js";

export default {
    name: "ping",
    description: "Ping!",
    execute: async (interaction: Interaction) => {
        if (interaction.isCommand()) {
            await interaction.reply("Pong!");
        } else {
            return;
        }
    },
};
