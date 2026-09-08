# 💧 GeoVisor API — Backend

API REST del sistema GeoVisor de Agua y Saneamiento de Zipaquirá, Cundinamarca.  
Construida con **FastAPI + MySQL**, autenticación por **JWT** y control de acceso por roles.

> 🎓 Proyecto de Tesis de Grado — 2025

---

## 🏗️ ¿Por qué Monolito Modular?

Esta API usa una arquitectura **Monolítica Modular por Capas**. Cada dominio de negocio vive en su propio router, completamente aislado, pero todos comparten el mismo proceso y base de datos.

| Criterio | Monolito Modular ✅ | Microservicios ❌ |
|---|---|---|
| Equipo | 1–2 personas (tesis) | Requiere equipo DevOps |
| Complejidad de despliegue | Un servidor, un comando | Contenedores, orquestación, API Gateway |
| Latencia entre módulos | 0 (misma memoria) | Red entre servicios |
| Debug y logs | Centralizados | Distribuidos y difíciles de trazar |
| Escalabilidad | Suficiente para un municipio | Necesaria para millones de usuarios |
| Migración futura | Fácil: cada router se extrae como servicio | — |

---

## 📁 Estructura del proyecto

```
backend/
├── main.py                        ← Entrada: monta FastAPI, CORS y registra todos los routers
├── requirements.txt               ← Dependencias Python
├── tools_hash.py                  ← CLI para generar hashes PBKDF2 de contraseñas
├── .env.example                   ← Plantilla de variables de entorno (nunca subir .env real)
├── geovisor_backup_limpio.sql     ← Dump SQL de la base de datos
└── app/
    ├── core/
    │   ├── security.py            ← JWT (crear/decodificar) + hashing PBKDF2 de contraseñas
    │   └── deps.py                ← Dependencias FastAPI: get_current_user, require_roles()
    ├── db/
    │   └── database.py            ← get_connection() → conexión de un pool (DBUtils), DictCursor
    └── routers/                   ← Un archivo por dominio de negocio
        ├── auth.py                ← POST /auth/login, GET /auth/me
        ├── usuarios.py            ← Registro, perfil, cambio de contraseña, gestión admin
        ├── entidades.py           ← CRUD de entidades prestadoras del servicio
        ├── reportes.py            ← CRUD reportes + cambio de estado + mapa + estadísticas
        ├── catalogos.py           ← Tablas de referencia (estados, tipos, severidades)
        ├── historial.py           ← Historial de cambios de estado por reporte
        ├── notificaciones.py      ← Notificaciones in-app por usuario
        ├── infraestructura.py     ← Puntos GIS de infraestructura hídrica
        └── auditoria.py           ← Logs de auditoría del sistema (solo ADMIN)
```

---

## ⚙️ Stack tecnológico

| Tecnología | Versión | Rol |
|---|---|---|
| **Python** | 3.11+ | Lenguaje base |
| **FastAPI** | 0.128 | Framework HTTP, validación automática, docs Swagger |
| **Uvicorn** | 0.40 | Servidor ASGI |
| **PyMySQL** | 1.1 | Driver MySQL (conexión directa, sin ORM) |
| **DBUtils** | 3.2 | Pool de conexiones sobre PyMySQL (`PooledDB`) |
| **Pydantic v2** | 2.12 | Modelos de entrada y salida con validación |
| **python-jose** | 3.5 | Generación y validación de JWT (HS256) |
| **Passlib + PBKDF2** | 1.7 | Hashing seguro de contraseñas |
| **python-dotenv** | 1.2 | Variables de entorno desde `.env` |
| **MySQL** | 8.x | Base de datos relacional |

---

## 🔐 Autenticación y roles

### Flujo JWT
1. `POST /auth/login` → el servidor valida credenciales y devuelve un `access_token`
2. El cliente adjunta `Authorization: Bearer <token>` en cada request protegido
3. `deps.py → get_current_user()` decodifica el token, consulta la BD e inyecta el usuario

### Roles

| ID | Rol | Qué puede hacer |
|---|---|---|
| 1 | **CIUDADANO** | Crear reportes, ver sus reportes, recibir notificaciones |
| 2 | **ENTIDAD** | Ver y gestionar reportes asignados a su entidad |
| 3 | **MODERADOR** | Todos los reportes, gestionar infraestructura hídrica |
| 4 | **ADMINISTRADOR** | Acceso total: usuarios, entidades, auditoría |

### Estados de cuenta

| ID | Estado | Descripción |
|---|---|---|
| 1 | ACTIVO | Puede iniciar sesión |
| 2 | INACTIVO | Acceso bloqueado |
| 3 | SUSPENDIDO | Sanción temporal |
| 4 | PENDIENTE | Recién registrado — espera activación del Admin |

---

## 📡 Endpoints

