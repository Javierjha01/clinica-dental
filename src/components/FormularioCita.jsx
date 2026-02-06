import { useState, useEffect } from 'react'
import { getActividades } from '../lib/citasApi'
import './FormularioCita.css'

const ID_OTRO = 'otro'

function FormularioCita({ fecha, horario, onSubmit, disabled }) {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [motivo, setMotivo] = useState('')
  const [motivoOtro, setMotivoOtro] = useState('')
  const [actividades, setActividades] = useState([])
  const [cargandoActividades, setCargandoActividades] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getActividades()
      .then(setActividades)
      .catch(() => setActividades([]))
      .finally(() => setCargandoActividades(false))
  }, [])

  const formatoTelefono = (v) => v.replace(/\D/g, '').slice(0, 15)

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    const tel = formatoTelefono(telefono)
    if (!nombre.trim()) {
      setError('Escribe tu nombre completo.')
      return
    }
    if (!tel || tel.length < 10) {
      setError('Escribe un número de WhatsApp válido (10 dígitos).')
      return
    }
    if (!motivo) {
      setError('Indica el motivo de la consulta.')
      return
    }
    if (motivo === ID_OTRO && !motivoOtro.trim()) {
      setError('Indica el motivo (Otro).')
      return
    }

    onSubmit({
      nombre: nombre.trim(),
      telefono: tel,
      motivo: motivo === ID_OTRO ? ID_OTRO : motivo,
      motivoOtro: motivo === ID_OTRO ? motivoOtro.trim() : undefined,
      fecha,
      horario,
    })
  }

  const listo = fecha && horario && !disabled

  return (
    <form className="formulario-cita" onSubmit={handleSubmit}>
      <h3 className="formulario-cita-titulo">Tus datos</h3>

      <label className="formulario-cita-label">
        Nombre completo
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej. María García López"
          autoComplete="name"
        />
      </label>

      <label className="formulario-cita-label">
        WhatsApp
        <input
          type="tel"
          value={telefono}
          onChange={(e) => setTelefono(formatoTelefono(e.target.value))}
          placeholder="10 dígitos, ej. 5512345678"
          autoComplete="tel"
        />
      </label>

      <label className="formulario-cita-label">
        Motivo de la consulta
        {cargandoActividades ? (
          <span className="formulario-cita-cargando">Cargando opciones...</span>
        ) : (
          <>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="formulario-cita-select"
            >
              <option value="">Elige una opción</option>
              {actividades.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre} ({a.duracionMinutos || 30} min)
                </option>
              ))}
              <option value={ID_OTRO}>Otro</option>
            </select>
            {motivo === ID_OTRO && (
              <input
                type="text"
                value={motivoOtro}
                onChange={(e) => setMotivoOtro(e.target.value)}
                placeholder="Describe el motivo de tu consulta"
                className="formulario-cita-input-otro"
              />
            )}
          </>
        )}
      </label>

      {error && <p className="formulario-cita-error" role="alert">{error}</p>}

      <button
        type="submit"
        className="formulario-cita-boton"
        disabled={!listo}
      >
        Confirmar cita
      </button>
    </form>
  )
}

export default FormularioCita
