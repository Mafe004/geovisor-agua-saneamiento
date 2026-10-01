# 💧 GeoVisor — Agua y Saneamiento · Cundinamarca

Sistema de gestión y visualización geoespacial de reportes de agua potable y saneamiento básico del municipio de Zipaquirá, Cundinamarca.

> 🎓 Proyecto de Tesis de Grado — 2026

---

## 🌿 Ramas del repositorio

| Rama | Contiene | Descripción |
|---|---|---|
| `main` | Documentación general | Vista general del proyecto, sin código de producción |
| `backend` | API FastAPI + MySQL | Servidor REST completo con autenticación JWT y control por roles |
| `frontend` | App React Native + Expo | Aplicación móvil con pantallas por rol y mapa interactivo |

---

## 🏗️ Arquitectura general

```
┌─────────────────────────────────────────────┐
│           📱 App Móvil (frontend)            │
│       React Native + Expo + Axios            │
│  iOS / Android  ←→  Expo Go en desarrollo    │
└────────────────────┬────────────────────────┘
                     │  HTTP REST + JWT
                     │  (misma red WiFi en dev)
┌────────────────────▼────────────────────────┐
│          💧 API REST (backend)               │
│         FastAPI + Uvicorn (Python)           │
│   /auth  /reportes  /usuarios  /entidades   │
│   /infraestructura  /notificaciones  /audit  │
└────────────────────┬────────────────────────┘
                     │  PyMySQL
┌────────────────────▼────────────────────────┐
│           🗄️ Base de datos                   │
│              MySQL 8.x                       │
│  usuarios · reportes · entidades · GIS...    │
└─────────────────────────────────────────────┘
```

### ¿Por qué esta arquitectura?

Se eligió un **Monolito Modular** para el backend y una **app móvil feature-based por roles** para el frontend porque:

- El equipo es de 1–2 personas (proyecto de tesis)
- El contexto es un municipio, no millones de usuarios
- El despliegue es simple: un servidor, un comando
- Cada módulo está bien aislado → fácil de escalar a microservicios si el proyecto crece

---

## 🔐 Roles del sistema

| ID | Rol | Descripción |
|---|---|---|
| 1 | **CIUDADANO** | Crea y hace seguimiento de sus reportes |
| 2 | **ENTIDAD** | Gestiona reportes asignados a su organización |
| 3 | **MODERADOR** | Supervisa todos los reportes y la infraestructura hídrica |
| 4 | **ADMINISTRADOR** | Control total: usuarios, entidades, auditoría |

---

## 🚀 Inicio rápido

### Backend (Python/FastAPI)

```bash
git clone -b backend https://github.com/tu-usuario/tu-repo.git geovisor-backend
cd geovisor-backend
python -m venv .venv && source .venv/bin/activate  # o .venv\Scripts\activate en Windows
pip install -r requirements.txt
cp .env.example .env   # edita con tus datos de BD
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

📖 Docs completas → [`backend` branch README](../../tree/backend#readme)

### Frontend (React Native/Expo)

```bash
git clone -b frontend https://github.com/tu-usuario/tu-repo.git geovisor-app
cd geovisor-app
npm install
# Edita src/api/client.js → pon la IP de tu PC
npx expo start   # Escanea QR con Expo Go
```

📖 Docs completas → [`frontend` branch README](../../tree/frontend#readme)

---

## 🎨 Diseño

- **Gradiente:** azul `#1565C0` → teal `#00ACC1`
- **UI:** React Native Paper + Expo Linear Gradient
- **Mapas:** OpenStreetMap + Leaflet (WebView) · compatible con Google Maps
- **Auth:** JWT en AsyncStorage con interceptores Axios

---

## 📋 Endpoints principales de la API

| Método | Ruta | Acceso |
|---|---|---|
| `POST` | `/auth/login` | Público |
| `POST` | `/usuarios/registro` | Público |
| `GET` | `/reportes/` | Autenticado (filtrado por rol) |
| `POST` | `/reportes/` | Ciudadano / Entidad |
| `GET` | `/reportes/mapa` | Autenticado |
| `GET` | `/reportes/estadisticas` | Autenticado |
| `GET` | `/infraestructura/` | Autenticado |
| `GET` | `/auditoria/` | Solo Admin |

Ver lista completa en el README de la rama `backend`.

---

*Municipio de  · Cundinamarca · Colombia*
