import './SelectorHorario.css'

const INICIO = 9   // 9:00
const FIN = 18     // 18:00 (último slot termina 18:00)
const INTERVALO = 30 // minutos

function generarSlots() {
  const slots = []
  for (let h = INICIO; h < FIN; h++) {
    for (let m = 0; m < 60; m += INTERVALO) {
      const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      slots.push({ label, hora: h, minuto: m })
    }
  }
  return slots
}

const SLOTS = generarSlots()

/** True si el slot ya pasó hoy (solo aplica cuando la fecha seleccionada es hoy). */
function esSlotPasado(fecha, slot) {
  const hoy = new Date()
  if (fecha.getDate() !== hoy.getDate() ||
      fecha.getMonth() !== hoy.getMonth() ||
      fecha.getFullYear() !== hoy.getFullYear()) {
    return false
  }
  const ahora = hoy.getHours() * 60 + hoy.getMinutes()
  const slotMinutos = slot.hora * 60 + slot.minuto
  return slotMinutos <= ahora
}

function SelectorHorario({ fecha, valor, onChange, ocupados = [] }) {
  if (!fecha) {
    return (
      <div className="selector-horario vacio">
        <p>Selecciona una fecha en el calendario.</p>
      </div>
    )
  }

  const esOcupado = (slot) => {
    const key = `${slot.hora}-${slot.minuto}`
    return ocupados.includes(key)
  }

  const slotsVisibles = SLOTS.filter((slot) => !esSlotPasado(fecha, slot))

  return (
    <div className="selector-horario">
      <h3 className="selector-horario-titulo">Horarios disponibles</h3>
      <p className="selector-horario-fecha">
        {fecha.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>
      <div className="selector-horario-grid">
        {slotsVisibles.map((slot) => {
          const ocupado = esOcupado(slot)
          const seleccionado = valor === slot.label
          return (
            <button
              key={slot.label}
              type="button"
              className={`slot ${ocupado ? 'ocupado' : ''} ${seleccionado ? 'seleccionado' : ''}`}
              onClick={() => !ocupado && onChange(slot.label)}
              disabled={ocupado}
            >
              {slot.label}
            </button>
          )
        })}
      </div>
      {slotsVisibles.length === 0 && (
        <p className="selector-horario-sin-slots">No hay horarios disponibles para este día.</p>
      )}
    </div>
  )
}

export default SelectorHorario
