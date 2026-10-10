# Laboratorios FICCT

Plataforma web y móvil para gestionar los laboratorios de cómputo de la FICCT (UAGRM).

| Carpeta     | Qué es                                                        |
|-------------|---------------------------------------------------------------|
| `backend/`  | API en Django 5.2 + Django REST Framework + PostgreSQL 18     |
| `frontend/` | Web en React 19 + TypeScript + Vite 7 + Fluent UI 9           |
| `mobile/`   | App en Flutter (Android e iOS) con Riverpod 3 y go_router     |
| `infra/`    | Script inicial de PostgreSQL (extensión `btree_gist`)         |

## Fase 1: qué incluye

1. **Usuarios.** El Superadmin gestiona a todos. El Admin gestiona solo a Auxiliares, Docentes y Administrativos. Se puede crear, editar, desactivar, eliminar y restablecer contraseñas.
2. **Elementos.** Catálogo de PC, proyectores, etc. Cada elemento tiene su ícono o imagen, color y prefijo para numerar.
3. **Laboratorios.** Editor de grilla estilo OrganiLab:
   - herramientas de pintar, borrar, mano (mover) y numerar, con deshacer y rehacer;
   - ficha de cada elemento con IP, MAC y activo;
   - software instalado;
   - credenciales cifradas, con registro de quién las vio.
4. **Horarios.** Clases recurrentes por periodo. El sistema no deja guardar dos clases que choquen. Una clase se puede suspender un día puntual.
5. **Reservas.** Eventos únicos o de pocos días. Se pueden pedir programas y apoyo de auxiliares. Mientras llenas el formulario, se revisa en vivo si el laboratorio está libre.
6. **Pizarra.** Calendario por día y semana, por hora y por laboratorio.
7. **Objetos perdidos.** Registro con foto e historial. Un registro se entrega o se anula, pero **nunca se borra**: lo impiden la API y un trigger en la base de datos.

## Fase 2: qué incluye

- **Notificaciones.** Campana con contador en la web y en la app. Se actualiza sola cada ~20 segundos, sin servicios externos. Tocar un aviso lleva a lo que corresponde (la solicitud, la tarea, la pizarra de ese día…).
- **Preferencias del docente.** Cada docente marca cómo quiere el aula: si los estudiantes pasan antes, si se borra la pizarra, etc., y puede dejar una nota. Valen para todas sus clases.
  - La lista de opciones la edita el Admin en *Preferencias docentes → Opciones*.
  - Los auxiliares ven las preferencias en la pizarra y en el aviso de "alistar aula".
- **Solicitar asistencia.** Docentes y administrativos piden apoyo (laboratorio o lugar, categoría, si es urgente). Se avisa a todos los auxiliares.
  - Un auxiliar la toma ("Voy en camino") y luego la marca resuelta. Quien la pidió recibe un aviso en cada paso.
- **Avisos de clase/reserva.** El sistema avisa solo a los auxiliares (si la reserva tiene auxiliares asignados, solo a ellos):
  - 15 minutos antes de cada clase o reserva, para **alistar** el aula (con las preferencias del docente);
  - al terminar, para **cerrarla** (si no sigue otra actividad).
  - Desde la pizarra también se puede enviar el aviso a mano.
- **Bitácora de laboratorio.** Registrar, editar, borrar y consultar lo que se hace en cada laboratorio: instalación de programas, revisión de equipos, mantenimiento, incidentes…
  - Está en el menú *Bitácora* y en la pestaña *Bitácora* de cada laboratorio.
  - Cada quien edita lo suyo; el Admin, todo.
- **Revisiones periódicas.** El Admin programa revisiones de un laboratorio cada N días, semanas o meses.
  - Cuando una vence, pasa sola al pizarrón de tareas y se avisa a los auxiliares.
  - Al marcar esa tarea como hecha, la revisión queda registrada en la bitácora y se calcula la próxima fecha.
- **Pizarrón de tareas.** Columnas *Pendiente · En progreso · Hecha*, con prioridad, responsables, fecha límite y avances (texto y porcentaje). Lo ven y usan Admin y Auxiliares.

Quién puede qué:

| Función | Admin | Auxiliar | Docente | Administrativo |
|---|---|---|---|---|
| Notificaciones | ✔ | ✔ | ✔ | ✔ |
| Preferencias | edita las opciones y las de cualquier docente | ve las de todos | marca las suyas | — |
| Asistencia | atiende | atiende | pide | pide |
| Avisos alistar/cerrar | envía a mano | recibe y envía a mano | — | — |
| Bitácora | todo | registra y edita lo suyo | — | — |
| Revisiones periódicas | programa y realiza | realiza | — | — |
| Pizarrón de tareas | todo | crea, mueve, anota avances y borra lo suyo | — | — |

---

