import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, collection, doc, getDoc, getDocs, 
    query, limit, startAfter, orderBy, updateDoc, deleteDoc, where 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBRSt2aoSJ-lumYAWGAXE6ncui7__TqJ4E",
    authDomain: "sera-product.firebaseapp.com",
    projectId: "sera-product",
    storageBucket: "sera-product.firebasestorage.app",
    messagingSenderId: "516762224598",
    appId: "1:516762224598:web:b6a571f355a8a4a97c0677",
    measurementId: "G-RLMWH43FXX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const OWNER_EMAILS = [
    "shohidhossain@gmail.com", 
    "nazrulislam887441234@gmail.com", 
    "support.seraproduct@gmail.com"
];

let currentUserRole = null;
let lastVisible = null;
let currentBuyers = [];
let isSearching = false;
let currentSearchQuery = "";
let deletingBuyerId = null;
let statusToggleBuyerId = null;
let pendingBlockState = false;

document.addEventListener("DOMContentLoaded", () => {
    checkAuthentication();
    initEventListeners();
});

function checkAuthentication() {
    showLoading("অ্যাক্সেস যাচাই করা হচ্ছে...");
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            redirectToLogin();
            return;
        }

        const email = user.email;
        if (OWNER_EMAILS.includes(email)) {
            currentUserRole = "Owner";
            initializeDashboard(email, "মালিক");
            return;
        }

        try {
            const adminDocRef = doc(db, "admins", user.uid);
            const adminDoc = await getDoc(adminDocRef);

            if (adminDoc.exists()) {
                const adminData = adminDoc.data();
                if (adminData.active === true && adminData.email === email) {
                    currentUserRole = "Admin";
                    initializeDashboard(email, "অ্যাডমিন");
                    return;
                }
            }
            redirectToLogin();
        } catch (error) {
            showToast("অ্যাক্সেস যাচাই করতে সমস্যা হয়েছে।", "error");
            redirectToLogin();
        }
    });
}

function redirectToLogin() {
    window.location.href = "https://admin.seraproduct.com";
}

function initializeDashboard(email, roleName) {
    document.getElementById("user-email-display").textContent = email;
    document.getElementById("user-role-badge").textContent = roleName;
    document.getElementById("app-wrapper").style.display = "block";
    hideLoading();
    loadBuyers();
}

async function loadBuyers() {
    showLoading("ক্রেতার তথ্য লোড হচ্ছে...");
    try {
        const q = query(collection(db, "buyers"), orderBy("createdAt", "desc"), limit(20));
        const snapshot = await getDocs(q);
        
        currentBuyers = [];
        snapshot.forEach((docSnap) => {
            currentBuyers.push({ id: docSnap.id, ...docSnap.data() });
        });

        lastVisible = snapshot.docs[snapshot.docs.length - 1];
        renderBuyers(currentBuyers);
        
        const loadMoreContainer = document.getElementById("load-more-container");
        const endOfData = document.getElementById("end-of-data");
        
        if (snapshot.docs.length < 20) {
            loadMoreContainer.style.display = "none";
            if (currentBuyers.length > 0) endOfData.style.display = "block";
        } else {
            loadMoreContainer.style.display = "block";
            endOfData.style.display = "none";
        }
    } catch (error) {
        showToast("ক্রেতার তথ্য লোড করা যায়নি।", "error");
    } finally {
        hideLoading();
    }
}

async function loadMoreBuyers() {
    if (!lastVisible || isSearching) return;
    showLoading("আরও তথ্য লোড হচ্ছে...");
    try {
        const q = query(
            collection(db, "buyers"), 
            orderBy("createdAt", "desc"), 
            startAfter(lastVisible), 
            limit(20)
        );
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            document.getElementById("load-more-container").style.display = "none";
            document.getElementById("end-of-data").style.display = "block";
            hideLoading();
            return;
        }

        snapshot.forEach((docSnap) => {
            currentBuyers.push({ id: docSnap.id, ...docSnap.data() });
        });

        lastVisible = snapshot.docs[snapshot.docs.length - 1];
        renderBuyers(currentBuyers);

        if (snapshot.docs.length < 20) {
            document.getElementById("load-more-container").style.display = "none";
            document.getElementById("end-of-data").style.display = "block";
        }
    } catch (error) {
        showToast("আরও তথ্য লোড করতে সমস্যা হয়েছে।", "error");
    } finally {
        hideLoading();
    }
}

