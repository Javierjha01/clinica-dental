const functions = require('firebase-functions')
const admin = require('firebase-admin')

admin.initializeApp()

const db = admin.firestore()
const messaging = admin.messaging()

const COL_CITAS = 'citas'
const COL_CONFIG = 'config'
const COL_ADMINS = 'admins'
const SUBCOL_NOTIFICACIONES = 'notificaciones'
const DOC_ACTIVIDADES = 'actividades'
const ESTADOS = { ACTIVA: 'ACTIVA', CONFIRMADA: 'CONFIRMADA', CANCELADA: 'CANCELADA', REAGENDADA: 'REAGENDADA' }

const ACTIVIDADES_DEFAULT = [
  { id: 'revision', nombre: 'Revisión general', duracionMinutos: 30 },
  { id: 'limpieza', nombre: 'Limpieza dental', duracionMinutos: 40 },
  { id: 'ortodoncia-control', nombre: 'Ortodoncia – control / ajuste', duracionMinutos: 30 },
  { id: 'ortodoncia-colocacion', nombre: 'Ortodoncia – colocación o valoración', duracionMinutos: 45 },
  { id: 'caries', nombre: 'Caries / obturación (resina)', duracionMinutos: 45 },
  { id: 'endodoncia', nombre: 'Endodoncia (tratamiento de conductos)', duracionMinutos: 60 },
  { id: 'extraccion-simple', nombre: 'Extracción simple', duracionMinutos: 30 },
  { id: 'extraccion-cirugia', nombre: 'Extracción de cordales / cirugía oral', duracionMinutos: 60 },
  { id: 'blanqueamiento', nombre: 'Blanqueamiento dental', duracionMinutos: 60 },
  { id: 'coronas', nombre: 'Coronas / fundas', duracionMinutos: 45 },
  { id: 'protesis', nombre: 'Prótesis (fija o removible)', duracionMinutos: 45 },
  { id: 'periodoncia', nombre: 'Periodoncia / encías', duracionMinutos: 45 },
  { id: 'implantes-colocacion', nombre: 'Implantes – colocación', duracionMinutos: 60 },
  { id: 'implantes-revision', nombre: 'Implantes – revisión o control', duracionMinutos: 30 },
  { id: 'selladores', nombre: 'Selladores de fosetas y fisuras', duracionMinutos: 30 },
  { id: 'odontopediatria', nombre: 'Odontopediatría (niños)', duracionMinutos: 40 },
  { id: 'rehabilitacion', nombre: 'Rehabilitación oral', duracionMinutos: 60 },
  { id: 'radiografia-valoracion', nombre: 'Radiografía / valoración inicial', duracionMinutos: 30 },
  { id: 'urgencia', nombre: 'Urgencia / dolor', duracionMinutos: 30 },
]

/** True si la cita (fechaStr + hora) ya pasó y el dentista marcó "no asistió" → se libera el lugar. */
function citaLiberada(data, fechaStr) {
  if (data.asistio !== false) return false
  const horaStr = String(data.hora || '')
  const [hh, mm] = horaStr.split(':').map(Number)
  const [y, m, d] = (fechaStr || '').split('-').map(Number)
  const inicio = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0).getTime()
  return inicio < Date.now()
}

/** Dado hora "HH:mm" y duracionMinutos, devuelve array de slots "HH:mm" que ocupa la cita (cada 30 min). */
function slotsOcupadosPorCita(hora, duracionMinutos) {
  const d = duracionMinutos && duracionMinutos > 0 ? duracionMinutos : 30
  const [hh, mm] = String(hora || '09:00').split(':').map(Number)
  let totalMin = (hh || 0) * 60 + (mm || 0)
  const finMin = totalMin + d
  const slots = []
  while (totalMin < finMin) {
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    totalMin += 30
  }
  return slots
}

const WHATSAPP_API_VERSION = 'v22.0'

