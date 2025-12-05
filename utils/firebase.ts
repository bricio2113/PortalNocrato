

// Fix: Use Firebase v8 namespaced API
// Fix: Use compat imports for Firebase v8 API
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/analytics";
import "firebase/compat/auth";

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

export { db, auth };