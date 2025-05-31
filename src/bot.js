const { Client, GatewayIntentBits, Collection, MessageFlags } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const { loadGameSystems, loadServerSettings: loadServerSettingsService } = require('./services/fileService');
const { rollDice } = require('./utils/diceRoller');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();
let gameSystemsData = {}; 
let serverSettingsData = {}; // Caché para la configuración del servidor

// Cargar comandos
const commandsPath = path.join(__dirname, 'commands', 'generales');
try {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log(`Comando cargado: ${command.data.name}`);
        } else {
            console.log(`[ADVERTENCIA] Al comando ${filePath} le falta una propiedad "data" o "execute".`);
        }
    }
} catch (error) {
    console.error('Error al leer el directorio de comandos:', error);
}

client.once('ready', async () => {
  console.log('Iniciando carga de datos de sistemas de juego...');
  try {
    gameSystemsData = await loadGameSystems();
    if (Object.keys(gameSystemsData).length > 0) {
        console.log('📚 Datos de sistemas de juego cargados exitosamente.');
    } else {
        console.error('❌ No se pudieron cargar los datos de los sistemas de juego o el archivo está vacío.');
    }
    serverSettingsData = await loadServerSettingsService(); // Cargar config del servidor al inicio
    console.log('⚙️ Configuración de servidor cargada.');

  } catch (error) {
    console.error('❌ Error crítico durante la carga inicial de datos:', error);
  }
  console.log(`✅ Bot listo como ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No se encontró comando que coincida con ${interaction.commandName}.`);
        await interaction.reply({ content: '❌ Comando no encontrado.', flags: [MessageFlags.Ephemeral] });
        return;
    }

    if (Object.keys(gameSystemsData).length === 0) {
        await interaction.reply({ content: '❌ Los datos de los sistemas de juego no están cargados.', flags: [MessageFlags.Ephemeral] });
        return;
    }
    // Actualizar serverSettingsData si es necesario, o pasar la función para recargarla
    // Por simplicidad, asumimos que la instancia cargada en 'ready' es suficientemente actual para la mayoría de los casos,
    // o los comandos que la modifican (como setsystem) la actualizan también.
    // Para el autocompletado, es mejor recargarla o tener una forma de acceder a la más reciente.
    // Recargamos aquí para el contexto del autocompletado
    serverSettingsData = await loadServerSettingsService();


    try {
        await command.execute(interaction, { gameSystemsData, rollDice /* otras dependencias si son necesarias */ });
    } catch (error) {
        console.error(`Error ejecutando el comando ${interaction.commandName}:`, error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: '❌ Hubo un error ejecutando este comando.', flags: [MessageFlags.Ephemeral] });
        } else {
            await interaction.reply({ content: '❌ Hubo un error ejecutando este comando.', flags: [MessageFlags.Ephemeral] });
        }
    }
  } else if (interaction.isAutocomplete()) {
    // Manejador de Autocompletado
    const command = client.commands.get(interaction.commandName);
    if (!command || !command.autocomplete) { // Asumiremos que los comandos con autocomplete tienen una función `autocomplete`
        console.error(`No se encontró manejador de autocompletado para ${interaction.commandName}`);
        return;
    }

    // Actualizar/recargar serverSettingsData para el autocompletado
    serverSettingsData = await loadServerSettingsService();

    try {
        await command.autocomplete(interaction, { gameSystemsData, serverSettingsData });
    } catch (error) {
        console.error(`Error en autocompletado para ${interaction.commandName}:`, error);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);