import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Calendario from '../components/Calendario'
import SelectorHorario from '../components/SelectorHorario'
import FormularioCita from '../components/FormularioCita'
import { getHorariosOcupados, crearCita } from '../lib/citasApi'
import './AgendarCita.css'

function AgendarCita() {
  const [fecha, setFecha] = useState(() => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    return hoy
  })
  const [horario, setHorario] = useState(null)
  const [ocupados, setOcupados] = useState([])
  const [cargandoSlots, setCargandoSlots] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [mensajeError, setMensajeError] = useState(null)
  const [confirmacion, setConfirmacion] = useState(null)
  const [formKey, setFormKey] = useState(0)

  useEffect(() => {
    if (!fecha) {
      setOcupados([])
      return
    }
    setCargandoSlots(true)
    setMensajeError(null)
    getHorariosOcupados(fecha)
      .then(setOcupados)
      .catch(() => setOcupados([]))
      .finally(() => setCargandoSlots(false))
  }, [fecha])

  const handleConfirmar = async (datos) => {
    setMensajeError(null)
    setEnviando(true)
    try {
      const data = await crearCita({
        nombre: datos.nombre,
        telefono: datos.telefono,
        motivo: datos.motivo,
        motivoOtro: datos.motivoOtro,
        fecha,
        hora: horario,
      })
      const fechaStr = fecha?.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
      setConfirmacion({
        nombre: datos.nombre.trim(),
        fechaStr,
        horario,
        folio: data?.folio ?? null,
      })
      setFecha(null)
      setHorario(null)
      setFormKey((k) => k + 1)
    } catch (err) {
      const msg = err.message || err.details?.message || err.code || 'No se pudo guardar la cita.'
      setMensajeError(msg)
    } finally {
      setEnviando(false)
    }
  }

  const cerrarModal = () => setConfirmacion(null)

  useEffect(() => {
    if (!confirmacion) return
    const onEscape = (e) => { if (e.key === 'Escape') cerrarModal() }
    document.addEventListener('keydown', onEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onEscape)
      document.body.style.overflow = ''
    }
  }, [confirmacion])

  return (
    <div className="agendar-cita">
      <main className="agendar-cita-main">
        <section className="agendar-cita-paso">
          <h2 className="agendar-cita-paso-titulo">Elige la fecha</h2>
          <Calendario
            valor={fecha}
            onChange={(d) => {
              setFecha(d)
              setHorario(null)
            }}
            disabled={cargandoSlots}
          />
        </section>

        <section className="agendar-cita-paso">
          <h2 className="agendar-cita-paso-titulo">Elige el horario</h2>
          {cargandoSlots && fecha && <p className="agendar-cita-cargando">Cargando horarios...</p>}
          <SelectorHorario
            fecha={fecha}
            valor={horario}
            onChange={setHorario}
            ocupados={ocupados}
          />
        </section>

        <section className={`agendar-cita-paso ${enviando ? 'agendar-cita-paso--cargando' : ''}`}>
          <h2 className="agendar-cita-paso-titulo">Tus datos</h2>
          {mensajeError && (
            <p className="agendar-cita-mensaje error" role="alert">
              {mensajeError}
            </p>
          )}
          <div className="agendar-cita-paso-contenido">
            {enviando && (
              <div className="agendar-cita-spinner-overlay" aria-live="polite" aria-busy="true">
                <div className="agendar-cita-spinner" />
                <span className="agendar-cita-spinner-texto">Enviando cita...</span>
              </div>
            )}
            <FormularioCita
              key={formKey}
              fecha={fecha}
              horario={horario}
              onSubmit={handleConfirmar}
              disabled={enviando}
            />
          </div>
        </section>
      </main>

      <footer className="agendar-cita-footer">
        <p>Sin necesidad de crear cuenta. Te confirmamos por WhatsApp.</p>
        <Link to="/admin" className="agendar-cita-admin-link">Acceso administración</Link>
      </footer>

      {confirmacion && (
        <div
          className="agendar-modal-backdrop"
          onClick={cerrarModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-titulo"
        >
          <div
            className="agendar-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="agendar-modal-icon" aria-hidden>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2 id="modal-titulo" className="agendar-modal-titulo">Cita confirmada</h2>
            {confirmacion.folio && (
              <div className="agendar-modal-folio">
                <span className="agendar-modal-folio-label">Tu folio:</span>{' '}
                <strong className="agendar-modal-folio-code" aria-label={`Folio ${confirmacion.folio}`}>{confirmacion.folio}</strong>
                <p className="agendar-modal-folio-ayuda">Guarda tu folio para consultar o cancelar tu cita. <Link to="/consultar" className="agendar-modal-folio-link" onClick={cerrarModal}>Consultar cita</Link></p>
              </div>
            )}
            <p className="agendar-modal-texto">
              <strong>{confirmacion.nombre}</strong>, tu cita quedó registrada para el{' '}
              <strong>{confirmacion.fechaStr}</strong> a las <strong>{confirmacion.horario}</strong>.
            </p>
            <p className="agendar-modal-sub">Te enviaremos un mensaje por WhatsApp para confirmar.</p>
            <button type="button" className="agendar-modal-boton" onClick={cerrarModal}>
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AgendarCita
