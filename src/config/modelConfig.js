// Configuración de modelos 3D
export const modelConfig = {
  // Ruta base de los modelos
  basePath: "/src/models/",

  // Configuración de personajes
  characters: {
    farmer: {
      // Modelo principal
      model: "characters/farmer/Granjero.fbx",
      scale: 1.0, // La escala se manejará automáticamente en el ModelLoader
      // Animaciones
      animations: {
        // Animación de reposo
        idle: "characters/farmer/Neutral_Idle.fbx",
        // Animación de caminar/correr hacia adelante (usando RunningFront.fbx)
        walk: "characters/farmer/RunningFront.fbx",
        // Animación de caminar hacia atrás
        walkBackward: "characters/farmer/Running_backwar.fbx",
        // Animación de caminar hacia la izquierda
        strafeLeft: "characters/farmer/Left_Strafe.fbx",
        // Animación de caminar hacia la derecha
        strafeRight: "characters/farmer/Right_Strafe.fbx",
      },

      // Ajustes específicos
      settings: {
        height: 1.8, // Altura objetivo en unidades del mundo
        castShadow: true,
        receiveShadow: true,
      },
    },
  },

  // Obtener la configuración de un modelo
  getConfig(character) {
    return this.characters[character] || null;
  },

  // Obtener la ruta completa de un recurso
  getPath(resource) {
    return `${this.basePath}${resource}`;
  },
};

export default modelConfig;
