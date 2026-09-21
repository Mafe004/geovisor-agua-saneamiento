-- Migración 0003: columna `cargo` en usuarios -- cargo/puesto de la persona
-- dentro de su entidad (ej. "Ingeniero de Saneamiento"). Opcional y
-- relevante sobre todo para rol ENTIDAD (registro_con_invitacion,
-- backend/app/routers/usuarios.py), pero se deja disponible para
-- cualquier usuario en vez de restringirla a nivel de columna -- la regla
-- de "solo tiene sentido para Entidad" es de negocio, no de esquema.
--
-- Aplicada una sola vez por backend/migrations/run_migrations.py. Si se
-- ejecuta a mano contra una base ya migrada, el ALTER fallará con
-- "duplicate column name": es la señal correcta de que ya corrió.

ALTER TABLE `usuarios` ADD COLUMN `cargo` varchar(120) NULL AFTER `nombre_completo`;
