# 📱 GeoVisor App — Frontend

Aplicación móvil del sistema GeoVisor de Agua y Saneamiento de Zipaquirá, Cundinamarca.  
Construida con **React Native + Expo**, navegación por roles y mapa interactivo.

> 🎓 Proyecto de Tesis de Grado — 2025

---

## 🏗️ Arquitectura: Feature-based por roles

La app está organizada por **rol de usuario**, lo que refleja exactamente cómo funciona el negocio. Cada rol tiene su propio conjunto de pantallas y navegación. Esto facilita agregar o modificar funcionalidades sin tocar lo de otros roles.

```
src/
├── api/              ← Capa de comunicación con el backend
│   ├── client.js     ← Axios configurado: baseURL, JWT interceptor, manejo de errores
│   └── services.js   ← Funciones por módulo: authAPI, reportesAPI, usuariosAPI...
├── context/
│   └── AuthContext.js← Estado global de autenticación (usuario, token, login/logout)
├── navigation/
│   └── AppNavigator.js← Router principal: decide qué navegador mostrar según el rol
├── components/       ← Componentes reutilizables entre pantallas
│   ├── GradientHeader.js   ← Cabecera azul/teal con gradiente corporativo
│   ├── LoadingScreen.js    ← Pantalla de carga mientras valida sesión
│   ├── MapaWebView.js      ← Mapa OpenStreetMap + Leaflet embebido en WebView
│   ├── ReportCard.js       ← Tarjeta de reporte con badge de estado y severidad
│   ├── StatCard.js         ← Tarjeta de estadística para el dashboard del admin
│   └── StatusBadge.js      ← Badge de color por estado de reporte
├── screens/          ← Pantallas agrupadas por rol
│   ├── auth/         ← Login, Registro (públicas)
│   ├── ciudadano/    ← Mapa, Mis Reportes, Crear Reporte, Notificaciones, Perfil
│   ├── entidad/      ← Reportes Asignados, Detalle de Reporte
│   ├── moderador/    ← Todos los Reportes, Historial
│   ├── admin/        ← Dashboard, Usuarios, Entidades, Auditoría
│   └── shared/       ← PerfilScreen (compartida por todos los roles)
└── theme/
    └── colors.js     ← Paleta de colores y gradientes del sistema de diseño
```

---

## ⚙️ Stack tecnológico

| Tecnología | Versión | Rol |
|---|---|---|
| **React Native** | 0.78 | Framework móvil (iOS + Android) |
| **Expo** | ~54 | Toolchain: build, QR, módulos nativos |
| **React Navigation** | 6.x | Navegación: stack + bottom tabs por rol |
| **Axios** | 1.7 | Cliente HTTP con interceptores JWT |
| **AsyncStorage** | 2.x | Persistencia local del token y usuario |
| **react-native-webview** | 13.x | Renderiza el mapa Leaflet/OpenStreetMap |
| **react-native-paper** | 5.x | Componentes UI Material Design |
| **expo-linear-gradient** | 15.x | Gradientes azul→teal del diseño |
| **expo-location** | 16.x | GPS para geolocalizar reportes |
| **expo-image-picker** | 16.x | Adjuntar fotos a los reportes |

---

## 🎨 Sistema de diseño

- **Gradiente principal:** `#1565C0` (azul) → `#00ACC1` (teal)
- **Fondo de pantallas:** `#F0F4F8`
- **Tipografía primaria:** `#0D1B2A`
- **Colores de estado de reporte:**
  - 🟡 Pendiente: `#F59E0B`
  - 🔵 En Revisión: `#3B82F6`
  - 🟣 En Proceso: `#8B5CF6`
  - 🟢 Resuelto: `#10B981`

---

## 🗺️ Pantallas por rol

### 🔓 Públicas (sin sesión)
| Pantalla | Descripción |
|---|---|
| `LoginScreen` | Formulario de correo + contraseña, guarda token en AsyncStorage |
| `RegisterScreen` | Registro de ciudadano: datos personales + documento |

### 👤 Ciudadano (rol 1)
| Pantalla | Descripción |
|---|---|
| `MapaScreen` | Mapa con pines de sus reportes (OpenStreetMap + Leaflet vía WebView) |
| `MisReportesScreen` | Lista de sus reportes con estado y severidad |
| `CrearReporteScreen` | Formulario: tipo, severidad, descripción, ubicación GPS, foto |
| `NotificacionesScreen` | Alertas de cambios de estado de sus reportes |
| `PerfilScreen` (shared) | Ver y editar datos personales, cambiar contraseña |

### 🏢 Entidad (rol 2)
| Pantalla | Descripción |
|---|---|
| `ReportesAsignadosScreen` | Reportes asignados a su entidad |
| `DetalleReporteScreen` | Ver reporte completo y cambiar su estado |

### 🛡️ Moderador (rol 3)
| Pantalla | Descripción |
|---|---|
| `TodosReportesScreen` | Todos los reportes del sistema con filtros |
| `HistorialScreen` | Historial cronológico de cambios de estado |

### ⚙️ Administrador (rol 4)
| Pantalla | Descripción |
|---|---|
| `DashboardScreen` | Estadísticas globales: totales, por estado, por severidad |
| `UsuariosScreen` | Lista de usuarios + cambio de estado de cuenta |
| `EntidadesScreen` | CRUD de entidades prestadoras del servicio |
| `AuditoriaScreen` | Logs de auditoría del sistema |

---

## 🔐 Flujo de autenticación

