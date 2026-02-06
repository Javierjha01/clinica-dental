import { useState, useEffect } from 'react'
import { signIn as authSignIn, signOut as authSignOut, onAuth } from '../lib/auth'

/**
 * Hook para usar autenticación en componentes React.
 * - user: usuario actual o null
 * - loading: true mientras se resuelve el estado inicial
 * - signIn(email, password): inicia sesión (cierra la anterior)
 * - signOut(): cierra sesión
 */
export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuth((u) => {
      setUser(u)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    const u = await authSignIn(email, password)
    setUser(u)
    return u
  }

  const signOut = async () => {
    await authSignOut()
    setUser(null)
  }

  return { user, loading, signIn, signOut }
}
