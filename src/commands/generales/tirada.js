const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const fs = require('node:fs').promises; // Usamos promesas para fs
const path = require('node:path');
// Importamos los servicios necesarios directamente en este archivo
const { loadServerSettings, loadCharacter: loadCharacterService } = require('../../services/fileService');

// --- 2. FUNCIONES HELPER (para D&D y Autocompletado) ---

// Helper para calcular el modificador de atributo de D&D
function calculateDnDAttributeModifier(score) {
    return Math.floor((score - 10) / 2);
}

// Función para manejar el autocompletado de personajes
async function handleCharacterAutocomplete(interaction, gameSystemsData, serverSettingsData) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const guildId = interaction.guildId;

    if (!guildId || !serverSettingsData[guildId] || !serverSettingsData[guildId].activeSystem) {
        return interaction.respond([{ name: "Primero establece un sistema con /setsystem", value: "error_no_system" }]);
    }

    const activeSystem = serverSettingsData[guildId].activeSystem;
    const charactersPath = path.join(__dirname, '..', '..', 'data', 'characters');

    try {
        const files = await fs.readdir(charactersPath);
        const characterFiles = files.filter(file => file.endsWith(`_${activeSystem}.json`));
        
        let choices = characterFiles.map(file => {
            const name = file.substring(0, file.lastIndexOf(`_${activeSystem}.json`));
            const displayName = name.charAt(0).toUpperCase() + name.slice(1);
            return { name: displayName, value: name };
        });

        if (focusedValue) {
            choices = choices.filter(choice => choice.name.toLowerCase().includes(focusedValue));
        }
        await interaction.respond(choices.slice(0, 25)); 
    } catch (error) {
        console.error('Error listando personajes para autocompletar:', error);
        await interaction.respond([]);
    }
}

// Función para manejar el autocompletado de tiradas (atributos/habilidades)
async function handleTiradaAutocomplete(interaction, gameSystemsData, serverSettingsData) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const guildId = interaction.guildId;

    if (!guildId || !serverSettingsData[guildId] || !serverSettingsData[guildId].activeSystem) {
        return interaction.respond([{ name: "Primero establece un sistema con /setsystem", value: "error_no_system" }]);
    }

    const activeSystemKey = serverSettingsData[guildId].activeSystem;
    const systemInfo = gameSystemsData[activeSystemKey];

    if (!systemInfo) {
        return interaction.respond([{ name: "Datos del sistema no encontrados", value: "error_system_data_missing" }]);
    }

    let allChoices = [];
    if (systemInfo.attributes && Array.isArray(systemInfo.attributes)) {
        allChoices = allChoices.concat(
            systemInfo.attributes.map(attr => ({ 
                name: `Atributo: ${attr.charAt(0).toUpperCase() + attr.slice(1)}`, 
                value: attr
            }))
        );
    }
    if (systemInfo.skills && typeof systemInfo.skills === 'object') {
        allChoices = allChoices.concat(
            Object.keys(systemInfo.skills).map(skillKey => ({ 
                name: `Habilidad: ${skillKey.charAt(0).toUpperCase() + skillKey.slice(1).replace(/_/g, ' ')}`,
                value: skillKey
            }))
        );
    }
        console.log('systemInfo.skills: ' + JSON.stringify(systemInfo.skills, null, 2));

    // Ordenar alfabéticamente todas las opciones
    allChoices.sort((a, b) => a.name.localeCompare(b.name));
    console.log('allChoices: ' + JSON.stringify(allChoices, null, 2));


    let filteredChoices = [];
    if (focusedValue) {
        // Si hay un valor enfocado (el usuario ha escrito algo), filtra
        filteredChoices = allChoices.filter(choice => 
            choice.name.toLowerCase().includes(focusedValue) || 
            choice.value.toLowerCase().includes(focusedValue)
        );
    } else {
        // Si no hay valor enfocado, toma las primeras 25 opciones ordenadas alfabéticamente
        filteredChoices = allChoices.slice(0, 25);
    }

    await interaction.respond(filteredChoices.slice(0, 25)); // Asegurarse de enviar solo 25
}

