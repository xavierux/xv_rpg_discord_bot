const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } = require('discord.js');
const fs = require('node:fs').promises;
const path = require('node:path');
const { loadServerSettings, loadCharacter, saveCharacter } = require('../../services/fileService');

// Función de autocompletado para personajes (reutilizable)
async function handleCharacterAutocomplete(interaction, serverSettings) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const guildId = interaction.guildId;

    if (!guildId || !serverSettings[guildId] || !serverSettings[guildId].activeSystem) {
        return interaction.respond([{ name: "Primero establece un sistema con /setsystem", value: "error_no_system" }]);
    }

    const activeSystem = serverSettings[guildId].activeSystem;
    const charactersPath = path.join(__dirname, '..', '..', 'data', 'characters');

    try {
        const files = await fs.readdir(charactersPath);
        const characterFiles = files.filter(file => file.endsWith(`_${activeSystem}.json`));
        
        let choices = characterFiles.map(file => {
            const charName = file.replace(`_${activeSystem}.json`, '');
            return { name: charName.charAt(0).toUpperCase() + charName.slice(1), value: charName };
        });

        if (focusedValue) {
            choices = choices.filter(choice => choice.name.toLowerCase().startsWith(focusedValue));
        }

        await interaction.respond(choices.slice(0, 25));
    } catch (error) {
        console.error('Error en autocompletado de personajes para estilodado:', error);
        await interaction.respond([]);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('estilodado')
        .setDescription('Selecciona el estilo de dados para un personaje específico.')
        // NUEVA OPCIÓN PARA SELECCIONAR EL PERSONAJE
        .addStringOption(option =>
            option.setName('personaje')
                .setDescription('El personaje al que quieres cambiarle el estilo de dados.')
                .setRequired(true)
                .setAutocomplete(true)),
    
    async autocomplete(interaction) {
        const serverSettingsData = await loadServerSettings();
        await handleCharacterAutocomplete(interaction, serverSettingsData);
    },
    
    async execute(interaction) {
        const characterName = interaction.options.getString('personaje');
        const characterNameCapitalized = characterName.charAt(0).toUpperCase() + characterName.slice(1);

        let diceStyles = [];
        const stylesPath = path.join(__dirname, '..', '..', 'data', 'diceStyles.json');
        
        try {
            const data = await fs.readFile(stylesPath, 'utf8');
            diceStyles = JSON.parse(data);
        } catch (error) {
            console.error('Error cargando diceStyles.json:', error);
            return interaction.reply({ content: '❌ No se pudieron cargar los estilos de dado.', flags: [MessageFlags.Ephemeral] });
        }

        const selectOptions = diceStyles.slice(0, 25).map(style =>
            new StringSelectMenuOptionBuilder()
                .setLabel(style.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())) // Capitaliza cada palabra
                .setValue(style)
        );

        const selectMenu = new StringSelectMenuBuilder()
            // CAMBIO IMPORTANTE: ID único que incluye el nombre del personaje
            .setCustomId(`selectDiceStyle_FOR_${characterName}`)
            .setPlaceholder('Elige un estilo de dado...')
            .addOptions(selectOptions);

        const actionRow = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
            content: `Por favor, selecciona el estilo de dado para **${characterNameCapitalized}**:`,
            components: [actionRow],
            flags: [MessageFlags.Ephemeral]
        });
    },
};