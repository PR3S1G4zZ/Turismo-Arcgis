# Wave B — cámara de navegación

## Cambios

- La ruta se muestra en los estados `previsualizando`, `navegando` y `llegado`.
- El seguimiento vivo exige navegación, GPS confiable y ubicación no simulada.
- La previsualización encuadra la ruta sin iniciar seguimiento; el seguimiento en vivo no vuelve a ejecutar `fitBounds`.
- Cada actualización de cámara detiene la animación anterior y usa `easeTo` de 250 ms con la fijación GPS aceptada y un rumbo finito.
- Arrastrar, rotar o inclinar pausa el seguimiento y expone el control de recentrado.
- La vista informativa no vuelve a centrarse con cada lectura GPS; al salir de la navegación se restablecen norte-arriba y `pitch: 0`.

## Pruebas

`InteractiveMap.test.jsx` cubre previsualización, orden `stop` → `easeTo`, rumbo ausente, mapa informativo, los tres gestos de cámara y la salida a norte-arriba.

## Validación

- `npm.cmd test`: 19 pruebas aprobadas.
- `npm.cmd run lint`: sin errores ni advertencias.
- `npm.cmd run build`: compilación aprobada. Vite conserva su advertencia informativa de chunks mayores a 500 kB.