/** Obtiene los UIDs de todos los admins que tienen documento en admins. */
async function getAdminUids() {
  const snap = await db.collection(COL_ADMINS).get()
  return snap.docs.map((d) => d.id)
}

/**
 * Crea una notificación para cada admin y envía push FCM.
 * @param {object} notif - { tipo, titulo, mensaje, citaId?, fechaCita?, hora? }
 */
async function notificarAdmins(notif) {
  const uids = await getAdminUids()
  if (uids.length === 0) return
  const payload = {
    tipo: notif.tipo || 'info',
    titulo: notif.titulo || '',
    mensaje: notif.mensaje || '',
    citaId: notif.citaId || null,
    fechaCita: notif.fechaCita || null,
    hora: notif.hora || null,
    leida: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }
  const message = {
    notification: { title: payload.titulo, body: payload.mensaje },
    data: {
      tipo: payload.tipo,
      citaId: notif.citaId || '',
    },
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default' } } },
  }
  for (const uid of uids) {
    const notifRef = await db.collection(COL_ADMINS).doc(uid).collection(SUBCOL_NOTIFICACIONES).add(payload)
    const adminSnap = await db.collection(COL_ADMINS).doc(uid).get()
    const tokens = (adminSnap.data()?.fcmTokens || []).filter(Boolean)
    for (const token of tokens) {
      try {
        await messaging.send({
          ...message,
          token,
          data: {
            tipo: String(payload.tipo),
            citaId: String(notif.citaId || ''),
            notifId: String(notifRef.id),
          },
        })
      } catch (e) {
        if (e.code === 'messaging/invalid-registration-token' || e.code === 'messaging/registration-token-not-registered') {
          // Opcional: quitar token del documento del admin
        }
      }
    }
  }
}

function getWhatsAppConfig() {
  const config = functions.config().whatsapp || {}
  return {
    token: config.token || process.env.WHATSAPP_TOKEN,
    phoneNumberId: config.phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID,
    verifyToken: config.verify_token || process.env.WHATSAPP_VERIFY_TOKEN,
    siteUrl: config.site_url || process.env.WHATSAPP_SITE_URL || 'https://tu-sitio.netlify.app',
  }
}

function formatoFechaParaWhatsApp(fechaStr) {
  const [y, m, d] = fechaStr.split('-').map(Number)
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${d} de ${meses[m - 1]} de ${y}`
}

const FOLIO_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const FOLIO_LENGTH = 5

async function generarFolioUnico() {
  const ref = db.collection(COL_CITAS)
  for (let intento = 0; intento < 10; intento++) {
    let folio = ''
    for (let i = 0; i < FOLIO_LENGTH; i++) {
      folio += FOLIO_CHARS.charAt(Math.floor(Math.random() * FOLIO_CHARS.length))
    }
    const snap = await ref.where('folio', '==', folio).limit(1).get()
    if (snap.empty) return folio
  }
  throw new Error('No se pudo generar folio único')
}

async function enviarWhatsAppHelloWorld(to) {
  const { token, phoneNumberId } = getWhatsAppConfig()
  if (!token || !phoneNumberId) {
    console.warn('hello_world: falta token o phone_number_id')
    return false
  }
  const toClean = String(to).replace(/\D/g, '')
  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`
  const body = {
    messaging_product: 'whatsapp',
    to: toClean,
    type: 'template',
    template: { name: 'hello_world', language: { code: 'en_US' } },
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = await res.text()
    console.error('WhatsApp hello_world error:', res.status, errText)
    return false
  }
  return true
}

