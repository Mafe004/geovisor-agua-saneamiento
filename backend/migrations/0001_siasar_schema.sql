-- Migración 0001: tablas SIASAR (Cundinamarca) + vínculo desde reportes.
--
-- Aplicada una sola vez por backend/migrations/run_migrations.py, que
-- registra su nombre de archivo en `schema_migrations` para no reintentarla
-- -- por eso este archivo no necesita guardas IF NOT EXISTS propias. Si se
-- ejecuta a mano contra una base ya migrada, las CREATE TABLE fallarán con
-- "table already exists": es la señal correcta de que ya corrió.
--
-- Mismo ENGINE/CHARSET/COLLATE que el resto del esquema
-- (geovisor_backup_limpio.sql).

CREATE TABLE `siasar_comunidad` (
  `id_siasar`             int            NOT NULL,
  `nombre`                varchar(120)   NOT NULL,
  `municipio`             varchar(60)    NOT NULL,
  `localidad`             varchar(120)   DEFAULT NULL,
  `latitud`               decimal(10,7)  NOT NULL,
  `longitud`              decimal(10,7)  NOT NULL,
  `poblacion`             int            DEFAULT NULL,
  `viviendas`             int            DEFAULT NULL,
  `poblacion_atipica`     tinyint(1)     NOT NULL DEFAULT 0,
  `cobertura_agua`        decimal(5,4)   DEFAULT NULL,
  `cobertura_saneamiento` decimal(5,4)   DEFAULT NULL,
  `n_escuelas`            int            DEFAULT NULL,
  `sistemas_texto`        varchar(400)   DEFAULT NULL,
  `prestador`             varchar(400)   DEFAULT NULL,
  `calificacion`          char(1)        DEFAULT NULL,
  `fecha_encuesta`        date           NOT NULL,
  `fecha_importacion`     datetime       NOT NULL,
  PRIMARY KEY (`id_siasar`),
  KEY `idx_siasar_comunidad_municipio` (`municipio`),
  KEY `idx_siasar_comunidad_geo` (`latitud`, `longitud`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `siasar_sistema` (
  `id_siasar`              int            NOT NULL,
  `nombre`                 varchar(200)   NOT NULL,
  `municipio`              varchar(60)    NOT NULL,
  `localidad`              varchar(120)   DEFAULT NULL,
  `latitud`                decimal(10,7)  NOT NULL,
  `longitud`               decimal(10,7)  NOT NULL,
  `comunidades_texto`      varchar(800)   DEFAULT NULL,
  `prestador`              varchar(250)   DEFAULT NULL,
  `poblacion_servida`      int            DEFAULT NULL,
  `viviendas_servidas`     int            DEFAULT NULL,
  `poblacion_atipica`      tinyint(1)     NOT NULL DEFAULT 0,
  `horas_servicio`         decimal(4,1)   DEFAULT NULL,
  `cloracion`              enum('FUNCIONA','NO_FUNCIONA','NO_SE_REALIZA','SIN_DATO') NOT NULL,
  `prueba_coliformes`      enum('PASA','NO_PASA','SIN_PRUEBA') NOT NULL,
  `prueba_fisicoquimica`   enum('PASA','NO_PASA','SIN_PRUEBA') NOT NULL,
  `fecha_encuesta`         date           NOT NULL,
  `fecha_importacion`      datetime       NOT NULL,
  PRIMARY KEY (`id_siasar`),
  KEY `idx_siasar_sistema_municipio` (`municipio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `siasar_comunidad_sistema` (
  `id_siasar_comunidad` int NOT NULL,
  `id_siasar_sistema`   int NOT NULL,
  PRIMARY KEY (`id_siasar_comunidad`, `id_siasar_sistema`),
  KEY `idx_scs_sistema` (`id_siasar_sistema`),
  CONSTRAINT `fk_scs_comunidad` FOREIGN KEY (`id_siasar_comunidad`) REFERENCES `siasar_comunidad` (`id_siasar`) ON DELETE CASCADE,
  CONSTRAINT `fk_scs_sistema`   FOREIGN KEY (`id_siasar_sistema`)   REFERENCES `siasar_sistema`   (`id_siasar`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE `reportes`
  ADD COLUMN `id_siasar_comunidad` int NULL AFTER `id_entidad`,
  ADD COLUMN `distancia_siasar_m`  int NULL AFTER `id_siasar_comunidad`,
  ADD KEY `idx_reportes_siasar` (`id_siasar_comunidad`),
  ADD CONSTRAINT `fk_reportes_siasar` FOREIGN KEY (`id_siasar_comunidad`) REFERENCES `siasar_comunidad` (`id_siasar`) ON DELETE SET NULL;

-- Limpieza de placeholders ficticios: estas dos filas de
-- infraestructura_hidrica llevaban fuente='SIASAR' desde la semilla de
-- desarrollo pero nunca vinieron de datos SIASAR reales -- ver
-- SIASAR_INTEGRATION_NOTES.md "Removed placeholder rows".
DELETE FROM `infraestructura_hidrica`
WHERE `fuente` = 'SIASAR'
  AND `nombre` IN ('Planta de Tratamiento Central', 'Pozo de Abastecimiento Sur');
