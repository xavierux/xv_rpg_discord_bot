const { SlashCommandBuilder, MessageFlags } = require('discord.js'); // Asegúrate de tener MessageFlags aquí
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
            // Extraer el nombre del personaje del nombre del archivo
            // Ej: "elara_dnd5e.json" -> "elara"
            const name = file.substring(0, file.lastIndexOf(`_${activeSystem}.json`));
            // Capitalizar nombre para una mejor visualización (opcional)
            const displayName = name.charAt(0).toUpperCase() + name.slice(1);
            return { name: displayName, value: name }; // 'name' es lo que ve el usuario, 'value' es lo que se envía
        });

        if (focusedValue) {
            choices = choices.filter(choice => choice.name.toLowerCase().includes(focusedValue));
        }
        // Discord permite un máximo de 25 opciones en la respuesta de autocompletado
        await interaction.respond(choices.slice(0, 25)); 
    } catch (error) {
        console.error('Error listando personajes para autocompletar:', error);
        await interaction.respond([]); // Enviar array vacío en caso de error
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

    let choices = [];
    // Añadir atributos
    if (systemInfo.attributes && Array.isArray(systemInfo.attributes)) {
        choices = choices.concat(
            systemInfo.attributes.map(attr => ({ 
                name: `Atributo: ${attr.charAt(0).toUpperCase() + attr.slice(1)}`, 
                value: attr // El valor enviado será la clave del atributo/habilidad normalizada
            }))
        );
    }
    // Añadir habilidades
    if (systemInfo.skills && typeof systemInfo.skills === 'object') {
        choices = choices.concat(
            Object.keys(systemInfo.skills).map(skillKey => ({ 
                name: `Habilidad: ${skillKey.charAt(0).toUpperCase() + skillKey.slice(1).replace(/_/g, ' ')}`, // Mostrar nombre legible
                value: skillKey // Enviar la clave de la habilidad
            }))
        );
    }
    
    if (focusedValue) {
        choices = choices.filter(choice => 
            choice.name.toLowerCase().includes(focusedValue) || 
            choice.value.toLowerCase().includes(focusedValue)
        );
    }

    await interaction.respond(choices.slice(0, 25));
}

