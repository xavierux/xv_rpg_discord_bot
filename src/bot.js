const { Client, GatewayIntentBits, Collection, MessageFlags, Events } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { loadGameSystems, loadServerSettings: loadServerSettingsService, saveServerSettings } = require('./services/fileService');
const { rollDice } = require('./utils/diceRoller');


// --- 2. INICIALIZACIÓN DEL CLIENTE Y COLECCIONES ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();
let gameSystemsData = {}; 
let serverSettingsData = {}; // Caché para la configuración del servidor


// --- 3. CARGA DINÁMICA DE COMANDOS (DESDE SUB-CARPETAS) ---
// Esta sección ahora buscará comandos en todas las carpetas dentro de 'src/commands/'
const commandsRootPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsRootPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(commandsRootPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        // Establece un nuevo item en la Colección con la clave como nombre del comando y el valor como el módulo exportado
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log(`[CARGA] Comando cargado: /${command.data.name}`);
        } else {
            console.log(`[ADVERTENCIA] Al comando en ${filePath} le falta una propiedad "data" o "execute".`);
        }
    }
}


// --- 4. EVENTO 'CLIENT READY' (Cuando el bot se conecta) ---
client.once(Events.ClientReady, async c => {
    console.log('Iniciando carga de datos...');
    try {
        gameSystemsData = await loadGameSystems();
        console.log('📚 Datos de sistemas de juego cargados.');
        
        serverSettingsData = await loadServerSettingsService();
        console.log('⚙️ Configuración de servidores cargada.');
    } catch (error) {
        console.error('❌ Error crítico durante la carga inicial de datos:', error);
    }
    console.log(`✅ Bot listo. Conectado como ${c.user.tag}`);
});


// --- 5. MANEJADOR PRINCIPAL DE INTERACCIONES ---
client.on(Events.InteractionCreate, async interaction => {
    
    // --- MANEJO DE AUTOCOMPLETADO ---
    if (interaction.isAutocomplete()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command || !command.autocomplete) {
            console.error(`Error: No se encontró manejador de autocompletado para /${interaction.commandName}.`);
            return;
        }
        try {
            serverSettingsData = await loadServerSettingsService();
            await command.autocomplete(interaction, { gameSystemsData, serverSettingsData });
        } catch (error) {
            console.error(`Error en autocompletado para /${interaction.commandName}:`, error);
        }
        return; // Termina la ejecución aquí para interacciones de autocompletado
    }

    // --- MANEJO DE COMANDOS SLASH ---
    if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) {
            console.error(`Error: Comando /${interaction.commandName} no encontrado.`);
            return interaction.reply({ content: 'Error: Comando no encontrado.', flags: [MessageFlags.Ephemeral] });
        }
        try {
            await command.execute(interaction, { gameSystemsData, rollDice });
        } catch (error) {
            console.error(`Error ejecutando /${interaction.commandName}:`, error);
            const errorMessage = `❌ Hubo un error al ejecutar este comando.`;
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
            } else {
                await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
            }
        }
        return; // Termina la ejecución aquí para comandos slash
    }
    
    // --- MANEJO DE MENÚS DE SELECCIÓN ---
    if (interaction.isStringSelectMenu()) {

        // LÓGICA NUEVA Y CORREGIDA PARA GUARDAR ESTILO POR PERSONAJE
        if (interaction.customId.startsWith('selectDiceStyle_FOR_')) {
            console.log("Recibida selección de estilo de dado para personaje."); // LOG PARA VERIFICAR
            
            const characterName = interaction.customId.split('_FOR_')[1];
            const selectedStyle = interaction.values[0];
            const guildId = interaction.guildId;

            try {
                // Cargamos los servicios que necesitamos
                const { loadCharacter, saveCharacter, loadServerSettings } = require('./services/fileService');
                
                const serverSettings = await loadServerSettings();
                const activeSystem = serverSettings[guildId]?.activeSystem;
                if (!activeSystem) {
                    throw new Error("No hay un sistema de juego activo. Usa /setsystem primero.");
                }

                // Carga, modifica y guarda el personaje
                let characterData = await loadCharacter(characterName, activeSystem);
                if (!characterData) {
                    throw new Error(`Personaje ${characterName} no encontrado.`);
                }
                
                characterData.diceStyle = selectedStyle; // Añade o actualiza la propiedad
                await saveCharacter(characterData);

                const prettyStyleName = selectedStyle.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                await interaction.update({
                    content: `✅ Estilo de dado para **${characterName.charAt(0).toUpperCase() + characterName.slice(1)}** actualizado a: **${prettyStyleName}**`,
                    components: [], // Quitamos el menú para que no se pueda volver a usar
                });
                console.log(`Estilo guardado para ${characterName}: ${selectedStyle}`);

            } catch (error) {
                console.error('Error guardando estilo de dado para personaje:', error);
                await interaction.update({
                    content: `❌ Hubo un error: ${error.message}`,
                    components: [],
                });
            }
        }
        // Puedes añadir aquí otros 'else if' para otros menús en el futuro
    }
});


// --- 6. LOGIN DEL BOT ---
client.login(process.env.DISCORD_TOKEN);