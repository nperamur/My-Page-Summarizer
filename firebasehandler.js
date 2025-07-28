import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithCredential, onAuthStateChanged, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot} from "firebase/firestore";


const firebaseConfig = {
  apiKey: "AIzaSyB_Q4URffEbtM_Amrr4uVhqIDZeJeHTgNs",
  authDomain: "my-page-summarizer.firebaseapp.com",
  projectId: "my-page-summarizer",
  storageBucket: "my-page-summarizer.firebasestorage.app",
  messagingSenderId: "163674124159",
  appId: "1:163674124159:web:a7df11133cf80ef4f0744a",
  measurementId: "G-548ZGYP3H0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

let unsubscribe = null;

let writingToDatabase = false;

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'finishedGoogleAuth') {
    writingToDatabase = true;
    const credential = GoogleAuthProvider.credential(null, message.accessToken);
    signInWithCredential(auth, credential).then(userCredential => {
      const user = auth.currentUser;
      if (user) {
        const docRef = doc(db, "users", user.uid);
        getDoc(docRef).then((document) => {
          if (document.exists()) {
             // Document exists – update refreshToken only
            if (!message.refreshToken || typeof message.refreshToken !== "string") {
              console.log("cannot add refresh token to database");
              return;
            }
            updateDoc(docRef, {refreshToken: message.refreshToken}).then(() => {
                console.log("Refresh token updated.");
            }).catch((error) => {
                console.error("Error updating document:", error);
            });
            chrome.runtime.sendMessage({type: 'retrievedRefreshToken', refreshToken: document.data()["refreshToken"]});

          } else {
            console.log("No such document!");
            if (!message.refreshToken || typeof message.refreshToken !== "string") {
              console.log("cannot add refresh token to database");
              return;
            }
            setDoc(docRef, {
                refreshToken: message.refreshToken,
                apiKey: ""
            }).then(() => {
                console.log("User document created.");
            }).catch((error) => {
                console.error("Error creating document:", error);
            });
            chrome.runtime.sendMessage({type: 'retrievedRefreshToken', refreshToken: message.refreshToken});
          }
        }).catch((error) => {
          console.error("Error getting document:", error);
        });
        }
      }
    ).catch(error => {
      console.error("Sign in failed:", error);
    });
    writingToDatabase = false;
  } else if (message.type === 'extendCurrentSession') {
      const credential = GoogleAuthProvider.credential(message.id_token);
      await signInWithCredential(auth, credential);
  } else if (message.type === 'getRefreshToken') {
        const docRef = doc(db, "users", auth.currentUser.uid);
        getDoc(docRef).then((document) => {
            if (document.exists()) {
                chrome.runtime.sendMessage({type: 'retrievedRefreshToken', refreshToken: document.data()["refreshToken"]});
            }
        });
  } else if (message.type === 'saveApiKey') {
    const docRef = doc(db, "users", auth.currentUser.uid);
    getDoc(docRef).then((document) => {
        if (document.exists()) {
           updateDoc(docRef, {apiKey: message.value}).then(() => {
             console.log("Api Key Updated.");
           }).catch((error) => {
             console.error("Error updating document:", error);
           });
        }
    });
  } else if (message.type === 'signOut') {
    signOut(auth)
      .then(() => {
        console.log('User signed out successfully');
      })
      .catch((error) => {
        console.error('Error signing out:', error);
      });
  }
});




onAuthStateChanged(auth, (user) => {
  let signedIn;
  if (user) {
    console.log("User is signed in.");
    signedIn = true;
    const docRef = doc(db, "users", user.uid);

    if (unsubscribe) {
      unsubscribe();
    }


    unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        chrome.runtime.sendMessage({type: 'retrievedApiKey', apiKey: docSnap.data()["apiKey"]});
      } else {
        console.log("No such document!");
      }
    });


  } else {
    console.log("No user is signed in.");
    signedIn = false;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  chrome.runtime.sendMessage({type: "signInStatus", authState: signedIn});
});