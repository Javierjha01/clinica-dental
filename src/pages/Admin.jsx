import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { db } from '../lib/firebase'
import { collection, doc, query, where, orderBy, limit, onSnapshot, updateDoc } from 'firebase/firestore'
import { COLLECTIONS, ESTADOS_CITA } from '../lib/firestore'
import { getActividades, updateActividades, deleteExpediente, reagendarCita, getHorariosOcupados } from '../lib/citasApi'
import './Admin.css'

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const SLOTS_HORARIO = (() => {
  const s = []
  for (let h = 9; h < 18; h++) {
    for (let m = 0; m < 60; m += 30) {
      s.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return s
})()
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function formatFecha(d) {
  const date = d instanceof Date ? d : new Date(d)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getMonthRange(d) {
  const date = new Date(d)
  const y = date.getFullYear()
  const m = date.getMonth()
  const first = new Date(y, m, 1)
  const last = new Date(y, m + 1, 0)
  return { first, last, inicio: formatFecha(first), fin: formatFecha(last) }
}

/** True si la cita ya pasó (fecha + hora <= ahora). */
function isCitaPasada(cita) {
  if (!cita?.fecha || !cita?.hora) return false
  const [y, m, d] = cita.fecha.split('-').map(Number)
  const [h, min] = String(cita.hora).split(':').map(Number)
  const fechaHora = new Date(y, m - 1, d, h || 0, min || 0, 0, 0)
  return fechaHora.getTime() <= Date.now()
}

/** True si el horario (fechaStr + slot "HH:mm") ya pasó. */
function esHorarioPasado(fechaStr, slot) {
  if (!fechaStr || !slot) return false
  const [y, m, d] = fechaStr.split('-').map(Number)
  const [hh, mm] = String(slot).split(':').map(Number)
  const ts = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0).getTime()
  return ts <= Date.now()
}

/** Estado a mostrar en UI: si ya pasó la hora y no está cancelada → "Finalizada"; si no, el estado real. */
function estadoParaMostrar(cita) {
  if (!cita) return ESTADOS_CITA.ACTIVA
  if (cita.estado === ESTADOS_CITA.CANCELADA) return ESTADOS_CITA.CANCELADA
  if (isCitaPasada(cita)) return 'Finalizada'
  return (cita.estado === 'CREADA' ? ESTADOS_CITA.ACTIVA : cita.estado) || ESTADOS_CITA.ACTIVA
}

function Admin() {
  const { user, loading: authLoading, signIn, signOut } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  const [seccion, setSeccion] = useState('citas')
  const [subSeccion, setSubSeccion] = useState('calendario')
  const [actividades, setActividades] = useState([])
  const [guardandoActividades, setGuardandoActividades] = useState(false)
  const [mensajeActividades, setMensajeActividades] = useState('')
  const [confirmEliminarExpediente, setConfirmEliminarExpediente] = useState(false)
  const [eliminandoExpediente, setEliminandoExpediente] = useState(false)
  const [citaParaReagendar, setCitaParaReagendar] = useState(null)
  const [fechaReagendar, setFechaReagendar] = useState('')
  const [horaReagendar, setHoraReagendar] = useState('')
  const [ocupadosReagendar, setOcupadosReagendar] = useState([])
  const [cargandoOcupadosReagendar, setCargandoOcupadosReagendar] = useState(false)
  const [guardandoReagendar, setGuardandoReagendar] = useState(false)
  const [errorReagendar, setErrorReagendar] = useState('')
  const [mesReagendar, setMesReagendar] = useState(() => new Date())
  const [mesCalendario, setMesCalendario] = useState(() => new Date())
  const [citasMes, setCitasMes] = useState([])
  const [citasRecientes, setCitasRecientes] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedCita, setSelectedCita] = useState(null)
  const [selectedExpediente, setSelectedExpediente] = useState(null)
  const [busquedaExpediente, setBusquedaExpediente] = useState('')
  const [loadingCitas, setLoadingCitas] = useState(false)
  const [actualizandoAsistio, setActualizandoAsistio] = useState(null)

  const { inicio: mesInicio, fin: mesFin } = getMonthRange(mesCalendario)

  useEffect(() => {
    if (!user) return
    setLoadingCitas(true)
    const ref = collection(db, COLLECTIONS.CITAS)
    const q = query(
      ref,
      where('fecha', '>=', mesInicio),
      where('fecha', '<=', mesFin),
      orderBy('fecha', 'asc'),
      orderBy('hora', 'asc')
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        setCitasMes(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
        setLoadingCitas(false)
      },
      (err) => {
        setLoadingCitas(false)
        console.error(err)
      }
    )
    return () => unsub()
  }, [user, mesInicio, mesFin])

  useEffect(() => {
    if (!user) return
    const ref = collection(db, COLLECTIONS.CITAS)
    const q = query(ref, orderBy('fecha', 'desc'), limit(500))
    const unsub = onSnapshot(q, (snap) => {
      setCitasRecientes(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    })
    return () => unsub()
  }, [user])

  useEffect(() => {
    if (seccion === 'actividades' && user) {
      setMensajeActividades('')
      getActividades()
        .then(setActividades)
        .catch(() => setMensajeActividades('No se pudieron cargar las actividades.'))
    }
  }, [seccion, user])

  const guardarActividades = async () => {
    setGuardandoActividades(true)
    setMensajeActividades('')
    try {
      await updateActividades(actividades)
      setMensajeActividades('Actividades guardadas.')
    } catch (err) {
      setMensajeActividades(err?.message || 'Error al guardar.')
    } finally {
      setGuardandoActividades(false)
    }
  }

  const actualizarActividad = (index, campo, valor) => {
    setActividades((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [campo]: valor }
      return next
    })
  }

  useEffect(() => {
    if (!citaParaReagendar || !fechaReagendar) {
      setOcupadosReagendar([])
      setCargandoOcupadosReagendar(false)
      return
    }
    setCargandoOcupadosReagendar(true)
    getHorariosOcupados(fechaReagendar, citaParaReagendar.id)
      .then((ocupados) => {
        setOcupadosReagendar(ocupados)
        setHoraReagendar((prev) => {
          if (!prev) return prev
          if (esHorarioPasado(fechaReagendar, prev)) return ''
          const [hh, mm] = prev.split(':').map(Number)
          const key = `${hh}-${mm || 0}`
          return ocupados.includes(key) ? '' : prev
        })
      })
      .catch(() => setOcupadosReagendar([]))
      .finally(() => setCargandoOcupadosReagendar(false))
  }, [citaParaReagendar, fechaReagendar])

  useEffect(() => {
    if (!fechaReagendar || !horaReagendar) return
    if (esHorarioPasado(fechaReagendar, horaReagendar)) setHoraReagendar('')
  }, [fechaReagendar, horaReagendar])

  const eliminarExpedienteConfirmar = async () => {
    if (!selectedExpediente) return
    setEliminandoExpediente(true)
    try {
      await deleteExpediente(selectedExpediente.telefono)
      setSelectedExpediente(null)
      setConfirmEliminarExpediente(false)
    } catch (err) {
      console.error(err)
    } finally {
      setEliminandoExpediente(false)
    }
  }

  const abrirReagendar = (cita) => {
    setCitaParaReagendar(cita)
    const fechaInicial = cita.fecha || formatFecha(new Date())
    setFechaReagendar(fechaInicial)
    setHoraReagendar('')
    setErrorReagendar('')
    if (cita.fecha) {
      const [y, m] = cita.fecha.split('-').map(Number)
      setMesReagendar(new Date(y, m - 1, 1))
    } else {
      setMesReagendar(new Date())
    }
  }

  const reagendarConfirmar = async () => {
    if (!citaParaReagendar || !fechaReagendar || !horaReagendar) return
    setGuardandoReagendar(true)
    setErrorReagendar('')
    try {
      await reagendarCita(citaParaReagendar.id, fechaReagendar, horaReagendar)
      setCitaParaReagendar(null)
      setFechaReagendar('')
      setHoraReagendar('')
    } catch (err) {
      setErrorReagendar(err?.message || 'No se pudo reagendar.')
    } finally {
      setGuardandoReagendar(false)
    }
  }

  /** Solo citas que aún están en horario (se pueden atender). */
  const citasActivas = useMemo(
    () => citasRecientes.filter(
      (c) => c.estado !== ESTADOS_CITA.CANCELADA && !isCitaPasada(c)
    ),
    [citasRecientes]
  )
  /** Citas cuya hora ya pasó y aún no tienen asistencia marcada (solo esas aparecen en Finalizadas). */
  const citasFinalizadas = useMemo(
    () => citasRecientes.filter(
      (c) => c.estado !== ESTADOS_CITA.CANCELADA && isCitaPasada(c) && c.asistio !== true && c.asistio !== false
    ),
    [citasRecientes]
  )
  /** Citas pasadas ya marcadas como asistió / no asistió (no aparecen en Finalizadas). */
  const citasAsistio = useMemo(
    () => citasRecientes.filter(
      (c) => c.estado !== ESTADOS_CITA.CANCELADA && isCitaPasada(c) && c.asistio === true
    ),
    [citasRecientes]
  )
  const citasNoAsistio = useMemo(
    () => citasRecientes.filter(
      (c) => c.estado !== ESTADOS_CITA.CANCELADA && isCitaPasada(c) && c.asistio === false
    ),
    [citasRecientes]
  )
  const citasCanceladas = useMemo(
    () => citasRecientes.filter((c) => c.estado === ESTADOS_CITA.CANCELADA),
    [citasRecientes]
  )

  const marcarAsistio = async (citaId, valor) => {
    if (actualizandoAsistio) return
    setActualizandoAsistio(citaId)
    try {
      const ref = doc(db, COLLECTIONS.CITAS, citaId)
      await updateDoc(ref, { asistio: valor })
    } catch (err) {
      console.error(err)
    } finally {
      setActualizandoAsistio(null)
    }
  }

  const expedientes = useMemo(() => {
    const byTel = new Map()
    citasRecientes.forEach((c) => {
      const key = (c.telefono || '').toString().trim()
      if (!key) return
      if (!byTel.has(key)) {
        byTel.set(key, { telefono: key, nombre: c.nombre || '', citas: [] })
      }
      byTel.get(key).citas.push(c)
      if (c.nombre) byTel.get(key).nombre = c.nombre
    })
    return Array.from(byTel.values()).map((p) => ({
      ...p,
      citas: [...p.citas].sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora)),
      ultimaCita: p.citas[0],
    }))
  }, [citasRecientes])

  const expedientesFiltrados = useMemo(() => {
    const q = busquedaExpediente.trim().toLowerCase()
    if (!q) return expedientes
    return expedientes.filter(
      (p) =>
        (p.nombre || '').toLowerCase().includes(q) ||
        (p.telefono || '').replace(/\D/g, '').includes(q.replace(/\D/g, ''))
    )
  }, [expedientes, busquedaExpediente])

  const diasConCitas = useMemo(() => {
    const set = new Set()
    citasMes.forEach((c) => set.add(c.fecha))
    return set
  }, [citasMes])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginError('')
    try {
      await signIn(email, password)
    } catch (err) {
      setLoginError(err.message || 'Error al iniciar sesión')
    }
  }

  if (authLoading) {
    return (
      <div className="admin admin-loading">
        <div className="admin-spinner" />
        <p>Cargando...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="admin admin-login">
        <div className="admin-login-wrap">
          <div className="admin-login-card">
            <h1>Panel de administración</h1>
            <p className="admin-login-sub">Clínica Dental</p>
            <form onSubmit={handleLogin}>
              <label>
                Correo
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@clinica.com"
                  required
                />
              </label>
              <label>
                Contraseña
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              {loginError && <p className="admin-login-error" role="alert">{loginError}</p>}
              <button type="submit">Entrar</button>
            </form>
            <Link to="/" className="admin-login-link">Ver sitio público</Link>
          </div>
          <footer className="site-footer">
            <div className="site-footer-inner">
              <p className="site-footer-copy">
                © {new Date().getFullYear()} Clínica Dental. Todos los derechos reservados.
              </p>
              <div className="site-footer-contacto">
                <a href="mailto:contacto@clinicadental.com" className="site-footer-link">contacto@clinicadental.com</a>
                <span className="site-footer-sep"> · </span>
                <a href="tel:+525512345678" className="site-footer-link">(55) 1234-5678</a>
              </div>
              <div className="site-footer-enlaces">
                <Link to="/" className="site-footer-link">Inicio</Link>
                <span className="site-footer-sep"> · </span>
                <Link to="/agendar" className="site-footer-link">Agendar cita</Link>
                <span className="site-footer-sep"> · </span>
                <Link to="/consultar" className="site-footer-link">Consultar cita</Link>
              </div>
              <nav className="site-footer-redes" aria-label="Redes sociales">
                <a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" className="site-footer-icon" title="Facebook" aria-label="Facebook">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                </a>
                <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" className="site-footer-icon" title="Instagram" aria-label="Instagram">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
                </a>
                <a href="https://wa.me/5215512345678" target="_blank" rel="noopener noreferrer" className="site-footer-icon" title="WhatsApp" aria-label="WhatsApp">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                </a>
              </nav>
            </div>
          </footer>
        </div>
      </div>
    )
  }

  const hoyStr = formatFecha(new Date())

  const anteriorMes = () => setMesCalendario((d) => new Date(d.getFullYear(), d.getMonth() - 1))
  const siguienteMes = () => setMesCalendario((d) => new Date(d.getFullYear(), d.getMonth() + 1))

  const citasDelDia = selectedDate ? citasMes.filter((c) => c.fecha === formatFecha(selectedDate)) : []

  const buildCalendarioGrid = () => {
    const { first, last } = getMonthRange(mesCalendario)
    const primerDia = first.getDay()
    const offset = primerDia === 0 ? 6 : primerDia - 1
    const ultimoDia = last.getDate()
    const dias = []
    for (let i = 0; i < offset; i++) dias.push(null)
    for (let d = 1; d <= ultimoDia; d++) dias.push(d)
    return { dias, mes: mesCalendario.getMonth(), anio: mesCalendario.getFullYear() }
  }

  const { dias, mes, anio } = buildCalendarioGrid()

  return (
    <div className="admin">
      <header className="admin-header">
        <div className="admin-header-inner">
          <Link to="/" className="admin-logo">
            Clínica Dental <span className="admin-logo-badge">Admin</span>
          </Link>
          <nav className="admin-nav">
            <button
              type="button"
              className={`admin-nav-item ${seccion === 'citas' ? 'activo' : ''}`}
              onClick={() => { setSeccion('citas'); setSubSeccion('calendario'); setSelectedDate(null); setSelectedCita(null) }}
            >
              Citas
            </button>
            <button
              type="button"
              className={`admin-nav-item ${seccion === 'expedientes' ? 'activo' : ''}`}
              onClick={() => { setSeccion('expedientes'); setSelectedCita(null); setSelectedExpediente(null) }}
            >
              Expedientes
            </button>
            <button
              type="button"
              className={`admin-nav-item ${seccion === 'actividades' ? 'activo' : ''}`}
              onClick={() => { setSeccion('actividades'); setSelectedCita(null); setSelectedExpediente(null) }}
            >
              Actividades
            </button>
          </nav>
          <div className="admin-header-actions">
            <span className="admin-email">{user.email}</span>
            <button type="button" className="admin-logout" onClick={signOut}>
              Cerrar sesión
            </button>
          </div>
        </div>
        {seccion === 'citas' && (
          <div className="admin-subnav">
            <button
              type="button"
              className={subSeccion === 'calendario' ? 'activo' : ''}
              onClick={() => { setSubSeccion('calendario'); setSelectedDate(null); setSelectedCita(null) }}
            >
              Calendario
              <span className="admin-subnav-badge">{citasMes.length}</span>
            </button>
            <button
              type="button"
              className={subSeccion === 'activas' ? 'activo' : ''}
              onClick={() => { setSubSeccion('activas'); setSelectedCita(null) }}
            >
              Activas
              <span className="admin-subnav-badge">{citasActivas.length}</span>
            </button>
            <button
              type="button"
              className={subSeccion === 'finalizadas' ? 'activo' : ''}
              onClick={() => { setSubSeccion('finalizadas'); setSelectedCita(null) }}
            >
              Finalizadas
              <span className="admin-subnav-badge">{citasFinalizadas.length}</span>
            </button>
            <button
              type="button"
              className={subSeccion === 'asistio' ? 'activo' : ''}
              onClick={() => { setSubSeccion('asistio'); setSelectedCita(null) }}
            >
              Asistió
              <span className="admin-subnav-badge">{citasAsistio.length}</span>
            </button>
            <button
              type="button"
              className={subSeccion === 'no-asistio' ? 'activo' : ''}
              onClick={() => { setSubSeccion('no-asistio'); setSelectedCita(null) }}
            >
              No asistió
              <span className="admin-subnav-badge">{citasNoAsistio.length}</span>
            </button>
            <button
              type="button"
              className={subSeccion === 'canceladas' ? 'activo' : ''}
              onClick={() => { setSubSeccion('canceladas'); setSelectedCita(null) }}
            >
              Canceladas
              <span className="admin-subnav-badge">{citasCanceladas.length}</span>
            </button>
          </div>
        )}
      </header>

      <main className="admin-main">
        {seccion === 'citas' && subSeccion === 'calendario' && (
          <>
            <div className="admin-calendario-wrap">
              <div className="admin-calendario-header">
                <button type="button" className="admin-cal-btn" onClick={anteriorMes} aria-label="Mes anterior">
                  ‹
                </button>
                <h2 className="admin-calendario-mes">{MESES[mes]} {anio}</h2>
                <button type="button" className="admin-cal-btn" onClick={siguienteMes} aria-label="Mes siguiente">
                  ›
                </button>
              </div>
              <div className="admin-calendario-dias-semana">
                {DIAS_SEMANA.map((d) => (
                  <span key={d} className="admin-cal-dia-nombre">{d}</span>
                ))}
              </div>
              <div className="admin-calendario-grid">
                {dias.map((dia, i) => {
                  if (dia === null) {
                    return <span key={`e-${i}`} className="admin-cal-celda vacia" />
                  }
                  const fechaStr = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
                  const tieneCita = diasConCitas.has(fechaStr)
                  const esHoy = fechaStr === hoyStr
                  const esPasado = fechaStr < hoyStr
                  const isSelected = selectedDate && formatFecha(selectedDate) === fechaStr
                  return (
                    <button
                      key={dia}
                      type="button"
                      className={`admin-cal-celda ${tieneCita ? 'con-cita' : 'disponible'} ${esHoy ? 'hoy' : ''} ${esPasado ? 'pasado' : ''} ${isSelected ? 'seleccionado' : ''}`}
                      onClick={() => setSelectedDate(new Date(anio, mes, dia))}
                    >
                      {dia}
                    </button>
                  )
                })}
              </div>
            </div>

            {selectedDate && (
              <div className="admin-detalle-dia">
                <h3>Citas del {selectedDate.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                {loadingCitas ? (
                  <p className="admin-cargando">Cargando...</p>
                ) : citasDelDia.length === 0 ? (
                  <p className="admin-vacio">No hay citas este día.</p>
                ) : (
                  <ul className="admin-lista-citas-dia">
                    {citasDelDia.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className={`admin-cita-mini ${selectedCita?.id === c.id ? 'seleccionado' : ''}`}
                          onClick={() => setSelectedCita(selectedCita?.id === c.id ? null : c)}
                        >
                          <span className="admin-cita-mini-hora">{c.hora}</span>
                          <span className="admin-cita-mini-nombre">{c.nombre}</span>
                          <span className={`admin-cita-mini-estado admin-cita-mini-estado--${estadoParaMostrar(c).toLowerCase()}`}>
                            {estadoParaMostrar(c)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {selectedCita && (
              <div className="admin-modal-backdrop" onClick={() => setSelectedCita(null)} role="dialog" aria-modal="true">
                <div className="admin-modal admin-modal-detalle" onClick={(e) => e.stopPropagation()}>
                  <div className="admin-modal-header">
                    <h3>Detalle del paciente</h3>
                    <button type="button" className="admin-modal-cerrar" onClick={() => setSelectedCita(null)} aria-label="Cerrar">
                      ×
                    </button>
                  </div>
                  <div className="admin-modal-body">
                    <p><strong>Nombre:</strong> {selectedCita.nombre}</p>
                    <p><strong>Teléfono / WhatsApp:</strong>{' '}
                      <a href={`https://wa.me/${(selectedCita.telefono || '').replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="admin-link-whatsapp">
                        {selectedCita.telefono}
                      </a>
                    </p>
                    <p><strong>Motivo:</strong> {selectedCita.motivo}</p>
                    <p><strong>Fecha:</strong> {selectedCita.fecha}</p>
                    <p><strong>Hora:</strong> {selectedCita.hora}</p>
                    {selectedCita.duracionMinutos != null && (
                      <p><strong>Duración:</strong> {selectedCita.duracionMinutos} min</p>
                    )}
                    <p><strong>Estado:</strong> <span className={`admin-badge admin-badge--${estadoParaMostrar(selectedCita).toLowerCase()}`}>{estadoParaMostrar(selectedCita)}</span></p>
                    {isCitaPasada(selectedCita) && (
                      <>
                        <p><strong>Asistencia:</strong>{' '}
                          {selectedCita.asistio === true && <span className="admin-badge admin-badge--asistio">Asistió</span>}
                          {selectedCita.asistio === false && <span className="admin-badge admin-badge--no-asistio">No asistió</span>}
                          {(selectedCita.asistio === undefined || selectedCita.asistio === null) && <span className="admin-texto-suave">Sin marcar</span>}
                        </p>
                        <div className="admin-modal-detalle-acciones">
                          {(selectedCita.asistio === undefined || selectedCita.asistio === null) ? (
                            <>
                              <button
                                type="button"
                                className="admin-btn-asistio si"
                                onClick={() => { setSelectedCita((p) => ({ ...p, asistio: true })); marcarAsistio(selectedCita.id, true) }}
                                disabled={actualizandoAsistio === selectedCita.id}
                              >
                                Asistió
                              </button>
                              <button
                                type="button"
                                className="admin-btn-asistio no"
                                onClick={() => { setSelectedCita((p) => ({ ...p, asistio: false })); marcarAsistio(selectedCita.id, false) }}
                                disabled={actualizandoAsistio === selectedCita.id}
                              >
                                No asistió
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="admin-btn-cambiar"
                              onClick={() => {
                                const nuevo = !selectedCita.asistio
                                setSelectedCita((p) => ({ ...p, asistio: nuevo }))
                                marcarAsistio(selectedCita.id, nuevo)
                              }}
                              disabled={actualizandoAsistio === selectedCita.id}
                            >
                              Cambiar
                            </button>
                          )}
                        </div>
                      </>
                    )}
                    {estadoParaMostrar(selectedCita) === ESTADOS_CITA.ACTIVA && (
                      <div className="admin-modal-detalle-acciones">
                        <button type="button" className="admin-btn-reagendar" onClick={() => { abrirReagendar(selectedCita); setSelectedCita(null) }}>
                          Reagendar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {seccion === 'citas' && subSeccion === 'activas' && (
          <div className="admin-lista-seccion">
            <h2>Citas activas</h2>
            <p className="admin-ayuda">Solo citas que aún están en horario y se pueden atender.</p>
            {citasActivas.length === 0 ? (
              <p className="admin-vacio">No hay citas activas.</p>
            ) : (
              <ul className="admin-lista-citas">
                {citasActivas.map((c) => (
                  <li key={c.id}>
                    <article className={`admin-cita-card admin-cita-card--${((c.estado === 'CREADA' ? 'ACTIVA' : c.estado) || 'ACTIVA').toLowerCase()}`}>
                      <div className="admin-cita-card-main">
                        <span className="admin-cita-card-hora">{c.hora}</span>
                        <span className="admin-cita-card-fecha">{c.fecha}</span>
                        <strong>{c.nombre}</strong>
                        <span className="admin-cita-card-motivo">{c.motivo}</span>
                        <span className="admin-cita-card-tel">{c.telefono}</span>
                      </div>
                      <div className="admin-cita-card-acciones">
                        <span className={`admin-badge admin-badge--${((c.estado === 'CREADA' ? 'ACTIVA' : c.estado) || 'ACTIVA').toLowerCase()}`}>{(c.estado === 'CREADA' ? 'ACTIVA' : c.estado) || ESTADOS_CITA.ACTIVA}</span>
                        <button type="button" className="admin-btn-reagendar" onClick={() => abrirReagendar(c)}>
                          Reagendar
                        </button>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {seccion === 'citas' && subSeccion === 'finalizadas' && (
          <div className="admin-lista-seccion">
            <h2>Finalizadas</h2>
            <p className="admin-ayuda">Citas cuya hora ya pasó. Marca si el paciente asistió o no.</p>
            {citasFinalizadas.length === 0 ? (
              <p className="admin-vacio">No hay citas finalizadas.</p>
            ) : (
              <ul className="admin-lista-citas">
                {citasFinalizadas.map((c) => (
                  <li key={c.id}>
                    <article className="admin-cita-card admin-cita-card-finalizada">
                      <div className="admin-cita-card-main">
                        <span className="admin-cita-card-hora">{c.hora}</span>
                        <span className="admin-cita-card-fecha">{c.fecha}</span>
                        <strong>{c.nombre}</strong>
                        <span className="admin-cita-card-motivo">{c.motivo}</span>
                        <span className="admin-cita-card-tel">{c.telefono}</span>
                      </div>
                      <div className="admin-cita-card-acciones">
                        {c.asistio === true && <span className="admin-badge admin-badge--asistio">Asistió</span>}
                        {c.asistio === false && <span className="admin-badge admin-badge--no-asistio">No asistió</span>}
                        {(c.asistio === undefined || c.asistio === null) && (
                          <>
                            <button
                              type="button"
                              className="admin-btn-asistio si"
                              onClick={() => marcarAsistio(c.id, true)}
                              disabled={actualizandoAsistio === c.id}
                            >
                              Asistió
                            </button>
                            <button
                              type="button"
                              className="admin-btn-asistio no"
                              onClick={() => marcarAsistio(c.id, false)}
                              disabled={actualizandoAsistio === c.id}
                            >
                              No asistió
                            </button>
                          </>
                        )}
                        {(c.asistio === true || c.asistio === false) && (
                          <button
                            type="button"
                            className="admin-btn-cambiar"
                            onClick={() => marcarAsistio(c.id, c.asistio === true ? false : true)}
                            disabled={actualizandoAsistio === c.id}
                          >
                            Cambiar
                          </button>
                        )}
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {seccion === 'citas' && subSeccion === 'asistio' && (
          <div className="admin-lista-seccion">
            <h2>Asistió</h2>
            <p className="admin-ayuda">Pacientes que asistieron a su cita.</p>
            {citasAsistio.length === 0 ? (
              <p className="admin-vacio">No hay citas marcadas como asistió.</p>
            ) : (
              <ul className="admin-lista-citas">
                {citasAsistio.map((c) => (
                  <li key={c.id}>
                    <article className="admin-cita-card admin-cita-card--asistio">
                      <div className="admin-cita-card-main">
                        <span className="admin-cita-card-hora">{c.hora}</span>
                        <span className="admin-cita-card-fecha">{c.fecha}</span>
                        <strong>{c.nombre}</strong>
                        <span className="admin-cita-card-motivo">{c.motivo}</span>
                        <span className="admin-cita-card-tel">{c.telefono}</span>
                      </div>
                      <span className="admin-badge admin-badge--asistio">Asistió</span>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {seccion === 'citas' && subSeccion === 'no-asistio' && (
          <div className="admin-lista-seccion">
            <h2>No asistió</h2>
            <p className="admin-ayuda">Pacientes que no asistieron a su cita.</p>
            {citasNoAsistio.length === 0 ? (
              <p className="admin-vacio">No hay citas marcadas como no asistió.</p>
            ) : (
              <ul className="admin-lista-citas">
                {citasNoAsistio.map((c) => (
                  <li key={c.id}>
                    <article className="admin-cita-card admin-cita-card--no-asistio">
                      <div className="admin-cita-card-main">
                        <span className="admin-cita-card-hora">{c.hora}</span>
                        <span className="admin-cita-card-fecha">{c.fecha}</span>
                        <strong>{c.nombre}</strong>
                        <span className="admin-cita-card-motivo">{c.motivo}</span>
                        <span className="admin-cita-card-tel">{c.telefono}</span>
                      </div>
                      <span className="admin-badge admin-badge--no-asistio">No asistió</span>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {seccion === 'citas' && subSeccion === 'canceladas' && (
          <div className="admin-lista-seccion">
            <h2>Citas canceladas</h2>
            {citasCanceladas.length === 0 ? (
              <p className="admin-vacio">No hay citas canceladas.</p>
            ) : (
              <ul className="admin-lista-citas">
                {citasCanceladas.map((c) => (
                  <li key={c.id}>
                    <article className="admin-cita-card admin-cita-card--cancelada">
                      <div className="admin-cita-card-main">
                        <span className="admin-cita-card-hora">{c.hora}</span>
                        <span className="admin-cita-card-fecha">{c.fecha}</span>
                        <strong>{c.nombre}</strong>
                        <span className="admin-cita-card-motivo">{c.motivo}</span>
                        <span className="admin-cita-card-tel">{c.telefono}</span>
                      </div>
                      <span className="admin-badge admin-badge--cancelada">CANCELADA</span>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {seccion === 'actividades' && (
          <div className="admin-actividades">
            <h2>Actividades / Motivos de consulta</h2>
            <p className="admin-ayuda">Define el tiempo estimado (minutos) por tipo de consulta. Una cita de 40 min ocupa 2 turnos de 30 min para la misma persona.</p>
            {mensajeActividades && <p className={guardandoActividades ? 'admin-actividades-msg' : 'admin-actividades-msg admin-actividades-msg--ok'}>{mensajeActividades}</p>}
            <ul className="admin-actividades-lista">
              {actividades.map((a, index) => (
                <li key={a.id || index} className="admin-actividad-item">
                  <span className="admin-actividad-nombre">{a.nombre}</span>
                  <label className="admin-actividad-duracion">
                    <input
                      type="number"
                      min={15}
                      max={120}
                      step={5}
                      value={a.duracionMinutos ?? 30}
                      onChange={(e) => actualizarActividad(index, 'duracionMinutos', parseInt(e.target.value, 10) || 30)}
                    />
                    min
                  </label>
                </li>
              ))}
            </ul>
            <button type="button" className="admin-actividades-guardar" onClick={guardarActividades} disabled={guardandoActividades}>
              {guardandoActividades ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        )}

        {seccion === 'expedientes' && (
          <div className="admin-expedientes">
            <h2>Expedientes</h2>
            <div className="admin-expedientes-busqueda">
              <input
                type="search"
                placeholder="Buscar por nombre o teléfono..."
                value={busquedaExpediente}
                onChange={(e) => setBusquedaExpediente(e.target.value)}
                className="admin-expedientes-input"
              />
            </div>
            {expedientesFiltrados.length === 0 ? (
              <p className="admin-vacio">No hay pacientes o no coincide la búsqueda.</p>
            ) : (
              <div className="admin-expedientes-grid">
                {expedientesFiltrados.map((p) => (
                  <article
                    key={p.telefono}
                    className="admin-expediente-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedExpediente(p)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedExpediente(p) } }}
                  >
                    <h3>{p.nombre || 'Sin nombre'}</h3>
                    <p className="admin-expediente-tel">{p.telefono}</p>
                    <p className="admin-expediente-ultima">
                      Última cita: {p.ultimaCita?.fecha} {p.ultimaCita?.hora} · {p.citas.length} cita(s)
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedExpediente && (
          <div className="admin-modal-backdrop" onClick={() => setSelectedExpediente(null)} role="dialog" aria-modal="true" aria-labelledby="expediente-titulo">
            <div className="admin-modal admin-modal-expediente" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h3 id="expediente-titulo">Expediente de {selectedExpediente.nombre || 'Sin nombre'}</h3>
                <button type="button" className="admin-modal-cerrar" onClick={() => setSelectedExpediente(null)} aria-label="Cerrar">
                  ×
                </button>
              </div>
              <div className="admin-modal-body">
                <p><strong>Teléfono / WhatsApp:</strong>{' '}
                <a href={`https://wa.me/${(selectedExpediente.telefono || '').replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="admin-link-whatsapp">
                  {selectedExpediente.telefono}
                </a>
              </p>
                <h4 className="admin-expediente-historial-titulo">Historial de citas ({selectedExpediente.citas.length})</h4>
                <ul className="admin-expediente-historial">
                  {selectedExpediente.citas.map((c) => (
                    <li key={c.id} className="admin-expediente-cita-item">
                      <span className="admin-expediente-cita-fecha">{c.fecha} {c.hora}</span>
                      <span className={`admin-badge admin-badge--${((c.estado === 'CREADA' ? 'ACTIVA' : c.estado) || 'ACTIVA').toLowerCase()}`}>{(c.estado === 'CREADA' ? 'ACTIVA' : c.estado) || ESTADOS_CITA.ACTIVA}</span>
                      {isCitaPasada(c) && c.asistio !== undefined && c.asistio !== null && (
                        <span className={`admin-badge ${c.asistio ? 'admin-badge--asistio' : 'admin-badge--no-asistio'}`}>
                          {c.asistio ? 'Asistió' : 'No asistió'}
                        </span>
                      )}
                      <p className="admin-expediente-cita-motivo"><strong>Motivo:</strong> {c.motivo || '—'}</p>
                    </li>
                  ))}
                </ul>
                <div className="admin-expediente-footer">
                  <button type="button" className="admin-btn-eliminar-expediente" onClick={() => setConfirmEliminarExpediente(true)} disabled={eliminandoExpediente}>
                    Eliminar expediente
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {confirmEliminarExpediente && selectedExpediente && (
          <div className="admin-modal-backdrop" onClick={() => !eliminandoExpediente && setConfirmEliminarExpediente(false)} role="dialog" aria-modal="true" aria-labelledby="confirm-eliminar-titulo">
            <div className="admin-modal admin-modal-confirm" onClick={(e) => e.stopPropagation()}>
              <h3 id="confirm-eliminar-titulo">¿Eliminar expediente?</h3>
              <p className="admin-modal-confirm-texto">
                Se eliminará el expediente de <strong>{selectedExpediente.nombre || 'Sin nombre'}</strong> y todas las citas asociadas ({selectedExpediente.citas.length} cita(s)). Esta acción no se puede deshacer.
              </p>
              <div className="admin-modal-confirm-botones">
                <button type="button" className="admin-btn-cancelar" onClick={() => setConfirmEliminarExpediente(false)} disabled={eliminandoExpediente}>
                  Cancelar
                </button>
                <button type="button" className="admin-btn-confirmar-eliminar" onClick={eliminarExpedienteConfirmar} disabled={eliminandoExpediente}>
                  {eliminandoExpediente ? 'Eliminando…' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {citaParaReagendar && (
          <div className="admin-modal-backdrop" onClick={() => !guardandoReagendar && setCitaParaReagendar(null)} role="dialog" aria-modal="true" aria-labelledby="reagendar-titulo">
            <div className="admin-modal admin-modal-reagendar" onClick={(e) => e.stopPropagation()}>
              <h3 id="reagendar-titulo">Reagendar cita</h3>
              <p className="admin-reagendar-paciente">{citaParaReagendar.nombre} · {citaParaReagendar.fecha} {citaParaReagendar.hora}</p>
              <div className="admin-reagendar-calendario-wrap">
                <label className="admin-reagendar-label">Nueva fecha</label>
                <div className="admin-reagendar-calendario">
                  <div className="admin-reagendar-cal-header">
                    <button type="button" className="admin-reagendar-cal-nav" onClick={() => setMesReagendar((d) => new Date(d.getFullYear(), d.getMonth() - 1))} aria-label="Mes anterior">
                      ‹
                    </button>
                    <span className="admin-reagendar-cal-mes">{MESES[mesReagendar.getMonth()]} {mesReagendar.getFullYear()}</span>
                    <button type="button" className="admin-reagendar-cal-nav" onClick={() => setMesReagendar((d) => new Date(d.getFullYear(), d.getMonth() + 1))} aria-label="Mes siguiente">
                      ›
                    </button>
                  </div>
                  <div className="admin-reagendar-cal-dias-semana">
                    {DIAS_SEMANA.map((d) => (
                      <span key={d} className="admin-reagendar-cal-dia-nombre">{d}</span>
                    ))}
                  </div>
                  <div className="admin-reagendar-cal-grid">
                    {(() => {
                      const { first, last } = getMonthRange(mesReagendar)
                      const primerDia = first.getDay()
                      const offset = primerDia === 0 ? 6 : primerDia - 1
                      const ultimoDia = last.getDate()
                      const anio = mesReagendar.getFullYear()
                      const mes = mesReagendar.getMonth()
                      const hoyStr = formatFecha(new Date())
                      const celdas = []
                      for (let i = 0; i < offset; i++) celdas.push(null)
                      for (let d = 1; d <= ultimoDia; d++) celdas.push(d)
                      return celdas.map((dia, i) => {
                        if (dia === null) {
                          return <span key={`e-${i}`} className="admin-reagendar-cal-celda vacia" />
                        }
                        const fechaStr = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
                        const esHoy = fechaStr === hoyStr
                        const esPasado = fechaStr < hoyStr
                        const seleccionado = fechaStr === fechaReagendar
                        return (
                          <button
                            key={dia}
                            type="button"
                            className={`admin-reagendar-cal-celda ${esHoy ? 'hoy' : ''} ${esPasado ? 'pasado' : ''} ${seleccionado ? 'seleccionado' : ''}`}
                            onClick={() => !esPasado && setFechaReagendar(fechaStr)}
                            disabled={esPasado}
                          >
                            {dia}
                          </button>
                        )
                      })
                    })()}
                  </div>
                </div>
              </div>
              <label className="admin-reagendar-label">
                Nueva hora
                {cargandoOcupadosReagendar && <span className="admin-reagendar-cargando">Cargando horarios…</span>}
                <div className="admin-reagendar-slots">
                  {SLOTS_HORARIO.map((slot) => {
                    const [hh, mm] = slot.split(':').map(Number)
                    const key = `${hh}-${mm || 0}`
                    const ocupado = ocupadosReagendar.includes(key)
                    const pasado = esHorarioPasado(fechaReagendar, slot)
                    const seleccionado = horaReagendar === slot
                    const deshabilitado = cargandoOcupadosReagendar || ocupado || pasado
                    return (
                      <button
                        key={slot}
                        type="button"
                        className={`admin-reagendar-slot ${ocupado ? 'ocupado' : ''} ${pasado ? 'pasado' : ''} ${seleccionado ? 'seleccionado' : ''}`}
                        onClick={() => !deshabilitado && setHoraReagendar(slot)}
                        disabled={deshabilitado}
                      >
                        {slot}
                      </button>
                    )
                  })}
                </div>
              </label>
              {errorReagendar && <p className="admin-reagendar-error" role="alert">{errorReagendar}</p>}
              <div className="admin-modal-confirm-botones">
                <button type="button" className="admin-btn-cancelar" onClick={() => setCitaParaReagendar(null)} disabled={guardandoReagendar}>
                  Cancelar
                </button>
                <button type="button" className="admin-btn-reagendar-confirmar" onClick={reagendarConfirmar} disabled={guardandoReagendar || !fechaReagendar || !horaReagendar}>
                  {guardandoReagendar ? 'Guardando…' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <p className="site-footer-copy">
            © {new Date().getFullYear()} Clínica Dental. Todos los derechos reservados.
          </p>
          <div className="site-footer-contacto">
            <a href="mailto:contacto@clinicadental.com" className="site-footer-link">contacto@clinicadental.com</a>
            <span className="site-footer-sep"> · </span>
            <a href="tel:+525512345678" className="site-footer-link">(55) 1234-5678</a>
          </div>
          <div className="site-footer-enlaces">
            <Link to="/" className="site-footer-link">Inicio</Link>
            <span className="site-footer-sep"> · </span>
            <Link to="/agendar" className="site-footer-link">Agendar cita</Link>
            <span className="site-footer-sep"> · </span>
            <Link to="/consultar" className="site-footer-link">Consultar cita</Link>
          </div>
          <nav className="site-footer-redes" aria-label="Redes sociales">
            <a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" className="site-footer-icon" title="Facebook" aria-label="Facebook">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
            </a>
            <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" className="site-footer-icon" title="Instagram" aria-label="Instagram">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
            </a>
            <a href="https://wa.me/5215512345678" target="_blank" rel="noopener noreferrer" className="site-footer-icon" title="WhatsApp" aria-label="WhatsApp">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
            </a>
          </nav>
        </div>
      </footer>
    </div>
  )
}

export default Admin
