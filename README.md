# Three.js Simple Starter

Un proyecto base para comenzar con Three.js sin herramientas de construcción complejas.

## 📦 Dependencias

El proyecto utiliza las siguientes dependencias con sus versiones específicas:

| Dependencia | Versión | Comando de instalación |
|-------------|---------|------------------------|
| three | ^0.162.0 | `npm install three` |
| @types/three | ^0.180.0 | `npm install --save-dev @types/three` |
| three-stdlib | ^2.36.0 | `npm install three-stdlib` |

## 🚀 Instalación

Sigue estos pasos para configurar el proyecto en tu máquina local:

1. Clona el repositorio:

   ```bash
   git clone [URL_DEL_REPOSITORIO]
   cd [NOMBRE_DEL_PROYECTO]
   ```

2. Instala las dependencias:

   ```bash
   npm install
   ```

3. Inicia el servidor de desarrollo:

   ```bash
   npx serve
   ```

4. Abre tu navegador en `http://localhost:3000` para ver la aplicación o bien usar la extension de visual studio code Live Server.

## 📁 Estructura del Proyecto

     ```
     
     ├── src/               # Código fuente
     │   ├── assets/       # Recursos (texturas, modelos, etc.)
     │   ├── config/       # Archivos de configuración
     │   └── main.js       # Punto de entrada principal
     ├── index.html        # Página HTML principal
     └── style.css         # Estilos CSS

 ```
 
## 📝 Notas

- Asegúrate de tener Node.js instalado en tu sistema.
- Este proyecto está configurado para desarrollo local sin necesidad de herramientas de construcción como Webpack o Vite.
