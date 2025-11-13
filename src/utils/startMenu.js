// Módulo que contiene las diapositivas de la historia y un gestor del carrusel
export const storySlides = [
  {
    image: "./src/assets/imagen1.png",
    text: "!BOOM! El granjero espacial ''Kael'' sintió como su viaje se desmoronaba luego de chocar un asteroide",
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
    text: "Luego de tanto buscar, ''Kael'' por fin encontró a los aliens nativos!",
  },
  {
    image: "./src/assets/imagen5.png",
    text: "Ideo un plan para llegar a un acuerdo con ellos el cual consiste en intercambiar la leche de sus preciadas vacas, con el motivo de comprar herramientas para su nave.",
  },
  {
    image: "./src/assets/imagen6.png",
    text: "Los aliens aceptaron pero le dieron una advertencia para Kael... Algunos aliens hostiles intentarán hacerte daño a tí y tu rebaño.",
  },
  {
    image: "./src/assets/imagen7.png",
    text: "Entonces ''Kael'' miro al horizonte y dijo: ''Protegeré a toda costa mi ganado!!'' ",
  },
];

import { safePlaySfx } from "./audioHelpers.js";

export class StoryManager {
  constructor(storySlidesArg = storySlides, initStarter) {
    this.storySlidesArg = storySlidesArg;
    this.initStarter = initStarter;
    this.currentSlide = 0;
    this.gameInitPromise = null;
    this.gameInitialized = false;
    this.imageCache = new Array(this.storySlidesArg.length);
    this._imagesPreloaded = false;
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

  preloadImages() {
    if (this._imagesPreloaded) return;
    this._imagesPreloaded = true;
    const preloadOne = (idx) => {
      try {
        const src = this.storySlidesArg[idx] && this.storySlidesArg[idx].image;
        if (!src) return;
        const img = new Image();
        img.decoding = "async";
        img.loading = "eager";
        img.src = src;
        const done = () => {
          this.imageCache[idx] = img;
        };
        if (typeof img.decode === "function") {
          img.decode().then(done).catch(done);
        } else {
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        }
      } catch (_) {}
    };
    for (let i = 0; i < this.storySlidesArg.length; i++) preloadOne(i);
  }

  updateCarousel() {
    const carouselImage = document.querySelector(".carousel-image img");
    const carouselText = document.querySelector(".carousel-text p");
    const currentPageNum = document.querySelector(".current-page");

    carouselImage.style.opacity = "0";
    carouselText.style.opacity = "0";
    const cached = this.imageCache[this.currentSlide];
    const nextSrc = cached && cached.src ? cached.src : this.storySlidesArg[this.currentSlide].image;
    carouselImage.src = nextSrc;
    carouselText.textContent = this.storySlidesArg[this.currentSlide].text;
    currentPageNum.textContent = (this.currentSlide + 1).toString();
    requestAnimationFrame(() => {
      carouselImage.style.opacity = "1";
      carouselText.style.opacity = "1";
    });
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
        const sched = (fn) => {
          try {
            if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
              window.requestIdleCallback(fn, { timeout: 2000 });
            } else {
              setTimeout(fn, 250);
            }
          } catch (_) { setTimeout(fn, 250); }
        };
        sched(() => this.preloadImages());
      } catch (_) {}
      try {
        const soundHudEl = document.getElementById("sound-hud");
        if (soundHudEl) soundHudEl.style.display = "none";
      } catch (_) {}
      document.getElementById("main-menu").style.display = "none";
      const difficultyMenu = document.getElementById("difficulty-menu");
      if (difficultyMenu) difficultyMenu.style.display = "flex";

      const proceedToStory = () => {
        if (difficultyMenu) difficultyMenu.style.display = "none";
        document.getElementById("story-carousel").style.display = "flex";
        this.updateCarousel();

        const prevButton = document.getElementById("prev-slide");
        const nextButton = document.getElementById("next-slide");
        const skipButton = document.getElementById("skip-story");

        if (prevButton && !prevButton._bound) {
          prevButton._bound = true;
          prevButton.addEventListener("pointerenter", () => this.playUIHover());
          prevButton.addEventListener("mouseenter", () => this.playUIHover());
          prevButton.addEventListener("click", () => {
            this.playUIClick();
            if (this.currentSlide > 0) {
              this.currentSlide--;
              this.updateCarousel();
            }
          });
        }
        if (nextButton && !nextButton._bound) {
          nextButton._bound = true;
          nextButton.addEventListener("pointerenter", () => this.playUIHover());
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
        }
        if (skipButton && !skipButton._bound) {
          skipButton._bound = true;
          skipButton.addEventListener("pointerenter", () => this.playUIHover());
          skipButton.addEventListener("mouseenter", () => this.playUIHover());
          skipButton.addEventListener("click", () => {
            this.playUIClick();
            this.startGame();
          });
        }
      };

      try {
        const easyBtn = document.getElementById("difficulty-easy");
        const mediumBtn = document.getElementById("difficulty-medium");
        const hardBtn = document.getElementById("difficulty-hard");

        const setDiff = (mode) => {
          try { window.selectedDifficulty = mode; } catch (_) {}
          proceedToStory();
        };

        if (easyBtn && !easyBtn._bound) {
          easyBtn._bound = true;
          easyBtn.addEventListener("mouseenter", () => this.playUIHover());
          easyBtn.addEventListener("click", () => { this.playUIClick(); setDiff("easy"); });
        }
        if (mediumBtn && !mediumBtn._bound) {
          mediumBtn._bound = true;
          mediumBtn.addEventListener("mouseenter", () => this.playUIHover());
          mediumBtn.addEventListener("click", () => { this.playUIClick(); setDiff("medium"); });
        }
        if (hardBtn && !hardBtn._bound) {
          hardBtn._bound = true;
          hardBtn.addEventListener("mouseenter", () => this.playUIHover());
          hardBtn.addEventListener("click", () => { this.playUIClick(); setDiff("hard"); });
        }
      } catch (_) {}

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

export function createStoryManager(storySlidesArg = storySlides, initStarter) {
  return new StoryManager(storySlidesArg, initStarter);
}
