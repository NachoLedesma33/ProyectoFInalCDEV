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
export function createStoryManager(storySlidesArg = storySlides, initStarter) {
  let currentSlide = 0;
  let gameInitPromise = null;
  let gameInitialized = false;

  function updateCarousel() {
    const carouselImage = document.querySelector(".carousel-image img");
    const carouselText = document.querySelector(".carousel-text p");
    const currentPageNum = document.querySelector(".current-page");

    carouselImage.style.opacity = "0";
    carouselText.style.opacity = "0";

    setTimeout(() => {
      carouselImage.src = storySlidesArg[currentSlide].image;
      carouselText.textContent = storySlidesArg[currentSlide].text;
      currentPageNum.textContent = (currentSlide + 1).toString();
      carouselImage.style.opacity = "1";
      carouselText.style.opacity = "1";
    }, 300);
  }

  function startGame() {
    document.getElementById("story-carousel").style.display = "none";
    document.getElementById("controls-hud").style.display = "flex";

    document.getElementById("controls-continue").onclick = () => {
      document.getElementById("controls-hud").style.display = "none";

      if (gameInitialized) {
        document.getElementById("game-container").style.display = "block";
        return;
      }

      if (gameInitPromise) {
        gameInitPromise.then(() => {
          document.getElementById("game-container").style.display = "block";
        });
      }
    };
  }

  function attachToPlayButton(playButton) {
    if (!playButton) return;

    playButton.addEventListener("click", () => {
      document.getElementById("main-menu").style.display = "none";
      document.getElementById("story-carousel").style.display = "flex";
      updateCarousel();

      const prevButton = document.getElementById("prev-slide");
      const nextButton = document.getElementById("next-slide");
      const skipButton = document.getElementById("skip-story");

      if (!prevButton.onclick) {
        prevButton.onclick = () => {
          if (currentSlide > 0) {
            currentSlide--;
            updateCarousel();
          }
        };

        nextButton.onclick = () => {
          if (currentSlide < storySlidesArg.length - 1) {
            currentSlide++;
            updateCarousel();
          } else {
            startGame();
          }
        };

        skipButton.onclick = startGame;
      }

      if (!gameInitPromise && typeof initStarter === "function") {
        gameInitPromise = initStarter();
        if (gameInitPromise && typeof gameInitPromise.then === "function") {
          gameInitPromise.then(() => {
            gameInitialized = true;
          }).catch((e) => console.error(e));
        }
      }
    });
  }

  return {
    attachToPlayButton,
    updateCarousel,
    startGame,
  };
}
