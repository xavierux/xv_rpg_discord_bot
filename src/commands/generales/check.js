const { SlashCommandBuilder } = require('discord.js');

// Helper function para D&D, podría estar en utils si se usa en más sitios
function calculateDnDAttributeModifier(score) {
    return Math.floor((score - 10) / 2);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('check')
    .setDescription('Realiza una tirada de habilidad o atributo.')
    .addStringOption(option =>
      option.setName('personaje')
        .setDescription('Nombre del personaje (ej: Garra, Razor)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('sistema')
        .setDescription('Sistema de juego')
        .setRequired(true)
        .addChoices(
          { name: 'D&D 5e', value: 'dnd5e' },
          { name: 'Cyberpunk RED', value: 'cyberpunkRed' }
          // Podrías cargar estas opciones dinámicamente desde gameSystems.json si lo deseas
        ))
    .addStringOption(option =>
      option.setName('tirada')
        .setDescription('Habilidad o atributo a tirar (ej: percepcion, reflejos, disparar)')
        .setRequired(true)),
  async execute(interaction, { gameSystemsData, loadCharacter, rollDice }) {
    const characterNameInput = interaction.options.getString('personaje');
    const systemKey = interaction.options.getString('sistema');
    const checkNameRaw = interaction.options.getString('tirada');
    // Normalizar nombre: minúsculas y reemplazar espacios con guion bajo para coincidir con claves JSON
    const checkName = checkNameRaw.toLowerCase().replace(/\s+/g, '_');

    if (!gameSystemsData || !gameSystemsData[systemKey]) {
      return interaction.reply({ content: '❌ Sistema de juego no reconocido o no cargado.', ephemeral: true });
    }
    const systemInfo = gameSystemsData[systemKey];

    const pj = await loadCharacter(characterNameInput, systemKey);
    if (!pj) {
      const expectedFileName = `${characterNameInput.toLowerCase().replace(/\s+/g, '_')}_${systemKey}.json`;
      return interaction.reply({ content: `❌ Personaje "${characterNameInput}" no encontrado para el sistema ${systemInfo.name}.\nAsegúrate que el archivo \`src/data/characters/${expectedFileName}\` exista y el nombre coincida (sensible a mayúsculas/minúsculas para el nombre en el comando, pero no para el archivo).`, ephemeral: true });
    }

    let baseValue = 0;
    let bonusDescription = "";
    let isAttributeCheckDirectly = false;

    // 1. ¿Es una tirada de atributo puro? (p.ej. una "tirada de Fuerza")
    if (systemInfo.attributes.includes(checkName)) {
        isAttributeCheckDirectly = true;
        const attributeScore = pj.attributes[checkName] || 0;

        if (systemKey === 'dnd5e' && systemInfo.attributeModifierFormula === "(score - 10) / 2") {
            baseValue = calculateDnDAttributeModifier(attributeScore);
            bonusDescription = `Mod. ${checkName.toUpperCase()} (${baseValue} de ${attributeScore})`;
        } else if (systemKey === 'cyberpunkRed' && systemInfo.attributeModifierFormula === "score_is_modifier") {
            baseValue = attributeScore; // En Cyberpunk, para una "tirada de REFLEJOS pura", se usa el STAT directamente.
            bonusDescription = `STAT ${checkName.toUpperCase()} (${baseValue})`;
        } else { // Fallback genérico si la fórmula no es reconocida o para otros sistemas
            baseValue = attributeScore;
            bonusDescription = `Atributo ${checkName.toUpperCase()} (${baseValue})`;
        }
    }
    // 2. ¿Es una tirada de habilidad?
    else if (systemInfo.skills && systemInfo.skills[checkName]) {
        const skillBaseAttribute = systemInfo.skills[checkName]; // Atributo base de la habilidad
        const attributeScore = pj.attributes[skillBaseAttribute] || 0;

        if (systemKey === 'dnd5e') {
            const attributeModifier = calculateDnDAttributeModifier(attributeScore);
            baseValue = attributeModifier; // Empezamos con el modificador del atributo
            bonusDescription = `Mod. ${skillBaseAttribute.toUpperCase()} (${attributeModifier} de ${attributeScore})`;
            if (pj.skills_proficiency && pj.skills_proficiency[checkName] === true) {
                const proficiencyBonus = pj.proficiencyBonus || 0;
                baseValue += proficiencyBonus;
                bonusDescription += ` + Prof. (${proficiencyBonus})`;
            }
        } else if (systemKey === 'cyberpunkRed') {
            const skillLevel = pj.skills[checkName] || 0;
            // En Cyberpunk, la habilidad se suma al STAT base.
            baseValue = attributeScore + skillLevel;
            bonusDescription = `${skillBaseAttribute.toUpperCase()} (${attributeScore}) + ${checkName.toUpperCase()} (${skillLevel})`;
        } else {
            // Lógica para otros sistemas o un fallback simple
            const skillLevel = pj.skills[checkName] || 0; // Asumiendo que otros sistemas también tienen niveles de habilidad
            baseValue = attributeScore + skillLevel;
            bonusDescription = `Atributo ${skillBaseAttribute.toUpperCase()} (${attributeScore}) + Habilidad ${checkName.toUpperCase()} (${skillLevel})`;
        }
    } else {
      const availableAttributes = systemInfo.attributes.join(', ');
      const availableSkills = systemInfo.skills ? Object.keys(systemInfo.skills).join(', ') : 'Ninguna definida';
      return interaction.reply({ content: `❌ Habilidad o atributo "${checkNameRaw}" (normalizado: ${checkName}) no reconocido para ${systemInfo.name}.\nAtributos disponibles: ${availableAttributes}\nHabilidades disponibles: ${availableSkills}`, ephemeral: true });
    }

    try {
        const diceResult = rollDice(systemInfo.dice.primaryCheck);
        const total = diceResult.total + baseValue;

        await interaction.reply(
        `**${pj.name}** (${systemInfo.name}) realiza una tirada de **${checkNameRaw}**:\n` +
        `🎲 ${systemInfo.dice.primaryCheck} (${diceResult.rolls.join(', ')}) → ${diceResult.baseRollSum}\n` +
        `➕ Bonificador (${bonusDescription}): ${baseValue}\n` +
        ` ∑ Total = **${total}**`
        );
    } catch (error) {
        console.error("Error durante el rolldice o respuesta:", error);
        await interaction.followUp({content: `❌ Hubo un error al procesar la tirada: ${error.message}`, ephemeral: true});
    }
  },
};