function renderBuyers(buyersList) {
    const tableBody = document.getElementById("buyers-table-body");
    const cardContainer = document.getElementById("buyers-card-container");
    const emptyState = document.getElementById("empty-state");

    tableBody.innerHTML = "";
    cardContainer.innerHTML = "";

    if (buyersList.length === 0) {
        emptyState.style.display = "block";
        document.getElementById("empty-state-text").textContent = isSearching ? 
            "আপনার অনুসন্ধানের সাথে মিল পাওয়া যায়নি।" : "কোনো ক্রেতার তথ্য পাওয়া যায়নি।";
        return;
    }

    emptyState.style.display = "none";

    buyersList.forEach((buyer) => {
        const isBlocked = buyer.block === true;
        const statusText = isBlocked ? "ব্লক করা" : "চালু";
        const statusBadgeClass = isBlocked ? "badge badge-blocked" : "badge badge-active";
        const formattedDate = formatCreatedAt(buyer.createdAt);

        // Table Row
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${escapeHtml(buyer.name || "তথ্য নেই")}</td>
            <td>${escapeHtml(buyer.email || "তথ্য নেই")}</td>
            <td>${escapeHtml(buyer.phone || "তথ্য নেই")}</td>
            <td>${formattedDate}</td>
            <td><span class="${statusBadgeClass}">${statusText}</span></td>
            <td>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <label class="switch">
                        <input type="checkbox" ${isBlocked ? "checked" : ""} data-id="${buyer.id}" class="status-toggle">
                        <span class="slider"></span>
                    </label>
                    <button class="btn btn-secondary btn-sm edit-btn" data-id="${buyer.id}">সম্পাদনা</button>
                    <button class="btn btn-outline btn-sm json-btn" data-id="${buyer.id}">JSON কপি</button>
                    <button class="btn btn-danger btn-sm delete-btn" data-id="${buyer.id}">মুছে ফেলুন</button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);

        // Mobile Card
        const card = document.createElement("div");
        card.className = "buyer-card";
        card.innerHTML = `
            <div class="buyer-card-header">
                <strong>${escapeHtml(buyer.name || "তথ্য নেই")}</strong>
                <span class="${statusBadgeClass}">${statusText}</span>
            </div>
            <div class="buyer-card-body">
                <div>ইমেইল: ${escapeHtml(buyer.email || "তথ্য নেই")}</div>
                <div>ফোন: ${escapeHtml(buyer.phone || "তথ্য নেই")}</div>
                <div>সময়: ${formattedDate}</div>
            </div>
            <div class="buyer-card-footer">
                <div style="display: flex; align-items: center; gap: 6px; margin-right: auto;">
                    <label class="switch">
                        <input type="checkbox" ${isBlocked ? "checked" : ""} data-id="${buyer.id}" class="status-toggle">
                        <span class="slider"></span>
                    </label>
                    <span style="font-size: 12px;">ব্লক</span>
                </div>
                <button class="btn btn-secondary btn-sm edit-btn" data-id="${buyer.id}">সম্পাদনা</button>
                <button class="btn btn-outline btn-sm json-btn" data-id="${buyer.id}">JSON</button>
                <button class="btn btn-danger btn-sm delete-btn" data-id="${buyer.id}">মুছে ফেলুন</button>
            </div>
        `;
        cardContainer.appendChild(card);
    });

    attachDynamicListeners();
}

function attachDynamicListeners() {
    document.querySelectorAll(".edit-btn").forEach(btn => {
        btn.addEventListener("click", (e) => openEditModal(e.target.dataset.id));
    });

    document.querySelectorAll(".delete-btn").forEach(btn => {
        btn.addEventListener("click", (e) => promptDeleteBuyer(e.target.dataset.id));
    });

    document.querySelectorAll(".json-btn").forEach(btn => {
        btn.addEventListener("click", (e) => copyBuyerJSON(e.target.dataset.id));
    });

    document.querySelectorAll(".status-toggle").forEach(toggle => {
        toggle.addEventListener("change", (e) => {
            const buyerId = e.target.dataset.id;
            const newState = e.target.checked;
            e.target.checked = !newState; // Revert visually until confirmed
            promptStatusChange(buyerId, newState);
        });
    });
}

