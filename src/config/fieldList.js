/**
 * Lista de campos para las animaciones del personaje Farmer
 * Cada animación tiene un ID numérico único y su nombre correspondiente
 */

export const FARMER_ANIMATIONS = {
  // Animación de espera (reposo)
  IDLE: {
    id: 0,
    name: 'idle',
    description: 'El personaje está en posición de espera',
    file: 'characters/farmer/Neutral Idle.fbx'
  },
  
  // Animación de caminar
  WALK: {
    id: 1,
    name: 'walk',
    description: 'El personaje camina hacia adelante',
    file: 'characters/farmer/WalkingFarmer.fbx'
  },
  
  // Agregar más animaciones según sea necesario
  // Ejemplo:
  // RUN: {
  //   id: 2,
  //   name: 'run',
  //   description: 'El personaje corre',
  //   file: 'characters/farmer/Run.fbx'
  // },
};

/**
 * Obtiene la configuración de una animación por su ID
 * @param {number} animationId - El ID de la animación
 * @returns {Object|null} La configuración de la animación o null si no se encuentra
 */
export const getAnimationById = (animationId) => {
  return Object.values(FARMER_ANIMATIONS).find(
    (anim) => anim.id === animationId
  ) || null;
};

/**
 * Obtiene la configuración de una animación por su nombre
 * @param {string} animationName - El nombre de la animación
 * @returns {Object|null} La configuración de la animación o null si no se encuentra
 */
export const getAnimationByName = (animationName) => {
  return FARMER_ANIMATIONS[animationName.toUpperCase()] || null;
};

/**
 * Obtiene la ruta del archivo de animación por su ID
 * @param {number} animationId - El ID de la animación
 * @returns {string|null} La ruta del archivo o null si no se encuentra
 */
export const getAnimationPathById = (animationId) => {
  const anim = getAnimationById(animationId);
  return anim ? anim.file : null;
};

export default FARMER_ANIMATIONS;
