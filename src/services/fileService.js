const fs = require('fs').promises;
const path = require('path');

const baseDataPath = path.join(__dirname, '..', 'data');
const charactersDir = path.join(baseDataPath, 'characters');
const gameSystemsPath = path.join(baseDataPath, 'gameSystems.json');

// Asegurarse de que el directorio de personajes exista
async function ensureCharactersDirExists() {
    try {
        await fs.access(charactersDir);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('Directorio de personajes no encontrado, creándolo...');
            await fs.mkdir(charactersDir, { recursive: true });
        } else {
            throw error; // Relanzar otros errores
        }
    }
}

async function loadGameSystems() {
  try {
    const data = await fs.readFile(gameSystemsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error crítico cargando ${gameSystemsPath}:`, error);
    return {}; // Retorna un objeto vacío en caso de error para evitar que el bot se rompa completamente
  }
}

async function getCharacterFilePath(characterName, systemKey) {
  const normalizedName = characterName.toLowerCase().replace(/\s+/g, '_');
  return path.join(charactersDir, `${normalizedName}_${systemKey}.json`);
}

async function loadCharacter(characterName, systemKey) {
  await ensureCharactersDirExists(); // Asegurar que el directorio exista antes de leer
  const filePath = await getCharacterFilePath(characterName, systemKey);
  try {
    await fs.access(filePath);
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`Archivo de personaje no encontrado: ${filePath}`);
      return null;
    }
    console.error(`Error cargando personaje desde ${filePath}:`, error);
    return null;
  }
}

async function saveCharacter(characterData) {
  await ensureCharactersDirExists(); // Asegurar que el directorio exista antes de guardar
  if (!characterData || !characterData.name || !characterData.system) {
    console.error('Datos de personaje inválidos para guardar.');
    return false;
  }
  const filePath = await getCharacterFilePath(characterData.name, characterData.system);
  try {
    await fs.writeFile(filePath, JSON.stringify(characterData, null, 2), 'utf8');
    console.log(`Personaje guardado en: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`Error guardando personaje en ${filePath}:`, error);
    return false;
  }
}

module.exports = {
  loadGameSystems,
  loadCharacter,
  saveCharacter,
};