// Firebase Modular SDK imports from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBRSt2aoSJ-lumYAWGAXE6ncui7__TqJ4E",
  authDomain: "sera-product.firebaseapp.com",
  projectId: "sera-product",
  storageBucket: "sera-product.firebasestorage.app",
  messagingSenderId: "516762224598",
  appId: "1:516762224598:web:b6a571f355a8a4a97c0677",
  measurementId: "G-RLMWH43FXX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Owner Emails List (Lowercase for case-insensitive verification)
const OWNER_EMAILS = [
    "shohidhossain200@gmail.com",
    "nazrulislam887441234@gmail.com",
    "support.seraproduct@gmail.com"
];

// DOM Elements
const initialLoader = document.getElementById("initial-loader");
const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const btnText = document.getElementById("btn-text");
const btnLoader = document.getElementById("btn-loader");
const errorAlert = document.getElementById("error-alert");
const errorMessage = document.getElementById("error-message");
const togglePasswordBtn = document.getElementById("toggle-password");
const eyeIcon = document.getElementById("eye-icon");

// SVG Icons for Password Eye toggle
const eyeOpenSVG = '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>';
const eyeClosedSVG = '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2z"/>';

// Password Show/Hide Toggle
togglePasswordBtn.addEventListener("click", () => {
    const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
    passwordInput.setAttribute("type", type);
    eyeIcon.innerHTML = type === "password" ? eyeOpenSVG : eyeClosedSVG;
});

// Helper: Show Error Message in Bengali
function showError(msg) {
    errorMessage.textContent = msg;
    errorAlert.classList.remove("hidden");
}

function hideError() {
    errorAlert.classList.add("hidden");
}

// Helper: Set Loading State for Form
function setLoading(isLoading) {
    if (isLoading) {
        loginBtn.setAttribute("disabled", "true");
        btnText.textContent = "লগইন হচ্ছে...";
        btnLoader.classList.remove("hidden");
        emailInput.setAttribute("disabled", "true");
        passwordInput.setAttribute("disabled", "true");
    } else {
        loginBtn.removeAttribute("disabled");
        btnText.textContent = "লগইন করুন";
        btnLoader.classList.add("hidden");
        emailInput.removeAttribute("disabled");
        passwordInput.removeAttribute("disabled");
    }
}

// Firebase Error Translator to Bengali
function getBengaliErrorMessage(errorCode) {
    switch (errorCode) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
            return "ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।";
        case "auth/user-disabled":
            return "আপনার অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে।";
        case "auth/too-many-requests":
            return "অনেকবার ভুল চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।";
        case "auth/network-request-failed":
            return "ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।";
        default:
            return "লগইন করার সময় একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।";
    }
}

// Authorization & Verification Engine
async function verifyAndRedirectUser(user) {
    try {
        const emailLower = user.email ? user.email.toLowerCase() : "";

        // ১. Owner Check
        if (OWNER_EMAILS.includes(emailLower)) {
            // Owner Verified -> Redirect to Owner Dashboard
            window.location.replace("dashboard.html");
            return;
        }

        // ২. Admin Check via Firestore (admins/{uid})
        const adminDocRef = doc(db, "admins", user.uid);
        const adminSnap = await getDoc(adminDocRef);

        if (!adminSnap.exists()) {
            throw new Error("UNAUTHORIZED_NO_DOC");
        }

        const adminData = adminSnap.data();

        // Strict Validation Rules
        const isValid = 
            adminData.name &&
            adminData.email &&
            adminData.uid &&
            adminData.active === true &&
            adminData.uid === user.uid &&
            adminData.email.toLowerCase() === emailLower;

        if (!isValid) {
            throw new Error("UNAUTHORIZED_INVALID_DATA");
        }

        // Valid Admin Verified -> Redirect to Admin Dashboard
        window.location.replace("dashboard.html");

    } catch (error) {
        console.error("Authorization Error:", error.message);
        
        // Sign out unauthorized user immediately
        await signOut(auth);

        if (error.message.includes("UNAUTHORIZED")) {
            showError("আপনার এই প্যানেলে প্রবেশের অনুমতি নেই।");
        } else {
            showError("ডেটা যাচাই করার সময় ত্রুটি ঘটেছে। কিছুক্ষণ পর চেষ্টা করুন।");
        }

        initialLoader.style.opacity = "0";
        setTimeout(() => initialLoader.classList.add("hidden"), 300);
    }
}

// Handle Form Submission (Sign In)
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showError("দয়া করে ইমেইল এবং পাসওয়ার্ড উভয়ই প্রদান করুন।");
        return;
    }

    setLoading(true);

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await verifyAndRedirectUser(userCredential.user);
    } catch (error) {
        setLoading(false);
        const friendlyMsg = getBengaliErrorMessage(error.code);
        showError(friendlyMsg);
    }
});

// Monitor Auth State for Session Persistence & Page Reloads
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Already logged in, verify permissions
        await verifyAndRedirectUser(user);
    } else {
        // Not logged in, hide initial loader to show login page
        initialLoader.style.opacity = "0";
        setTimeout(() => initialLoader.classList.add("hidden"), 300);
    }
});
