# Uso de Three.js en el Proyecto

Este documento detalla el uso de la biblioteca Three.js a lo largo del proyecto, explicando las funciones clave utilizadas, su propósito y el orden en que los objetos se renderizan en el entorno virtual.

## 1. Inicialización y Configuración del Entorno (`main.js`)

El archivo `main.js` es el punto de entrada de la aplicación y es responsable de configurar el entorno 3D básico. El proceso de inicialización sigue estos pasos:

1. **Creación de la Escena**: Se crea una instancia de `THREE.Scene`, que actuará como el contenedor principal para todos los objetos 3D.

    ```javascript
    scene = new THREE.Scene();
    ```

2. **Configuración del Renderizador**: Se inicializa `THREE.WebGLRenderer` para dibujar la escena en el navegador. Se configuran varias propiedades para optimizar el rendimiento y la calidad visual:

    * `antialias: true`: Suaviza los bordes de los objetos.
    * `shadowMap.enabled = true`: Habilita el renderizado de sombras.
    * `shadowMap.type = THREE.PCFSoftShadowMap`: Utiliza sombras suaves para un mayor realismo.
    * `physicallyCorrectLights = true`: Usa un modelo de iluminación físicamente correcto.
    * `outputEncoding = THREE.sRGBEncoding`: Asegura una representación de color precisa.
    * `toneMapping = THREE.ACESFilmicToneMapping`: Aplica un mapeo de tonos cinematográfico para mejorar el rango dinámico de la imagen.

3. **Creación de la Cámara**: Se utiliza una clase personalizada, `CameraManager`, para crear y gestionar la cámara. La cámara principal es una `THREE.PerspectiveCamera`, configurada para una vista isométrica.

4. **Inicialización del Reloj**: Se crea una instancia de `THREE.Clock` para gestionar el tiempo en las animaciones y asegurar que el movimiento sea fluido e independiente de la tasa de fotogramas.

    ```javascript
    clock = new THREE.Clock();
    ```

## 2. Componentes Principales de la Escena

Una vez que el entorno básico está configurado, se inicializan los diferentes componentes que conforman el mundo virtual.

### Cámara (`CameraManager.js` y `controls.js`)

* **`THREE.PerspectiveCamera`**: Se utiliza para crear la cámara principal. Aunque la vista es isométrica, se logra posicionando y rotando una cámara en perspectiva de una manera específica.
* **`OrbitControls`**: Importado de los ejemplos de Three.js, se utiliza en `ControlsManager` para permitir al usuario rotar la cámara alrededor de un punto de interés, aunque en este proyecto su funcionalidad principal es gestionar el seguimiento del personaje.

### Iluminación (`lighting.js`)

Para crear una atmósfera realista, se utilizan varios tipos de luces:

* **`THREE.AmbientLight`**: Proporciona una luz base que ilumina todos los objetos de la escena de manera uniforme, evitando que las áreas en sombra se vean completamente negras.
* **`THREE.DirectionalLight`**: Simula la luz del sol. Es una luz que emite rayos paralelos desde una dirección específica y es la principal fuente de sombras en la escena.
* **`THREE.HemisphereLight`**: Proporciona una iluminación más natural al simular la luz que proviene del cielo y la que es reflejada por el suelo, dando a los objetos un color de iluminación diferente desde arriba y desde abajo.

### Terreno (`Terrain.js`)

El terreno se construye utilizando los siguientes componentes de Three.js:

* **`THREE.PlaneGeometry`**: Se utiliza para crear el plano base del suelo.
* **`THREE.BoxGeometry`**: Se usa para crear las paredes que delimitan el área de juego.
* **`THREE.TextureLoader`**: Carga las texturas de pasto y de los contornos para aplicarlas a los materiales del suelo y las paredes.
* **`THREE.MeshStandardMaterial`**: Es el material utilizado tanto para el suelo como para las paredes. Este material reacciona a la luz de una manera físicamente realista.
* **`SimplexNoise`**: Aunque está presente, la función `generateHeight` devuelve `0`, lo que resulta en un terreno plano. Originalmente, esta utilidad se usa para generar terrenos procedurales con elevaciones.

### Skybox (`Skybox.js`)

El fondo 360° del entorno se crea de la siguiente manera:

* **`THREE.SphereGeometry`**: Se crea una gran esfera que envuelve toda la escena.
* **`THREE.TextureLoader`**: Carga la imagen panorámica que se usará como textura del cielo.
* **`THREE.MeshBasicMaterial`**: Se utiliza para el skybox. Este material no se ve afectado por las luces de la escena, lo que es ideal para un fondo. La propiedad `side: THREE.BackSide` asegura que la textura se renderice en la cara interior de la esfera.

### Carga de Modelos y Animaciones (`modelLoader.js`)

El personaje principal y sus animaciones se cargan utilizando:

* **`FBXLoader`**: Un cargador específico para modelos en formato `.fbx`. Se utiliza tanto para cargar la malla del personaje como sus animaciones, que pueden estar en archivos separados.
* **`THREE.AnimationMixer`**: Es el corazón del sistema de animación. Permite reproducir, detener y hacer transiciones suaves entre diferentes clips de animación (`THREE.AnimationClip`).
* **`SkeletonUtils`**: Una utilidad que puede ser usada para clonar modelos esqueléticos, aunque en este código su uso no es explícito, es una dependencia común al trabajar con animaciones complejas.

### Control del Personaje (`FarmerController.js`)

El movimiento del personaje se gestiona actualizando directamente las propiedades `position` y `rotation` del objeto del modelo 3D (`this.model.position` y `this.model.rotation`) en respuesta a la entrada del teclado.

## 3. Ciclo de Renderizado (Función `animate` en `main.js`)

El ciclo de renderizado es una función que se ejecuta en cada fotograma y es responsable de actualizar y dibujar la escena. El orden de las operaciones en cada fotograma es crucial:

1. **Obtener el Delta Time**: Se llama a `clock.getDelta()` para obtener el tiempo transcurrido desde el último fotograma. Este valor se utiliza para que las animaciones y el movimiento sean independientes de la velocidad de fotogramas.

2. **Actualizar el Mezclador de Animaciones**: Se actualiza el `AnimationMixer` del `modelLoader` con el `delta` para avanzar las animaciones del personaje al siguiente fotograma.

    ```javascript
    modelLoader.update(delta);
    ```

3. **Actualizar el Controlador del Personaje**: Se actualiza la lógica de movimiento del `farmerController`, que modifica la posición y rotación del modelo del granjero basándose en las teclas presionadas.

    ```javascript
    farmerController.update(delta);
    ```

4. **Actualizar la Cámara**: El `cameraManager` actualiza la posición y el punto de mira de la cámara para seguir suavemente al personaje.

    ```javascript
    cameraManager.update(delta);
    ```

5. **Renderizar la Escena**: Finalmente, se llama a `renderer.render(scene, camera)`. Esta función toma la escena actualizada y la cámara y dibuja el resultado en el lienzo (canvas) del navegador.

Este ciclo se repite continuamente gracias a `requestAnimationFrame(animate)`, creando la ilusión de movimiento y una experiencia interactiva en tiempo real.
