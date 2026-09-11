# Migraciones

Este proyecto no tenía un mecanismo de migraciones antes de SIASAR: el único
esquema versionado era `backend/geovisor_backup_limpio.sql` (dump completo,
recreado desde cero en cada base nueva o de test). Esta carpeta se agrega
para poder aplicar cambios incrementales sobre una base **existente** (dev o
producción) sin recrearla. El dump sigue siendo la fuente de verdad para
bases nuevas — cada migración de aquí también se refleja ahí a mano.

## Orden de ejecución

Los archivos se aplican en orden numérico (`0001_...`, `0002_...`, ...).
`run_migrations.py` los aplica en ese orden y registra cada nombre de
archivo en la tabla `schema_migrations` para no reintentarlo.

- `0001_siasar_schema.sql` — tablas `siasar_comunidad`, `siasar_sistema`,
  `siasar_comunidad_sistema`; columnas `reportes.id_siasar_comunidad` y
  `reportes.distancia_siasar_m`; elimina las dos filas placeholder de
  `infraestructura_hidrica` con `fuente = 'SIASAR'`.

## Uso

Desde `backend/`, con el venv activado y `.env` apuntando a la base
correcta (nunca a una que no sea la tuya):

```bash
python migrations/run_migrations.py --dry-run   # ver qué falta aplicar
python migrations/run_migrations.py             # aplicarlo
```

Cada migración corre en su propia transacción (`BEGIN`/`COMMIT`, rollback
completo si cualquier sentencia falla) y se registra en
`schema_migrations` solo si terminó sin errores.

## Bases nuevas (dev limpio, test)

No corras estas migraciones ahí: `geovisor_backup_limpio.sql` ya incluye el
esquema final (SIASAR incluido), así que simplemente importar el dump deja
la base al día. `backend/tests/conftest.py` hace exactamente eso para la
base de test.
