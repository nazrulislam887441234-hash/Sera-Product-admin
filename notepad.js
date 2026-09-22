// Firebase Modular SDK imports from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    orderBy, 
    limit, 
    getDocs, 
    serverTimestamp 
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

// Authoritative Owner Emails List
const OWNER_EMAILS = [
    "shohidhossain@gmail.com",
    "nazrulislam887441234@gmail.com",
    "support.seraproduct@gmail.com"
];

// State Variables
let allLoadedNotes = [];
let selectedDeleteId = null;

// DOM Elements
const authLoader = document.getElementById("auth-loader");
const appContainer = document.getElementById("app-container");
const userEmailDisplay = document.getElementById("user-email-display");
const userBadge = document.getElementById("user-badge");
const logoutBtn = document.getElementById("logout-btn");
const notesGrid = document.getElementById("notes-grid");
const loadingState = document.getElementById("loading-state");
const emptyState = document.getElementById("empty-state");
const totalNoteCount = document.getElementById("total-note-count");
const searchInput = document.getElementById("search-input");
const openCreateModalBtn = document.getElementById("open-create-modal-btn");
const emptyCreateBtn = document.getElementById("empty-create-btn");
const limitWarningBanner = document.getElementById("limit-warning-banner");

// Modals & Forms
const createModal = document.getElementById("create-modal");
const editModal = document.getElementById("edit-modal");
const deleteModal = document.getElementById("delete-modal");
const createNoteForm = document.getElementById("create-note-form");
const editNoteForm = document.getElementById("edit-note-form");
const confirmDeleteBtn = document.getElementById("confirm-delete-btn");

// Toast Notification Helper
function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Authentication & Authorization Check
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("/admin/");
        return;
    }

    const emailLower = user.email ? user.email.toLowerCase().trim() : "";
    let isOwner = OWNER_EMAILS.some(email => email.toLowerCase() === emailLower);

    if (isOwner) {
        userBadge.textContent = "OWNER";
        initPanel(user);
        return;
    }

    // Check if valid Admin via admins/{uid}
    try {
        const adminDocRef = doc(db, "admins", user.uid);
        const adminSnap = await getDoc(adminDocRef);

        if (adminSnap.exists()) {
            const adminData = adminSnap.data();
            if (adminData.active === true && adminData.uid === user.uid && adminData.email.toLowerCase() === emailLower) {
                userBadge.textContent = "ADMIN";
                initPanel(user);
                return;
            }
        }
        
        // Unauthorized
        await signOut(auth);
        alert("আপনার এই প্যানেলে প্রবেশের অনুমতি নেই।");
        window.location.replace("/admin/");

    } catch (error) {
        console.error("Authorization check error:", error);
        await signOut(auth);
        window.location.replace("/admin/");
    }
});

function initPanel(user) {
    userEmailDisplay.textContent = user.email;
    authLoader.classList.add("hidden");
    appContainer.classList.remove("hidden");
    loadNotes();
}

// Logout Handler
logoutBtn.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.replace("/admin/");
    } catch (error) {
        showToast("লগআউট করতে সমস্যা হয়েছে।", "error");
    }
});

// Load Maximum 20 Notes
async function loadNotes() {
    try {
        loadingState.classList.remove("hidden");
        notesGrid.innerHTML = "";
        
        const q = query(collection(db, "notepad"), orderBy("createdAt", "desc"), limit(20));
        const snapshot = await getDocs(q);

        allLoadedNotes = [];
        snapshot.forEach((docSnap) => {
            allLoadedNotes.push({ id: docSnap.id, ...docSnap.data() });
        });

        loadingState.classList.add("hidden");
        renderNotes(allLoadedNotes);
        updateLimitStatus();

    } catch (error) {
        console.error("Error loading notes:", error);
        loadingState.classList.add("hidden");
        showToast("নোট লোড করা যায়নি। আবার চেষ্টা করুন।", "error");
        emptyState.classList.remove("hidden");
    }
}

// Update Limit Counter & Create Button Status
function updateLimitStatus() {
    const count = allLoadedNotes.length;
    totalNoteCount.textContent = `${count} / ২০`;

    if (count >= 20) {
        openCreateModalBtn.setAttribute("disabled", "true");
        limitWarningBanner.classList.remove("hidden");
    } else {
        openCreateModalBtn.removeAttribute("disabled");
        limitWarningBanner.classList.add("hidden");
    }
}

// Format Timestamp Helper
function formatTimestamp(ts) {
    if (!ts || !ts.toDate) return "প্রযোজ্য নয়";
    try {
        return ts.toDate().toLocaleString('bn-BD', { 
            year: 'numeric', month: 'short', day: 'numeric', 
            hour: '2-digit', minute: '2-digit' 
        });
    } catch (e) {
        return "প্রযোজ্য নয়";
    }
}

