

// Fix: Use Firebase v8 namespaced API
// Fix: Use compat imports for Firebase v8 API
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/analytics";
import "firebase/compat/auth";
import "firebase/compat/storage";

// Your web app's Firebase configuration from the user prompt
const firebaseConfig = {
  apiKey: "AIzaSyDxRHULXmj0gGQoCuEfSy-SgOBy1UifNkY",
  authDomain: "agencia-nocrato.firebaseapp.com",
  projectId: "agencia-nocrato",
  storageBucket: "agencia-nocrato.firebasestorage.app",
  messagingSenderId: "14738043017",
  appId: "1:14738043017:web:c622455eb921f71c575658",
  measurementId: "G-1XB2Z7N3MB"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();
// Cloud Storage. O bucket vem do proprio firebaseConfig (storageBucket).
// As regras dele estao em storage.rules - arquivo SEPARADO de firestore.rules,
// publicado por outro comando. Ver o cabecalho de storage.rules.
const storage = firebase.storage();

export { db, auth, storage };