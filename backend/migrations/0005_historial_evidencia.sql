-- Migración 0005: columna `imagen_url` en historial_reportes -- evidencia
-- fotográfica opcional que ENTIDAD puede adjuntar al cambiar el estado de
-- un reporte (p.ej. "foto del arreglo" al marcarlo RESUELTO). Antes de esta
-- migración, PUT /reportes/{id}/estado no tenía ningún campo para esto --
-- la cámara que ya existía en EntidadCierreView (entidad/DetalleReporteScreen.tsx)
-- era puramente decorativa.
--
-- `reportes.imagen_url` (la foto que el ciudadano/entidad adjunta al CREAR
-- el reporte) ya existía desde antes y no se toca acá -- esta es una
-- columna distinta, para la foto de la ATENCIÓN, no la del reporte original.
--
-- Aplicada una sola vez por backend/migrations/run_migrations.py.

ALTER TABLE `historial_reportes`
  ADD COLUMN `imagen_url` varchar(500) DEFAULT NULL;
