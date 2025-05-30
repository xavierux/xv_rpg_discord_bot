# Bot de Discord para RPG de Mesa

Un bot de Discord versátil diseñado para facilitar la gestión de partidas de rol de mesa, con soporte inicial para Dungeons & Dragons 5ª Edición y Cyberpunk RED. Permite realizar tiradas de dados, consultar atributos y habilidades de personajes, y es extensible a otros sistemas de juego.

## Características

* **Soporte Multisistema:** Configurado inicialmente para D&D 5e y Cyberpunk RED a través de un archivo `gameSystems.json`.
* **Gestión de Personajes:** Los personajes se almacenan como archivos JSON individuales, permitiendo una fácil visualización y modificación.
* **Comandos Slash:** Interfaz moderna y fácil de usar dentro de Discord.
    * `/check`: Realiza tiradas de atributo o habilidad para un personaje específico y sistema.
* **Modularidad:** Diseñado para ser fácilmente configurable y extensible.
* **Tirador de Dados Integrado:** Soporta formatos de dados como `1d20`, `2d6+3`, etc.

## Requisitos Previos

* [Node.js](https://nodejs.org/) (se recomienda la versión LTS más reciente)
* npm (generalmente se instala con Node.js)
* Una cuenta de Discord y un servidor donde tengas permisos para añadir bots.
* Una aplicación de bot creada en el [Portal de Desarrolladores de Discord](https://discord.com/developers/applications), con su Token y Client ID.

## Configuración e Instalación

Sigue estos pasos para configurar y ejecutar el bot en tu propio entorno:

1.  **Clonar el Repositorio (si está en GitHub):**
    ```bash
    git clone URL_DE_TU_REPOSITORIO_EN_GITHUB.git
    cd nombre-del-directorio-del-proyecto
    ```
    Si no lo tienes en GitHub aún, simplemente asegúrate de tener todos los archivos del proyecto en una carpeta.

2.  **Crear el archivo `.env`:**
    En la raíz del proyecto, crea un archivo llamado `.env` y añade tus credenciales. **Este archivo NUNCA debe subirse a GitHub si tu repositorio es público.**

    ```env
    # Tu token de Bot de Discord (del Discord Developer Portal)
    DISCORD_TOKEN=TU_TOKEN_DE_DISCORD_AQUI

    # El ID de Cliente (o Aplicación) de tu bot (del Discord Developer Portal)
    CLIENT_ID=TU_CLIENT_ID_AQUI
    ```
    Reemplaza `TU_TOKEN_DE_DISCORD_AQUI` y `TU_CLIENT_ID_AQUI` con tus valores reales.

3.  **Instalar Dependencias:**
    Abre una terminal en la raíz del proyecto y ejecuta:
    ```bash
    npm install
    ```

4.  **Registrar Comandos Slash:**
    Este paso solo necesitas hacerlo una vez, o cada vez que modifiques la estructura de un comando (nombre, descripción, opciones).
    ```bash
    npm run deploy
    ```
    Esto registrará los comandos definidos en `src/commands/` con Discord.

5.  **Iniciar el Bot:**
    ```bash
    npm start
    ```
    Si todo está configurado correctamente, verás un mensaje en la consola indicando que el bot está listo y conectado.

## Configuración del Juego

### `gameSystems.json`
Este archivo (`src/data/gameSystems.json`) es el corazón de la configuración de los sistemas de juego. Aquí puedes:
* Definir nuevos sistemas de juego.
* Especificar los atributos principales de cada sistema.
* Listar las habilidades y a qué atributo base están ligadas.
* Definir el dado principal para las tiradas (`primaryCheck`).
* Indicar cómo se calculan o interpretan los modificadores de atributo (`attributeModifierFormula`).
* Configurar lógicas básicas de combate (nombres de estadísticas defensivas, cómo se aplica el daño, etc.).

### Archivos de Personaje
Los personajes se almacenan como archivos `.json` individuales dentro del directorio `src/data/characters/`.
* El nombre del archivo sigue el formato: `nombrepersonaje_sistemajuego.json` (ej: `garra_dnd5e.json`).
* Cada archivo contiene los atributos, habilidades, puntos de golpe, inventario y otra información relevante del personaje, específica para su sistema de juego.
* Puedes crear nuevos personajes simplemente añadiendo un nuevo archivo JSON formateado correctamente en este directorio.

## Uso

Actualmente, el comando principal implementado es:

* **`/check`**: Realiza una tirada de atributo o habilidad.
    * **Opciones:**
        * `personaje`: Nombre del personaje (tal como aparece en el nombre de su archivo JSON, sin la extensión ni el sistema).
        * `sistema`: El sistema de juego a usar (ej: `dnd5e`, `cyberpunkRed`).
        * `tirada`: El nombre del atributo o habilidad a tirar (ej: `percepcion`, `disparar`, `fuerza`).

    * **Ejemplo:**
        ```
        /check personaje:Garra sistema:D&D 5e tirada:arcana
        /check personaje:Razor sistema:Cyberpunk RED tirada:disparar
        ```

## Estructura del Proyecto (Resumen)

/tu_proyecto_bot
├── src/
│   ├── commands/       # Lógica de los comandos slash
│   │   └── generales/  # Comandos generales como /check
│   ├── data/           # Datos del juego
│   │   ├── characters/ # Archivos JSON de los personajes
│   │   └── gameSystems.json # Configuración de los sistemas de juego
│   ├── services/       # Servicios (ej: manejo de archivos)
│   │   └── fileService.js
│   ├── utils/          # Funciones de utilidad (ej: tirar dados)
│   │   └── diceRoller.js
│   ├── bot.js          # Lógica principal del cliente Discord
│   └── deploy-commands.js # Script para registrar comandos
├── .env                # Variables de entorno (IGNORADO POR GIT)
├── .gitignore          # Archivos a ignorar por Git
├── package.json        # Metadatos del proyecto y dependencias
├── package-lock.json   # Versiones exactas de las dependencias
├── README.md           # Este archivo
└── index.js            # Punto de entrada de la aplicación

## Contribuciones (Opcional)

Si deseas permitir contribuciones, puedes añadir una sección aquí explicando cómo la gente puede contribuir a tu proyecto (ej: reportando bugs, sugiriendo características, enviando pull requests).

## Licencia (Opcional)

Puedes elegir una licencia para tu proyecto (ej: MIT, Apache 2.0, GPL). Si lo haces, añade una sección aquí y un archivo `LICENSE` en tu repositorio.
Ejemplo:
Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

---

Creado por Xavierux