const { SlashCommandBuilder } = require('discord.js');
const { loadServerSettings, saveServerSettings, loadGameSystems } = require('../../services/fileService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setsystem')
        .setDescription('Establece el sistema de juego activo para este servidor.')
        .addStringOption(option =>
            option.setName('sistema')
                .setDescription('El sistema de juego a activar.')
                .setRequired(true)
            // Las .addChoices() son ahora manejadas por deploy-commands.js
        ),
    async execute(interaction) {
        const guildId = interaction.guildId;
        if (!guildId) {
            return interaction.reply({ content: 'Este comando solo puede usarse en un servidor.', ephemeral: true });
        }

        const selectedSystemKey = interaction.options.getString('sistema');
        
        const gameSystems = await loadGameSystems(); // Cargar para obtener el nombre y validar
        if (!gameSystems[selectedSystemKey]) {
            return interaction.reply({ content: `El sistema "${selectedSystemKey}" no es válido.`, ephemeral: true });
        }

        const serverSettings = await loadServerSettings();
        
        if (!serverSettings[guildId]) {
            serverSettings[guildId] = {};
        }
        serverSettings[guildId].activeSystem = selectedSystemKey;

        const success = await saveServerSettings(serverSettings);

        if (success) {
            await interaction.reply(`Sistema de juego para este servidor establecido a: **${gameSystems[selectedSystemKey].name}**.`);
        } else {
            await interaction.reply({ content: 'Hubo un error guardando la configuración del sistema.', ephemeral: true });
        }
    },
};