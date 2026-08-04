

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

/**
 * Cria uma conta no Auth SEM derrubar a sessao de quem esta logado.
 *
 * `auth.createUserWithEmailAndPassword` LOGA como a conta nova - e o
 * comportamento do SDK cliente, nao um detalhe evitavel. Chamar isso no painel
 * deslogaria o admin e o deixaria dentro da conta que ele acabou de criar. Foi por
 * isso que "criar colaborador" parecia exigir Cloud Function com Admin SDK.
 *
 * A saida e uma SEGUNDA instancia do app Firebase: cada instancia tem a propria
 * sessao, entao o login acontece na secundaria e a principal - a do admin -
 * continua intocada. A secundaria e destruida no fim; sem isso ela ficaria viva
 * com a sessao da pessoa nova pendurada no navegador de quem criou.
 *
 * O e-mail de confirmacao sai daqui porque so aqui existe o objeto do usuario
 * novo. E obrigatorio, nao cortesia: `isVerified()` em firestore.rules exige
 * e-mail confirmado para a conta da agencia poder ler qualquer coisa.
 */
export async function criarContaSemTrocarSessao(email: string, senha: string): Promise<string> {
    const NOME = 'criacao-de-conta';
    const secundario = firebase.apps.find(a => a.name === NOME)
        || firebase.initializeApp(firebaseConfig, NOME);
    try {
        const cred = await secundario.auth().createUserWithEmailAndPassword(email, senha);
        if (!cred.user) throw new Error('A conta foi criada mas o Firebase não devolveu o usuário.');
        await cred.user.sendEmailVerification();
        return cred.user.uid;
    } finally {
        // Em `finally`: mesmo com erro no meio, a instancia nao pode sobrar.
        await secundario.auth().signOut().catch(() => {});
        await secundario.delete().catch(() => {});
    }
}

export { db, auth, storage };