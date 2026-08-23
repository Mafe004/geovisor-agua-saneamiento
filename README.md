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
    │   └── database.py            ← get_connection() → PyMySQL con DictCursor
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

SECRET_KEY=genera-una-clave-larga-y-aleatoria
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

> Genera una clave segura con:
> ```bash
> python -c "import secrets; print(secrets.token_hex(32))"
> ```

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

---

*Municipio de Zipaquirá · Cundinamarca · Colombia · Tesis 2025*
