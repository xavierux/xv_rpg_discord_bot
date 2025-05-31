require('dotenv').config();
const { SlashCommandBuilder, REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Cargar gameSystems.json para generar opciones dinámicas
let gameSystemsData = {};
const gameSystemsPath = path.join(__dirname, 'data', 'gameSystems.json'); // Ajusta la ruta a tu gameSystems.json
try {
    const rawData = fs.readFileSync(gameSystemsPath, 'utf8');
    gameSystemsData = JSON.parse(rawData);
} catch (error) {
    console.error('Error al cargar gameSystems.json para el despliegue de comandos:', error);
    // Podrías decidir terminar el proceso o continuar sin opciones dinámicas para setsystem
}

const commands = [];
const commandFolders = fs.readdirSync(path.join(__dirname, 'commands'));

for (const folder of commandFolders) {
    const commandFiles = fs.readdirSync(path.join(__dirname, 'commands', folder)).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const commandModule = require(path.join(__dirname, 'commands', folder, file));
        if (commandModule.data) {
            let commandData = commandModule.data;

            // Personalización para el comando /setsystem
            if (commandData.name === 'setsystem') {
                const systemOption = commandData.options.find(opt => opt.name === 'sistema');
                if (systemOption && Object.keys(gameSystemsData).length > 0) {
                    const choices = Object.keys(gameSystemsData).map(key => ({
                        name: gameSystemsData[key].name || key, // Usar el nombre del sistema o la clave como fallback
                        value: key
                    }));
                    systemOption.choices = choices; // Asignar las choices dinámicas
                }
            }
            
            commands.push(commandData.toJSON());
            console.log(`Comando preparado para despliegue: ${commandData.name}`);
        } else {
            console.log(`[ADVERTENCIA] Al comando ${path.join(__dirname, 'commands', folder, file)} le falta una propiedad "data".`);
        }
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    if (commands.length === 0) {
        console.log('No hay comandos para registrar.');
        return;
    }
    console.log(`Registrando ${commands.length} comandos slash...`);

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );
    console.log('✅ Comandos slash registrados globalmente.');
  } catch (error) {
    console.error('Error al registrar comandos slash:', error);
  }
})();