function promptStatusChange(buyerId, newState) {
    statusToggleBuyerId = buyerId;
    pendingBlockState = newState;
    const modalText = document.getElementById("status-modal-text");
    modalText.textContent = newState ? "আপনি কি এই ক্রেতাকে ব্লক করতে চান?" : "আপনি কি এই ক্রেতার ব্লক খুলতে চান?";
    document.getElementById("status-modal").style.display = "flex";
}

async function executeStatusChange() {
    document.getElementById("status-modal").style.display = "none";
    showLoading("ক্রেতার অবস্থা পরিবর্তন করা হচ্ছে...");
    try {
        const buyerRef = doc(db, "buyers", statusToggleBuyerId);
        await updateDoc(buyerRef, { block: pendingBlockState });

        const buyer = currentBuyers.find(b => b.id === statusToggleBuyerId);
        if (buyer) buyer.block = pendingBlockState;

        renderBuyers(currentBuyers);
        showToast(pendingBlockState ? "ক্রেতাকে সফলভাবে ব্লক করা হয়েছে।" : "ক্রেতার ব্লক সফলভাবে খোলা হয়েছে।", "success");
    } catch (error) {
        showToast("ক্রেতার অবস্থা পরিবর্তন করা যায়নি।", "error");
    } finally {
        hideLoading();
    }
}

function openEditModal(buyerId) {
    const buyer = currentBuyers.find(b => b.id === buyerId);
    if (!buyer) return;

    document.getElementById("edit-buyer-id").value = buyer.id;
    document.getElementById("edit-name").value = buyer.name || "";
    document.getElementById("edit-phone").value = buyer.phone || "";
    document.getElementById("edit-modal").style.display = "flex";
}

function closeEditModal() {
    document.getElementById("edit-modal").style.display = "none";
}

async function handleEditSubmit(e) {
    e.preventDefault();
    const buyerId = document.getElementById("edit-buyer-id").value;
    const name = document.getElementById("edit-name").value.trim();
    const phone = document.getElementById("edit-phone").value.trim();

    if (!name || !phone) {
        showToast("নাম এবং ফোন নম্বর খালি রাখা যাবে না।", "error");
        return;
    }

    showLoading("তথ্য সংরক্ষণ করা হচ্ছে...");
    try {
        const buyerRef = doc(db, "buyers", buyerId);
        await updateDoc(buyerRef, { name, phone });

        const buyer = currentBuyers.find(b => b.id === buyerId);
        if (buyer) {
            buyer.name = name;
            buyer.phone = phone;
        }

        renderBuyers(currentBuyers);
        closeEditModal();
        showToast("তথ্য সফলভাবে সংরক্ষণ করা হয়েছে।", "success");
    } catch (error) {
        showToast("তথ্য সংরক্ষণ করা যায়নি।", "error");
    } finally {
        hideLoading();
    }
}

function promptDeleteBuyer(buyerId) {
    deletingBuyerId = buyerId;
    document.getElementById("delete-modal").style.display = "flex";
}

async function executeDeleteBuyer() {
    document.getElementById("delete-modal").style.display = "none";
    showLoading("তথ্য মুছে ফেলা হচ্ছে...");
    try {
        const buyerRef = doc(db, "buyers", deletingBuyerId);
        await deleteDoc(buyerRef);

        currentBuyers = currentBuyers.filter(b => b.id !== deletingBuyerId);
        renderBuyers(currentBuyers);
        showToast("ক্রেতার তথ্য সফলভাবে মুছে ফেলা হয়েছে।", "success");
    } catch (error) {
        showToast("তথ্য মুছে ফেলা যায়নি।", "error");
    } finally {
        hideLoading();
    }
}

