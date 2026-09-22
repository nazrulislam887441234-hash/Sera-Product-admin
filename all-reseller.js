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

// Authoritative Owner Emails List
const OWNER_EMAILS = [
    "shohidhossain@gmail.com",
    "nazrulislam887441234@gmail.com",
    "support.seraproduct@gmail.com"
];

// Pagination & State Management
let resellerList = [];
let lastVisibleDocument = null;
let isLoading = false;
let hasMoreData = true;
let currentSearchTerm = "";
let selectedDeleteId = null;

// DOM Elements
const authLoader = document.getElementById("auth-loader");
const appContainer = document.getElementById("app-container");
const userEmailDisplay = document.getElementById("user-email-display");
const userBadge = document.getElementById("user-badge");
const logoutBtn = document.getElementById("logout-btn");
const resellerTbody = document.getElementById("reseller-tbody");
const mobileCardsContainer = document.getElementById("mobile-cards-container");
const loadingState = document.getElementById("loading-state");
const emptyState = document.getElementById("empty-state");
const emptyStateText = document.getElementById("empty-state-text");
const loadMoreWrap = document.getElementById("load-more-wrap");
const loadMoreBtn = document.getElementById("load-more-btn");
const searchInput = document.getElementById("search-input");

// Modals & Forms
const editModal = document.getElementById("edit-modal");
const deleteModal = document.getElementById("delete-modal");
const editResellerForm = document.getElementById("edit-reseller-form");
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

    // Check Admin authorization via admins/{uid}
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
    loadInitialResellers();
}

// Logout Handler
logoutBtn.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.replace("/admin/");
    } catch (error) {
        showToast("লগআউট করতে সমস্যা হয়েছে।", "error");
    }
});

// Load Initial 20 Resellers (Alphabetical A->Z by name)
async function loadInitialResellers() {
    try {
        isLoading = true;
        loadingState.classList.remove("hidden");
        emptyState.classList.add("hidden");
        resellerList = [];
        lastVisibleDocument = null;
        hasMoreData = true;

        const q = query(collection(db, "reseller"), orderBy("name", "asc"), limit(20));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            loadingState.classList.add("hidden");
            emptyState.classList.remove("hidden");
            loadMoreWrap.classList.add("hidden");
            return;
        }

        snapshot.forEach((docSnap) => {
            resellerList.push({ id: docSnap.id, ...docSnap.data() });
        });

        lastVisibleDocument = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.docs.length < 20) {
            hasMoreData = false;
            loadMoreWrap.classList.add("hidden");
        } else {
            loadMoreWrap.classList.remove("hidden");
        }

        loadingState.classList.add("hidden");
        renderResellers(resellerList);

    } catch (error) {
        console.error("Error loading resellers:", error);
        loadingState.classList.add("hidden");
        showToast("রিসেলারদের তথ্য লোড করা যায়নি। আবার চেষ্টা করুন।", "error");
    } finally {
        isLoading = false;
    }
}

// Load More Resellers (Cursor-based pagination)
async function loadMoreResellers() {
    if (isLoading || !hasMoreData || currentSearchTerm !== "") return;

    try {
        isLoading = true;
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = "আরও লোড হচ্ছে...";

        const q = query(
            collection(db, "reseller"), 
            orderBy("name", "asc"), 
            startAfter(lastVisibleDocument), 
            limit(20)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            hasMoreData = false;
            loadMoreWrap.classList.add("hidden");
            return;
        }

        snapshot.forEach((docSnap) => {
            resellerList.push({ id: docSnap.id, ...docSnap.data() });
        });

        lastVisibleDocument = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.docs.length < 20) {
            hasMoreData = false;
            loadMoreWrap.classList.add("hidden");
        }

        renderResellers(resellerList);

    } catch (error) {
        console.error("Error loading more resellers:", error);
        showToast("আরও তথ্য লোড করা যায়নি।", "error");
    } finally {
        isLoading = false;
        loadMoreBtn.disabled = false;
        loadMoreBtn.innerHTML = "<span>আরও দেখুন</span>";
    }
}

loadMoreBtn.addEventListener("click", loadMoreResellers);

