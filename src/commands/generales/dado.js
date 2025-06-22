const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const path = require('node:path');
const fs = require('node:fs').promises;
const { loadServerSettings } = require('../../services/fileService');
const { rollDice } = require('../../utils/diceRoller');
const sharp = require('sharp'); // Requerimos la librería que acabamos de instalar

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dado')
        .setDescription('Realiza una tirada de dados libre con el formato estándar (ej: 2d6+3).')
        .addStringOption(option =>
            option.setName('expresion')
                .setDescription('La tirada que quieres realizar (ej: d20, 3d8, 1d100+10, 2d12-4)')
                .setRequired(true)),

    async execute(interaction) {
        // --- 1. ANÁLISIS DE LA EXPRESIÓN (Sin cambios) ---
        const expression = interaction.options.getString('expresion').toLowerCase().trim();
        const diceNotationRegex = /^(\d+)?d(4|6|8|10|12|20|100)([+-]\d+)?$/i;
        const match = expression.match(diceNotationRegex);

        if (!match) {
            return interaction.reply({ content: '❌ Expresión de dado no válida.', flags: [MessageFlags.Ephemeral] });
        }
        const numDice = match[1] ? parseInt(match[1], 10) : 1;
        const dieType = parseInt(match[2], 10);
        const modifier = match[3] ? parseInt(match[3], 10) : 0;
        if (numDice > 10) { // Reducimos el límite para no crear imágenes excesivamente largas
            return interaction.reply({ content: '❌ No puedes tirar más de 10 dados a la vez con este comando.', flags: [MessageFlags.Ephemeral] });
        }

        // --- 2. TIRADA DE DADOS Y CÁLCULOS (Sin cambios) ---
        const guildId = interaction.guildId;
        const currentServerSettings = await loadServerSettings();
        const activeDiceStyle = currentServerSettings[guildId]?.diceStyle || 'polyhedral_3d_blue_and_white';
        const diceString = `${numDice}d${dieType}`;
        const diceResult = rollDice(diceString);
        const finalTotal = diceResult.total + modifier;
        
        // --- 3. LÓGICA PARA CREAR IMAGEN COMPUESTA ---
        const dieSize = 64; // Tamaño de cada dado en la tira final (ej. 64x64)
        let imageBuffers = []; // Un array para guardar las imágenes de cada dado

        try {
            // Primero, cargamos y redimensionamos cada imagen de dado necesaria
            for (const rollValue of diceResult.rolls) {
                const imageFileName = `d${dieType}s${rollValue}.png`;
                const imagePath = path.join(__dirname, '..', '..', '..', 'assets', 'dice_images', activeDiceStyle, `d${dieType}`, imageFileName);
                
                const imageBuffer = await fs.readFile(imagePath);
                const resizedBuffer = await sharp(imageBuffer)
                    .resize(dieSize, dieSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .toBuffer();
                
                imageBuffers.push(resizedBuffer);
            }

            // Preparamos las opciones para 'pegar' las imágenes una al lado de la otra
            const compositeOptions = imageBuffers.map((buffer, i) => ({
                input: buffer,
                left: i * dieSize, // Posición horizontal: 0, 64, 128, etc.
                top: 0
            }));
            
            // Creamos la imagen final compuesta
            const compositeImageBuffer = await sharp({
                create: {
                    width: numDice * dieSize, // El ancho total es la cantidad de dados por su tamaño
                    height: dieSize,          // La altura es el tamaño de un dado
                    channels: 4,
                    background: { r: 0, g: 0, b: 0, alpha: 0 } // Fondo transparente
                }
            })
            .composite(compositeOptions)
            .png() // Exportamos como PNG para mantener la transparencia
            .toBuffer();

            // --- 4. PREPARACIÓN Y ENVÍO DE LA RESPUESTA ---
            const content = `**${interaction.user.username}** realiza un lanzamiento de **${expression.toUpperCase()}**:\n` +
                          `🎲 Resultados: **${diceResult.rolls.join(', ')}** (Suma: **${diceResult.total}**)\n` +
                          `🔧 Modificador: **${modifier >= 0 ? '+' : ''}${modifier}**\n` +
                          ` ∑ Total = **${finalTotal}**`;

            await interaction.reply({
                content: content,
                // Adjuntamos la ÚNICA imagen compuesta que hemos creado
                files: [{ attachment: compositeImageBuffer, name: 'dice-roll.png' }],
            });

        } catch (error) {
            console.error("Error creando la imagen compuesta o enviando la respuesta:", error);
            // Si hay un error (ej. falta una imagen), envía una respuesta sin imagen.
            const fallbackContent = `**${interaction.user.username}** realiza un lanzamiento de **${expression.toUpperCase()}**:\n` +
                                  `🎲 Resultados: **${diceResult.rolls.join(', ')}** (Suma: **${diceResult.total}**)\n` +
                                  `🔧 Modificador: **${modifier >= 0 ? '+' : ''}${modifier}**\n` +
                                  ` ∑ Total = **${finalTotal}**\n\n` +
                                  `*(No se pudieron generar las imágenes de los dados)*`;
            await interaction.reply({ content: fallbackContent, flags: [MessageFlags.Ephemeral] });
        }
    },
};