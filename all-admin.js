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
    setDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    orderBy, 
    limit, 
    startAfter, 
    getDocs 
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

// Authorized Owner Emails List
const OWNER_EMAILS = [
    "shohidhossain200@gmail.com",
    "nazrulislam887441234@gmail.com",
    "support.seraproduct@gmail.com"
];

// State Variables
let allLoadedAdmins = [];
let lastVisibleDoc = null;
let currentSearchQuery = "";
let selectedDeleteUid = null;

// DOM Elements
const authLoader = document.getElementById("auth-loader");
const appContainer = document.getElementById("app-container");
const ownerEmailDisplay = document.getElementById("owner-email-display");
const logoutBtn = document.getElementById("logout-btn");
const adminTableBody = document.getElementById("admin-table-body");
const emptyState = document.getElementById("empty-state");
const loadMoreBtn = document.getElementById("load-more-btn");
const loadMoreText = document.getElementById("load-more-text");
const loadMoreSpinner = document.getElementById("load-more-spinner");
const totalAdminCount = document.getElementById("total-admin-count");
const searchInput = document.getElementById("search-input");

// Modal Elements
const createModal = document.getElementById("create-modal");
const editModal = document.getElementById("edit-modal");
const deleteModal = document.getElementById("delete-modal");
const openCreateModalBtn = document.getElementById("open-create-modal-btn");
const createAdminForm = document.getElementById("create-admin-form");
const editAdminForm = document.getElementById("edit-admin-form");
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

// Authentication & Owner Verification Guard
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("/admin/"); // Redirect to login if not logged in
        return;
    }

    const emailLower = user.email ? user.email.toLowerCase() : "";
    if (!OWNER_EMAILS.includes(emailLower)) {
        await signOut(auth);
        alert("অ্যাক্সেস অনুমোদিত নয়");
        window.location.replace("/admin/");
        return;
    }

    // Owner verified successfully
    ownerEmailDisplay.textContent = user.email;
    authLoader.classList.add("hidden");
    appContainer.classList.remove("hidden");

    // Load initial admins
    loadAdmins();
});

// Logout Handler
logoutBtn.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.replace("/admin/");
    } catch (error) {
        showToast("লগআউট করতে সমস্যা হয়েছে।", "error");
    }
});

// Load Initial 20 Admins (Cursor Pagination)
async function loadAdmins() {
    try {
        adminTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">অ্যাডমিন তালিকা লোড হচ্ছে...</td></tr>';
        
        const q = query(collection(db, "admins"), orderBy("name"), limit(20));
        const snapshot = await getDocs(q);

        allLoadedAdmins = [];
        if (snapshot.empty) {
            lastVisibleDoc = null;
            renderAdmins([]);
            loadMoreBtn.classList.add("hidden");
            return;
        }

        lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];

        snapshot.forEach((docSnap) => {
            allLoadedAdmins.push({ id: docSnap.id, ...docSnap.data() });
        });

        renderAdmins(allLoadedAdmins);

        if (snapshot.docs.length < 20) {
            loadMoreBtn.classList.add("hidden");
        } else {
            loadMoreBtn.classList.remove("hidden");
        }

    } catch (error) {
        console.error("Error loading admins:", error);
        showToast("তথ্য লোড করা যায়নি। আবার চেষ্টা করুন।", "error");
        adminTableBody.innerHTML = '';
        emptyState.classList.remove("hidden");
    }
}

// Load More Admins
loadMoreBtn.addEventListener("click", async () => {
    if (!lastVisibleDoc) return;

    loadMoreText.textContent = "আরও লোড হচ্ছে...";
    loadMoreSpinner.classList.remove("hidden");
    loadMoreBtn.setAttribute("disabled", "true");

    try {
        const q = query(
            collection(db, "admins"), 
            orderBy("name"), 
            startAfter(lastVisibleDoc), 
            limit(20)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
            snapshot.forEach((docSnap) => {
                allLoadedAdmins.push({ id: docSnap.id, ...docSnap.data() });
            });
            renderAdmins(allLoadedAdmins);
        }

        if (snapshot.docs.length < 20) {
            loadMoreBtn.classList.add("hidden");
        }
    } catch (error) {
        console.error("Error loading more:", error);
        showToast("ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।", "error");
    } finally {
        loadMoreText.textContent = "আরও দেখুন";
        loadMoreSpinner.classList.add("hidden");
        loadMoreBtn.removeAttribute("disabled");
    }
});

