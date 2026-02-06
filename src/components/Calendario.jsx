import { useState } from 'react'
import './Calendario.css'

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function Calendario({ valor, onChange, minFecha, disabled }) {
  const hoy = minFecha || new Date()
  hoy.setHours(0, 0, 0, 0)

  const [mesActual, setMesActual] = useState(() => {
    const d = valor ? new Date(valor) : new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const anio = mesActual.getFullYear()
  const mes = mesActual.getMonth()
  const primerDia = new Date(anio, mes, 1).getDay()
  const ultimoDia = new Date(anio, mes + 1, 0).getDate()

  const esPasado = (dia) => {
    const d = new Date(anio, mes, dia)
    d.setHours(0, 0, 0, 0)
    return d < hoy
  }

  const esSeleccionado = (dia) => {
    if (!valor) return false
    const v = new Date(valor)
    return v.getDate() === dia && v.getMonth() === mes && v.getFullYear() === anio
  }

  const handleClick = (dia) => {
    if (disabled || esPasado(dia)) return
    onChange(new Date(anio, mes, dia))
  }

  const anterior = () => { if (!disabled) setMesActual(new Date(anio, mes - 1, 1)) }
  const siguiente = () => { if (!disabled) setMesActual(new Date(anio, mes + 1, 1)) }

  const dias = []
  for (let i = 0; i < primerDia; i++) dias.push(null)
  for (let d = 1; d <= ultimoDia; d++) dias.push(d)

  return (
    <div className={`calendario ${disabled ? 'calendario--deshabilitado' : ''}`} aria-busy={disabled}>
      <div className="calendario-cabecera">
        <button type="button" className="calendario-nav" onClick={anterior} aria-label="Mes anterior" disabled={disabled}>
          ‹
        </button>
        <span className="calendario-mes">{MESES[mes]} {anio}</span>
        <button type="button" className="calendario-nav" onClick={siguiente} aria-label="Mes siguiente" disabled={disabled}>
          ›
        </button>
      </div>
      <div className="calendario-dias-semana">
        {DIAS_SEMANA.map((d) => (
          <span key={d} className="calendario-dia-nombre">{d}</span>
        ))}
      </div>
      <div className="calendario-grid">
        {dias.map((dia, i) =>
          dia === null ? (
            <span key={`e-${i}`} className="calendario-celda vacia" />
          ) : (
            <button
              key={dia}
              type="button"
              className={`calendario-celda ${esPasado(dia) ? 'pasado' : ''} ${esSeleccionado(dia) ? 'seleccionado' : ''}`}
              onClick={() => handleClick(dia)}
              disabled={esPasado(dia) || disabled}
            >
              {dia}
            </button>
          )
        )}
      </div>
    </div>
  )
}

export default Calendario
