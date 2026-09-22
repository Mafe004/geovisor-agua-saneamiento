-- Migración 0002: tabla invitaciones (códigos de invitación para altas de
-- ENTIDAD/MODERADOR/ADMINISTRADOR sin pasar por el estado PENDIENTE) + FK
-- hacia roles/entidades/usuarios.
--
-- Aplicada una sola vez por backend/migrations/run_migrations.py, que
-- registra su nombre de archivo en `schema_migrations` para no reintentarla
-- -- por eso este archivo no necesita guardas IF NOT EXISTS propias. Si se
-- ejecuta a mano contra una base ya migrada, el CREATE TABLE fallará con
-- "table already exists": es la señal correcta de que ya corrió.
--
-- Mismo ENGINE/CHARSET/COLLATE que el resto del esquema
-- (geovisor_backup_limpio.sql).

CREATE TABLE `invitaciones` (
  `id`         int          NOT NULL AUTO_INCREMENT,
  `token`      char(6)      NOT NULL,
  `id_rol`     int          NOT NULL,
  `id_entidad` int          DEFAULT NULL,
  `creado_por` int          NOT NULL,
  `expira_en`  datetime     NOT NULL,
  `usado`      tinyint(1)   NOT NULL DEFAULT 0,
  `creado_en`  datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `fk_invitaciones_rol` (`id_rol`),
  KEY `fk_invitaciones_entidad` (`id_entidad`),
  KEY `fk_invitaciones_creado_por` (`creado_por`),
  CONSTRAINT `fk_invitaciones_rol`        FOREIGN KEY (`id_rol`)     REFERENCES `roles`     (`id_rol`),
  CONSTRAINT `fk_invitaciones_entidad`    FOREIGN KEY (`id_entidad`) REFERENCES `entidades` (`id_entidad`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_invitaciones_creado_por` FOREIGN KEY (`creado_por`) REFERENCES `usuarios`  (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
