# 💧 GeoVisor Agua y Saneamiento — Zipaquirá

Sistema de gestión y visualización geoespacial de reportes de agua potable y saneamiento básico del municipio de Zipaquirá, Cundinamarca.

> 🎓 Proyecto de Tesis de Grado — 2025

---

## 🏗️ Estructura del proyecto

| Rama | Contenido |
|------|-----------|
| `main` | Backend FastAPI (rama estable) |
| `develop` | Backend — últimas mejoras (entidades, mapa, estadísticas) |
| `develop-frontend` | Frontend React Native / Expo |

---

## ⚙️ Backend — FastAPI + MySQL

**Ruta:** `/app/routers/`

### Endpoints principales
- `POST /auth/login` — Autenticación JWT
- `GET  /reportes/mapa` — Pines para Google Maps
- `GET  /reportes/estadisticas` — Métricas agregadas
- `GET  /entidades/` — CRUD entidades
- `GET  /usuarios/` — Gestión de usuarios

### Roles
| ID | Rol |
|----|-----|
| 1 | CIUDADANO |
| 2 | ENTIDAD |
| 3 | MODERADOR |
| 4 | ADMINISTRADOR |

### Instalación
```bash
pip install -r requirements.txt
cp .env.example .env   # Configura tus variables
uvicorn main:app --reload
```

---

## 📱 Frontend — React Native + Expo

**Ruta:** rama `develop-frontend`

### Pantallas por rol

| Rol | Pantallas |
|-----|-----------|
| Ciudadano | Mapa, Mis Reportes, Crear Reporte, Notificaciones, Perfil |
| Entidad | Reportes Asignados, Detalle Reporte |
| Moderador | Todos los Reportes, Historial |
| Admin | Dashboard, Usuarios, Entidades, Auditoría |

### Instalación
```bash
cd geovisor-app
npm install
npx expo start   # Escanea QR con Expo Go
```

### Configuración requerida
1. Edita `src/api/client.js` → cambia `API_URL` a la IP de tu servidor FastAPI
2. Edita `app.json` → reemplaza `YOUR_GOOGLE_MAPS_API_KEY`

---

## 🎨 Diseño

- **Tema:** Gradiente azul `#1565C0` → teal `#00ACC1`
- **UI:** React Native Paper + Expo Linear Gradient
- **Mapas:** react-native-maps con Google Maps
- **Auth:** JWT en AsyncStorage con interceptores Axios

---

*Municipio de Zipaquirá · Cundinamarca · Colombia*
