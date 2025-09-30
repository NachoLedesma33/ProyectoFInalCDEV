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
        // Animación de correr hacia adelante
        run: "characters/farmer/RunningFront.fbx",
        // Animación de caminar hacia adelante (usando animación de correr)
        walk: "characters/farmer/RunningFront.fbx",
        // Animación de giro de 180 grados
        turn180: "characters/farmer/Running Turn 180.fbx",
        // Animación de caminar hacia la izquierda
        strafeLeft: "characters/farmer/Left_Strafe.fbx",
        // Animación de caminar hacia la derecha
        strafeRight: "characters/farmer/Right_Strafe.fbx",
        // Animación de correr hacia atrás (opcional)
        runBackward: "characters/farmer/Running_backwar.fbx",
      },

      // Ajustes específicos
      settings: {
        height: 1.8, // Altura objetivo en unidades del mundo
        castShadow: true,
        receiveShadow: true,
      },
    },
    
    farmer2: {
      // Modelo principal
      model: "characters/farmer/Granjero2.fbx",
      scale: 1.2, // La escala se manejará automáticamente en el ModelLoader (aumentada significativamente)
      // Animaciones
      animations: {
        // Animación de reposo
        idle: "characters/farmer/Neutral_Idle_Granjero2.fbx",
        // Animación de correr hacia adelante
        run: "characters/farmer/Running_Granjero2.fbx",
        // Animación de caminar hacia adelante (usando animación de correr)
        walk: "characters/farmer/Running_Granjero2.fbx",
        // Animación de giro de 180 grados
        turn180: "characters/farmer/Running_Turn_180_Granjero2.fbx",
        // Animación de caminar hacia la izquierda (ahora usa Running_Left_Turn)
        strafeLeft: "characters/farmer/Running_Left_Turn_Granjero2.fbx",
        // Animación de caminar hacia la derecha (ahora usa Running_Right_Turn)
        strafeRight: "characters/farmer/Running_Right_Turn_Granjero2.fbx",
        // Nuevas animaciones para movimiento diagonal
        // Movimiento diagonal adelante-izquierda (W + A)
        diagonalForwardLeft: "characters/farmer/Running_Left_Turn_Granjero2.fbx",
        // Movimiento diagonal adelante-derecha (W + D)
        diagonalForwardRight: "characters/farmer/Running_Right_Turn_Granjero2.fbx",
      },

      // Ajustes específicos
      settings: {
        height: 1.8, // Altura objetivo en unidades del mundo (aumentado significativamente)
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