// --- 3. EXPORTACIÓN DEL MÓDULO DEL COMANDO ---
module.exports = {
    data: new SlashCommandBuilder()
        .setName('tirada')
        .setDescription('Realiza una tirada de habilidad o atributo para el sistema activo.')
        .addStringOption(option =>
            option.setName('personaje')
                .setDescription('Personaje para la tirada (empieza a escribir para ver opciones)')
                .setRequired(true)
                .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('tirada')
                .setDescription('Habilidad o atributo a tirar (empieza a escribir para ver opciones)')
                .setRequired(true)
                .setAutocomplete(true)),
    
    async autocomplete(interaction, { gameSystemsData, serverSettingsData }) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'personaje') {
            await handleCharacterAutocomplete(interaction, gameSystemsData, serverSettingsData);
        } else if (focusedOption.name === 'tirada') {
            await handleTiradaAutocomplete(interaction, gameSystemsData, serverSettingsData);
        }
    },

    async execute(interaction, { gameSystemsData, rollDice }) {
        const guildId = interaction.guildId;
        if (!guildId) {
            return interaction.reply({ content: 'Este comando solo puede usarse en un servidor.', flags: [MessageFlags.Ephemeral]});
        }

        const currentServerSettings = await loadServerSettings(); 
        const systemKey = currentServerSettings[guildId]?.activeSystem;

        if (!systemKey) {
            return interaction.reply({ content: 'No hay un sistema de juego activo para este servidor. Usa `/setsystem` para establecer uno.', flags: [MessageFlags.Ephemeral] });
        }
        
        if (!gameSystemsData || !gameSystemsData[systemKey]) {
            return interaction.reply({ content: `❌ Sistema de juego "${systemKey}" no reconocido o no cargado.`, flags: [MessageFlags.Ephemeral] });
        }
        const systemInfo = gameSystemsData[systemKey];

        const characterNameInput = interaction.options.getString('personaje');
        const checkNameRaw = interaction.options.getString('tirada');
        
        const checkName = checkNameRaw.toLowerCase().replace(/\s+/g, '_'); 

        const pj = await loadCharacterService(characterNameInput, systemKey);
        if (!pj) {
            return interaction.reply({ content: `❌ Personaje "${characterNameInput}" no encontrado para el sistema ${systemInfo.name}.`, flags: [MessageFlags.Ephemeral] });
        }

        // --- MODIFICACIÓN CLAVE: Lógica para decidir el estilo de dado ---
        // 1. Prioridad: El estilo definido en el archivo del personaje.
        // 2. Respaldo: El estilo guardado para el servidor.
        // 3. Último Recurso: Un estilo por defecto si ninguno de los anteriores existe.
        const characterDiceStyle = pj.diceStyle;
        const serverDiceStyle = currentServerSettings[guildId]?.diceStyle;
        const finalDiceStyle = characterDiceStyle || serverDiceStyle || 'polyhedral_3d_blue_and_white'; // Estilo por defecto

        let baseValue = 0;
        let bonusDescription = "";

        if (systemInfo.attributes.includes(checkName)) {
            const attributeScore = pj.attributes[checkName] || 0;
            if (systemKey === 'dnd5e') {
                baseValue = calculateDnDAttributeModifier(attributeScore);
                bonusDescription = `(${checkName.toUpperCase()} ${attributeScore} Mod. +${baseValue})`;
            } else if (systemKey === 'cyberpunkRed') {
                baseValue = attributeScore;
                bonusDescription = `STAT ${checkName.toUpperCase()} (${baseValue})`;
            } else {
                baseValue = attributeScore;
                bonusDescription = `Atributo ${checkName.toUpperCase()} (${baseValue})`;
            }
        } else if (systemInfo.skills && systemInfo.skills[checkName]) {
            const skillBaseAttribute = systemInfo.skills[checkName];
            const attributeScore = pj.attributes[skillBaseAttribute] || 0;
            if (systemKey === 'dnd5e') {
                const attributeModifier = calculateDnDAttributeModifier(attributeScore);
                baseValue = attributeModifier;
                bonusDescription = `(${checkName.toUpperCase()} ${attributeScore} Mod. +${baseValue})`;
                if (pj.skills_proficiency && pj.skills_proficiency[checkName] === true) {
                    const proficiencyBonus = pj.proficiencyBonus || 0;
                    baseValue += proficiencyBonus;
                    bonusDescription += ` + (Prof. +${proficiencyBonus})`;
                }
            } else if (systemKey === 'cyberpunkRed') {
                const skillLevel = pj.skills[checkName] || 0;
                baseValue = attributeScore + skillLevel;
                bonusDescription = `${skillBaseAttribute.toUpperCase()} (${attributeScore}) + ${checkName.toUpperCase()} (${skillLevel})`;
            } else {
                const skillLevel = pj.skills[checkName] || 0;
                baseValue = attributeScore + skillLevel;
                bonusDescription = `Atributo ${skillBaseAttribute.toUpperCase()} (${attributeScore}) + Habilidad ${checkName.toUpperCase()} (${skillLevel})`;
            }
        } else {
          const availableAttributes = systemInfo.attributes.join(', ');
          const availableSkills = systemInfo.skills ? Object.keys(systemInfo.skills).join(', ') : 'Ninguna definida';
          return interaction.reply({ content: `❌ Habilidad o atributo "${checkNameRaw}" no reconocido.`, flags: [MessageFlags.Ephemeral] });
        }

        try {
            const diceType = systemInfo.dice.primaryCheck;
            const diceResult = rollDice(diceType);
            const total = diceResult.total + baseValue; 

            const diceTypeMatch = diceType.match(/(\d+)d(\d+)/);
            let formattedDiceTypeForPath = '';
            if (diceTypeMatch && diceTypeMatch[2]) {
                formattedDiceTypeForPath = `d${diceTypeMatch[2]}`;
            } else {
                console.warn(`Formato de diceType inesperado: ${diceType}. Usando 'd20' como fallback.`);
                formattedDiceTypeForPath = 'd20';
            }

            let filesToAttach = [];
            let rollImagesDescription = '';

            if (diceResult.rolls && diceResult.rolls.length > 0) {
                for (let i = 0; i < diceResult.rolls.length; i++) {
                    const rollValue = diceResult.rolls[i];
                    const imageFileName = `${formattedDiceTypeForPath}s${rollValue}.png`;
                    // Usamos la variable 'finalDiceStyle' para construir la ruta
                    const imagePath = path.join(
                        __dirname, '..', '..', '..',
                        'assets', 'dice_images', finalDiceStyle, formattedDiceTypeForPath, imageFileName
                    );

                    try {
                        await fs.access(imagePath);
                        filesToAttach.push({
                            attachment: imagePath,
                            name: `roll_${formattedDiceTypeForPath}_${rollValue}_${i}.png`
                        });
                        rollImagesDescription += `[${formattedDiceTypeForPath.toUpperCase()} ${rollValue}](attachment://roll_${formattedDiceTypeForPath}_${rollValue}_${i}.png) `;
                    } catch (fileError) {
                        console.warn(`Imagen no encontrada: ${imagePath}`);
                        rollImagesDescription += `**${formattedDiceTypeForPath.toUpperCase()} ${rollValue}** `;
                    }
                }
            }

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setAuthor({ name: `${pj.name} (${systemInfo.name})` })
                .setTitle(`Tirada de ${checkNameRaw}`)
                .setDescription(
                    `🎲 **Dados:** ${diceResult.baseRollSum} **Bonificador (${bonusDescription}):** +${baseValue}\n` +
                    `## ∑ Total: ${total}`
                );

            if (filesToAttach.length > 0) {
                const thumbnailImageName = filesToAttach[0].name;
                embed.setThumbnail(`attachment://${thumbnailImageName}`);
            }

            await interaction.reply({
                embeds: [embed],
                files: filesToAttach,
            });

        } catch (error) {
            console.error("Error durante la creación del embed o la respuesta:", error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: `❌ Hubo un error al procesar la tirada: ${error.message}`, flags: [MessageFlags.Ephemeral] });
            } else {
                await interaction.reply({ content: `❌ Hubo un error al procesar la tirada: ${error.message}`, flags: [MessageFlags.Ephemeral] });
            }
        }
    },
};