async function searchBuyers() {
    const queryText = document.getElementById("search-input").value.trim();
    if (!queryText) {
        resetSearch();
        return;
    }

    isSearching = true;
    currentSearchQuery = queryText;
    document.getElementById("clear-search-btn").style.display = "inline-flex";
    document.getElementById("load-more-container").style.display = "none";
    document.getElementById("end-of-data").style.display = "none";
    showLoading("অনুসন্ধান করা হচ্ছে...");

    try {
        const nameQuery = getDocs(query(collection(db, "buyers"), orderBy("name"), startAfter(queryText), limit(20)));
        const snapshot = await getDocs(query(collection(db, "buyers"), limit(50)));
        
        const resultsMap = new Map();
        const lowerQuery = queryText.toLowerCase();

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const name = (data.name || "").toLowerCase();
            const email = (data.email || "").toLowerCase();
            const phone = (data.phone || "").toLowerCase();

            if (name.includes(lowerQuery) || email.includes(lowerQuery) || phone.includes(lowerQuery)) {
                resultsMap.set(docSnap.id, { id: docSnap.id, ...data });
            }
        });

        currentBuyers = Array.from(resultsMap.values());
        renderBuyers(currentBuyers);
    } catch (error) {
        showToast("অনুসন্ধান ব্যর্থ হয়েছে।", "error");
    } finally {
        hideLoading();
    }
}

function resetSearch() {
    document.getElementById("search-input").value = "";
    document.getElementById("clear-search-btn").style.display = "none";
    isSearching = false;
    currentSearchQuery = "";
    loadBuyers();
}

function copyBuyerJSON(buyerId) {
    const buyer = currentBuyers.find(b => b.id === buyerId);
    if (!buyer) return;

    const jsonString = JSON.stringify(buyer, null, 2);
    copyWithFallback(jsonString, "JSON সফলভাবে কপি হয়েছে।");
}

function copyBulkJSON() {
    if (currentBuyers.length === 0) {
        showToast("কপি করার মতো কোনো তথ্য নেই।", "error");
        return;
    }
    const jsonString = JSON.stringify(currentBuyers, null, 2);
    copyWithFallback(jsonString, "JSON সফলভাবে কপি হয়েছে।");
}

function copyWithFallback(text, successMessage) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast(successMessage, "success");
        }).catch(() => {
            fallbackCopy(text, successMessage);
        });
    } else {
        fallbackCopy(text, successMessage);
    }
}

function fallbackCopy(text, successMessage) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showToast(successMessage, "success");
        } else {
            showToast("JSON কপি করা যায়নি।", "error");
        }
    } catch (err) {
        showToast("JSON কপি করা যায়নি।", "error");
    }
    document.body.removeChild(textarea);
}

function formatCreatedAt(timestamp) {
    if (!timestamp || !timestamp.seconds) return "তথ্য নেই";
    const date = new Date(timestamp.seconds * 1000);
    return new Intl.DateTimeFormat('bn-BD', {
        dateStyle: 'long',
        timeStyle: 'short'
    }).format(date);
}

function showLoading(text) {
    document.getElementById("loading-text").textContent = text;
    document.getElementById("loading-screen").style.display = "flex";
}

function hideLoading() {
    document.getElementById("loading-screen").style.display = "none";
}

function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function initEventListeners() {
    document.getElementById("search-btn").addEventListener("click", searchBuyers);
    document.getElementById("search-input").addEventListener("keypress", (e) => {
        if (e.key === "Enter") searchBuyers();
    });
    document.getElementById("clear-search-btn").addEventListener("click", resetSearch);
    document.getElementById("load-more-btn").addEventListener("click", loadMoreBuyers);
    document.getElementById("bulk-json-btn").addEventListener("click", copyBulkJSON);

    document.getElementById("close-modal-btn").addEventListener("click", closeEditModal);
    document.getElementById("cancel-edit-btn").addEventListener("click", closeEditModal);
    document.getElementById("edit-buyer-form").addEventListener("submit", handleEditSubmit);

    document.getElementById("cancel-delete-btn").addEventListener("click", () => {
        document.getElementById("delete-modal").style.display = "none";
    });
    document.getElementById("confirm-delete-btn").addEventListener("click", executeDeleteBuyer);

    document.getElementById("cancel-status-btn").addEventListener("click", () => {
        document.getElementById("status-modal").style.display = "none";
        renderBuyers(currentBuyers); // Re-render to fix toggle state back
    });
    document.getElementById("confirm-status-btn").addEventListener("click", executeStatusChange);
}
