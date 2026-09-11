"""
Aplica las migraciones SQL numeradas en backend/migrations/ una sola vez
cada una, contra la base de datos configurada por las variables de entorno
DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME (mismas que usa el resto del
backend, ver .env.example).

No reemplaza geovisor_backup_limpio.sql como fuente de verdad para bases
nuevas/de test (eso lo sigue creando conftest.py ejecutando el dump
completo, que ya incluye este mismo esquema) -- este runner es para aplicar
el cambio incremental sobre una base de datos EXISTENTE (dev o producción)
sin tener que recrearla desde cero.

Uso (desde backend/, con el venv activado):
    python migrations/run_migrations.py            # aplica lo pendiente
    python migrations/run_migrations.py --dry-run  # solo lista lo pendiente
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import pymysql
from dotenv import load_dotenv

MIGRATIONS_DIR = Path(__file__).parent


def _split_statements(sql_text: str) -> list[str]:
    """Separa un archivo .sql en sentencias ejecutables una por una.

    Igual de simple que tests/conftest.py._split_statements: sin soporte
    para DELIMITER ni procedimientos (este proyecto no los usa), solo
    partir por ';' descartando líneas de comentario '--' y vacías.
    """
    text = "\n".join(
        line for line in sql_text.splitlines() if not line.strip().startswith("--")
    )
    return [stmt.strip() for stmt in text.split(";") if stmt.strip()]


def _connect():
    load_dotenv(Path(__file__).parent.parent / ".env")
    return pymysql.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        port=int(os.environ.get("DB_PORT", 3306)),
        user=os.environ.get("DB_USER", "root"),
        password=os.environ.get("DB_PASSWORD", ""),
        database=os.environ.get("DB_NAME", "geovisor_agua_saneamiento"),
        autocommit=False,
        cursorclass=pymysql.cursors.DictCursor,
    )


def _ensure_tracking_table(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS `schema_migrations` (
                `filename`   varchar(200) NOT NULL,
                `applied_at` datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`filename`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
            """
        )
    conn.commit()


def _applied(conn) -> set[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT filename FROM schema_migrations;")
        return {row["filename"] for row in cur.fetchall()}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Solo lista lo pendiente")
    args = parser.parse_args()

    pending_files = sorted(MIGRATIONS_DIR.glob("[0-9]*.sql"))
    if not pending_files:
        print("No hay archivos de migración en", MIGRATIONS_DIR)
        return 0

    conn = _connect()
    try:
        _ensure_tracking_table(conn)
        already_applied = _applied(conn)

        to_apply = [f for f in pending_files if f.name not in already_applied]
        if not to_apply:
            print("Nada pendiente: todas las migraciones ya se aplicaron.")
            return 0

        print(f"Pendientes ({len(to_apply)}):", ", ".join(f.name for f in to_apply))
        if args.dry_run:
            return 0

        for f in to_apply:
            print(f"Aplicando {f.name}...")
            statements = _split_statements(f.read_text(encoding="utf-8"))
            try:
                with conn.cursor() as cur:
                    for stmt in statements:
                        cur.execute(stmt)
                    cur.execute(
                        "INSERT INTO schema_migrations (filename) VALUES (%s);", (f.name,)
                    )
                conn.commit()
            except Exception:
                conn.rollback()
                print(f"FALLÓ {f.name} -- se revirtió, no se aplican las siguientes.")
                raise
            print(f"  OK {f.name}")

        print("Listo.")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
