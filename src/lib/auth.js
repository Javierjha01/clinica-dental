import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth } from './firebase'

/**
 * Inicia sesión con email y contraseña.
 * Cierra cualquier sesión anterior antes de iniciar la nueva.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<User>} usuario de Firebase Auth
 */
export async function signIn(email, password) {
  // Cerrar sesión anterior si existe (así siempre entras con la cuenta que pasas)
  await firebaseSignOut(auth)
  const userCredential = await signInWithEmailAndPassword(auth, email, password)
  return userCredential.user
}

/**
 * Cierra la sesión actual en Firebase.
 */
export async function signOut() {
  await firebaseSignOut(auth)
}

/**
 * Suscripción al estado de autenticación (para usar en React).
 * @param {function} callback (user | null) => void
 * @returns {function} función para cancelar la suscripción
 */
export function onAuth(callback) {
  return onAuthStateChanged(auth, callback)
}

export { auth }
