import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getCitaPorFolio, cancelarCitaPorFolio } from '../lib/citasApi'
import { ESTADOS_CITA } from '../lib/firestore'
import './ConsultarCita.css'

function formatearFecha(fechaStr) {
  if (!fechaStr) return '—'
  const [y, m, d] = fechaStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function ConsultarCita() {
  const [folioInput, setFolioInput] = useState('')
  const [cita, setCita] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [modalCancelar, setModalCancelar] = useState(false)
  const [cancelando, setCancelando] = useState(false)

  const folioClean = (v) => String(v).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)

  const handleBuscar = async (e) => {
    e.preventDefault()
    setError(null)
    setCita(null)
    const folio = folioClean(folioInput)
    if (folio.length !== 5) {
      setError('El folio debe tener 5 caracteres (letras y números).')
      return
    }
    setLoading(true)
    try {
      const res = await getCitaPorFolio(folio)
      setCita(res?.cita ?? null)
      if (!res?.cita) setError('No se encontró una cita con ese folio.')
    } catch (err) {
      setError(err.message || 'No se pudo consultar la cita.')
      setCita(null)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelarCita = async () => {
    if (!cita?.folio) return
    setCancelando(true)
    try {
      await cancelarCitaPorFolio(cita.folio)
      const res = await getCitaPorFolio(cita.folio)
      setCita(res?.cita ?? null)
      setModalCancelar(false)
    } catch (err) {
      setError(err.message || 'No se pudo cancelar la cita.')
    } finally {
      setCancelando(false)
    }
  }

  const puedeCancelar = cita && cita.estado !== ESTADOS_CITA.CANCELADA

  return (
    <div className="consultar-cita">
      <main className="consultar-cita-main">
        <section className="consultar-cita-card">
          <h1 className="consultar-cita-titulo">Consultar mi cita</h1>
          <p className="consultar-cita-intro">
            Ingresa el folio de 5 caracteres que recibiste por WhatsApp. No compartas tu folio con nadie.
          </p>

          <form onSubmit={handleBuscar} className="consultar-cita-form">
            <label className="consultar-cita-label">
              Folio
              <input
                type="text"
                value={folioInput}
                onChange={(e) => setFolioInput(folioClean(e.target.value))}
                placeholder="Ej. A3B7K"
                maxLength={5}
                className="consultar-cita-input"
                autoComplete="off"
              />
            </label>
            <button type="submit" className="consultar-cita-boton-buscar" disabled={loading}>
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </form>

          {error && (
            <p className="consultar-cita-error" role="alert">
              {error}
            </p>
          )}

          {cita && (
            <div className="consultar-cita-resultado">
              <h2>Detalle de tu cita</h2>
              <dl className="consultar-cita-detalle">
                <dt>Folio</dt>
                <dd>{cita.folio}</dd>
                <dt>Nombre</dt>
                <dd>{cita.nombre}</dd>
                <dt>Fecha</dt>
                <dd>{formatearFecha(cita.fecha)}</dd>
                <dt>Hora</dt>
                <dd>{cita.hora}</dd>
                <dt>Motivo</dt>
                <dd>{cita.motivo || '—'}</dd>
                <dt>Estado</dt>
                <dd>
                  <span className={`consultar-cita-badge consultar-cita-badge--${((cita.estado === 'CREADA' ? 'ACTIVA' : cita.estado) || 'ACTIVA').toLowerCase()}`}>
                    {(cita.estado === 'CREADA' ? 'ACTIVA' : cita.estado) || ESTADOS_CITA.ACTIVA}
                  </span>
                </dd>
              </dl>
              {puedeCancelar && (
                <button
                  type="button"
                  className="consultar-cita-boton-cancelar"
                  onClick={() => setModalCancelar(true)}
                >
                  Cancelar cita
                </button>
              )}
            </div>
          )}
        </section>

        <p className="consultar-cita-footer">
          <Link to="/">Volver al inicio</Link>
          {' · '}
          <Link to="/agendar">Agendar otra cita</Link>
        </p>
      </main>

      {modalCancelar && (
        <div className="consultar-cita-modal-backdrop" onClick={() => !cancelando && setModalCancelar(false)} role="dialog" aria-modal="true" aria-labelledby="modal-cancelar-titulo">
          <div className="consultar-cita-modal" onClick={(e) => e.stopPropagation()}>
            <h3 id="modal-cancelar-titulo">¿Cancelar esta cita?</h3>
            <p>Si cancelas, deberás agendar una nueva cita cuando lo necesites.</p>
            <div className="consultar-cita-modal-acciones">
              <button type="button" className="consultar-cita-modal-no" onClick={() => !cancelando && setModalCancelar(false)} disabled={cancelando}>
                No, mantener
              </button>
              <button type="button" className="consultar-cita-modal-si" onClick={handleCancelarCita} disabled={cancelando}>
                {cancelando ? 'Cancelando...' : 'Sí, cancelar cita'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
