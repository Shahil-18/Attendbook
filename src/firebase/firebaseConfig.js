import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyCNtivgfw6hm60_mnBpcgFVB8IH8pz5Uhg",
  authDomain: "attendbook-8ae49.firebaseapp.com",
  projectId: "attendbook-8ae49",
  storageBucket: "attendbook-8ae49.firebasestorage.app",
  messagingSenderId: "925792225797",
  appId: "1:925792225797:web:d75d432bab2ecc6a2c6a6c"
};

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)