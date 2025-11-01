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
    alien2: {
      // Modelo principal
      model: "characters/aliens/Alien2.fbx",
      scale: 1.2, // Misma escala que farmer2
      // Animaciones
      animations: {
        // Animación de reposo
        idle: "characters/aliens/IdleAlien2.fbx",
        // Animación de caminar
        walk: "characters/aliens/WalkingAlien2.fbx",
        // Animación de giro a la derecha (usando la animación de caminar con rotación)
        turnRight: "characters/aliens/Alien2 Walk Forward Turn 90L.fbx",
      },

      // Ajustes específicos
      settings: {
        height: 1.9, // Misma altura que farmer2
        castShadow: true,
        receiveShadow: true,
      },
    },

    // Configuración del Alien1 (enemigos que spawnearán en oleadas)
    alien1: {
      // Modelo principal
      model: "characters/aliens/Alieni1.fbx",
      // increase default scale a bit so aliens are more visible
      scale: 1.5,
      // Animaciones principales (idle, walk, attack, death)
      animations: {
        idle: "characters/aliens/Alieni1_idle.fbx",
        run: "characters/aliens/Alieni1_walk.fbx",
        walk: "characters/aliens/Alieni1_walk.fbx",
        combatIdle: "characters/aliens/Alieni1_combat_idle.fbx",
        death: "characters/aliens/Alieni1_Death.fbx",
        // golpes izquierdos/derechos para el Alien1
        punch_left: "characters/aliens/Alieni1_Punch_Left.fbx",
        punch_right: "characters/aliens/Alieni1_Punch_Right.fbx",
      },
      // Ajustes específicos
      settings: {
        height: 2.05,
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
        strafeLeft: "characters/farmer/Left_Strafe_Granjero2.fbx",
        // Animación de caminar hacia la derecha (ahora usa Running_Right_Turn)
        strafeRight: "characters/farmer/Right_Strafe_Granjero2.fbx",
        // Nuevas animaciones para movimiento diagonal
        // Movimiento diagonal adelante-izquierda (W + A)
        diagonalForwardLeft:
          "characters/farmer/Jog Forward Diagonal Left Farmer2.fbx",
        // Movimiento diagonal adelante-derecha (W + D)
        diagonalForwardRight:
          "characters/farmer/Jog Forward Diagonal Right Farmer2.fbx",
        // Animación de colisión con vacas (agacharse)
        Kneel_Granjero2: "characters/farmer/Kneeling Down.fbx",
        // Animación de estado final agachado
        Kneeling: "characters/farmer/Kneeling.fbx",
        // Animaciones de combate / melee (para cuando el granjero sostiene un arma)
        meleeIdle: "characters/farmer/Melee_Idle_Granjero2.fbx",
        meleeAttack:
          "characters/farmer/Standing_Melee_Attack_Horizontal_Granjero2.fbx",
        meleeRun: "characters/farmer/Combat_Run_Forward_Granjero2.fbx",
        // Animaciones de combate individuales (punchs y estado de combate)
        combat_idle: "characters/farmer/Granjero2_combat_idle.fbx",
        punch_left: "characters/farmer/Granjero2_Punching_Left.fbx",
        punch_right: "characters/farmer/Granjero2_Punching_Right.fbx",
        // Animación de muerte
        death: "characters/farmer/Granjero2_Death.fbx",
      },

      // Ajustes específicos
      settings: {
        height: 1.9, // Altura objetivo en unidades del mundo (aumentado significativamente)
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
