import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

const getHorariosDisponiblesFn = httpsCallable(functions, 'getHorariosDisponibles')
const getActividadesFn = httpsCallable(functions, 'getActividades')
const crearCitaFn = httpsCallable(functions, 'crearCita')
const getCitaPorFolioFn = httpsCallable(functions, 'getCitaPorFolio')
const cancelarCitaPorFolioFn = httpsCallable(functions, 'cancelarCitaPorFolio')
const updateActividadesFn = httpsCallable(functions, 'updateActividades')
const deleteExpedienteFn = httpsCallable(functions, 'deleteExpediente')
const reagendarCitaFn = httpsCallable(functions, 'reagendarCita')

/**
 * Convierte horarios "HH:mm" a formato que usa SelectorHorario: "h-min"
 */
function ocupadosToSlotKeys(ocupados) {
  if (!Array.isArray(ocupados)) return []
  return ocupados.map((h) => {
    const [hh, mm] = String(h).split(':')
    return `${parseInt(hh, 10)}-${parseInt(mm || 0, 10)}`
  })
}

/**
 * Obtiene horarios ocupados para una fecha (formato YYYY-MM-DD o Date).
 * Opcional excludeCitaId: excluye esa cita (para reagendar).
 * @returns {Promise<string[]>} array de keys "h-min" para SelectorHorario
 */
export async function getHorariosOcupados(fecha, excludeCitaId) {
  const fechaStr = typeof fecha === 'string' ? fecha : formatFecha(fecha)
  const { data } = await getHorariosDisponiblesFn({ fecha: fechaStr, excludeCitaId: excludeCitaId || undefined })
  return ocupadosToSlotKeys(data?.ocupados ?? [])
}

/**
 * Obtiene actividades (motivos de consulta) con tiempo estimado.
 * @returns {Promise<{ actividades: Array<{ id, nombre, duracionMinutos }> }>}
 */
export async function getActividades() {
  const { data } = await getActividadesFn()
  return data?.actividades ?? []
}

/**
 * Actualiza actividades (admin). Requiere auth.
 */
export async function updateActividades(actividades) {
  const { data } = await updateActividadesFn({ actividades })
  return data?.actividades ?? actividades
}

/**
 * Crea una cita. motivo = id de actividad o "otro"; motivoOtro = texto si motivo es "otro".
 * @returns {Promise<{ id: string, ... }>}
 */
export async function crearCita({ nombre, telefono, motivo, motivoOtro, fecha, hora }) {
  const fechaStr = typeof fecha === 'string' ? fecha : formatFecha(fecha)
  const { data } = await crearCitaFn({ nombre, telefono, motivo, motivoOtro, fecha: fechaStr, hora })
  return data
}

/**
 * Obtiene una cita por folio (público). No se compara con nadie; solo devuelve esa cita.
 * @returns {Promise<{ cita: object | null }>}
 */
export async function getCitaPorFolio(folio) {
  const folioClean = String(folio || '').trim().toUpperCase()
  const { data } = await getCitaPorFolioFn({ folio: folioClean })
  return data
}

/**
 * Cancela una cita por folio (público).
 */
export async function cancelarCitaPorFolio(folio) {
  const folioClean = String(folio || '').trim().toUpperCase()
  const { data } = await cancelarCitaPorFolioFn({ folio: folioClean })
  return data
}

/**
 * Elimina expediente (todas las citas con ese teléfono). Requiere auth.
 */
export async function deleteExpediente(telefono) {
  const tel = String(telefono || '').replace(/\D/g, '')
  const { data } = await deleteExpedienteFn({ telefono: tel })
  return data
}

/**
 * Reagenda una cita (cambia fecha y hora). Requiere auth.
 */
export async function reagendarCita(citaId, nuevaFecha, nuevaHora) {
  const fechaStr = typeof nuevaFecha === 'string' ? nuevaFecha : formatFecha(nuevaFecha)
  const { data } = await reagendarCitaFn({ citaId, nuevaFecha: fechaStr, nuevaHora })
  return data
}

function formatFecha(d) {
  if (!d) return ''
  const date = d instanceof Date ? d : new Date(d)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
