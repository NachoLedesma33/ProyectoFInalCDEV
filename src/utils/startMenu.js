// Módulo que contiene las diapositivas de la historia y un gestor del carrusel
export const storySlides = [
  {
    image: "./src/assets/imagen1.png",
    text: "BUM! El granjero espacial Kael sintió como su viaje se desmoronaba luego de chocar un asteroide",
  },
  {
    image: "./src/assets/imagen2.png",
    text: "Con él iban sus preciadas vacas que otorgaban el mejor producto lácteo de la galaxia.",
  },
  {
    image: "./src/assets/imagen3.png",
    text: "No le quedo otra opción que descender a la luna mas cercana en alfa Centauri y buscar la forma de arreglar su nave...",
  },
  {
    image: "./src/assets/imagen4.png",
    text: "Luego de tanto buscar, Kael encontró a los aliens nativos",
  },
  {
    image: "./src/assets/imagen5.png",
    text: "Ideo un plan para llegar a un acuerdo con ellos el cual consiste en intercambiar la leche de sus preciadas vacas, con el motivo de comprar herramientas para su nave.",
  },
  {
    image: "./src/assets/imagen6.png",
    text: "Los aliens aceptaron pero le dieron una advertencia para Kael... Algunos aliens malvados trataran de tomar las vacas sin nada a cambio...",
  },
  {
    image: "./src/assets/imagen7.png",
    text: "Entonces Kael miro al horizonte y dijo: ''Protegeré a toda costa mi ganado!!'' ",
  },
];

/**
 * createStoryManager(storySlides, initStarter)
 * - storySlides: array de slides (imagen/texto)
 * - initStarter: función opcional que cuando se llame debe devolver una Promise que resuelve cuando la inicialización del juego termine.
 *
 * El manager se encarga de mostrar el carousel y manejar los botones prev/next/skip.
 */
import { safePlaySfx } from "./audioHelpers.js";

export class StoryManager {
  constructor(storySlidesArg = storySlides, initStarter) {
    this.storySlidesArg = storySlidesArg;
    this.initStarter = initStarter;
    this.currentSlide = 0;
    this.gameInitPromise = null;
    this.gameInitialized = false;
    this.playUIClick = () => {
      try {
        safePlaySfx("uiClick", { volume: 0.9 });
      } catch (_) {}
    };
    this.playUIHover = () => {
      try {
        safePlaySfx("uiHover", { volume: 0.6 });
      } catch (_) {}
    };
  }

  updateCarousel() {
    const carouselImage = document.querySelector(".carousel-image img");
    const carouselText = document.querySelector(".carousel-text p");
    const currentPageNum = document.querySelector(".current-page");

    carouselImage.style.opacity = "0";
    carouselText.style.opacity = "0";

    setTimeout(() => {
      carouselImage.src = this.storySlidesArg[this.currentSlide].image;
      carouselText.textContent = this.storySlidesArg[this.currentSlide].text;
      currentPageNum.textContent = (this.currentSlide + 1).toString();
      carouselImage.style.opacity = "1";
      carouselText.style.opacity = "1";
    }, 300);
  }

  startGame() {
    document.getElementById("story-carousel").style.display = "none";
    document.getElementById("controls-hud").style.display = "flex";

    try {
      const soundHud = document.getElementById("sound-hud");
      if (soundHud) soundHud.style.display = "none";
    } catch (_) {}

    const controlsContinueBtn = document.getElementById("controls-continue");
    if (controlsContinueBtn) {
      try {
        controlsContinueBtn.addEventListener("pointerenter", () =>
          this.playUIHover()
        );
        controlsContinueBtn.addEventListener("mouseenter", () =>
          this.playUIHover()
        );
      } catch (_) {}

      controlsContinueBtn.onclick = () => {
        this.playUIClick();
        try {
          if (!window.__gameplayStarted) {
            window.__gameplayStarted = true;
            if (typeof window.onGameplayStart === "function") {
              try {
                window.onGameplayStart();
              } catch (_) {}
            }
            try {
              window.dispatchEvent(new CustomEvent("gameplaystart"));
            } catch (_) {}
          }
        } catch (_) {}

        document.getElementById("controls-hud").style.display = "none";

        if (this.gameInitialized) {
          document.getElementById("game-container").style.display = "block";
          return;
        }

        if (this.gameInitPromise) {
          this.gameInitPromise.then(() => {
            document.getElementById("game-container").style.display = "block";
          });
        }
      };
    }
  }

  attachToPlayButton(playButton) {
    if (!playButton) return;
    playButton.addEventListener("mouseenter", () => this.playUIHover());
    playButton.addEventListener("click", () => {
      this.playUIClick();
      try {
        const soundHudEl = document.getElementById("sound-hud");
        if (soundHudEl) soundHudEl.style.display = "none";
      } catch (_) {}
      document.getElementById("main-menu").style.display = "none";
      document.getElementById("story-carousel").style.display = "flex";
      this.updateCarousel();

      const prevButton = document.getElementById("prev-slide");
      const nextButton = document.getElementById("next-slide");
      const skipButton = document.getElementById("skip-story");

      if (!prevButton.onclick) {
        prevButton.addEventListener("mouseenter", () => this.playUIHover());
        prevButton.addEventListener("click", () => {
          this.playUIClick();
          if (this.currentSlide > 0) {
            this.currentSlide--;
            this.updateCarousel();
          }
        });

        nextButton.addEventListener("mouseenter", () => this.playUIHover());
        nextButton.addEventListener("click", () => {
          this.playUIClick();
          if (this.currentSlide < this.storySlidesArg.length - 1) {
            this.currentSlide++;
            this.updateCarousel();
          } else {
            this.startGame();
          }
        });

        skipButton.addEventListener("mouseenter", () => this.playUIHover());
        skipButton.addEventListener("click", () => {
          this.playUIClick();
          this.startGame();
        });
      }

      if (!this.gameInitPromise && typeof this.initStarter === "function") {
        this.gameInitPromise = this.initStarter();
        if (
          this.gameInitPromise &&
          typeof this.gameInitPromise.then === "function"
        ) {
          this.gameInitPromise
            .then(() => {
              this.gameInitialized = true;
            })
            .catch((e) => console.error(e));
        }
      }
    });
  }
}

// Backwards-compatible factory wrapper
export function createStoryManager(storySlidesArg = storySlides, initStarter) {
  return new StoryManager(storySlidesArg, initStarter);
}
