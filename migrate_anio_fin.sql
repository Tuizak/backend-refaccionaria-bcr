-- Agrega la columna anio_fin para soportar rangos de años en compatibilidades
ALTER TABLE producto_compatibilidades
ADD COLUMN anio_fin YEAR NULL DEFAULT NULL AFTER anio;
