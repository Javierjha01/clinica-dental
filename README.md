# Clínica Dental – Agenda de Citas

## Firebase – Primeros pasos

### 1. Variables de entorno

1. Copia el archivo de ejemplo:
   ```bash
   cp .env.example .env
   ```
2. En [Firebase Console](https://console.firebase.google.com) → tu proyecto → **Project settings** (engranaje) → **General** → en **Your apps** selecciona tu app web.
3. Copia el objeto `firebaseConfig` y pega cada valor en tu `.env`:

   | Variable en `.env` | Dónde está en Firebase |
   |-------------------|-------------------------|
   | `VITE_FIREBASE_API_KEY` | `apiKey` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `VITE_FIREBASE_PROJECT_ID` | `projectId` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
   | `VITE_FIREBASE_APP_ID` | `appId` |

### 2. Activar servicios en Firebase Console

- **Authentication**: Sign-in method → habilitar **Email/Password** (para el panel admin).
- **Firestore Database**: Crear base de datos en modo producción; después desplegamos las reglas.

### 3. Desplegar reglas e índices de Firestore

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### 4. Desplegar Cloud Functions (agendar citas y horarios ocupados)

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

Las funciones `getHorariosDisponibles` y `crearCita` se usan desde la página pública; sin desplegarlas, agendar no guardará en Firestore.

### 5. Ejecutar el proyecto

```bash
npm install
npm run dev
```

Abre la URL que muestra Vite (por ejemplo `http://localhost:5173`). Si Firebase está bien configurado, la app cargará sin errores en consola.

---

## Iniciar y cerrar sesión (Firebase Auth)

El proyecto usa **Email/Password** para el panel de administración.

### Desde código (sin hook)

```js
import { signIn, signOut } from './lib/auth'

// Iniciar sesión (cierra cualquier sesión anterior y entra con esta cuenta)
await signIn('admin@tu-clinica.com', 'tu-password')

// Cerrar sesión
await signOut()
```

### Desde un componente React (con hook)

```jsx
import { useAuth } from './hooks/useAuth'

function MiComponente() {
  const { user, loading, signIn, signOut } = useAuth()

  if (loading) return <p>Cargando...</p>
  if (!user) return <button onClick={() => signIn('email', 'password')}>Entrar</button>

  return (
    <div>
      <p>Hola, {user.email}</p>
      <button onClick={signOut}>Cerrar sesión</button>
    </div>
  )
}
```

**Nota:** `signIn` cierra la sesión anterior antes de iniciar la nueva, así siempre quedas con la cuenta que indicas.

---

## WhatsApp Business API

Tu número de negocio: **56 47575817** (Chile). Para que el envío y las respuestas funcionen:

### 1. Meta (developers.facebook.com) – Paso a paso

#### A. Desde la página "Tecnologías sociales" (donde estás ahora)

Si al abrir *developers.facebook.com/apps* te deja en la misma página, suele ser porque **aún no estás registrado como desarrollador**. Haz esto en orden:

**Paso 0 – Registrarte como desarrollador (solo una vez)**  
1. En la barra de direcciones escribe tú mismo (o copia y pega):  
   `https://developers.facebook.com/async/registration`  
2. Enter. Completa el formulario (cuenta de Facebook, correo, aceptar condiciones) y **Registrarse**.  
3. Cuando termines, Meta te llevará al panel de desarrollador.

**Paso 1 – Ir a Mis aplicaciones**  
1. En la barra de direcciones escribe:  
   `https://developers.facebook.com/apps`  
2. Enter. Deberías ver la lista de **Mis aplicaciones** y el botón **Crear aplicación**.

**Si sigues en “Tecnologías sociales” sin cambiar de página:**  
- Haz clic en el botón **Empezar** (arriba a la derecha). A veces desde ahí te llevan a registro o a “Mis aplicaciones”.  
- O en **Primeros pasos** haz clic en **Explorar todos los productos** y busca **WhatsApp** en la lista; al entrar en WhatsApp a veces pide crear o elegir una app.

**Crear la app (cuando ya estés en Mis aplicaciones):**
1. Clic en **Crear aplicación**.
2. Elige **Otro** → tipo **Empresa** → **Siguiente**.
3. Nombre (ej. *Clínica Dental Agenda*) y correo → **Crear aplicación**.
4. En **Agregar casos de uso**: WhatsApp no aparece en la lista. Elige **"Crear una app sin un caso de uso"** (baja en la lista), marca el checkbox y **Siguiente**. Termina el asistente. WhatsApp se añade después desde el panel de la app.

#### B. Añadir WhatsApp a la app

**Si en el panel no ves "Agregar productos" ni WhatsApp:**

1. **Enlace directo:** prueba `https://developers.facebook.com/apps/TU_APP_ID/whatsapp-business/` (sustituye `TU_APP_ID` por tu App ID, ej. `797397320037275`). Si la app aún no tiene WhatsApp añadido, **Meta te redirige al dashboard**; en ese caso hay que vincular antes un portfolio comercial (paso 3).
2. **Por Business Manager:** entra en **business.facebook.com** → **Configuración del negocio** (engranaje) → **Cuentas** → **Cuentas de WhatsApp**. Si tienes o creas una cuenta de WhatsApp Business, a veces desde ahí se puede vincular la app; luego en developers.facebook.com → tu app puede aparecer WhatsApp en el menú.
3. **Portfolio comercial (recomendado):** Meta suele exigir un *portfolio comercial* (negocio) para que aparezca WhatsApp. Sin portfolio, el enlace directo a whatsapp-business suele redirigir a `.../dashboard/`.
   - Ve a **Mis apps** (lista de apps) → en **Portfolio comercial** abre el desplegable "Ningún portfolio comercial seleccionado".
   - **Crear negocio:** si no tienes, haz clic en la opción para crear un negocio (te puede llevar a business.facebook.com). Completa nombre del negocio, etc.
   - **Asignar la app:** vuelve a **Mis apps**, selecciona tu portfolio en el desplegable y asigna "Clínica Dental Agenda" a ese negocio si te lo pide.
   - Después de vincular, entra de nuevo en tu app y revisa el **Panel** o el menú: puede aparecer **Agregar productos** o **WhatsApp**. Si aparece, configúralo; si no, prueba de nuevo el enlace directo a `.../whatsapp-business/`.

**Cuando ya veas WhatsApp en tu app:**

1. En el panel de tu app, en **Agregar productos**, busca **WhatsApp** y haz clic en **Configurar** (o usa el enlace directo de arriba).
2. Te llevará a **WhatsApp** → **Introducción**. Si te pide elegir una **Cuenta de WhatsApp Business**, selecciónala o créala (asociada a tu número **56 47575817**).

#### C. Obtener Phone number ID y Access token

1. En el menú izquierdo entra a **WhatsApp** → **API Setup** (o **Configuración de la API**).
2. Verás una sección **Desde** con tu número (o un número de prueba). Debajo suele decir **Phone number ID**.
   - **Phone number ID:** es un número largo (ej. `123456789012345`). Cópialo; es tu `whatsapp.phone_number_id`.
3. En la misma página, arriba, está **Access token** (token temporal).
   - Para producción necesitas un **token permanente**:
     - Menú izquierdo: **Configuración** (engranaje) → **Básica**.
     - En **Cuenta de Facebook** / **Cuenta del sistema** puedes crear un **Usuario del sistema** y generar un token con permisos `whatsapp_business_messaging` y `whatsapp_business_management`.
     - O en **WhatsApp** → **API Setup** usa primero el token temporal para pruebas; luego en **Configuración** → **Avanzada** puedes crear un token de larga duración.
   - El valor que copies es tu `whatsapp.token`.

#### D. Resumen de lo que necesitas

| Qué necesitas        | Dónde está en Meta |
|----------------------|--------------------|
| **Phone number ID**  | WhatsApp → API Setup → sección “Desde” / tu número → **Phone number ID** |
| **Access token**     | WhatsApp → API Setup → **Token temporal** (pruebas) o token permanente (producción) |

- **Phone number ID:** número largo que identifica tu número 56 47575817 en la API.  
- **Access token:** la “clave” que usa Firebase para enviar y recibir mensajes por WhatsApp.

Cuando los tengas, configúralos en Firebase (sección 3 de este README) con:

```bash
firebase functions:config:set \
  whatsapp.token="EL_ACCESS_TOKEN_QUE_COPIASTE" \
  whatsapp.phone_number_id="EL_PHONE_NUMBER_ID_QUE_COPIASTE" \
  ...
```

### 2. Plantilla de mensaje en Meta

En **WhatsApp** → **Message templates** crea una plantilla con:

- **Nombre:** `cita_confirmacion`
- **Idioma:** Español
- **Cuerpo (Body):**  
  `Hola {{1}}, tu cita dental está programada para el {{2}} a las {{3}}. Responde 1 para confirmar o 2 para cancelar.`

Las variables {{1}}, {{2}}, {{3}} son: nombre, fecha (ej. 5 de febrero de 2026), hora.  
Debes enviar la plantilla a revisión y tenerla **aprobada** para poder usarla.

### 3. Configurar Cloud Functions (Firebase)

Después de desplegar las funciones, configura los valores de WhatsApp.

**Si al ejecutar `firebase functions:config:set` ves un aviso de deprecación**, activa primero el comando legacy (válido hasta marzo 2026) y luego ejecuta los `config:set`:

```bash
firebase experiments:enable legacyRuntimeConfigCommands
```

Después, por separado o junto:

```bash
firebase functions:config:set whatsapp.token="TU_ACCESS_TOKEN_DE_META"
firebase functions:config:set whatsapp.phone_number_id="TU_PHONE_NUMBER_ID"
firebase functions:config:set whatsapp.verify_token="UN_TOKEN_SECRETO_QUE_TU_ELIJAS"
firebase functions:config:set whatsapp.site_url="https://tu-sitio.netlify.app"
```

- **whatsapp.token:** Access token de Meta (WhatsApp → API Setup).
- **whatsapp.phone_number_id:** Phone number ID de la cuenta/número 56 47575817.
- **whatsapp.verify_token:** Cualquier texto secreto; lo usarás en el webhook de Meta.
- **whatsapp.site_url:** URL pública de tu app (ej. Netlify) para el enlace de reagendar.

Luego vuelve a desplegar las funciones:

```bash
firebase deploy --only functions
```

### 4. Webhook en Meta

1. En **WhatsApp** → **Configuration** → **Webhook**:
   - **Callback URL:**  
     `https://us-central1-clinica-dental-agenda.cloudfunctions.net/whatsappWebhook`  
     (sustituye `clinica-dental-agenda` por tu **Project ID** de Firebase si es distinto).
   - **Verify token:** el mismo que pusiste en `whatsapp.verify_token`.
2. Suscríbete a **messages** (y si quieres, a **message_template_status_update**).

### 5. Comportamiento

- **Al crear una cita:** se envía automáticamente el mensaje de la plantilla `cita_confirmacion` al teléfono del paciente (número de la cita).
- **Respuesta 1:** se marca la cita como CONFIRMADA y se envía confirmación por WhatsApp.
- **Respuesta 2:** se marca como CANCELADA y se envía mensaje de cancelación.
- **Respuesta REAGENDAR:** se envía el enlace a `whatsapp.site_url/agendar` para que el paciente reagende.
