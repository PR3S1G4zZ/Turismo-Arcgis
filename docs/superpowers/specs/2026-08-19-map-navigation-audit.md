# Especificación de confiabilidad del mapa

## Objetivo

La navegación debe usar exclusivamente posiciones GPS reales y vigentes para seguimiento, progreso, llegada y recálculo. Si no hay una posición confiable, la aplicación puede mostrar una ruta de vista previa desde un origen manual, pero no puede afirmar que está siguiendo al usuario.

## Requisitos

- Enviar origen y destino al servicio de rutas en ese orden y conservar { lat, lng }.
- Rechazar lecturas GPS desordenadas, con más de 50 m de precisión declarada o con más de 5 s de antigüedad durante una sesión live.
- No introducir retraso artificial: la lectura GPS aceptada alimenta inmediatamente la lógica, la cámara y el rumbo; cualquier interpolación queda limitada al marcador visual.
- Nunca sustituir una última ubicación real por el centro simulado de Itagüí tras un error temporal de GPS.
- Una ruta creada sin GPS real es una vista previa estática: sin progreso, llegada ni recálculo automático.
- Al iniciar navegación con GPS, la cámara se centra en el usuario en modo course-up; al salir, vuelve a norte y sin inclinación. Ningún fitBounds debe competir con esa cámara.
- Cubrir geometría, política de ubicación y estados de navegación con pruebas automatizadas.

## Estados de ubicación

- `gpsConfiable=true`: existe una lectura aceptada, fresca, monotónica y con precisión de 50 m o mejor.
- `gpsConfiable=false` después de un error: se conserva la última coordenada confiable solo para mostrarla, pero se suspenden progreso, llegada, voz y recálculo.
- `isSimulated=true`: solo se permite antes de la primera lectura confiable y nunca habilita seguimiento.

## Objetivo de latencia

- `watchPosition` en live usa `enableHighAccuracy: true`, `maximumAge: 1000` y `timeout: 5000`.
- La interfaz muestra la antigüedad de la última lectura aceptada y pasa a estado no-live al superar 5 s sin una lectura nueva.
- No se promete una frecuencia fija: el navegador y el dispositivo controlan el hardware GPS, pero ninguna capa de la aplicación debe añadir más de una lectura de retraso.

## Criterio de salida

La funcionalidad no se considera lista hasta que las pruebas automáticas cubran el contrato A→B, lecturas stale/imprecisas, pérdida temporal de señal, origen manual y cámara preview/live/exit; además, una prueba en HTTPS desde un dispositivo físico confirma la lectura real sin guardar coordenadas personales.
