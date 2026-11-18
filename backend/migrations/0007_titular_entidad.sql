-- Migración 0007: distingue, dentro del rol ENTIDAD, a quién representa a
-- la entidad ("titular" -- la cuenta que Admin vincula directamente, ve
-- TODO el pool de reportes de su entidad y puede agregar/repartir trabajo
-- entre compañeros) de un trabajador normal (agregado por invitación,
-- ve solo lo que el titular -- o Admin -- le asigna a él específicamente,
-- no el pool completo, y no puede agregar ni asignar a otros).
--
-- Antes de esta migración, toda cuenta ENTIDAD era funcionalmente idéntica
-- -- cualquier trabajador podía ver el pool entero de la entidad y agregar
-- más trabajadores, lo cual no refleja cómo funciona una entidad real
-- (alguien la representa ante el sistema; el resto solo atiende lo suyo).
--
-- `invitaciones.es_titular` viaja con la invitación para que, al canjearse
-- (registro_con_invitacion en usuarios.py), la cuenta nueva nazca ya con el
-- valor correcto en `usuarios.es_titular_entidad` -- quien genera la
-- invitación decide de una vez si es para un titular o un trabajador, no
-- se infiere después.
--
-- Aplicada una sola vez por backend/migrations/run_migrations.py.

ALTER TABLE `usuarios`
  ADD COLUMN `es_titular_entidad` tinyint(1) NOT NULL DEFAULT 0;

ALTER TABLE `invitaciones`
  ADD COLUMN `es_titular` tinyint(1) NOT NULL DEFAULT 0;

-- Backfill: cualquier cuenta ENTIDAD que YA tenga id_entidad (vinculada
-- antes de que existiera esta distinción) se trata como titular -- es la
-- única forma en que llegó a tener acceso hasta ahora, así que degradarla
-- a "trabajador" de golpe le quitaría acceso que ya tenía sin que nadie lo
-- haya decidido explícitamente.
UPDATE `usuarios` SET `es_titular_entidad` = 1 WHERE `id_rol` = 2 AND `id_entidad` IS NOT NULL;
