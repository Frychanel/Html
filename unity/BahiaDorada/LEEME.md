# Bahía Dorada: proyecto de Unity

Versión de Unity del juego de mundo abierto **original** Bahía Dorada. Toda la ciudad, los coches, la gente, la policía, las misiones y la interfaz (incluidos los controles táctiles en horizontal) se **generan por código** al pulsar Play, así que no hay que montar ninguna escena a mano.

## Qué necesitas
- Un **ordenador** con Windows, Mac o Linux. Unity no funciona en el móvil.
- **Unity Hub** y **Unity 2022.3 LTS** o más reciente (Unity 6 también vale). La licencia Personal es gratuita.
- Al instalar Unity, marca el módulo **Android Build Support** (con OpenJDK y Android SDK/NDK) para poder crear el APK.

## Pasos
1. En Unity Hub: **Add → Add project from disk** y elige esta carpeta (`unity/BahiaDorada`).
2. Ábrelo. La primera vez Unity tarda unos minutos en importar.
3. En la barra superior: **Bahía Dorada → 1. Preparar proyecto**. Si pide reiniciar por «Input Handling», acepta.
4. Pulsa **Play (▶)** para jugar en el ordenador:
   - **WASD**: moverse o conducir.
   - **Ratón**: cámara.
   - **Shift**: correr.
   - **Espacio**: saltar o freno de mano.
   - **F**: subir y bajar del coche.
   - **E**: hablar.
   - **Q**: golpear.
   - **P**: pausa.
5. Para el móvil: **File → Build Settings → Android → Switch Platform** y después **Bahía Dorada → 2. Crear APK para Android**. El archivo aparece en `Builds/BahiaDorada.apk`. Cópialo al teléfono e instálalo (hay que permitir «orígenes desconocidos»).

Para ver los controles táctiles dentro del editor, marca `touchControlsInEditor` en el objeto **BahiaDorada** de la escena.

## Contenido
| Script | Función |
|---|---|
| `GameBootstrap.cs` | Arranque: crea todo, gestiona los K.O. y los arrestos |
| `City.cs` | Ciudad de 12×12 manzanas, calles con marcas, playa, parques, plaza y farolas |
| `Mats.cs` | Materiales fotográficos (Poly Haven, CC0) y fachadas con ventanas que se encienden de noche |
| `Player.cs`, `Human.cs` | Rafa y los cuerpos animados de las personas |
| `Car.cs` | Coches con física arcade (Rigidbody), daños y patrullas con luces |
| `Traffic.cs` | Tráfico que sigue los carriles |
| `Peds.cs` | Peatones: pasean, hablan, huyen, se defienden y caen si los atropellas |
| `Police.cs` | Estrellas de búsqueda, persecuciones y arresto |
| `Missions.cs` | 3 misiones: El Paquete, Vuelta Rápida, Calor Policial |
| `DayNight.cs` | Ciclo de día y noche con cielo procedural |
| `CameraRig.cs` | Cámara en tercera persona con colisión |
| `HUD.cs`, `MobileControls.cs` | Interfaz, radar y controles táctiles horizontales |
| `Editor/BahiaSetup.cs` | Menú «Bahía Dorada»: preparar el proyecto y crear el APK |

## Estado
Los scripts **compilan** contra la API de Unity 2021.3 (comprobado fuera de Unity), pero **todavía no se han ejecutado dentro de Unity**. Si al abrirlo aparece algún error en la consola, cópialo y lo arreglo.

Siguientes mejoras posibles: Universal Render Pipeline (URP) con postprocesado, personajes con animaciones Mecanim y semáforos.

Créditos de texturas: `Assets/Resources/Textures/CREDITS.md`.