// Render Admins Table/List
function renderAdmins(adminsToRender) {
    adminTableBody.innerHTML = "";
    totalAdminCount.textContent = adminsToRender.length;

    if (adminsToRender.length === 0) {
        emptyState.classList.remove("hidden");
        return;
    }

    emptyState.classList.add("hidden");

    adminsToRender.forEach((admin) => {
        const tr = document.createElement("tr");
        const statusBadge = admin.active 
            ? '<span class="badge active">সক্রিয়</span>' 
            : '<span class="badge inactive">নিষ্ক্রিয়</span>';

        tr.innerHTML = `
            <td><strong>${escapeHTML(admin.name)}</strong></td>
            <td>${escapeHTML(admin.email)}</td>
            <td><code>${escapeHTML(admin.uid)}</code></td>
            <td>${statusBadge}</td>
            <td>
                <div class="action-btns">
                    <button class="icon-btn edit-btn" title="সম্পাদনা" onclick="window.openEditModal('${admin.uid}')">
                        <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                    </button>
                    <button class="icon-btn delete-btn" title="ডিলিট" onclick="window.openDeleteModal('${admin.uid}')">
                        <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                </div>
            </td>
        `;
        adminTableBody.appendChild(tr);
    });
}

// Security HTML Escaper
function escapeHTML(str) {
    return str ? str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    ) : '';
}

// Client-Side Search Filtering (Instant Filtering on Loaded Data)
searchInput.addEventListener("input", (e) => {
    const term = e.target.value.trim().toLowerCase();
    if (!term) {
        renderAdmins(allLoadedAdmins);
        return;
    }

    const filtered = allLoadedAdmins.filter(admin => 
        (admin.name && admin.name.toLowerCase().includes(term)) ||
        (admin.email && admin.email.toLowerCase().includes(term)) ||
        (admin.uid && admin.uid.toLowerCase().includes(term))
    );

    renderAdmins(filtered);
});

// Modal Controls
openCreateModalBtn.addEventListener("click", () => createModal.classList.remove("hidden"));

document.querySelectorAll(".close-modal-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const modalId = btn.getAttribute("data-modal");
        document.getElementById(modalId).classList.add("hidden");
    });
});

// Create Admin Handler
createAdminForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const uid = document.getElementById("create-uid").value.trim();
    const name = document.getElementById("create-name").value.trim();
    const email = document.getElementById("create-email").value.trim();
    const active = document.querySelector('input[name="create-active"]:checked').value === "true";

    if (!uid || !name || !email) {
        showToast("দয়া করে সমস্ত তথ্য সঠিকভাবে প্রদান করুন।", "error");
        return;
    }

    try {
        const adminRef = doc(db, "admins", uid);
        const docSnap = await getDoc(adminRef);

        if (docSnap.exists()) {
            showToast("এই UID দিয়ে একজন অ্যাডমিন ইতিমধ্যে রয়েছে।", "error");
            return;
        }

        const newAdminData = {
            name: name,
            email: email.toLowerCase(),
            uid: uid,
            active: active
        };

        await setDoc(adminRef, newAdminData);
        showToast("অ্যাডমিন সফলভাবে তৈরি হয়েছে।");
        createModal.classList.add("hidden");
        createAdminForm.reset();
        loadAdmins(); // Refresh list

    } catch (error) {
        console.error("Create error:", error);
        showToast("অ্যাডমিন তৈরি করা যায়নি। আবার চেষ্টা করুন।", "error");
    }
});

// Global Edit Modal Trigger Function
window.openEditModal = function(uid) {
    const admin = allLoadedAdmins.find(a => a.uid === uid);
    if (!admin) return;

    document.getElementById("edit-uid").value = admin.uid;
    document.getElementById("edit-uid-display").value = admin.uid;
    document.getElementById("edit-name").value = admin.name;
    document.getElementById("edit-email").value = admin.email;
    document.getElementById("edit-active").value = admin.active ? "true" : "false";

    editModal.classList.remove("hidden");
};

// Update Admin Handler
editAdminForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const uid = document.getElementById("edit-uid").value;
    const name = document.getElementById("edit-name").value.trim();
    const email = document.getElementById("edit-email").value.trim();
    const active = document.getElementById("edit-active").value === "true";

    try {
        const adminRef = doc(db, "admins", uid);
        await updateDoc(adminRef, {
            name: name,
            email: email.toLowerCase(),
            active: active
        });

        showToast("অ্যাডমিনের তথ্য সফলভাবে আপডেট হয়েছে।");
        editModal.classList.add("hidden");
        loadAdmins(); // Refresh list

    } catch (error) {
        console.error("Update error:", error);
        showToast("অ্যাডমিনের তথ্য পরিবর্তন করা যায়নি।", "error");
    }
});

// Global Delete Modal Trigger Function
window.openDeleteModal = function(uid) {
    selectedDeleteUid = uid;
    deleteModal.classList.remove("hidden");
};

// Confirm Delete Handler
confirmDeleteBtn.addEventListener("click", async () => {
    if (!selectedDeleteUid) return;

    try {
        await deleteDoc(doc(db, "admins", selectedDeleteUid));
        showToast("অ্যাডমিন সফলভাবে মুছে ফেলা হয়েছে।");
        deleteModal.classList.add("hidden");
        selectedDeleteUid = null;
        loadAdmins(); // Refresh list
    } catch (error) {
        console.error("Delete error:", error);
        showToast("অ্যাডমিন মুছে ফেলা যায়নি।", "error");
    }
});
