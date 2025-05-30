require('dotenv').config();
const { SlashCommandBuilder, REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const commands = [];
// Cargar comandos dinámicamente para asegurar que se registran los mismos que usa el bot
const commandsPath = path.join(__dirname, 'commands', 'generales'); // Ajusta si tienes más subdirectorios

try {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(path.join(commandsPath, file));
        if (command.data) {
            commands.push(command.data.toJSON());
            console.log(`Comando preparado para despliegue: ${command.data.name}`);
        }
    }
} catch (error) {
    console.error('Error al leer el directorio de comandos para el despliegue:', error);
}


const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    if (commands.length === 0) {
        console.log('No hay comandos para registrar.');
        return;
    }
    console.log(`Registrando ${commands.length} comandos slash...`);

    // El ID de aplicación (cliente) de tu bot
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );
    console.log('✅ Comandos slash registrados globalmente.');
  } catch (error) {
    console.error('Error al registrar comandos slash:', error);
  }
})();