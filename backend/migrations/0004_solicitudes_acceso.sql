-- Migración 0004: tabla solicitudes_acceso -- solicitudes públicas de
-- acceso como ADMINISTRADOR sin invitación previa (ver
-- backend/app/routers/solicitudes_acceso.py), revisadas manualmente por un
-- ADMIN existente. Al aprobar, se genera una invitación normal (tabla
-- `invitaciones`, migración 0002) con id_rol=4.
--
-- FK `revisado_por` apunta a usuarios.id_usuario (no "usuarios.id" -- esa
-- columna no existe en este esquema, ver CREATE TABLE `usuarios`).
--
-- Aplicada una sola vez por backend/migrations/run_migrations.py. Si se
-- ejecuta a mano contra una base ya migrada, el CREATE TABLE fallará con
-- "table already exists": es la señal correcta de que ya corrió.

CREATE TABLE `solicitudes_acceso` (
  `id`              int                                        NOT NULL AUTO_INCREMENT,
  `nombre_completo` varchar(150)                                NOT NULL,
  `correo`          varchar(150)                                NOT NULL,
  `motivo`          text                                        NOT NULL,
  `estado`          enum('PENDIENTE','APROBADO','RECHAZADO')    NOT NULL DEFAULT 'PENDIENTE',
  `revisado_por`    int                                         DEFAULT NULL,
  `creado_en`       timestamp                                   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `revisado_en`     timestamp                                   NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `correo` (`correo`),
  KEY `fk_solicitudes_revisado_por` (`revisado_por`),
  CONSTRAINT `fk_solicitudes_revisado_por` FOREIGN KEY (`revisado_por`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