### 🔓 Públicos (sin token)

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/auth/login` | Iniciar sesión, obtener JWT |
| `POST` | `/usuarios/registro` | Registro de nuevo ciudadano |
| `POST` | `/usuarios/solicitar-recuperacion` | Solicitar token de recuperación de contraseña |
| `POST` | `/usuarios/restablecer-contrasena` | Restablecer contraseña con token |
| `GET` | `/health` | Estado del servidor |
| `GET` | `/db-test` | Test de conexión a base de datos |

### 🔒 Autenticados (requieren JWT)

| Método | Ruta | Roles |
|---|---|---|
| `GET` | `/auth/me` | Todos |
| `GET` | `/reportes/` | Todos (filtrado por rol automáticamente) |
| `POST` | `/reportes/` | Ciudadano, Entidad |
| `GET` | `/reportes/{id}` | Todos (según pertenencia) |
| `PUT` | `/reportes/{id}/estado` | Entidad, Moderador, Admin |
| `GET` | `/reportes/mapa` | Todos |
| `GET` | `/reportes/estadisticas` | Todos |
| `GET` | `/reportes/{id}/historial` | Todos (según pertenencia) |
| `GET` | `/notificaciones/` | Todos |
| `PUT` | `/notificaciones/{id}/leer` | Todos |
| `PUT` | `/notificaciones/marcar-todas-leidas` | Todos |
| `GET` | `/infraestructura/` | Todos |
| `POST` | `/infraestructura/` | Moderador, Admin |
| `PUT` | `/infraestructura/{id}` | Moderador, Admin |
| `GET` | `/entidades/` | Todos |
| `POST` | `/entidades/` | Admin |
| `PUT` | `/entidades/{id}` | Admin |
| `GET` | `/catalogos/estado-reporte` | Todos |
| `GET` | `/catalogos/tipo-incidente` | Todos |
| `GET` | `/catalogos/severidad` | Todos |
| `GET` | `/usuarios/perfil` | Todos |
| `PUT` | `/usuarios/perfil` | Todos |
| `PUT` | `/usuarios/perfil/password` | Todos |
| `GET` | `/usuarios/` | Solo Admin |
| `GET` | `/usuarios/pendientes` | Solo Admin |
| `PUT` | `/usuarios/{id}/estado` | Solo Admin |
| `GET` | `/auditoria/` | Solo Admin |

---

## 🚀 Instalación y ejecución

### 1. Requisitos previos
- Python 3.11 o superior
- MySQL 8.x corriendo localmente o en servidor
- Base de datos `geovisor_agua_saneamiento` creada (usar el `.sql` incluido)

### 2. Clonar la rama y preparar entorno virtual

```bash
# Clonar solo la rama backend
git clone -b backend https://github.com/tu-usuario/tu-repo.git geovisor-backend
cd geovisor-backend

# Crear entorno virtual
python -m venv .venv

# Activar
# Windows:
.venv\Scripts\activate
# Linux / macOS:
source .venv/bin/activate
```

### 3. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 4. Configurar variables de entorno

```bash
cp .env.example .env
# Edita .env con tus datos reales de BD y la SECRET_KEY
```

Contenido mínimo del `.env`:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=geovisor_agua_saneamiento
DB_POOL_SIZE=10

SECRET_KEY=genera-una-clave-larga-y-aleatoria-de-al-menos-32-caracteres
ACCESS_TOKEN_EXPIRE_MINUTES=60

CORS_ORIGINS=http://localhost:8081,http://localhost:19006
LOG_LEVEL=INFO
```

> Genera una clave segura con:
> ```bash
> python -c "import secrets; print(secrets.token_hex(32))"
> ```

> ⚠️ **`SECRET_KEY` es obligatoria.** Si falta o tiene menos de 32
> caracteres, la aplicación se niega a arrancar (`RuntimeError` al importar
> `app/core/security.py`) en vez de arrancar con una clave insegura por
> defecto. `ALGORITHM` ya no es configurable por entorno: está fijo en
> `HS256` en el código para que un valor externo no pueda debilitar la
> verificación del token.

> ⚠️ **`TRUST_PROXY`** controla de dónde sale la IP que se guarda en
> `logs_auditoria` (`app/core/deps.py:get_client_ip`). Por defecto (`false`)
> se usa `request.client.host`, la IP real de la conexión TCP. Si pones
> `TRUST_PROXY=true`, se usa la cabecera `X-Forwarded-For` en su lugar —
> hazlo **solo** si el backend está detrás de un proxy/load balancer de
> confianza que la setea de forma fiable, porque esa cabecera la controla
> el cliente y es falsificable: sin un proxy de por medio, cualquiera puede
> mandar `X-Forwarded-For: lo-que-quiera` y aparecer así en el log.

> ⚠️ **`DB_POOL_SIZE`** (default `10`) es el tope de conexiones que
> `app/db/database.py` mantiene abiertas hacia MySQL a la vez, vía un pool
> de `DBUtils` — antes de esto, cada request abría su propia conexión
> nueva (TCP connect + auth handshake de MySQL) y la cerraba al terminar.
> **Debe quedar por debajo de `max_connections` en el servidor MySQL**
> (151 por defecto). Si `uvicorn` corre con varios procesos worker, cada
> uno abre su propio pool — lo que hay que comparar contra el límite del
> servidor es `workers × DB_POOL_SIZE`, no este número solo.

### 5. Crear la base de datos

