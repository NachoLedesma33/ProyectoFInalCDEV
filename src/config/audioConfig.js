// Configuración centralizada de rutas y volúmenes de audio
// Nota: Por compatibilidad con la estructura actual del proyecto,
// - La música se ubica en 'src/music/'
// - Los efectos y UI se ubican en 'src/assets/audio/{sfx, ui, ambience}'

export const AUDIO = {
  music: {
    // Agrega tus pistas aquí. Ejemplos:
    main: "./src/assets/audio/music/Stellaris - Alpha Centauri.mp3",
    combat1: "./src/assets/audio/music/The Abduction.mp3",
    combat2: "./src/assets/audio/music/UFO Alien Invasion Scifi Music.mp3",
    ambient1: "./src/assets/audio/music/Space Ambient Music.mp3",
    ambient2: "./src/assets/audio/music/Red Planet Nocturne.mp3",
    final: "./src/assets/audio/music/Outer Wilds.mp3",

    // menu: "./src/music/menu_theme.ogg",
  },
  sfx: {
    uiClick: "./src/assets/audio/ui/button3.wav",
    uiHover: "./src/assets/audio/ui/hover_button.wav",
    punch: "./src/assets/audio/sfx/punch.wav",
    hit: "./src/assets/audio/sfx/punch1.wav",
    run: "./src/assets/audio/sfx/running.wav",
    milking: "./src/assets/audio/sfx/milking_cow.wav",
    openDoor: "./src/assets/audio/sfx/opening_door.wav",
    closeDoor: "./src/assets/audio/sfx/closing_door.wav",
    corralOpen: "./src/assets/audio/sfx/corral_open.wav",
    corralClose: "./src/assets/audio/sfx/corral_close.wav",
    farmerDeath: "./src/assets/audio/sfx/farmer_death.wav",
    cowMoo: "./src/assets/audio/sfx/cow_moo.wav",
    spaceshipPanel: "./src/assets/audio/ui/spaceship_panel.wav",
    spaceshipStart: "./src/assets/audio/sfx/spaceship_start.wav",
    spaceshipLaunch: "./src/assets/audio/sfx/spaceship_launch.wav",
    spaceshipRepair: "./src/assets/audio/ui/spaceship_repair.wav",
    brokenSpaceship: "./src/assets/audio/sfx/Smoking_rocket.wav",
    alienLaugh: "./src/assets/audio/sfx/alien_laugh.wav",
    alienScream: "./src/assets/audio/sfx/alien_scream.wav",
    alienSound: "./src/assets/audio/sfx/alien_song.wav",
    alienVoice: "./src/assets/audio/sfx/alien_voice.wav",
    alienVoice2: "./src/assets/audio/sfx/alien_voice2.wav",
    popup: "./src/assets/audio/ui/popup.wav",
    cashRegister: "./src/assets/audio/ui/cash_register.wav",

    // hit: "./src/assets/audio/sfx/hit.wav",
  },
  ambience: {
    noise: "./src/assets/audio/ambience/ambient_planet_noise.wav",
  },
};

export const AUDIO_DEFAULTS = {
  masterVolume: 0.9,
  musicVolume: 0.5,
  ambienceVolume: 0.4,
  sfxVolume: 1.0,
  muted: false,
};

// Helpers para validar rutas existentes (opcionalmente en el futuro)
export default {
  AUDIO,
  AUDIO_DEFAULTS,
};
