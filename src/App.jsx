import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom'
import SiteHeader from './components/SiteHeader'
import Inicio from './pages/Inicio'
import AgendarCita from './pages/AgendarCita'
import ConsultarCita from './pages/ConsultarCita'
import Admin from './pages/Admin'

function LayoutPublic() {
  return (
    <>
      <SiteHeader />
      <Outlet />
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<LayoutPublic />}>
          <Route path="/" element={<Inicio />} />
          <Route path="/agendar" element={<AgendarCita />} />
          <Route path="/consultar" element={<ConsultarCita />} />
        </Route>
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
