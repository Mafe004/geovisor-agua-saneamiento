CREATE DATABASE IF NOT EXISTS `geovisor_agua_saneamiento`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE `geovisor_agua_saneamiento`;

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- ============================================================
-- CATÁLOGOS (tablas de referencia sin dependencias externas)
-- ============================================================

DROP TABLE IF EXISTS `categoria_incidente`;
CREATE TABLE `categoria_incidente` (
  `id_categoria` int NOT NULL AUTO_INCREMENT,
  `nombre`       varchar(80) NOT NULL,
  PRIMARY KEY (`id_categoria`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `categoria_incidente` VALUES
  (1,'AGUA'),
  (2,'ALCANTARILLADO'),
  (3,'CONTAMINACION');

-- ------------------------------------------------------------

DROP TABLE IF EXISTS `estado_cuenta`;
CREATE TABLE `estado_cuenta` (
  `id_estado_cuenta` int NOT NULL AUTO_INCREMENT,
  `nombre`           varchar(30)  NOT NULL,
  `descripcion`      varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id_estado_cuenta`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `estado_cuenta` VALUES
  (1,'ACTIVO',     'Cuenta habilitada y operativa'),
  (2,'INACTIVO',   'Cuenta deshabilitada temporalmente'),
  (3,'SUSPENDIDO', 'Cuenta suspendida por incumplimiento o revisión'),
  (4,'PENDIENTE',  'Cuenta en proceso de validación');

-- ------------------------------------------------------------

DROP TABLE IF EXISTS `estado_reporte`;
CREATE TABLE `estado_reporte` (
  `id_estado`   int NOT NULL AUTO_INCREMENT,
  `nombre`      varchar(30)  NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id_estado`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `estado_reporte` VALUES
  (1,'PENDIENTE',   'Reporte creado, esperando revisión'),
  (2,'EN_REVISION', 'Moderador validando o clasificando'),
  (3,'EN_PROCESO',  'Entidad atendiendo el incidente'),
  (4,'RESUELTO',    'Incidente solucionado y cerrado');

-- ------------------------------------------------------------

DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id_rol`      int NOT NULL AUTO_INCREMENT,
  `nombre`      varchar(50)  NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `created_at`  datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_rol`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `roles` VALUES
  (1,'CIUDADANO',     'Usuario ciudadano que reporta incidentes y consulta el mapa',           NOW()),
  (2,'ENTIDAD',       'Entidad institucional que gestiona reportes asignados y actualiza estados', NOW()),
  (3,'MODERADOR',     'Valida, clasifica y asigna reportes a entidades',                        NOW()),
  (4,'ADMINISTRADOR', 'Administra usuarios, entidades, reportes, auditoría y estadísticas',     NOW());

-- ------------------------------------------------------------

DROP TABLE IF EXISTS `severidad`;
CREATE TABLE `severidad` (
  `id_severidad` int NOT NULL AUTO_INCREMENT,
  `nombre`       varchar(30)  NOT NULL,
  `descripcion`  varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id_severidad`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `severidad` VALUES
  (1,'BAJA',  'Incidente menor sin riesgo inmediato'),
  (2,'MEDIA', 'Incidente que requiere atención pronta'),
  (3,'ALTA',  'Incidente crítico con riesgo alto o afectación grave');

-- ------------------------------------------------------------

DROP TABLE IF EXISTS `tipo_incidente`;
CREATE TABLE `tipo_incidente` (
  `id_tipo_incidente` int NOT NULL AUTO_INCREMENT,
  `id_categoria`      int NOT NULL,
  `nombre`            varchar(120) NOT NULL,
  `descripcion`       varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id_tipo_incidente`),
  UNIQUE KEY `uq_categoria_nombre` (`id_categoria`,`nombre`),
  CONSTRAINT `fk_tipo_categoria` FOREIGN KEY (`id_categoria`) REFERENCES `categoria_incidente` (`id_categoria`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `tipo_incidente` VALUES
  (1,1,'Fuga de agua',               'Escape visible de agua en vía, andén o instalación'),
  (2,1,'Baja presión',               'Disminución notable del caudal o presión'),
  (3,2,'Taponamiento',               'Obstrucción de alcantarillado o sumideros'),
  (4,2,'Rebose de aguas residuales', 'Salida de aguas residuales en vía pública'),
  (5,3,'Agua contaminada',           'Cambio de color/olor/sabor del agua'),
  (6,3,'Basuras en cuerpos de agua', 'Residuos sólidos afectando fuentes hídricas');

-- ============================================================
-- ACTORES
-- ============================================================

DROP TABLE IF EXISTS `entidades`;
CREATE TABLE `entidades` (
  `id_entidad`             int          NOT NULL AUTO_INCREMENT,
  `id_estado_cuenta`       int          NOT NULL,
  `nombre_entidad`         varchar(150) NOT NULL,
  `nit_rut`                varchar(30)  NOT NULL,
  `correo_institucional`   varchar(120) NOT NULL,
  `telefono`               varchar(20)  DEFAULT NULL,
  `direccion`              varchar(150) DEFAULT NULL,
  `funcionario_responsable` varchar(150) DEFAULT NULL,
  `documento_funcionario`  varchar(50)  DEFAULT NULL,
  `sitio_web`              varchar(200) DEFAULT NULL,
  `created_at`             datetime     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`             datetime     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_entidad`),
  UNIQUE KEY `nit_rut`              (`nit_rut`),
  UNIQUE KEY `correo_institucional` (`correo_institucional`),
  KEY `fk_entidad_estado`           (`id_estado_cuenta`),
  CONSTRAINT `fk_entidad_estado` FOREIGN KEY (`id_estado_cuenta`) REFERENCES `estado_cuenta` (`id_estado_cuenta`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `entidades` VALUES
  (1,1,'Empresa de Acueducto Municipal','900123456-7','contacto@acueducto.gov.co',
   '6011234567','Cundinamarca','Juan Perez','1020304050','https://acueducto.gov.co',
   NOW(), NOW());

-- ------------------------------------------------------------

DROP TABLE IF EXISTS `usuarios`;
CREATE TABLE `usuarios` (
  `id_usuario`       int          NOT NULL AUTO_INCREMENT,
  `id_rol`           int          NOT NULL,
  `id_estado_cuenta` int          NOT NULL,
  `id_entidad`       int          DEFAULT NULL,
  `nombre_completo`  varchar(150) NOT NULL,
  `correo`           varchar(120) NOT NULL,
  `password_hash`    varchar(255) NOT NULL,
  `fecha_nacimiento` date         DEFAULT NULL,
  `tipo_documento`   varchar(20)  DEFAULT NULL,
  `numero_documento` varchar(50)  DEFAULT NULL,
  `telefono`         varchar(20)  DEFAULT NULL,
  `pais`             varchar(80)  DEFAULT NULL,
  `ciudad`           varchar(80)  DEFAULT NULL,
  `direccion`        varchar(150) DEFAULT NULL,
  `created_at`       datetime     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       datetime     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_usuario`),
  UNIQUE KEY `correo`           (`correo`),
  UNIQUE KEY `numero_documento` (`numero_documento`),
  KEY `fk_usuario_rol`    (`id_rol`),
  KEY `fk_usuario_estado` (`id_estado_cuenta`),
  KEY `idx_usuarios_id_entidad` (`id_entidad`),
  CONSTRAINT `fk_usuario_rol`        FOREIGN KEY (`id_rol`)           REFERENCES `roles`        (`id_rol`),
  CONSTRAINT `fk_usuario_estado`     FOREIGN KEY (`id_estado_cuenta`) REFERENCES `estado_cuenta`(`id_estado_cuenta`),
  CONSTRAINT `fk_usuarios_entidades` FOREIGN KEY (`id_entidad`)       REFERENCES `entidades`    (`id_entidad`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Contraseña de todos los usuarios de prueba: demo2025
INSERT INTO `usuarios` VALUES
  (1,1,1,NULL,'Juan Pérez',              'juan@test.com',
   '$pbkdf2-sha256$29000$NMa4txbCGCNEaI2RklJKSQ$1o4DhRRmByc5HAQVvxO8jR1vbgjK3yA2fEXbLOrVyQM',
   NULL,'CC','123456789',NULL,NULL,NULL,NULL,NOW(),NOW()),

  (2,2,1,1,'Operador Entidad - Acueducto','operador.acueducto@demo.com',
   '$pbkdf2-sha256$29000$NMa4txbCGCNEaI2RklJKSQ$1o4DhRRmByc5HAQVvxO8jR1vbgjK3yA2fEXbLOrVyQM',
   NULL,'CC','900000001','3001112233','Colombia','Zipaquirá','Oficina principal',NOW(),NOW()),

  (3,3,1,NULL,'Moderador Prueba',         'moderador@demo.com',
   '$pbkdf2-sha256$29000$NMa4txbCGCNEaI2RklJKSQ$1o4DhRRmByc5HAQVvxO8jR1vbgjK3yA2fEXbLOrVyQM',
   NULL,'CC','900000002','3001112244','Colombia','Zipaquirá','Oficina moderación',NOW(),NOW()),

  (4,1,1,NULL,'Maria Test',              'maria.test@correo.com',
   '$pbkdf2-sha256$29000$NMa4txbCGCNEaI2RklJKSQ$1o4DhRRmByc5HAQVvxO8jR1vbgjK3yA2fEXbLOrVyQM',
   NULL,'CC','987654321','3009876543','Colombia','Zipaquirá',NULL,NOW(),NOW()),

  (5,4,1,NULL,'Admin Geovisor',           'admin@geovisor.com',
   '$pbkdf2-sha256$29000$NMa4txbCGCNEaI2RklJKSQ$1o4DhRRmByc5HAQVvxO8jR1vbgjK3yA2fEXbLOrVyQM',
   NULL,'CC','111111111',NULL,NULL,NULL,NULL,NOW(),NOW());

-- ============================================================
-- OPERACIÓN CENTRAL
-- ============================================================

DROP TABLE IF EXISTS `reportes`;
CREATE TABLE `reportes` (
  `id_reporte`        int          NOT NULL AUTO_INCREMENT,
  `id_usuario`        int          NOT NULL,
  `id_entidad`        int          DEFAULT NULL,
  `id_tipo_incidente` int          NOT NULL,
  `id_severidad`      int          NOT NULL,
  `id_estado`         int          NOT NULL,
  `descripcion`       text         NOT NULL,
  `direccion`         varchar(200) DEFAULT NULL,
  `latitud`           decimal(10,7) NOT NULL,
  `longitud`          decimal(10,7) NOT NULL,
  `imagen_url`        varchar(300) DEFAULT NULL,
  `fuente_reporte`    enum('CIUDADANO','ENTIDAD') DEFAULT 'CIUDADANO',
  `fecha_reporte`     datetime     DEFAULT CURRENT_TIMESTAMP,
  `created_at`        datetime     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        datetime     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_reporte`),
  KEY `fk_reportes_entidad`   (`id_entidad`),
  KEY `fk_reportes_tipo`      (`id_tipo_incidente`),
  KEY `fk_reportes_severidad` (`id_severidad`),
  KEY `idx_reportes_usuario`  (`id_usuario`),
  KEY `idx_reportes_estado`   (`id_estado`),
  CONSTRAINT `fk_reportes_usuario`   FOREIGN KEY (`id_usuario`)        REFERENCES `usuarios`      (`id_usuario`),
  CONSTRAINT `fk_reportes_entidad`   FOREIGN KEY (`id_entidad`)        REFERENCES `entidades`     (`id_entidad`),
  CONSTRAINT `fk_reportes_tipo`      FOREIGN KEY (`id_tipo_incidente`) REFERENCES `tipo_incidente`(`id_tipo_incidente`),
  CONSTRAINT `fk_reportes_severidad` FOREIGN KEY (`id_severidad`)      REFERENCES `severidad`     (`id_severidad`),
  CONSTRAINT `fk_reportes_estado`    FOREIGN KEY (`id_estado`)         REFERENCES `estado_reporte`(`id_estado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Solo reportes válidos con coordenadas reales (Zipaquirá, Cundinamarca)
INSERT INTO `reportes` VALUES
  (1,1,1,1,1,1,
   'Fuga de agua constante en la vía principal',
   'Calle 10 # 5-20, Zipaquirá',
   5.0222000,-74.0048000,NULL,'CIUDADANO',NOW(),NOW(),NOW()),

  (2,1,1,1,3,4,
   'Fuga de agua en la vía principal (reporte resuelto)',
   'Calle 10 # 5-20, Zipaquirá',
   5.0220000,-74.0040000,NULL,'CIUDADANO',NOW(),NOW(),NOW()),

  (3,4,NULL,3,2,1,
   'Taponamiento del alcantarillado frente al parque central',
   'Carrera 7 # 3-15, Zipaquirá',
   5.0231000,-74.0062000,NULL,'CIUDADANO',NOW(),NOW(),NOW()),

  (4,4,NULL,5,3,2,
   'El agua que sale del grifo tiene color amarillento y mal olor',
   'Barrio Centro, Zipaquirá',
   5.0215000,-74.0055000,NULL,'CIUDADANO',NOW(),NOW(),NOW()),

  (5,1,NULL,2,1,1,
   'La presión del agua ha bajado mucho en los últimos días',
   'Calle 5 # 8-30, Zipaquirá',
   5.0240000,-74.0030000,NULL,'CIUDADANO',NOW(),NOW(),NOW());

-- ============================================================
-- SOPORTE / TRAZABILIDAD
-- ============================================================

DROP TABLE IF EXISTS `historial_reportes`;
CREATE TABLE `historial_reportes` (
  `id_historial`      int          NOT NULL AUTO_INCREMENT,
  `id_reporte`        int          NOT NULL,
  `estado_anterior`   varchar(50)  NOT NULL,
  `estado_nuevo`      varchar(50)  NOT NULL,
  `comentario`        varchar(255) DEFAULT NULL,
  `id_usuario_accion` int          NOT NULL,
  `fecha_cambio`      datetime     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_historial`),
  KEY `fk_historial_usuario`   (`id_usuario_accion`),
  KEY `idx_historial_reporte`  (`id_reporte`),
  CONSTRAINT `fk_historial_reporte`  FOREIGN KEY (`id_reporte`)        REFERENCES `reportes` (`id_reporte`),
  CONSTRAINT `fk_historial_usuario`  FOREIGN KEY (`id_usuario_accion`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `historial_reportes` VALUES
  (1,1,'NINGUNO',     'PENDIENTE',   'Reporte creado por el usuario',                     1,NOW()),
  (2,2,'NINGUNO',     'PENDIENTE',   'Reporte creado por el usuario',                     1,NOW()),
  (3,2,'PENDIENTE',   'EN_REVISION', 'Reporte validado por moderador',                    3,NOW()),
  (4,2,'EN_REVISION', 'EN_PROCESO',  'Iniciamos atención del reporte',                    2,NOW()),
  (5,2,'EN_PROCESO',  'RESUELTO',    'Reporte solucionado: se reparó la fuga',            2,NOW()),
  (6,3,'NINGUNO',     'PENDIENTE',   'Reporte creado por el usuario',                     4,NOW()),
  (7,4,'NINGUNO',     'PENDIENTE',   'Reporte creado por el usuario',                     4,NOW()),
  (8,4,'PENDIENTE',   'EN_REVISION', 'Clasificación y asignación a Acueducto Municipal',  3,NOW()),
  (9,5,'NINGUNO',     'PENDIENTE',   'Reporte creado por el usuario',                     1,NOW());

-- ------------------------------------------------------------

DROP TABLE IF EXISTS `notificaciones`;
CREATE TABLE `notificaciones` (
  `id_notificacion`   int          NOT NULL AUTO_INCREMENT,
  `id_usuario`        int          NOT NULL,
  `id_reporte`        int          DEFAULT NULL,
  `tipo_notificacion` varchar(50)  NOT NULL,
  `mensaje`           varchar(255) NOT NULL,
  `leida`             tinyint(1)   DEFAULT '0',
  `fecha_envio`       datetime     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_notificacion`),
  KEY `fk_notif_reporte`            (`id_reporte`),
  KEY `idx_notificaciones_usuario`  (`id_usuario`),
  CONSTRAINT `fk_notif_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`),
  CONSTRAINT `fk_notif_reporte` FOREIGN KEY (`id_reporte`) REFERENCES `reportes` (`id_reporte`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `notificaciones` VALUES
  (1,1,1,'REPORTE_CREADO', 'Tu reporte fue creado exitosamente y está en estado PENDIENTE',0,NOW()),
  (2,1,2,'REPORTE_CREADO', 'Tu reporte fue creado exitosamente y está en estado PENDIENTE',1,NOW()),
  (3,1,2,'CAMBIO_ESTADO',  'Tu reporte cambió a EN_REVISION',                             1,NOW()),
  (4,1,2,'CAMBIO_ESTADO',  'Tu reporte cambió a EN_PROCESO',                              1,NOW()),
  (5,1,2,'CAMBIO_ESTADO',  'Tu reporte cambió a RESUELTO',                                1,NOW()),
  (6,4,3,'REPORTE_CREADO', 'Tu reporte fue creado exitosamente y está en estado PENDIENTE',0,NOW()),
  (7,4,4,'REPORTE_CREADO', 'Tu reporte fue creado exitosamente y está en estado PENDIENTE',0,NOW()),
  (8,4,4,'CAMBIO_ESTADO',  'Tu reporte cambió a EN_REVISION',                             0,NOW()),
  (9,1,5,'REPORTE_CREADO', 'Tu reporte fue creado exitosamente y está en estado PENDIENTE',0,NOW());

-- ------------------------------------------------------------

DROP TABLE IF EXISTS `logs_auditoria`;
CREATE TABLE `logs_auditoria` (
  `id_log`       int          NOT NULL AUTO_INCREMENT,
  `id_usuario`   int          DEFAULT NULL,
  `accion`       varchar(100) NOT NULL,
  `modulo`       varchar(100) NOT NULL,
  `fecha_accion` datetime     DEFAULT CURRENT_TIMESTAMP,
  `ip_origen`    varchar(45)  DEFAULT NULL,
  PRIMARY KEY (`id_log`),
  KEY `fk_log_usuario` (`id_usuario`),
  CONSTRAINT `fk_log_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `logs_auditoria` VALUES
  (1,1,'LOGIN',          'AUTH',     NOW(),'127.0.0.1'),
  (2,1,'CREAR_REPORTE',  'REPORTES', NOW(),'127.0.0.1'),
  (3,5,'LISTAR_USUARIOS','USUARIOS', NOW(),'127.0.0.1'),
  (4,3,'CAMBIAR_ESTADO', 'REPORTES', NOW(),'127.0.0.1'),
  (5,5,'LOGIN',          'AUTH',     NOW(),'127.0.0.1');

-- ------------------------------------------------------------

DROP TABLE IF EXISTS `recuperacion_contrasena`;
CREATE TABLE `recuperacion_contrasena` (
  `id_recuperacion` int          NOT NULL AUTO_INCREMENT,
  `id_usuario`      int          NOT NULL,
  `token`           varchar(255) NOT NULL,
  `fecha_expiracion` datetime    NOT NULL,
  `usado`           tinyint(1)   DEFAULT '0',
  PRIMARY KEY (`id_recuperacion`),
  UNIQUE KEY `token` (`token`),
  KEY `fk_recup_usuario` (`id_usuario`),
  CONSTRAINT `fk_recup_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ------------------------------------------------------------

DROP TABLE IF EXISTS `infraestructura_hidrica`;
CREATE TABLE `infraestructura_hidrica` (
  `id_infraestructura` int           NOT NULL AUTO_INCREMENT,
  `nombre`             varchar(120)  NOT NULL,
  `tipo`               varchar(80)   NOT NULL,
  `latitud`            decimal(10,7) NOT NULL,
  `longitud`           decimal(10,7) NOT NULL,
  `fuente`             varchar(200)  DEFAULT NULL,
  `estado`             varchar(40)   DEFAULT NULL,
  `fecha_actualizacion` datetime     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_infraestructura`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `infraestructura_hidrica` VALUES
  (1,'Planta de Tratamiento Central',       'PTAR',          5.0222000,-74.0048000,'SIASAR',    'ACTIVA',NOW()),
  (2,'Acueducto Norte Zipaquirá',           'ACUEDUCTO',     5.0280000,-74.0100000,'CAR',       'ACTIVA',NOW()),
  (3,'Embalse del Neusa',                   'EMBALSE',       5.1200000,-73.9800000,'CAR',       'ACTIVA',NOW()),
  (4,'Pozo de Abastecimiento Sur',          'POZO',          5.0150000,-74.0200000,'SIASAR',    'ACTIVA',NOW()),
  (5,'Red Alcantarillado Centro',           'ALCANTARILLADO',5.0231000,-74.0062000,'Municipio', 'ACTIVA',NOW());

-- ============================================================
-- VISTA: reportes completos (útil para el mapa)
-- ============================================================

DROP VIEW IF EXISTS `vw_reportes_completos`;
CREATE VIEW `vw_reportes_completos` AS
  SELECT
    r.id_reporte,
    u.nombre_completo  AS ciudadano,
    e.nombre_entidad   AS nombre_entidad,
    ti.nombre          AS tipo_incidente,
    s.nombre           AS severidad,
    er.nombre          AS estado,
    r.descripcion,
    r.direccion,
    r.latitud,
    r.longitud,
    r.imagen_url,
    r.fuente_reporte,
    r.fecha_reporte
  FROM reportes r
  JOIN usuarios       u  ON r.id_usuario        = u.id_usuario
  LEFT JOIN entidades e  ON r.id_entidad         = e.id_entidad
  JOIN tipo_incidente ti ON r.id_tipo_incidente  = ti.id_tipo_incidente
  JOIN severidad      s  ON r.id_severidad       = s.id_severidad
  JOIN estado_reporte er ON r.id_estado          = er.id_estado;

-- ============================================================
-- STORED PROCEDURE: cambiar estado de reporte (transacción)
-- ============================================================

DROP PROCEDURE IF EXISTS `sp_cambiar_estado_reporte`;
DELIMITER ;;
CREATE PROCEDURE `sp_cambiar_estado_reporte`(
    IN p_id_reporte  INT,
    IN p_nuevo_estado INT,
    IN p_id_usuario  INT,
    IN p_comentario  VARCHAR(255)
)
BEGIN
    DECLARE v_estado_anterior    VARCHAR(50);
    DECLARE v_nombre_estado_nuevo VARCHAR(50);

    SELECT er.nombre INTO v_estado_anterior
    FROM reportes r
    JOIN estado_reporte er ON r.id_estado = er.id_estado
    WHERE r.id_reporte = p_id_reporte;

    SELECT nombre INTO v_nombre_estado_nuevo
    FROM estado_reporte WHERE id_estado = p_nuevo_estado;

    UPDATE reportes SET id_estado = p_nuevo_estado WHERE id_reporte = p_id_reporte;

    INSERT INTO historial_reportes
        (id_reporte, estado_anterior, estado_nuevo, comentario, id_usuario_accion, fecha_cambio)
    VALUES (p_id_reporte, v_estado_anterior, v_nombre_estado_nuevo, p_comentario, p_id_usuario, NOW());

    INSERT INTO notificaciones (id_usuario, id_reporte, tipo_notificacion, mensaje, leida, fecha_envio)
    SELECT r.id_usuario, r.id_reporte, 'CAMBIO_ESTADO',
           CONCAT('Tu reporte cambió a ', v_nombre_estado_nuevo), 0, NOW()
    FROM reportes r WHERE r.id_reporte = p_id_reporte;
END ;;
DELIMITER ;

-- ============================================================
-- RESTAURAR CONFIGURACIÓN ORIGINAL
-- ============================================================

/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump generado y limpiado: geovisor_backup_limpio.sql
-- Contraseña usuarios de prueba: demo2025
-- Coordenadas: región Zipaquirá, Cundinamarca, Colombia