## Requisitos

- **Docker Desktop:** levanta PostgreSQL, Redis y la API.
- **Node.js 20.19 o superior** (o 22.12+), para la web.
- **Flutter 3.35 o superior**, para la app. Además necesitas Android Studio con un emulador, o un celular con depuración USB.

## Antes de empezar: cómo leer esta guía

- **"Terminal"** = PowerShell en Windows (clic derecho sobre la carpeta → *Abrir en Terminal*), o Terminal en Mac y Linux.
- Cada paso dice **en qué carpeta** abrir la terminal. `labficct` es la carpeta que sale al descomprimir el zip.
- Necesitas **tres terminales abiertas a la vez**: una para Docker (paso 2), una para la web (paso 5) y una para la app (paso 6). No las cierres mientras usas el sistema.

## Paso 1 · Archivos `.env` (ya vienen listos)

El zip trae los tres archivos de configuración ya creados con valores de desarrollo; **no tienes que copiar nada**:

| Archivo | Para qué sirve |
|---------|----------------|
| `labficct/backend/.env` | Base de datos, claves y rutas de la API (`API_PREFIX`, `ADMIN_URL`, CORS) |
| `labficct/frontend/.env` | Dirección de la API para la web (`VITE_API_BASE_URL`) |
| `labficct/mobile/env/dev.env` | Dirección de la API para la app (`API_BASE_URL`) |

> **¿No los ves?** Los nombres que empiezan con punto se ocultan en Mac (Finder: `Cmd + Shift + .`) y a veces en Windows (Explorador → *Vista* → *Mostrar* → *Elementos ocultos*).

Junto a cada uno hay un `.env.example`: es la plantilla que se sube a git. Los `.env` reales no se suben (están en `.gitignore`).

## Paso 2 · Levantar la base de datos y la API

1. Abre **Docker Desktop** y espera a que diga que está corriendo.
2. Abre una terminal **en la carpeta `labficct`** (la que tiene `docker-compose.yml`).
3. Ejecuta:

```bash
docker compose up --build
```

La primera vez tarda unos minutos (descarga PostgreSQL, Redis y Python). Está listo cuando ves una línea como `Starting development server at http://0.0.0.0:8000/`. **Deja esta terminal abierta.**

Para comprobarlo, abre en el navegador `http://localhost:8000/api/v1/salud/`: debe mostrar `"estado": "ok"`. La documentación de la API está en `http://localhost:8000/api/v1/docs/`.

## Paso 3 · Crear tu usuario y los datos de ejemplo

Abre **otra terminal en la carpeta `labficct`** (Docker debe seguir corriendo en la primera) y ejecuta:

```bash
docker compose exec backend python manage.py crear_superadmin
```

Te pedirá correo, nombres, apellidos y contraseña: ese será tu usuario Superadmin.

Luego, en la misma terminal, carga datos de prueba (laboratorios dibujados, horarios, reservas, objetos perdidos y usuarios de cada rol):

```bash
docker compose exec backend python manage.py cargar_demo
```

Todos los usuarios de ejemplo usan la contraseña **`Ficct2026!`**:

| Rol            | Usuario                                   |
|----------------|-------------------------------------------|
| Admin          | `jefe@demo.ficct.edu.bo`                  |
| Auxiliar       | `ana.rojas@demo.ficct.edu.bo`             |
| Docente        | `mario.justiniano@demo.ficct.edu.bo`      |
| Administrativo | `patricia.vargas@demo.ficct.edu.bo`       |

## Paso 4 · Pruebas del backend (opcional)

En esa misma segunda terminal (carpeta `labficct`):

```bash
docker compose exec backend pytest
```

Debe terminar con todas las pruebas en verde (`passed`). Si alguna falla, cópiame el resultado completo.

## Paso 5 · Web

1. Abre una terminal **en la carpeta `labficct/frontend`**.
2. La primera vez, instala las dependencias (tarda unos minutos):

```bash
npm install
```

3. Arranca la web:

```bash
npm run dev
```

4. Abre `http://localhost:5173` en el navegador e inicia sesión con tu Superadmin o con `jefe@demo.ficct.edu.bo`. **Deja esta terminal abierta.**

Dentro de la web, **Ctrl + K** busca cualquier pantalla o acción.

## Paso 6 · App móvil

1. Abre Android Studio y enciende un emulador (*Device Manager* → ▶). Comprueba en una terminal que Flutter lo ve con `flutter devices`.
2. Abre una terminal **en la carpeta `labficct/mobile`**.
3. **Solo la primera vez**, genera las carpetas de Android e iOS (no borra ni reemplaza nada de lo que ya está):

```bash
flutter create . --org bo.edu.uagrm.ficct --project-name labficct --platforms android,ios
```

4. Descarga las dependencias:

```bash
flutter pub get
```

5. Ejecuta la app (este es el comando de siempre, a partir de ahora solo usas este):

```bash
flutter run --dart-define-from-file=env/dev.env
```

Inicia sesión con `ana.rojas@demo.ficct.edu.bo` / `Ficct2026!` para ver la pizarra del día.

**Si usas un celular físico en vez del emulador:**

1. Averigua la IP de tu PC en el Wi-Fi (`ipconfig` en Windows, busca "Dirección IPv4"; por ejemplo `192.168.1.50`).
2. En `mobile/env/dev.env` cambia `10.0.2.2` por esa IP.
3. En `backend/.env` agrega esa IP al final de `DJANGO_ALLOWED_HOSTS` (separada por coma).
4. En la terminal de Docker, detén con `Ctrl + C` y vuelve a ejecutar `docker compose up`.
5. El celular y la PC deben estar en la misma red Wi-Fi.

**Cámara en iOS:** agrega esto a `ios/Runner/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Para fotografiar los objetos perdidos que se registran.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Para adjuntar la foto de un objeto perdido.</string>
```

**APK de producción:** agrega `<uses-permission android:name="android.permission.INTERNET"/>` en `android/app/src/main/AndroidManifest.xml` (Flutter solo lo pone en depuración) y compila con `--dart-define-from-file=env/prod.env`.

## Uso diario (después de la primera vez)

| Qué | Carpeta | Comando |
|-----|---------|---------|
| Base de datos, API y avisos automáticos | `labficct` | `docker compose up` |
| Web | `labficct/frontend` | `npm run dev` |
| App | `labficct/mobile` | `flutter run --dart-define-from-file=env/dev.env` |

Para apagar todo: `Ctrl + C` en cada terminal.

Los avisos automáticos (alistar/cerrar aulas cada minuto, revisiones que vencen) los manda el servicio `worker`, que arranca solo con `docker compose up`. Para probarlos sin esperar:

```bash
docker compose exec backend python manage.py enviar_avisos
```

Qué ve cada rol en la app:

| Rol               | Pestañas                                                         |
|-------------------|------------------------------------------------------------------|
| Admin y Auxiliar  | Hoy (pizarra) · Tareas · Labs · Reservas · Objetos               |
| Docente           | Mis clases · Laboratorios · Mis reservas · Asistencia            |
| Administrativo    | Horarios · Laboratorios · Asistencia                             |

En todas las pestañas está la campana de notificaciones. Las solicitudes de asistencia (para quien las atiende) y *Mis preferencias* (docentes) se abren desde el perfil. Bitácora y revisiones están solo en la web.

---

## Dónde tocar cuando algo cambie

- **Quién puede qué:** `backend/apps/core/permisos.py`. La web y la app leen los permisos del usuario desde `/auth/me/`, así que ahí no hay que cambiar nada.
- **Rutas de la API:**
  - web: `frontend/src/api/endpoints.ts`;
  - app: `mobile/lib/core/network/endpoints.dart`;
  - la dirección base, siempre en el `.env` de cada uno.
- **Colores de la FICCT:**
  - web: `frontend/src/app/tema.ts`;
  - app: `mobile/lib/core/theme/tema.dart`.
- **Mensajes de error de choques:** `backend/apps/core/errores.py` (`MENSAJES_RESTRICCION`).
- **Cuántos minutos antes se avisa "alistar aula":** `AVISO_ALISTAR_MINUTOS` en `backend/.env` (por defecto 15). Reinicia `docker compose up` después de cambiarlo.
- **Qué hacen los avisos automáticos:** `backend/apps/notificaciones/avisos.py`; cada cuánto corren, `CELERY_BEAT_SCHEDULE` en `backend/config/settings/base.py`.

## Problemas comunes

- **El contenedor `db` no arranca después de actualizar a PostgreSQL 18.** El volumen viejo usa otra ruta. En desarrollo, bórralo con `docker compose down -v` y vuelve a levantar.
- **La app dice "No hay conexión con el servidor".** Revisa tres cosas:
  1. que `docker compose up` esté corriendo;
  2. la IP de `env/dev.env`;
  3. que esa IP esté en `DJANGO_ALLOWED_HOSTS`.
- **La app muestra "Falta configuración".** La ejecutaste sin `--dart-define-from-file=env/dev.env`.
- **La web dice que falta `VITE_API_BASE_URL`.** Falta `frontend/.env`: cópialo del ejemplo y reinicia `npm run dev`.
- **No llegan los avisos de alistar/cerrar aula.** Revisa que en la terminal de Docker aparezcan líneas del `worker`. Si cambiaste código de avisos o tareas, detén con `Ctrl + C` y vuelve a ejecutar `docker compose up`. Para probar al instante, usa `enviar_avisos` (arriba).