```
App.js
  └── AuthProvider (contexto global)
        └── AppNavigator
              ├── loading=true  → LoadingScreen (valida token guardado)
              ├── user=null     → AuthStack (Login / Registro)
              └── user != null  → Navigator según id_rol
                    ├── rol 1 → CiudadanoTabs
                    ├── rol 2 → EntidadStack
                    ├── rol 3 → ModeradorTabs
                    └── rol 4 → AdminTabs
```

El token JWT se guarda en `AsyncStorage` con la clave `'token'`. Al abrir la
app, `AuthContext.loadStoredAuth()` lo recupera y lo revalida contra
`GET /auth/me` — el servidor es la fuente de verdad, no lo que quedó
cacheado, así que un cambio de rol o una cuenta suspendida se reflejan
apenas se abre la app, no cuando falla la primera acción real. `loading`
se mantiene en `true` (mostrando `LoadingScreen`) hasta que esa
revalidación se resuelve, en cualquiera de sus tres desenlaces:

- **200** → se guarda y se usa el usuario que devolvió el servidor.
- **401 / 403** (token inválido/vencido, cuenta suspendida) → sesión
  inválida de verdad: se cierra sesión y se manda a login.
- **sin `error.response`** (backend caído, sin red, timeout) → no se sabe
  si la sesión sigue siendo válida, así que **no se borra**: se usa lo
  cacheado para que la app abra igual con WiFi inestable. Vaciar una
  sesión válida porque se cayó el WiFi sería peor que el problema que
  esto resuelve.

Cualquier 401 que llegue después, en cualquier request (no solo el
chequeo de arranque), pasa por el interceptor de `client.js`, que limpia
`AsyncStorage` y avisa a `AuthContext` (vía un callback que el provider
registra — `client.js` no importa el contexto directamente, para evitar
un import circular) para que también resetee su estado de React; si no,
la UI se queda en una pantalla logueada con un token que el backend ya
rechazó.

---

## 🚀 Instalación y ejecución

### 1. Requisitos previos
- Node.js 18 o superior
- npm o yarn
- Expo Go instalado en tu teléfono ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iOS](https://apps.apple.com/app/expo-go/id982107779))
- El **backend** corriendo y accesible desde tu teléfono

### 2. Clonar la rama y entrar al proyecto

```bash
git clone -b frontend https://github.com/tu-usuario/tu-repo.git geovisor-app
cd geovisor-app
```

### 3. Instalar dependencias

```bash
npm install
```

### 4. Configurar la URL del backend

Edita `src/api/client.js` y cambia la IP por la de tu PC:

```js
const DEV_IP = '192.168.1.XXX'; // ← tu IP real
```

> **¿Cómo saber tu IP?**  
> - Windows: abre `cmd` → escribe `ipconfig` → busca "Dirección IPv4"  
> - Mac/Linux: `ip a` o `ifconfig`  
>
> ⚠️ No uses `localhost` — desde el teléfono apunta al propio teléfono, no a tu PC.

### 5. Configurar Google Maps (opcional)

Edita `app.json` y reemplaza `YOUR_GOOGLE_MAPS_API_KEY` con tu API Key de Google Maps.  
Si no tienes una, el mapa usará la implementación WebView con OpenStreetMap (ya incluida).

### 6. Iniciar la app

```bash
npx expo start
```

Escanea el código QR con la app **Expo Go** en tu teléfono.  
Asegúrate de que el teléfono y tu PC estén **en la misma red WiFi**.

---

## 🐛 Problemas frecuentes

| Error | Causa | Solución |
|---|---|---|
| `ERR_CONNECTION_TIMED_OUT` | IP incorrecta o backend apagado | Verifica `DEV_IP` en `client.js` y que el backend esté corriendo |
| `Network Error` | PC y teléfono en redes distintas | Conecta ambos a la misma WiFi |
| Pantalla en blanco | Token inválido en AsyncStorage | En Expo Go: limpiar datos de la app / reinstalar |
| `Cannot find module` | Dependencias no instaladas | Ejecuta `npm install` nuevamente |

---

## 📁 Archivos raíz importantes

| Archivo | Descripción |
|---|---|
| `App.js` | Punto de entrada: monta `AuthProvider` + `AppNavigator` |
| `index.js` | Registro de la app con Expo |
| `app.json` | Configuración de Expo: nombre, íconos, splash, Google Maps API Key |
| `package.json` | Dependencias y scripts npm |
| `src/api/client.js` | ⚠️ Aquí cambias la IP del backend |
| `src/types/api.d.ts` | Tipos TypeScript generados desde el OpenAPI del backend (ver abajo) |

---

## 🧾 Contrato de la API (`src/types/api.d.ts`)

El backend expone un OpenAPI real (con `response_model` en cada endpoint), y
`src/types/api.d.ts` es su traducción a tipos TypeScript, generada con
[`openapi-typescript`](https://openapi-ts.dev/):

```bash
npm run gen:api
```

Esto requiere que el backend esté corriendo en `http://localhost:8000`
(`uvicorn main:app --reload` desde `backend/`). El script apunta a
`http://localhost:8000/openapi.json` — edítalo en `package.json` si tu
backend corre en otro host/puerto.

**Este archivo es generado, no lo edites a mano.** Regenéralo (`npm run
gen:api`) cada vez que cambie un `response_model`, un schema en
`backend/app/schemas/`, o la forma de un endpoint, y confirma el archivo
actualizado junto con el cambio de backend que lo motivó — así el contrato
en el repo nunca queda desincronizado con la API real.

Ningún archivo de la app se migró a TypeScript todavía: los tipos existen
para consultarlos y para una futura migración incremental, no se están
usando aún en `.js`.

---

*Municipio de Zipaquirá · Cundinamarca · Colombia · Tesis 2025*
