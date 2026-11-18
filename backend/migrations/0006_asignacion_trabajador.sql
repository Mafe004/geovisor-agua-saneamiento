-- Migración 0006: columna `id_usuario_asignado` en reportes -- permite que
-- una ENTIDAD (o un ADMIN) reparta reportes entre sus propios trabajadores,
-- en vez de que todos los trabajadores de una misma entidad vean siempre el
-- mismo pool completo sin distinción de quién lo está atendiendo.
--
-- Antes de esta migración, "Tomar" en ReportesAsignadosScreen.tsx solo
-- cambiaba el estado a EN_PROCESO -- la etiqueta "Tú lo tomaste" que se
-- mostraba después era honesta solo para quien lo tomó, pero CUALQUIER otro
-- trabajador de la misma entidad veía la misma tarjeta con el mismo texto,
-- porque no había ningún dato que dijera QUIÉN lo tomó.
--
-- NULL = sin asignar a un trabajador específico todavía (el pool compartido
-- de la entidad sigue existiendo, esto solo añade un nivel más fino encima).
--
-- Aplicada una sola vez por backend/migrations/run_migrations.py.

ALTER TABLE `reportes`
  ADD COLUMN `id_usuario_asignado` int DEFAULT NULL,
  ADD CONSTRAINT `fk_reportes_usuario_asignado`
    FOREIGN KEY (`id_usuario_asignado`) REFERENCES `usuarios` (`id_usuario`);
