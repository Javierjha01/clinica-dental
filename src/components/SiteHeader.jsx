import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './SiteHeader.css'

function SiteHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const handler = () => setMenuAbierto(false)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const cerrarMenu = () => setMenuAbierto(false)

  return (
    <header className={`site-header ${scrolled ? 'site-header--scrolled' : ''} ${menuAbierto ? 'site-header--menu-abierto' : ''}`} id="inicio">
      <div className="site-header-inner">
        <Link to="/" className="site-logo" onClick={cerrarMenu}>
          <div className="site-logo-texto">
            <span className="site-logo-nombre">Clínica Dental</span>
            <span className="site-logo-subtitulo">Especialidades odontológicas</span>
          </div>
        </Link>

        <button
          type="button"
          className="site-header-hamburger"
          onClick={() => setMenuAbierto((v) => !v)}
          aria-expanded={menuAbierto}
          aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
        >
          <span className="site-header-hamburger-barras" aria-hidden>
            <span />
            <span />
            <span />
          </span>
        </button>

        <nav className="site-nav">
          <Link to="/" onClick={cerrarMenu}>Inicio</Link>
          <Link to="/agendar" onClick={cerrarMenu}>Citas</Link>
          <Link to="/consultar" onClick={cerrarMenu}>Consultar cita</Link>
          <Link to="/#nosotros" onClick={cerrarMenu}>Nosotros</Link>
          <Link to="/#especialidades" onClick={cerrarMenu}>Especialidades</Link>
          <Link to="/#contacto" onClick={cerrarMenu}>Contacto</Link>
        </nav>
      </div>
    </header>
  )
}

export default SiteHeader