// --- 3. EXPORTACIÓN DEL MÓDULO DEL COMANDO ---
module.exports = {
  // MODIFICADO: Definición del comando con .setAutocomplete(true)
  data: new SlashCommandBuilder()
    .setName('check')
    .setDescription('Realiza una tirada de habilidad o atributo para el sistema activo.')
    .addStringOption(option =>
      option.setName('personaje')
        .setDescription('Personaje para la tirada (empieza a escribir para ver opciones)')
        .setRequired(true)
        .setAutocomplete(true)) // Autocompletado habilitado
    .addStringOption(option =>
      option.setName('tirada')
        .setDescription('Habilidad o atributo a tirar (empieza a escribir para ver opciones)')
        .setRequired(true)
        .setAutocomplete(true)), // Autocompletado habilitado
  
  //Función para manejar las interacciones de autocompletado para este comando
  async autocomplete(interaction, { gameSystemsData, serverSettingsData }) {
    const focusedOption = interaction.options.getFocused(true); // Obtiene la opción que tiene el foco

    if (focusedOption.name === 'personaje') {
        await handleCharacterAutocomplete(interaction, gameSystemsData, serverSettingsData);
    } else if (focusedOption.name === 'tirada') {
        await handleTiradaAutocomplete(interaction, gameSystemsData, serverSettingsData);
    }
  },

  //Lógica principal del comando
  async execute(interaction, { gameSystemsData, rollDice }) {
    const guildId = interaction.guildId;
    if (!guildId) {
        return interaction.reply({ content: 'Este comando solo puede usarse en un servidor.', flags: [MessageFlags.Ephemeral]});
    }

    // serverSettingsData y gameSystemsData ahora vienen del manejador de interacción en bot.js
    // pero para execute, necesitamos cargar la configuración del servidor actual y el personaje
    // 'serverSettingsData' pasado a 'autocomplete' es el que está cacheado en bot.js
    // Para 'execute', es más seguro recargar la configuración del servidor si ha podido cambiar por /setsystem.
    const currentServerSettings = await loadServerSettings(); 
    const systemKey = currentServerSettings[guildId]?.activeSystem;

    if (!systemKey) {
        return interaction.reply({ content: 'No hay un sistema de juego activo para este servidor. Usa `/setsystem` para establecer uno.', flags: [MessageFlags.Ephemeral] });
    }
    
    if (!gameSystemsData || !gameSystemsData[systemKey]) {
      // gameSystemsData viene como parámetro y debería estar actualizado desde bot.js
      return interaction.reply({ content: `❌ Sistema de juego "${systemKey}" no reconocido o no cargado.`, flags: [MessageFlags.Ephemeral] });
    }
    const systemInfo = gameSystemsData[systemKey];

    const characterNameInput = interaction.options.getString('personaje'); // Este es el 'value' de la opción seleccionada
    const checkNameRaw = interaction.options.getString('tirada'); // Este es el 'value' de la opción seleccionada
    
    // Normalizamos el 'value' de la tirada (que es la clave de la habilidad/atributo)
    const checkName = checkNameRaw.toLowerCase().replace(/\s+/g, '_'); 

    const pj = await loadCharacterService(characterNameInput, systemKey); // Usamos el servicio importado
    if (!pj) {
      return interaction.reply({ content: `❌ Personaje "${characterNameInput}" no encontrado para el sistema ${systemInfo.name}.\nEl autocompletado debería mostrar solo personajes válidos. Si ves esto, revisa los nombres de archivo.`, flags: [MessageFlags.Ephemeral] });
    }

    let baseValue = 0;
    let bonusDescription = "";

    // Lógica de cálculo de la tirada (sin cambios significativos aquí, solo asegurar que usa las variables correctas)
    if (systemInfo.attributes.includes(checkName)) {
        const attributeScore = pj.attributes[checkName] || 0;
        if (systemKey === 'dnd5e' && systemInfo.attributeModifierFormula === "(score - 10) / 2") {
            baseValue = calculateDnDAttributeModifier(attributeScore);
            bonusDescription = `Mod. ${checkName.toUpperCase()} (${baseValue} de ${attributeScore})`;
        } else if (systemKey === 'cyberpunkRed' && systemInfo.attributeModifierFormula === "score_is_modifier") {
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
            bonusDescription = `Mod. ${skillBaseAttribute.toUpperCase()} (${attributeModifier} de ${attributeScore})`;
            if (pj.skills_proficiency && pj.skills_proficiency[checkName] === true) {
                const proficiencyBonus = pj.proficiencyBonus || 0;
                baseValue += proficiencyBonus;
                bonusDescription += ` + Prof. (${proficiencyBonus})`;
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
      return interaction.reply({ content: `❌ Habilidad o atributo "${checkNameRaw}" (normalizado: ${checkName}) no reconocido para ${systemInfo.name}.\nAtributos disponibles: ${availableAttributes}\nHabilidades disponibles: ${availableSkills}`, flags: [MessageFlags.Ephemeral] });
    }

    try {
        const diceResult = rollDice(systemInfo.dice.primaryCheck); // rollDice viene como parámetro desde bot.js
        const total = diceResult.total + baseValue; 

        await interaction.reply(
        `**${pj.name}** (${systemInfo.name}) realiza una tirada de **${checkNameRaw}**:\n` + // Usamos checkNameRaw para mostrar el nombre legible
        `🎲 ${systemInfo.dice.primaryCheck} (${diceResult.rolls.join(', ')}) → ${diceResult.baseRollSum}\n` +
        `➕ Bonificador (${bonusDescription}): ${baseValue}\n` +
        ` ∑ Total = **${total}**`
        );
    } catch (error) {
        console.error("Error durante el rolldice o respuesta:", error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({content: `❌ Hubo un error al procesar la tirada: ${error.message}`, flags: [MessageFlags.Ephemeral]});
        } else {
            await interaction.reply({content: `❌ Hubo un error al procesar la tirada: ${error.message}`, flags: [MessageFlags.Ephemeral]});
        }
    }
  },
};