async function enviarWhatsAppTemplate(to, nombre, fechaStr, hora, templateName = 'cita_confirmacion_bold', folio = null) {
  const { token, phoneNumberId } = getWhatsAppConfig()
  if (!token || !phoneNumberId) {
    console.warn('WhatsApp no configurado: falta token o phone_number_id')
    return
  }
  const toClean = String(to).replace(/\D/g, '')
  const fechaFormateada = formatoFechaParaWhatsApp(fechaStr)
  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`
  const body = {
    messaging_product: 'whatsapp',
    to: toClean,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'es_MX' },
      components: [
        {
          type: 'body',
          parameters: folio
            ? [
                { type: 'text', text: nombre },
                { type: 'text', text: fechaFormateada },
                { type: 'text', text: hora },
                { type: 'text', text: folio },
              ]
            : [
                { type: 'text', text: nombre },
                { type: 'text', text: fechaFormateada },
                { type: 'text', text: hora },
              ],
        },
      ],
    },
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = await res.text()
    console.error(`WhatsApp ${templateName} error:`, res.status, errText)
    const isTemplateError = (res.status === 400 || res.status === 404) &&
      (errText.includes('132001') || errText.includes('132015') || errText.includes('132000') || errText.includes('template') || errText.includes('Template'))
    if (isTemplateError) {
      if (folio && templateName === 'cita_confirmacion_con_folio') {
        const ok = await enviarWhatsAppTemplate(to, nombre, fechaStr, hora, 'cita_confirmacion_bold', null)
        if (ok) {
          console.log('Enviado cita_confirmacion_bold sin folio (plantilla con folio no disponible).')
          return
        }
      }
      if (templateName === 'cita_confirmacion_bold') {
        const ok = await enviarWhatsAppTemplate(to, nombre, fechaStr, hora, 'cita_confirmacion', null)
        if (ok) {
          console.log('Enviado cita_confirmacion como respaldo (plantilla bold en revisión).')
          return
        }
      }
      const ok = await enviarWhatsAppHelloWorld(to)
      if (ok) {
        console.log('Enviado hello_world como respaldo.')
        return
      }
    }
    throw new Error(`WhatsApp: ${res.status}`)
  }
  return true
}

async function enviarWhatsAppTexto(to, texto) {
  const { token, phoneNumberId } = getWhatsAppConfig()
  if (!token || !phoneNumberId) return
  const toClean = String(to).replace(/\D/g, '')
  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`
  const body = {
    messaging_product: 'whatsapp',
    to: toClean,
    type: 'text',
    text: { body: texto },
  }
  await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

// Slots válidos: 09:00 a 17:30 cada 30 min
const SLOTS_VALIDOS = []
for (let h = 9; h < 18; h++) {
  for (let m = 0; m < 60; m += 30) {
    SLOTS_VALIDOS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
}

function fechaToString(date) {
  const d = typeof date === 'string' ? new Date(date) : date
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Devuelve las actividades (motivos) con tiempo estimado. Público para la página de agendar.
 */
exports.getActividades = functions.https.onCall(async (data, context) => {
  const ref = db.collection(COL_CONFIG).doc(DOC_ACTIVIDADES)
  const snap = await ref.get()
  const dataDoc = snap.exists ? snap.data() : null
  const items = dataDoc && Array.isArray(dataDoc.items) && dataDoc.items.length > 0
    ? dataDoc.items
    : ACTIVIDADES_DEFAULT
  return { actividades: items }
})

/**
 * Actualiza la lista de actividades (nombre + tiempo estimado). Requiere auth (admin).
 */
exports.updateActividades = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión')
  }
  const { actividades } = data || {}
  if (!Array.isArray(actividades)) {
    throw new functions.https.HttpsError('invalid-argument', 'actividades debe ser un array')
  }
  const items = actividades.map((a) => ({
    id: (a.id || '').toString().trim().toLowerCase() || `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nombre: (a.nombre || '').toString().trim() || 'Sin nombre',
    duracionMinutos: Math.max(15, Math.min(120, parseInt(a.duracionMinutos, 10) || 30)),
  }))
  await db.collection(COL_CONFIG).doc(DOC_ACTIVIDADES).set({ items })
  return { actividades: items }
})

/**
 * Devuelve los horarios ocupados para una fecha (citas no canceladas).
 * Opcional excludeCitaId: excluye esa cita del cálculo (para reagendar).
 */
exports.getHorariosDisponibles = functions.https.onCall(async (data, context) => {
  const { fecha, excludeCitaId } = data || {}
  if (!fecha) {
    throw new functions.https.HttpsError('invalid-argument', 'Falta fecha')
  }
  const fechaStr = typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
    ? fecha
    : fechaToString(fecha)
  const ref = db.collection(COL_CITAS)
  const snap = await ref
    .where('fecha', '==', fechaStr)
    .where('estado', '!=', ESTADOS.CANCELADA)
    .get()
  const ocupadosSet = new Set()
  snap.forEach((doc) => {
    if (excludeCitaId && doc.id === excludeCitaId) return
    const d = doc.data()
    if (citaLiberada(d, fechaStr)) return
    const hora = d.hora
    const duracionMinutos = typeof d.duracionMinutos === 'number' ? d.duracionMinutos : 30
    const slots = slotsOcupadosPorCita(hora, duracionMinutos)
    slots.forEach((s) => ocupadosSet.add(s))
  })
  const ocupados = Array.from(ocupadosSet)
  return { ocupados }
})

/**
 * Elimina un expediente (todas las citas con ese teléfono). Requiere auth (admin).
 */
exports.deleteExpediente = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión')
  }
  const telefono = (data?.telefono || '').toString().replace(/\D/g, '')
  if (!telefono || telefono.length < 10) {
    throw new functions.https.HttpsError('invalid-argument', 'Teléfono requerido')
  }
  const ref = db.collection(COL_CITAS)
  const snap = await ref.where('telefono', '==', telefono).get()
  const batch = db.batch()
  snap.docs.forEach((doc) => {
    batch.delete(doc.ref)
  })
  await batch.commit()
  return { eliminados: snap.size }
})

/**
 * Reagenda una cita (cambia fecha y hora). Requiere auth (admin). Comprueba que el nuevo horario esté libre.
 * Al actualizar fecha/hora, el horario anterior queda liberado para nuevas citas.
 */
exports.reagendarCita = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión')
  }
  const { citaId, nuevaFecha, nuevaHora } = data || {}
  if (!citaId || typeof citaId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'citaId requerido')
  }
  const fechaStr = typeof nuevaFecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(nuevaFecha)
    ? nuevaFecha
    : fechaToString(nuevaFecha)
  if (!nuevaHora || typeof nuevaHora !== 'string' || !SLOTS_VALIDOS.includes(nuevaHora)) {
    throw new functions.https.HttpsError('invalid-argument', 'Horario no válido')
  }
  const ref = db.collection(COL_CITAS)
  const docRef = ref.doc(citaId)
  const docSnap = await docRef.get()
  if (!docSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Cita no encontrada')
  }
  const cita = docSnap.data()
  if (cita.estado === ESTADOS.CANCELADA) {
    throw new functions.https.HttpsError('failed-precondition', 'No se puede reagendar una cita cancelada')
  }
  const duracionMinutos = typeof cita.duracionMinutos === 'number' ? cita.duracionMinutos : 30
  const misSlots = slotsOcupadosPorCita(nuevaHora, duracionMinutos)
  const snap = await ref
    .where('fecha', '==', fechaStr)
    .where('estado', '!=', ESTADOS.CANCELADA)
    .get()
  for (const doc of snap.docs) {
    if (doc.id === citaId) continue
    const d = doc.data()
    if (citaLiberada(d, fechaStr)) continue
    const dur = typeof d.duracionMinutos === 'number' ? d.duracionMinutos : 30
    const slotsCita = slotsOcupadosPorCita(d.hora, dur)
    const conflict = misSlots.some((s) => slotsCita.includes(s))
    if (conflict) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Ese horario ya está ocupado. Elige otro.'
      )
    }
  }
  await docRef.update({ fecha: fechaStr, hora: nuevaHora })
  return { ok: true, fecha: fechaStr, hora: nuevaHora }
})

/**
 * Crea una cita. Validaciones en servidor. Acepta motivo (id de actividad o "otro") y motivoOtro (texto si es "otro").
 * La cita ocupa tantos turnos de 30 min como indique la duración de la actividad.
 */
exports.crearCita = functions.https.onCall(async (data, context) => {
  const { nombre, telefono, motivo, motivoOtro, fecha, hora } = data || {}
  if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
    throw new functions.https.HttpsError('invalid-argument', 'Nombre requerido')
  }
  if (!telefono || typeof telefono !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Teléfono requerido')
  }
  const tel = String(telefono).replace(/\D/g, '')
  if (tel.length < 10) {
    throw new functions.https.HttpsError('invalid-argument', 'Teléfono debe tener al menos 10 dígitos')
  }
  const motivoId = motivo && typeof motivo === 'string' ? motivo.trim().toLowerCase() : ''
  if (!motivoId) {
    throw new functions.https.HttpsError('invalid-argument', 'Indica el motivo de la consulta')
  }
  if (motivoId === 'otro' && (!motivoOtro || typeof motivoOtro !== 'string' || !motivoOtro.trim())) {
    throw new functions.https.HttpsError('invalid-argument', 'Indica el motivo (Otro)')
  }
  const fechaStr = typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
    ? fecha
    : fechaToString(fecha)
  const hoy = fechaToString(new Date())
  if (fechaStr < hoy) {
    throw new functions.https.HttpsError('invalid-argument', 'No se pueden agendar citas en fechas pasadas')
  }
  if (!hora || typeof hora !== 'string' || !SLOTS_VALIDOS.includes(hora)) {
    throw new functions.https.HttpsError('invalid-argument', 'Horario no válido')
  }

  const ref = db.collection(COL_CITAS)
  const configRef = db.collection(COL_CONFIG).doc(DOC_ACTIVIDADES)
  const configSnap = await configRef.get()
  const actividades = configSnap.exists && Array.isArray(configSnap.data()?.items)
    ? configSnap.data().items
    : ACTIVIDADES_DEFAULT

  let duracionMinutos = 30
  let motivoDisplay = motivoOtro && motivoId === 'otro' ? motivoOtro.trim() : 'Otro'
  if (motivoId !== 'otro') {
    const act = actividades.find((a) => (a.id || '').toLowerCase() === motivoId)
    if (act) {
      duracionMinutos = typeof act.duracionMinutos === 'number' ? act.duracionMinutos : 30
      motivoDisplay = act.nombre || motivoId
    }
  }

  const misSlots = slotsOcupadosPorCita(hora, duracionMinutos)

  const snapCitas = await ref
    .where('fecha', '==', fechaStr)
    .where('estado', '!=', ESTADOS.CANCELADA)
    .get()

  for (const doc of snapCitas.docs) {
    const d = doc.data()
    const dur = typeof d.duracionMinutos === 'number' ? d.duracionMinutos : 30
    const slotsCita = slotsOcupadosPorCita(d.hora, dur)
    const conflict = misSlots.some((s) => slotsCita.includes(s))
    if (conflict) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Ese horario ya está ocupado o se solapa con otra cita. Elige otro.'
      )
    }
  }

  const tieneCitaFutura = await (async () => {
    const snap1 = await ref.where('telefono', '==', tel).get()
    let snap2 = { docs: [] }
    if (tel.length === 10) {
      snap2 = await ref.where('telefono', '==', '52' + tel).get()
    } else if (tel.length === 12 && tel.startsWith('52')) {
      snap2 = await ref.where('telefono', '==', tel.slice(2)).get()
    }
    const todosLosDocs = [...snap1.docs]
    snap2.docs.forEach((doc) => {
      if (!todosLosDocs.some((d) => d.id === doc.id)) todosLosDocs.push(doc)
    })
    return todosLosDocs.some((doc) => {
      const data = doc.data()
      if (data.estado === ESTADOS.CANCELADA) return false
      const f = data.fecha || ''
      const horaStr = String(data.hora || '')
      if (!f || !horaStr) return true
      const [y, m, dia] = f.split('-').map(Number)
      const [hr, min] = horaStr.split(':').map(Number)
      const ts = new Date(y, m - 1, dia, hr || 0, min || 0, 0, 0).getTime()
      return !Number.isNaN(ts) && ts > Date.now()
    })
  })()
  if (tieneCitaFutura) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Ya tienes una cita próxima con este número. Cancélala o espera a que pase la hora de la cita para agendar otra.'
    )
  }

  const folio = await generarFolioUnico()
  const docCita = {
    nombre: nombre.trim(),
    telefono: tel,
    motivo: motivoDisplay,
    fecha: fechaStr,
    hora,
    duracionMinutos,
    estado: ESTADOS.ACTIVA,
    folio,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }
  const wr = await ref.add(docCita)
  return {
    id: wr.id,
    folio: docCita.folio,
    nombre: docCita.nombre,
    telefono: docCita.telefono,
    motivo: docCita.motivo,
    fecha: docCita.fecha,
    hora: docCita.hora,
    duracionMinutos: docCita.duracionMinutos,
    estado: docCita.estado,
  }
})

/**
 * Consulta una cita por folio (público, sin auth). No se compara el folio con nadie; solo devuelve esa cita.
 */
exports.getCitaPorFolio = functions.https.onCall(async (data, context) => {
  const folio = (data?.folio || '').toString().trim().toUpperCase()
  if (!folio || folio.length !== FOLIO_LENGTH) {
    return { cita: null }
  }
  const snap = await db.collection(COL_CITAS).where('folio', '==', folio).limit(1).get()
  if (snap.empty) return { cita: null }
  const doc = snap.docs[0]
  const cita = doc.data()
  return {
    cita: {
      id: doc.id,
      folio: cita.folio,
      nombre: cita.nombre,
      fecha: cita.fecha,
      hora: cita.hora,
      motivo: cita.motivo,
      estado: cita.estado,
    },
  }
})

/**
 * Asegura que exista el documento del admin (para que reciba notificaciones en la campana).
 * Se llama al abrir el panel; así getAdminUids() lo incluye aunque aún no tenga token FCM.
 */
exports.ensureAdminDoc = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión')
  }
  const uid = context.auth.uid
  const ref = db.collection(COL_ADMINS).doc(uid)
  const snap = await ref.get()
  if (!snap.exists) {
    await ref.set({ fcmTokens: [] })
  }
  return { ok: true }
})

/**
 * Registra el FCM token del admin para enviar notificaciones push. Requiere auth.
 */
exports.setAdminFcmToken = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión')
  }
  const token = (data?.token || '').toString().trim()
  if (!token) {
    throw new functions.https.HttpsError('invalid-argument', 'Token requerido')
  }
  const uid = context.auth.uid
  const ref = db.collection(COL_ADMINS).doc(uid)
  await ref.set({ fcmTokens: admin.firestore.FieldValue.arrayUnion(token) }, { merge: true })
  return { ok: true }
})

/**
 * Marca una notificación como leída. Requiere auth.
 */
exports.marcarNotificacionLeida = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión')
  }
  const notifId = (data?.notifId || '').toString().trim()
  if (!notifId) {
    throw new functions.https.HttpsError('invalid-argument', 'notifId requerido')
  }
  const uid = context.auth.uid
  const ref = db.collection(COL_ADMINS).doc(uid).collection(SUBCOL_NOTIFICACIONES).doc(notifId)
  const snap = await ref.get()
  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'Notificación no encontrada')
  }
  await ref.update({ leida: true })
  return { ok: true }
})

/**
 * Notifica a los admins 5 min antes de cada cita activa. Se ejecuta cada minuto.
 */
exports.notificarProximaCita = functions.pubsub.schedule('every 1 minutes').onRun(async () => {
  const now = Date.now()
  const in5Min = now + 5 * 60 * 1000
  const windowStart = now + 4.5 * 60 * 1000
  const windowEnd = now + 5.5 * 60 * 1000
  const snap = await db.collection(COL_CITAS)
    .where('estado', '!=', ESTADOS.CANCELADA)
    .get()
  const citasToNotify = []
  snap.docs.forEach((doc) => {
    const d = doc.data()
    if (d.proximaCitaNotificada) return
    const [y, m, day] = (d.fecha || '').split('-').map(Number)
    const [hh, mm] = String(d.hora || '09:00').split(':').map(Number)
    const ts = new Date(y, (m || 1) - 1, day || 1, hh || 0, mm || 0, 0, 0).getTime()
    if (ts >= windowStart && ts < windowEnd) {
      citasToNotify.push({ id: doc.id, ref: doc.ref, ...d })
    }
  })
  for (const cita of citasToNotify) {
    await notificarAdmins({
      tipo: 'proxima_cita',
      titulo: 'Cita en 5 minutos',
      mensaje: `${cita.nombre || 'Paciente'} · ${cita.fecha} ${cita.hora}`,
      citaId: cita.id,
      fechaCita: cita.fecha,
      hora: cita.hora,
    })
    await cita.ref.update({ proximaCitaNotificada: true })
  }
  return null
})

/**
 * Cancela una cita por folio (público, sin auth). Solo si la cita existe y no está ya cancelada.
 * Notifica a los admins.
 */
exports.cancelarCitaPorFolio = functions.https.onCall(async (data, context) => {
  const folio = (data?.folio || '').toString().trim().toUpperCase()
  if (!folio || folio.length !== FOLIO_LENGTH) {
    throw new functions.https.HttpsError('invalid-argument', 'Folio no válido')
  }
  const snap = await db.collection(COL_CITAS).where('folio', '==', folio).limit(1).get()
  if (snap.empty) {
    throw new functions.https.HttpsError('not-found', 'No se encontró la cita con ese folio')
  }
  const doc = snap.docs[0]
  const cita = doc.data()
  if (cita.estado === ESTADOS.CANCELADA) {
    throw new functions.https.HttpsError('failed-precondition', 'La cita ya está cancelada')
  }
  await doc.ref.update({ estado: ESTADOS.CANCELADA })
  try {
    await notificarAdmins({
      tipo: 'cita_cancelada',
      titulo: 'Cita cancelada',
      mensaje: `${cita.nombre || 'Paciente'} · ${cita.fecha} ${cita.hora} (folio ${folio})`,
      citaId: doc.id,
      fechaCita: cita.fecha,
      hora: cita.hora,
    })
  } catch (e) {
    console.error('Error notificando cancelación:', e)
  }
  return { ok: true }
})

/**
 * Al crear una cita, envía mensaje de confirmación por WhatsApp (plantilla con folio o cita_confirmacion).
 */
exports.onCitaCreada = functions.firestore
  .document(`${COL_CITAS}/{citaId}`)
  .onCreate(async (snap, context) => {
    const data = snap.data()
    const { nombre, telefono, fecha, hora, estado, folio } = data || {}
    if (estado === ESTADOS.CANCELADA || !telefono || !nombre || !fecha || !hora) return
    const citaId = context.params.citaId
    try {
      await notificarAdmins({
        tipo: 'cita_creada',
        titulo: 'Nueva cita',
        mensaje: `${nombre} · ${fecha} ${hora}${folio ? ` · Folio ${folio}` : ''}`,
        citaId,
        fechaCita: fecha,
        hora,
      })
    } catch (err) {
      console.error('Error notificando admins (nueva cita):', err.message || err)
    }
    try {
      const config = getWhatsAppConfig()
      const hasToken = !!config.token
      const hasPhone = !!config.phoneNumberId
      console.log('Enviando WhatsApp a', telefono, 'para cita', fecha, hora, 'folio:', folio || '-', '| token:', hasToken ? 'ok' : 'FALTA')
      if (!hasToken || !hasPhone) {
        console.error('WhatsApp no enviado: configura token y phone_number_id en Firebase (firebase functions:config:set)')
        return
      }
      // Plantilla en Meta (cita_confirmacion_con_folio). Body con 4 variables: {{1}}=nombre, {{2}}=fecha, {{3}}=hora, {{4}}=folio
      // Texto sugerido en Meta:
      // Hola {{1}} 👋
      // Te recordamos que tu cita dental con el folio {{4}} está programada para el {{2}} a las {{3}} 🦷✨
      // Por favor responde: 1 para confirmar, 2 para cancelar. ¡Será un gusto atenderte! 🙌
      if (folio) {
        const ok = await enviarWhatsAppTemplate(telefono, nombre, fecha, hora, 'cita_confirmacion_con_folio', folio)
        if (ok) console.log('WhatsApp enviado con folio a', telefono)
      } else {
        await enviarWhatsAppTemplate(telefono, nombre, fecha, hora, 'cita_confirmacion_bold', null)
        console.log('WhatsApp enviado correctamente a', telefono)
      }
    } catch (err) {
      console.error('Error enviando WhatsApp al crear cita:', err.message || err)
    }
  })

/**
 * Webhook de WhatsApp: verificación (GET) y mensajes entrantes (POST).
 * En Meta: Configuration → Webhook → URL = https://...cloudfunctions.net/whatsappWebhook
 */
exports.whatsappWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method === 'GET') {
    const config = getWhatsAppConfig()
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']
    if (mode === 'subscribe' && token === config.verifyToken && challenge) {
      res.status(200).send(challenge)
      return
    }
    res.status(403).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).end()
    return
  }

  const body = req.body
  if (!body?.entry?.[0]?.changes?.[0]?.value?.messages) {
    res.status(200).send('ok')
    return
  }

  const value = body.entry[0].changes[0].value
  const message = value.messages[0]
  const from = message?.from
  const text = (message?.text?.body || '').trim().toUpperCase()

  if (!from || !text) {
    res.status(200).send('ok')
    return
  }

  const fromClean = String(from).replace(/\D/g, '')

  try {
    const ref = db.collection(COL_CITAS)
    const snap = await ref
      .where('telefono', '==', fromClean)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get()

    const citaDoc = snap.docs.find((d) => d.data().estado !== ESTADOS.CANCELADA)
    if (!citaDoc) {
      await enviarWhatsAppTexto(from, 'No encontramos una cita activa con este número.')
      res.status(200).send('ok')
      return
    }

    const cita = citaDoc.data()

    if (text === '1') {
      await citaDoc.ref.update({ estado: ESTADOS.CONFIRMADA })
      await enviarWhatsAppTexto(from, `Tu cita del ${formatoFechaParaWhatsApp(cita.fecha)} a las ${cita.hora} ha sido confirmada.`)
    } else if (text === '2') {
      await citaDoc.ref.update({ estado: ESTADOS.CANCELADA })
      try {
        await notificarAdmins({
          tipo: 'cita_cancelada',
          titulo: 'Cita cancelada (WhatsApp)',
          mensaje: `${cita.nombre || 'Paciente'} · ${cita.fecha} ${cita.hora}`,
          citaId: citaDoc.id,
          fechaCita: cita.fecha,
          hora: cita.hora,
        })
      } catch (e) {
        console.error('Error notificando cancelación:', e)
      }
      await enviarWhatsAppTexto(from, 'Tu cita ha sido cancelada. Si deseas reagendar, visita nuestro sitio o responde REAGENDAR.')
    } else if (text === 'REAGENDAR') {
      const config = getWhatsAppConfig()
      const url = `${config.siteUrl.replace(/\/$/, '')}/agendar`
      await enviarWhatsAppTexto(from, `Para reagendar tu cita entra a: ${url}`)
    } else {
      await enviarWhatsAppTexto(from, 'Responde 1 para confirmar, 2 para cancelar, o REAGENDAR para cambiar tu cita.')
    }
  } catch (err) {
    console.error('Error procesando webhook WhatsApp:', err)
  }

  res.status(200).send('ok')
})