// Render Resellers (Table & Mobile Cards)
function renderResellers(listToRender) {
    resellerTbody.innerHTML = "";
    mobileCardsContainer.innerHTML = "";

    if (listToRender.length === 0) {
        emptyState.classList.remove("hidden");
        if (currentSearchTerm) {
            emptyStateText.textContent = "আপনার খোঁজার সাথে মিলে কোনো রিসেলার পাওয়া যায়নি।";
        } else {
            emptyStateText.textContent = "কোনো রিসেলার পাওয়া যায়নি";
        }
        return;
    }

    emptyState.classList.add("hidden");

    listToRender.forEach((item) => {
        const isActive = item.active === true;
        const statusHtml = isActive 
            ? `<span class="status-badge active"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>সক্রিয়</span>`
            : `<span class="status-badge inactive"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>বন্ধ</span>`;

        const statusToggleText = isActive ? "অ্যাকাউন্ট বন্ধ করুন" : "অ্যাকাউন্ট চালু করুন";

        // Desktop Table Row
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${escapeHTML(item.name)}</strong></td>
            <td>${escapeHTML(item.email)}</td>
            <td>${escapeHTML(item.phone)}</td>
            <td><code>${escapeHTML(item.uid)}</code></td>
            <td>${statusHtml}</td>
            <td>
                <div class="actions-cell">
                    <button class="action-btn status-toggle-btn" title="${statusToggleText}" onclick="window.toggleStatus('${item.id}', ${!isActive})">
                        <span>${statusToggleText}</span>
                    </button>
                    <button class="action-btn edit-action" title="সম্পাদনা" onclick="window.openEditModal('${item.id}')">
                        <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                        <span>সম্পাদনা</span>
                    </button>
                    <button class="action-btn copy-json-btn" title="JSON কপি করুন" onclick="window.copyResellerJson('${item.id}')">
                        <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                        <span>JSON কপি</span>
                    </button>
                    <button class="action-btn delete-action" title="ডিলিট" onclick="window.openDeleteModal('${item.id}')">
                        <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        <span>ডিলিট</span>
                    </button>
                </div>
            </td>
        `;
        resellerTbody.appendChild(tr);

        // Mobile Card View
        const card = document.createElement("div");
        card.className = "reseller-card";
        card.innerHTML = `
            <div class="reseller-card-row">
                <span class="reseller-card-label">নাম</span>
                <span class="reseller-card-val">${escapeHTML(item.name)}</span>
            </div>
            <div class="reseller-card-row">
                <span class="reseller-card-label">ইমেইল</span>
                <span class="reseller-card-val">${escapeHTML(item.email)}</span>
            </div>
            <div class="reseller-card-row">
                <span class="reseller-card-label">ফোন</span>
                <span class="reseller-card-val">${escapeHTML(item.phone)}</span>
            </div>
            <div class="reseller-card-row">
                <span class="reseller-card-label">UID</span>
                <span class="reseller-card-val"><code>${escapeHTML(item.uid)}</code></span>
            </div>
            <div class="reseller-card-row">
                <span class="reseller-card-label">অবস্থা</span>
                <span class="reseller-card-val">${statusHtml}</span>
            </div>
            <div class="reseller-card-actions">
                <button class="action-btn status-toggle-btn" onclick="window.toggleStatus('${item.id}', ${!isActive})">
                    <span>${statusToggleText}</span>
                </button>
                <button class="action-btn edit-action" onclick="window.openEditModal('${item.id}')">
                    <span>সম্পাদনা</span>
                </button>
                <button class="action-btn copy-json-btn" onclick="window.copyResellerJson('${item.id}')">
                    <span>JSON কপি</span>
                </button>
                <button class="action-btn delete-action" onclick="window.openDeleteModal('${item.id}')">
                    <span>ডিলিট</span>
                </button>
            </div>
        `;
        mobileCardsContainer.appendChild(card);
    });
}

// HTML Escaper
function escapeHTML(str) {
    return str ? String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    ) : '';
}

// Search Filtering (Client-side instant filtering on loaded records)
searchInput.addEventListener("input", (e) => {
    currentSearchTerm = e.target.value.trim().toLowerCase();
    
    if (!currentSearchTerm) {
        renderResellers(resellerList);
        if (hasMoreData) loadMoreWrap.classList.remove("hidden");
        return;
    }

    loadMoreWrap.classList.add("hidden");

    const filtered = resellerList.filter(item => 
        (item.name && item.name.toLowerCase().includes(currentSearchTerm)) ||
        (item.email && item.email.toLowerCase().includes(currentSearchTerm)) ||
        (item.phone && item.phone.toLowerCase().includes(currentSearchTerm)) ||
        (item.uid && item.uid.toLowerCase().includes(currentSearchTerm))
    );

    renderResellers(filtered);
});

// Toggle Active/Inactive Status
window.toggleStatus = async function(id, newStatus) {
    try {
        const docRef = doc(db, "reseller", id);
        await updateDoc(docRef, { active: newStatus });

        // Update local state
        const item = resellerList.find(r => r.id === id);
        if (item) item.active = newStatus;

        // Re-render
        const term = searchInput.value.trim().toLowerCase();
        if (term) {
            const filtered = resellerList.filter(r => 
                r.name.toLowerCase().includes(term) || r.email.toLowerCase().includes(term) ||
                r.phone.toLowerCase().includes(term) || r.uid.toLowerCase().includes(term)
            );
            renderResellers(filtered);
        } else {
            renderResellers(resellerList);
        }

        showToast("অ্যাকাউন্টের অবস্থা সফলভাবে পরিবর্তন করা হয়েছে।");

    } catch (error) {
        console.error("Status toggle error:", error);
        showToast("অ্যাকাউন্টের অবস্থা পরিবর্তন করা যায়নি।", "error");
    }
};

// Modal Controls
window.openEditModal = function(id) {
    const item = resellerList.find(r => r.id === id);
    if (!item) return;

    document.getElementById("edit-original-id").value = item.id;
    document.getElementById("edit-name").value = item.name;
    document.getElementById("edit-email").value = item.email;
    document.getElementById("edit-phone").value = item.phone;
    document.getElementById("edit-uid").value = item.uid;
    document.getElementById("edit-active").checked = item.active === true;

    editModal.classList.remove("hidden");
};

document.querySelectorAll(".close-modal-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const modalId = btn.getAttribute("data-modal");
        document.getElementById(modalId).classList.add("hidden");
    });
});

// Update Reseller Handler (Safely managing UID change & document migration if ID differs)
editResellerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const originalId = document.getElementById("edit-original-id").value;
    const name = document.getElementById("edit-name").value.trim();
    const email = document.getElementById("edit-email").value.trim();
    const phone = document.getElementById("edit-phone").value.trim();
    const uid = document.getElementById("edit-uid").value.trim();
    const active = document.getElementById("edit-active").checked;

    if (!name || !email || !phone || !uid) {
        showToast("সবগুলো ঘর পূরণ করা বাধ্যতামূলক।", "error");
        return;
    }

    try {
        const updatedData = {
            name: name,
            email: email,
            phone: phone,
            uid: uid,
            active: Boolean(active)
        };

        // If document ID matches originalId, but user changed UID and document ID is also used as UID
        if (originalId !== uid) {
            // Migrate document to new ID (uid) and delete old document
            await setDoc(doc(db, "reseller", uid), updatedData);
            await deleteDoc(doc(db, "reseller", originalId));
        } else {
            const docRef = doc(db, "reseller", originalId);
            await updateDoc(docRef, updatedData);
        }

        showToast("রিসেলারের তথ্য সফলভাবে আপডেট হয়েছে।");
        editModal.classList.add("hidden");
        loadInitialResellers();

    } catch (error) {
        console.error("Update error:", error);
        showToast("রিসেলারের তথ্য আপডেট করা যায়নি।", "error");
    }
});

// Delete Reseller Triggers
window.openDeleteModal = function(id) {
    selectedDeleteId = id;
    deleteModal.classList.remove("hidden");
};

confirmDeleteBtn.addEventListener("click", async () => {
    if (!selectedDeleteId) return;

    try {
        await deleteDoc(doc(db, "reseller", selectedDeleteId));
        showToast("রিসেলার সফলভাবে মুছে ফেলা হয়েছে।");
        deleteModal.classList.add("hidden");
        selectedDeleteId = null;
        loadInitialResellers();
    } catch (error) {
        console.error("Delete error:", error);
        showToast("রিসেলার মুছে ফেলা যায়নি।", "error");
    }
});

// JSON Copy with Robust HTTP/HTTPS Fallback Mechanism
window.copyResellerJson = async function(id) {
    const item = resellerList.find(r => r.id === id);
    if (!item) return;

    // Strictly 5 fields as requested
    const cleanJsonObj = {
        name: item.name,
        email: item.email,
        phone: item.phone,
        uid: item.uid,
        active: Boolean(item.active)
    };

    const jsonString = JSON.stringify(cleanJsonObj, null, 2);

    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(jsonString);
            showToast("JSON সফলভাবে কপি হয়েছে।");
            return;
        }
    } catch (err) {
        // Fallback below
    }

    // Fallback for HTTP environments or unsupported clipboard API
    try {
        const textarea = document.createElement("textarea");
        textarea.value = jsonString;
        textarea.style.position = "fixed";
        textarea.style.top = "0";
        textarea.style.left = "0";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        
        const successful = document.execCommand("copy");
        document.body.removeChild(textarea);

        if (successful) {
            showToast("JSON সফলভাবে কপি হয়েছে।");
        } else {
            showToast("JSON কপি করা যায়নি।", "error");
        }
    } catch (error) {
        showToast("JSON কপি করা যায়নি।", "error");
    }
};
