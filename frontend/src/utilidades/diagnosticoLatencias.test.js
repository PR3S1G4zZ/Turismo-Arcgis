import { afterEach, describe, expect, it, vi } from 'vitest';
import { marcar, medir, resumen, MARCAS, TRAMOS } from './diagnosticoLatencias';

describe('diagnosticoLatencias', () => {
  const devOriginal = import.meta.env.DEV;

  afterEach(() => {
    import.meta.env.DEV = devOriginal;
    vi.restoreAllMocks();
    performance.clearMarks();
    performance.clearMeasures();
  });

  it('no llama a performance.mark ni performance.measure cuando DEV es false', () => {
    import.meta.env.DEV = false;
    const markSpy = vi.spyOn(performance, 'mark');
    const measureSpy = vi.spyOn(performance, 'measure');

    marcar(MARCAS.GPS_ACEPTADO);
    medir(TRAMOS.GPS_MARCADOR, MARCAS.GPS_ACEPTADO, MARCAS.MARCADOR_RENDER);

    expect(markSpy).not.toHaveBeenCalled();
    expect(measureSpy).not.toHaveBeenCalled();
  });

  it('llama a performance.mark y performance.measure con los nombres exactos cuando DEV es true', () => {
    import.meta.env.DEV = true;
    const markSpy = vi.spyOn(performance, 'mark');
    const measureSpy = vi.spyOn(performance, 'measure').mockReturnValue({ duration: 12.3 });

    marcar(MARCAS.GPS_ACEPTADO);
    marcar(MARCAS.MARCADOR_RENDER);
    medir(TRAMOS.GPS_MARCADOR, MARCAS.GPS_ACEPTADO, MARCAS.MARCADOR_RENDER);

    expect(markSpy).toHaveBeenNthCalledWith(1, MARCAS.GPS_ACEPTADO);
    expect(markSpy).toHaveBeenNthCalledWith(2, MARCAS.MARCADOR_RENDER);
    expect(measureSpy).toHaveBeenCalledWith(TRAMOS.GPS_MARCADOR, MARCAS.GPS_ACEPTADO, MARCAS.MARCADOR_RENDER);
  });

  it('medir no lanza si falta alguna de las marcas', () => {
    import.meta.env.DEV = true;
    vi.spyOn(performance, 'measure').mockImplementation(() => {
      throw new Error('marca no encontrada');
    });

    expect(() => medir(TRAMOS.GPS_MARCADOR, 'no-existe-inicio', 'no-existe-fin')).not.toThrow();
  });

  it('resumen() agrupa measures diag:* con p95 y limpia el timeline', () => {
    import.meta.env.DEV = true;
    performance.mark('a1');
    performance.mark('a2');
    performance.mark('b1');
    performance.mark('b2');
    performance.measure(TRAMOS.GPS_MARCADOR, 'a1', 'a2');
    performance.measure(TRAMOS.GPS_MARCADOR, 'b1', 'b2');

    const resultado = resumen();

    expect(Object.keys(resultado)).toEqual([TRAMOS.GPS_MARCADOR]);
    expect(Object.keys(resultado[TRAMOS.GPS_MARCADOR]).sort()).toEqual([
      'avgMs',
      'count',
      'maxMs',
      'minMs',
      'p95Ms',
    ]);
    expect(resultado[TRAMOS.GPS_MARCADOR].count).toBe(2);
    expect(resultado[TRAMOS.GPS_MARCADOR].p95Ms).toBeGreaterThanOrEqual(
      resultado[TRAMOS.GPS_MARCADOR].minMs,
    );
    expect(performance.getEntriesByType('measure')).toHaveLength(0);
  });

  it('resumen() ignora measures que no empiezan con diag:', () => {
    import.meta.env.DEV = true;
    performance.mark('c1');
    performance.mark('c2');
    performance.measure('otra-herramienta:medida', 'c1', 'c2');

    const resultado = resumen();

    expect(Object.keys(resultado)).toEqual([]);
  });
});