```bash
mysql -u root -p < geovisor_backup_limpio.sql
```

### 6. Ejecutar el servidor

```bash
# Desarrollo (recarga automática al guardar)
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Producción
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 7. Verificar

```bash
curl http://localhost:8000/health
# → {"status": "ok"}
```

📖 Documentación interactiva (Swagger): `http://localhost:8000/docs`

---

## 🧪 Suite de tests

```bash
pip install -r requirements-dev.txt   # incluye pytest, pytest-cov, httpx, ruff
pytest                                 # corre toda la suite
pytest --cov=app --cov-report=term-missing   # con reporte de cobertura
pytest -m "not integration"            # solo tests unitarios puros (sin BD)
```

**No corren contra tu base de datos de desarrollo.** `tests/conftest.py`
crea y destruye una base separada, `geovisor_test`, en el mismo servidor
MySQL configurado en tu `.env` — recreándola desde
`geovisor_backup_limpio.sql` una vez por sesión de test, y truncando +
resembrando esas mismas tablas antes de **cada** test individual, así que
el orden de ejecución nunca importa y no hace falta ningún reset manual
entre corridas.

Un guard en `conftest.py` aborta la sesión completa si `DB_NAME` no termina
en `_test` — es la única protección real contra apuntar por error la suite
(que es destructiva: TRUNCATE de todas las tablas) a la base real.

La config de test vive en `tests/.env.test` (se commitea — no tiene nada
sensible): fija `DB_NAME=geovisor_test` y un `SECRET_KEY` determinista para
que los tokens de los tests sean reproducibles. `DB_HOST`/`DB_PORT`/
`DB_USER`/`DB_PASSWORD` se toman de tu `backend/.env` real (mismo servidor,
otra base) — no hace falta duplicarlos.

Los fixtures `client_ciudadano` / `client_entidad` / `client_moderador` /
`client_admin` hacen un `POST /auth/login` real con la contraseña
`demo2025` contra los usuarios semilla del dump — el hash semilla original
no corresponde en realidad a esa contraseña (es un placeholder), así que
`conftest.py` lo sobreescribe con un hash real de `demo2025` solo dentro de
`geovisor_test`, nunca en el dump ni en tu base de desarrollo.

Requiere un servidor MySQL accesible con las credenciales de tu `.env`
(por ejemplo, el mismo que ya usas para desarrollo) — no se necesita
Docker para correrla en local, solo en CI (ver `.github/workflows/ci.yml`).

---

## 🛠️ Herramienta: generar hash de contraseña

Si necesitas actualizar manualmente el `password_hash` de un usuario en la BD:

```bash
python tools_hash.py
# Imprime el hash PBKDF2 de "123456"
```

---

## 🗄️ Tablas principales de la base de datos

| Tabla | Descripción |
|---|---|
| `usuarios` | Cuentas con roles y estados |
| `roles` | CIUDADANO · ENTIDAD · MODERADOR · ADMINISTRADOR |
| `estado_cuenta` | ACTIVO · INACTIVO · SUSPENDIDO · PENDIENTE |
| `entidades` | Empresas/entidades prestadoras del servicio |
| `reportes` | Incidentes reportados por ciudadanos o entidades |
| `estado_reporte` | PENDIENTE · EN_PROCESO · RESUELTO · RECHAZADO |
| `tipo_incidente` | Catálogo de tipos de falla hídrica |
| `severidad` | BAJA · MEDIA · ALTA · CRITICA |
| `historial_reportes` | Bitácora de cada cambio de estado de un reporte |
| `notificaciones` | Alertas in-app para cada usuario |
| `infraestructura_hidrica` | Puntos GIS (PTAR, acueductos, pozos, embalses) |
| `logs_auditoria` | Registro de acciones administrativas |
| `recuperacion_contrasena` | Tokens temporales para reset de contraseña |

> ⚠️ **Sin stored procedures para lógica de negocio, a propósito.** El dump
> tenía un `sp_cambiar_estado_reporte` que duplicaba en SQL lo que hace
> `reportes.cambiar_estado()` (UPDATE + 2 INSERT) — nada lo llamaba, y se
> eliminó. La razón para no tener uno: esa operación requiere autorizar
> según el rol y la identidad del JWT del llamador (dueño del reporte /
> entidad asignada / MODERADOR / ADMIN), algo que la base de datos no
> puede ver. La lógica de negocio con reglas de autorización vive en la
> capa de aplicación (Python), nunca en SQL — un procedimiento almacenado
> aquí sería, en el mejor caso, código que se desincroniza en silencio de
> su equivalente en Python, y en el peor, una vía para saltarse los
> controles de acceso.
>
> La vista `vw_reportes_completos` sigue en el dump pero **tampoco la usa
> ningún código actual** (se verificó con grep) — a diferencia del
> procedimiento, no se eliminó en esta pasada porque una vista es más
> probable que la esté usando una consulta manual o una herramienta de
> reporting fuera de este repo; queda señalada aquí para que alguien con
> ese contexto decida si también se puede quitar.

---

*Municipio de Zipaquirá · Cundinamarca · Colombia · Tesis 2025*
