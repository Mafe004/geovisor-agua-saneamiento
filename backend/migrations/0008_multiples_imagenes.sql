-- Migración 0008: varias fotos por reporte, de dos tipos.
--
-- Hasta ahora reportes.imagen_url (la foto del incidente) e
-- historial_reportes.imagen_url (la foto de la atención/evidencia) eran
-- una sola columna cada una -- solo admitían UNA foto. Esta tabla permite
-- varias de cada tipo sin tocar esas dos columnas (se quedan como están,
-- para los reportes que ya tienen datos ahí -- ver _select_reporte_detalle_sql
-- y _select_historial_sql en el backend, que siguen devolviendo ambas
-- cosas: la columna legada Y la lista nueva).
--
-- `tipo` distingue las dos situaciones en una sola tabla en vez de dos
-- separadas (misma foto del reporte original vs. foto de cómo quedó al
-- cambiar de estado) porque comparten exactamente la misma forma y las
-- mismas reglas de subida (POST /reportes/imagen); solo cambia a qué fila
-- madre se cuelgan. INCIDENTE siempre cuelga de id_reporte (nunca
-- id_historial); EVIDENCIA siempre cuelga de ambos (de qué reporte Y de
-- qué cambio de estado específico generó esa evidencia).
--
-- ON DELETE CASCADE en ambas FK: borrar un reporte (eliminar_reporte_admin)
-- o una fila de historial nunca debe dejar fotos huérfanas en esta tabla.
--
-- Aplicada una sola vez por backend/migrations/run_migrations.py.

CREATE TABLE `reporte_imagenes` (
  `id_imagen`    int                            NOT NULL AUTO_INCREMENT,
  `id_reporte`   int                            NOT NULL,
  `id_historial` int                            DEFAULT NULL,
  `tipo`         enum('INCIDENTE','EVIDENCIA')  NOT NULL,
  `imagen_url`   varchar(300)                   NOT NULL,
  `creado_en`    datetime                       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_imagen`),
  KEY `idx_reporte_imagenes_reporte` (`id_reporte`),
  KEY `idx_reporte_imagenes_historial` (`id_historial`),
  CONSTRAINT `fk_reporte_imagenes_reporte`
    FOREIGN KEY (`id_reporte`) REFERENCES `reportes` (`id_reporte`) ON DELETE CASCADE,
  CONSTRAINT `fk_reporte_imagenes_historial`
    FOREIGN KEY (`id_historial`) REFERENCES `historial_reportes` (`id_historial`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
