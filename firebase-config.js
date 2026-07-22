/* Firebase sync configuration.
 *
 * When this is null, the app falls back to GitHub Gist sync / local-only.
 * To enable "Sign in with Google" progress sync, replace null with the web-app
 * config object from your Firebase console (Project settings → Your apps → Web).
 *
 * Safe to commit publicly: Firebase web API keys are identifiers, not secrets.
 * Access control comes from Firestore security rules + Auth authorized domains.
 *
 * window.FIREBASE_CONFIG = {
 *   apiKey: "AIza...",
 *   authDomain: "your-project.firebaseapp.com",
 *   projectId: "your-project",
 *   appId: "1:1234567890:web:abcdef"
 * };
 */
window.FIREBASE_CONFIG = null;
