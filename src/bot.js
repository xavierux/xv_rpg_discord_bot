const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const { loadGameSystems, loadCharacter } = require('./services/fileService');
const { rollDice } = require('./utils/diceRoller');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();
let gameSystemsData = {}; // Caché para los datos de los sistemas de juego

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
        // console.log('Sistemas cargados:', Object.keys(gameSystemsData).join(', '));
    } else {
        console.error('❌ No se pudieron cargar los datos de los sistemas de juego o el archivo está vacío. El bot podría no funcionar correctamente.');
    }
  } catch (error) {
    console.error('❌ Error crítico al cargar gameSystems.json:', error);
  }
  console.log(`✅ Bot listo como ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No se encontró comando que coincida con ${interaction.commandName}.`);
    await interaction.reply({ content: '❌ Comando no encontrado.', ephemeral: true });
    return;
  }

  if (Object.keys(gameSystemsData).length === 0) {
      await interaction.reply({ content: '❌ Los datos de los sistemas de juego no están cargados. Por favor, contacta al administrador del bot.', ephemeral: true });
      return;
  }

  try {
    await command.execute(interaction, { gameSystemsData, loadCharacter, rollDice });
  } catch (error) {
    console.error(`Error ejecutando el comando ${interaction.commandName}:`, error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: '❌ Hubo un error ejecutando este comando.', ephemeral: true });
    } else {
      await interaction.reply({ content: '❌ Hubo un error ejecutando este comando.', ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);