// Render Notes Grid
function renderNotes(notesToRender) {
    notesGrid.innerHTML = "";

    if (notesToRender.length === 0) {
        emptyState.classList.remove("hidden");
        return;
    }

    emptyState.classList.add("hidden");

    notesToRender.forEach((item) => {
        const card = document.createElement("div");
        card.className = "note-card";

        card.innerHTML = `
            <div>
                <div class="note-header-row">
                    <h3 class="note-title">${escapeHTML(item.title)}</h3>
                    <span class="note-date">${formatTimestamp(item.createdAt)}</span>
                </div>
                <p class="note-desc">${escapeHTML(item.description)}</p>
            </div>
            <div class="note-footer-row">
                <button class="action-btn edit-action" title="সম্পাদনা" onclick="window.openEditModal('${item.id}')">
                    <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                    <span>সম্পাদনা</span>
                </button>
                <button class="action-btn delete-action" title="ডিলিট" onclick="window.openDeleteModal('${item.id}')">
                    <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    <span>ডিলিট</span>
                </button>
            </div>
        `;
        notesGrid.appendChild(card);
    });
}

// HTML Escaper
function escapeHTML(str) {
    return str ? str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    ) : '';
}

// Client-Side Search Filtering
searchInput.addEventListener("input", (e) => {
    const term = e.target.value.trim().toLowerCase();
    if (!term) {
        renderNotes(allLoadedNotes);
        return;
    }

    const filtered = allLoadedNotes.filter(item => 
        (item.title && item.title.toLowerCase().includes(term)) ||
        (item.description && item.description.toLowerCase().includes(term))
    );

    renderNotes(filtered);
});

// Modal Management Controls
openCreateModalBtn.addEventListener("click", () => {
    if (allLoadedNotes.length >= 20) {
        showToast("সর্বোচ্চ ২০টি নোট রাখা যাবে।", "error");
        return;
    }
    createModal.classList.remove("hidden");
});

emptyCreateBtn.addEventListener("click", () => {
    createModal.classList.remove("hidden");
});

document.querySelectorAll(".close-modal-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const modalId = btn.getAttribute("data-modal");
        document.getElementById(modalId).classList.add("hidden");
    });
});

// Create Note Handler
createNoteForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("create-title").value.trim();
    const description = document.getElementById("create-description").value.trim();

    if (!title) {
        showToast("শিরোনাম লিখুন।", "error");
        return;
    }
    if (!description) {
        showToast("নোটের বিস্তারিত লিখুন।", "error");
        return;
    }

    if (allLoadedNotes.length >= 20) {
        showToast("সর্বোচ্চ ২০টি নোট রাখা যাবে। নতুন নোট তৈরি করতে আগে একটি নোট মুছে ফেলুন।", "error");
        createModal.classList.add("hidden");
        return;
    }

    try {
        await addDoc(collection(db, "notepad"), {
            title: title,
            description: description,
            createdAt: serverTimestamp()
        });

        showToast("নোট সফলভাবে তৈরি হয়েছে।");
        createModal.classList.add("hidden");
        createNoteForm.reset();
        loadNotes();

    } catch (error) {
        console.error("Create error:", error);
        showToast("নোট তৈরি করা যায়নি।", "error");
    }
});

// Global Edit Modal Trigger
window.openEditModal = function(id) {
    const item = allLoadedNotes.find(k => k.id === id);
    if (!item) return;

    document.getElementById("edit-doc-id").value = item.id;
    document.getElementById("edit-title").value = item.title;
    document.getElementById("edit-description").value = item.description;

    editModal.classList.remove("hidden");
};

// Update Note Handler
editNoteForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const docId = document.getElementById("edit-doc-id").value;
    const title = document.getElementById("edit-title").value.trim();
    const description = document.getElementById("edit-description").value.trim();

    if (!title) {
        showToast("শিরোনাম লিখুন।", "error");
        return;
    }
    if (!description) {
        showToast("নোটের বিস্তারিত লিখুন।", "error");
        return;
    }

    try {
        const docRef = doc(db, "notepad", docId);
        await updateDoc(docRef, {
            title: title,
            description: description
        });

        showToast("নোট সফলভাবে আপডেট হয়েছে।");
        editModal.classList.add("hidden");
        loadNotes();

    } catch (error) {
        console.error("Update error:", error);
        showToast("নোট আপডেট করা যায়নি।", "error");
    }
});

// Global Delete Modal Trigger
window.openDeleteModal = function(id) {
    selectedDeleteId = id;
    deleteModal.classList.remove("hidden");
};

// Confirm Delete Handler
confirmDeleteBtn.addEventListener("click", async () => {
    if (!selectedDeleteId) return;

    try {
        await deleteDoc(doc(db, "notepad", selectedDeleteId));
        showToast("নোট সফলভাবে মুছে ফেলা হয়েছে।");
        deleteModal.classList.add("hidden");
        selectedDeleteId = null;
        loadNotes();
    } catch (error) {
        console.error("Delete error:", error);
        showToast("নোট মুছে ফেলা যায়নি।", "error");
    }
});
