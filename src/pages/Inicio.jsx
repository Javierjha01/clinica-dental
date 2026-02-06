import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './Inicio.css'

const CONTACTO = {
  email: 'contacto@clinicadental.com',
  telefono: '(55) 1234-5678',
}

const REDES_SOCIALES = [
  {
    nombre: 'Facebook',
    href: 'https://www.facebook.com/',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    nombre: 'Instagram',
    href: 'https://www.instagram.com/',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  {
    nombre: 'WhatsApp',
    href: 'https://wa.me/5215512345678',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
  },
]

const SLIDES = [
  {
    img: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=1200&q=80',
    title: 'Cuidamos tu sonrisa',
    subtitle: 'Atención dental profesional en un ambiente de confianza. Agenda en línea, sin crear cuenta.',
  },
  {
    img: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=1200&q=80',
    title: 'Especialistas a tu servicio',
    subtitle: 'Revisión, limpieza y tratamientos preventivos. Te confirmamos por WhatsApp.',
  },
  {
    img: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=1200&q=80',
    title: 'Tu salud bucal primero',
    subtitle: 'Elige fecha y horario a tu conveniencia. Rápido, seguro y sin complicaciones.',
  },
]

const DURACION_TRANSICION = 700
const SLIDES_CON_CLON = [...SLIDES, SLIDES[0]]

function Inicio() {
  const [index, setIndex] = useState(0)
  const [sinTransicion, setSinTransicion] = useState(false)
  const [animating, setAnimating] = useState(false)

  const avanzar = () => {
    if (animating) return
    setAnimating(true)
    setIndex((i) => {
      if (i === SLIDES.length - 1) {
        setTimeout(() => {
          setSinTransicion(true)
          setIndex(0)
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setSinTransicion(false)
              setAnimating(false)
            })
          })
        }, DURACION_TRANSICION)
        return SLIDES.length
      }
      setTimeout(() => setAnimating(false), DURACION_TRANSICION)
      return i + 1
    })
  }

  useEffect(() => {
    const t = setInterval(avanzar, 5000)
    return () => clearInterval(t)
  }, [])

  const goTo = (nextIndex) => {
    if (animating) return
    setAnimating(true)
    setSinTransicion(true)
    setIndex(nextIndex)
    setTimeout(() => {
      setSinTransicion(false)
      setAnimating(false)
    }, 50)
  }

  const next = () => avanzar()

  const indiceReal = index >= SLIDES.length ? 0 : index

  return (
    <div className="inicio">
      {/* Barra superior de contacto (estilo referencia) */}
      <div className="inicio-topbar">
        <div className="inicio-topbar-inner">
          <a href={`mailto:${CONTACTO.email}`} className="inicio-topbar-link">
            <span className="inicio-topbar-icon" aria-hidden>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
            </span>
            {CONTACTO.email}
          </a>
          <a href={`tel:${CONTACTO.telefono.replace(/\D/g, '')}`} className="inicio-topbar-link">
            <span className="inicio-topbar-icon" aria-hidden>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
            </span>
            {CONTACTO.telefono}
          </a>
        </div>
      </div>

      {/* Hero: solo las imágenes se deslizan; texto y botón fijos encima */}
      <section className="inicio-hero">
        <div
          className={`inicio-carrusel-track ${sinTransicion ? 'inicio-carrusel-track--sin-transicion' : ''}`}
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {SLIDES_CON_CLON.map((slide, i) => (
            <div key={i} className="inicio-carrusel-slide">
              <img src={slide.img} alt="" className="inicio-carrusel-img" />
              <div className="inicio-carrusel-overlay" />
            </div>
          ))}
        </div>

        {/* Capa fija: texto y botón no se mueven al cambiar la imagen */}
        <div className="inicio-hero-fijo">
          <div className="inicio-hero-fijo-content" key={indiceReal}>
            <h1 className="inicio-carrusel-titulo">{SLIDES[indiceReal].title}</h1>
            <p className="inicio-carrusel-subtitulo">{SLIDES[indiceReal].subtitle}</p>
            <Link to="/agendar" className="inicio-hero-cta">
              Agendar cita
            </Link>
          </div>
        </div>

        <button type="button" className="inicio-carrusel-next" onClick={next} aria-label="Siguiente">
          ›
        </button>

        <div className="inicio-carrusel-dots">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`inicio-carrusel-dot ${i === indiceReal ? 'activo' : ''}`}
              onClick={() => goTo(i)}
              aria-label={`Ir a slide ${i + 1}`}
            />
          ))}
        </div>

        <div className="inicio-carrusel-indice" aria-hidden="true">
          {indiceReal + 1}/{SLIDES.length}
        </div>
      </section>

      {/* Franja azul: botones de acción */}
      <section className="inicio-franja-azul">
        <div className="inicio-franja-azul-inner">
          <Link to="/agendar" className="inicio-franja-btn inicio-franja-btn--principal">
            Ver disponibilidad y horarios
            <span className="inicio-franja-flecha" aria-hidden>→</span>
          </Link>
          <Link to="/consultar" className="inicio-franja-btn inicio-franja-btn--secundario">
            Consultar mi cita
          </Link>
        </div>
      </section>

      {/* Anclas para el menú */}
      <section id="nosotros" className="inicio-ancla" aria-hidden="true" />
      <section id="especialidades" className="inicio-ancla" aria-hidden="true" />
      <section id="contacto" className="inicio-ancla" aria-hidden="true" />

      {/* Footer: derechos reservados, contacto, administración */}
      <footer className="site-footer">
        <div className="site-footer-inner">
          <p className="site-footer-copy">
            © {new Date().getFullYear()} Clínica Dental. Todos los derechos reservados.
          </p>
          <div className="site-footer-contacto">
            <a href={`mailto:${CONTACTO.email}`} className="site-footer-link">{CONTACTO.email}</a>
            <span className="site-footer-sep"> · </span>
            <a href={`tel:${CONTACTO.telefono.replace(/\D/g, '')}`} className="site-footer-link">{CONTACTO.telefono}</a>
          </div>
          <div className="site-footer-enlaces">
            <Link to="/agendar" className="site-footer-link">Agendar cita</Link>
            <span className="site-footer-sep"> · </span>
            <Link to="/consultar" className="site-footer-link">Consultar cita</Link>
            <span className="site-footer-sep"> · </span>
            <Link to="/admin" className="site-footer-link">Iniciar sesión / Administración</Link>
          </div>
          <nav className="site-footer-redes" aria-label="Redes sociales">
            {REDES_SOCIALES.map((r) => (
              <a key={r.nombre} href={r.href} target="_blank" rel="noopener noreferrer" className="site-footer-icon" title={r.nombre} aria-label={r.nombre}>
                {r.icon}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  )
}

export default Inicio
