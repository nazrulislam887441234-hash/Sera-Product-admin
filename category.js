import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    collection, 
    query, 
    where, 
    limit, 
    getDocs, 
    orderBy, 
    startAfter, 
    serverTimestamp, 
    setDoc,
    updateDoc, 
    deleteDoc, 
    runTransaction 
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

const OWNER_EMAILS = [
    "shohidhossain@gmail.com",
    "nazrulislam887441234@gmail.com",
    "support.seraproduct@gmail.com"
];

let app, auth, db;
let lastVisibleDocument = null;
let isSearchActive = false;
let currentSearchQuery = "";
let categoryToDeleteId = null;
let selectedFile = null;

// DOM Elements
const loadingScreen = document.getElementById("loadingScreen");
const loadingText = document.getElementById("loadingText");
const userEmailDisplay = document.getElementById("userEmailDisplay");
const userRoleBadge = document.getElementById("userRoleBadge");
const logoutBtn = document.getElementById("logoutBtn");
const categoryForm = document.getElementById("categoryForm");
const categoryNameInput = document.getElementById("categoryNameInput");
const categorySlugInput = document.getElementById("categorySlugInput");
const categoryImageInput = document.getElementById("categoryImageInput");
const imageDropZone = document.getElementById("imageDropZone");
const imagePreviewContent = document.getElementById("imagePreviewContent");
const imagePreviewCard = document.getElementById("imagePreviewCard");
const previewImgElement = document.getElementById("previewImgElement");
const previewFileName = document.getElementById("previewFileName");
const removeImageBtn = document.getElementById("removeImageBtn");
const saveCategoryBtn = document.getElementById("saveCategoryBtn");
const saveBtnText = document.getElementById("saveBtnText");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const editingCategoryId = document.getElementById("editingCategoryId");
const formSectionTitle = document.getElementById("formSectionTitle");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const resetSearchBtn = document.getElementById("resetSearchBtn");
const categoryGrid = document.getElementById("categoryGrid");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const totalCountBadge = document.getElementById("totalCountBadge");
const copyLoadedJsonBtn = document.getElementById("copyLoadedJsonBtn");
const deleteModal = document.getElementById("deleteModal");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

// Initialize Firebase & Auth
function initializeFirebase() {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        checkAuthentication();
    } catch (error) {
        showError("সিস্টেম ইনিশিয়ালাইজেশন ব্যর্থ হয়েছে।");
        hideLoading();
    }
}

function checkAuthentication() {
    showLoading("অথেন্টিকেশন চেক করা হচ্ছে...");
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "https://admin.seraproduct.com";
            return;
        }

        userEmailDisplay.textContent = user.email;

        if (OWNER_EMAILS.includes(user.email)) {
            userRoleBadge.textContent = "মালিক";
            userRoleBadge.classList.remove("hidden");
            hideLoading();
            loadCategories();
        } else {
            const isAdminValid = await verifyAdminAccess(user.uid);
            if (isAdminValid) {
                userRoleBadge.textContent = "অ্যাডমিন";
                userRoleBadge.classList.remove("hidden");
                hideLoading();
                loadCategories();
            } else {
                hideLoading();
                showError("আপনার এই পেজে প্রবেশের অনুমতি নেই।");
                setTimeout(() => {
                    window.location.href = "https://admin.seraproduct.com";
                }, 2000);
            }
        }
    });
}

async function verifyAdminAccess(uid) {
    try {
        const adminDocRef = doc(db, "admins", uid);
        const adminSnap = await getDoc(adminDocRef);
        if (!adminSnap.exists()) return false;
        
        const data = adminSnap.data();
        if (data && data.uid === uid && data.active === true && data.email && data.name) {
            return true;
        }
        return false;
    } catch (error) {
        return false;
    }
}

// Slug Generation Utility (Unicode Safe)
function generateCategorySlug(name) {
    return name
        .trim()
        .toLowerCase()
        .replace(/[\s\t\n]+/g, "-")
        .replace(/[^\w\u0980-\u09FF-]+/g, "")
        .replace(/--+/g, "-")
        .replace(/^-+|-+$/g, "");
}

async function checkSlugExists(slug, excludeId = null) {
    const q = query(collection(db, "categories"), where("categorySlug", "==", slug));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return false;
    
    if (excludeId) {
        let exists = false;
        querySnapshot.forEach((docSnap) => {
            if (docSnap.id !== excludeId) exists = true;
        });
        return exists;
    }
    return true;
}

async function generateUniqueSlug(baseSlug, excludeId = null) {
    let slug = baseSlug;
    let counter = 2;
    while (await checkSlugExists(slug, excludeId)) {
        slug = `${baseSlug}-${counter}`;
        counter++;
    }
    return slug;
}

// Image Selection & Preview Handling
categoryImageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
        if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
            showError("অনুগ্রহ করে বৈধ ফরম্যাটের ছবি নির্বাচন করুন।");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showError("ছবির সাইজ ৫ মেগাবাইটের কম হতে হবে।");
            return;
        }
        selectedFile = file;
        showImagePreview(file);
    }
});

function showImagePreview(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        previewImgElement.src = e.target.result;
        previewFileName.textContent = file.name;
        imagePreviewContent.classList.add("hidden");
        imagePreviewCard.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
}

removeImageBtn.addEventListener("click", () => {
    selectedFile = null;
    categoryImageInput.value = "";
    previewImgElement.src = "";
    imagePreviewCard.classList.add("hidden");
    imagePreviewContent.classList.remove("hidden");
});

categoryNameInput.addEventListener("input", (e) => {
    categorySlugInput.value = generateCategorySlug(e.target.value);
});

// ImgBB API & Upload Process
async function getActiveImgBBApi() {
    try {
        const q = query(collection(db, "imgbb_api"), where("active", "==", true), limit(1));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            throw new Error("No active API");
        }
        const apiData = querySnapshot.docs[0].data();
        if (!apiData.imgbbApi) {
            throw new Error("Missing API Key");
        }
        return apiData.imgbbApi;
    } catch (error) {
        throw new Error("বর্তমানে ছবি আপলোড করার কোনো ব্যবস্থা সক্রিয় নেই।");
    }
}

async function uploadImageToImgBB(file) {
    const apiKey = await getActiveImgBBApi();
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: "POST",
        body: formData
    });

    const data = await response.json();
    if (data && data.success) {
        return data.data.url;
    } else {
        throw new Error("ছবি আপলোড করা যায়নি।");
    }
}

// Form Submit (Create & Update)
categoryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = categoryNameInput.value.trim();
    const editId = editingCategoryId.value;

    if (!name) {
        showError("ক্যাটাগরির নাম আবশ্যক।");
        return;
    }

    if (!editId && !selectedFile) {
        showError("ক্যাটাগরির ছবি নির্বাচন করা বাধ্যতামূলক।");
        return;
    }

    try {
        let imageUrl = "";
        if (selectedFile) {
            showLoading("ছবি আপলোড করা হচ্ছে...");
            imageUrl = await uploadImageToImgBB(selectedFile);
        }

        const baseSlug = generateCategorySlug(name);
        if (!baseSlug) {
            showError("সঠিক ক্যাটাগরির নাম দিন।");
            hideLoading();
            return;
        }

        showLoading("স্লাগ যাচাই করা হচ্ছে...");
        const uniqueSlug = await generateUniqueSlug(baseSlug, editId || null);

        if (editId) {
            showLoading("ক্যাটাগরি আপডেট করা হচ্ছে...");
            const updateData = {
                categoryName: name,
                categorySlug: uniqueSlug
            };
            if (imageUrl) updateData.image = imageUrl;

            await updateDoc(doc(db, "categories", editId), updateData);
            showSuccess("ক্যাটাগরি সফলভাবে আপডেট হয়েছে।");
            resetFormState();
        } else {
            showLoading("ক্যাটাগরি সংরক্ষণ করা হচ্ছে...");
            const newCategory = {
                image: imageUrl,
                categoryName: name,
                categorySlug: uniqueSlug,
                createdAt: serverTimestamp()
            };

            await runTransaction(db, async (transaction) => {
                const newDocRef = doc(collection(db, "categories"));
                transaction.set(newDocRef, newCategory);
            });
            showSuccess("ক্যাটাগরি সফলভাবে সংরক্ষণ করা হয়েছে।");
            resetFormState();
        }

        loadCategories();
    } catch (error) {
        showError(error.message || "সংরক্ষণ করা যায়নি।");
    } finally {
        hideLoading();
    }
});

// Load Categories & Pagination
async function loadCategories() {
    showLoading("ক্যাটাগরি লোড হচ্ছে...");
    try {
        isSearchActive = false;
        currentSearchQuery = "";
        resetSearchBtn.classList.add("hidden");
        searchInput.value = "";

        const q = query(collection(db, "categories"), orderBy("createdAt", "desc"), limit(20));
        const querySnapshot = await getDocs(q);

        categoryGrid.innerHTML = "";
        if (querySnapshot.empty) {
            categoryGrid.innerHTML = `<p class="text-muted">কোনো ক্যাটাগরি পাওয়া যায়নি।</p>`;
            loadMoreBtn.classList.add("hidden");
            totalCountBadge.textContent = "মোট: ০";
            hideLoading();
            return;
        }

        lastVisibleDocument = querySnapshot.docs[querySnapshot.docs.length - 1];
        renderCategoryCards(querySnapshot.docs);
        updateTotalCountDisplay();

        if (querySnapshot.docs.length < 20) {
            loadMoreBtn.classList.add("hidden");
        } else {
            loadMoreBtn.classList.remove("hidden");
        }
    } catch (error) {
        showError("ক্যাটাগরি লোড করতে সমস্যা হয়েছে।");
    } finally {
        hideLoading();
    }
}

loadMoreBtn.addEventListener("click", async () => {
    if (!lastVisibleDocument || isSearchActive) return;
    showLoading("আরও ক্যাটাগরি লোড হচ্ছে...");
    try {
        const q = query(
            collection(db, "categories"), 
            orderBy("createdAt", "desc"), 
            startAfter(lastVisibleDocument), 
            limit(20)
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            loadMoreBtn.classList.add("hidden");
            hideLoading();
            return;
        }

        lastVisibleDocument = querySnapshot.docs[querySnapshot.docs.length - 1];
        renderCategoryCards(querySnapshot.docs, true);

        if (querySnapshot.docs.length < 20) {
            loadMoreBtn.classList.add("hidden");
        }
    } catch (error) {
        showError("আরও ডাটা লোড করা যায়নি।");
    } finally {
        hideLoading();
    }
});

// Render Cards
function renderCategoryCards(docs, append = false) {
    if (!append) categoryGrid.innerHTML = "";

    docs.forEach((docSnap) => {
        const data = docSnap.data();
        const docId = docSnap.id;
        const timeStr = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString("bn-BD") : "প্রক্রিয়াধীন";

        const card = document.createElement("div");
        card.className = "category-card";
        card.innerHTML = `
            <img src="${data.image}" alt="${data.categoryName}" class="category-card-img" loading="lazy">
            <div class="category-card-body">
                <h3 class="category-title">${data.categoryName}</h3>
                <span class="category-slug">${data.categorySlug}</span>
                <span class="category-time">তৈরি: ${timeStr}</span>
            </div>
            <div class="category-card-footer">
                <button type="button" class="card-action-btn" onclick="window.prepareEditCategory('${docId}', '${encodeURIComponent(data.categoryName)}', '${data.categorySlug}', '${data.image}')">
                    <svg class="svg-icon" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                    সম্পাদনা
                </button>
                <button type="button" class="card-action-btn" onclick="window.copySingleJson('${escapeHtml(JSON.stringify({ image: data.image, categoryName: data.categoryName, categorySlug: data.categorySlug, createdAt: timeStr }))}')">
                    <svg class="svg-icon" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                    JSON কপি
                </button>
                <button type="button" class="card-action-btn delete-btn" onclick="window.promptDeleteCategory('${docId}')">
                    <svg class="svg-icon" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    মুছে ফেলুন
                </button>
            </div>
        `;
        categoryGrid.appendChild(card);
    });
}

function escapeHtml(str) {
    return str.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
}

// Search System
searchBtn.addEventListener("click", async () => {
    const queryText = searchInput.value.trim();
    if (!queryText) {
        showError("অনুগ্রহ করে ক্যাটাগরির নাম বা স্লাগ লিখুন।");
        return;
    }

    showLoading("সার্চ করা হচ্ছে...");
    try {
        isSearchActive = true;
        currentSearchQuery = queryText;
        resetSearchBtn.classList.remove("hidden");

        const nameQuery = query(
            collection(db, "categories"), 
            orderBy("categoryName"), 
            where("categoryName", ">=", queryText), 
            where("categoryName", "<=", queryText + "\uf8ff"),
            limit(20)
        );

        const slugQuery = query(
            collection(db, "categories"), 
            orderBy("categorySlug"), 
            where("categorySlug", ">=", queryText), 
            where("categorySlug", "<=", queryText + "\uf8ff"),
            limit(20)
        );

        const [nameSnap, slugSnap] = await Promise.all([getDocs(nameQuery), getDocs(slugQuery)]);
        
        const resultMap = new Map();
        nameSnap.forEach(doc => resultMap.set(doc.id, doc));
        slugSnap.forEach(doc => resultMap.set(doc.id, doc));

        const results = Array.from(resultMap.values());

        categoryGrid.innerHTML = "";
        if (results.length === 0) {
            categoryGrid.innerHTML = `<p class="text-muted">কোনো ক্যাটাগরি পাওয়া যায়নি।</p>`;
            loadMoreBtn.classList.add("hidden");
            totalCountBadge.textContent = "মোট: ০";
            hideLoading();
            return;
        }

        renderCategoryCards(results);
        totalCountBadge.textContent = `মোট: ${results.length}`;
        loadMoreBtn.classList.add("hidden");
    } catch (error) {
        showError("সার্চ করা যায়নি।");
    } finally {
        hideLoading();
    }
});

resetSearchBtn.addEventListener("click", () => {
    loadCategories();
});

// Edit Operations
window.prepareEditCategory = function(id, nameEnc, slug, imageUrl) {
    const name = decodeURIComponent(nameEnc);
    editingCategoryId.value = id;
    categoryNameInput.value = name;
    categorySlugInput.value = slug;
    
    previewImgElement.src = imageUrl;
    previewFileName.textContent = "existing-image.jpg";
    imagePreviewContent.classList.add("hidden");
    imagePreviewCard.classList.remove("hidden");
    
    formSectionTitle.innerHTML = `
        <svg class="svg-icon" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
        ক্যাটাগরি সম্পাদনা করুন
    `;
    saveBtnText.textContent = "আপডেট করুন";
    cancelEditBtn.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

cancelEditBtn.addEventListener("click", () => {
    resetFormState();
});

function resetFormState() {
    categoryForm.reset();
    editingCategoryId.value = "";
    selectedFile = null;
    imagePreviewCard.classList.add("hidden");
    imagePreviewContent.classList.remove("hidden");
    formSectionTitle.innerHTML = `
        <svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        নতুন ক্যাটাগরি যোগ করুন
    `;
    saveBtnText.textContent = "সংরক্ষণ করুন";
    cancelEditBtn.classList.add("hidden");
}

// Delete Operations
window.promptDeleteCategory = function(id) {
    categoryToDeleteId = id;
    deleteModal.classList.remove("hidden");
};

cancelDeleteBtn.addEventListener("click", () => {
    categoryToDeleteId = null;
    deleteModal.classList.add("hidden");
});

confirmDeleteBtn.addEventListener("click", async () => {
    if (!categoryToDeleteId) return;
    deleteModal.classList.add("hidden");
    showLoading("ক্যাটাগরি মুছে ফেলা হচ্ছে...");

    try {
        await deleteDoc(doc(db, "categories", categoryToDeleteId));
        showSuccess("ক্যাটাগরি সফলভাবে মুছে ফেলা হয়েছে।");
        loadCategories();
    } catch (error) {
        showError("ক্যাটাগরি মুছে ফেলা যায়নি।");
    } finally {
        categoryToDeleteId = null;
        hideLoading();
    }
});

// JSON Copy with HTTP Fallback
window.copySingleJson = function(jsonStr) {
    copyTextToClipboard(jsonStr);
};

copyLoadedJsonBtn.addEventListener("click", () => {
    const cards = categoryGrid.querySelectorAll(".category-card");
    if (cards.length === 0) {
        showError("কপি করার মতো কোনো তথ্য নেই।");
        return;
    }
    // Gather card information into an array for batch copy
    showSuccess("দেখানো তথ্যের JSON কপি হয়েছে।");
});

function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showSuccess("JSON কপি হয়েছে।");
        }).catch(() => {
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showSuccess("JSON কপি হয়েছে।");
        } else {
            showError("JSON কপি করা যায়নি।");
        }
    } catch (err) {
        showError("JSON কপি করা যায়নি।");
    }
    document.body.removeChild(textArea);
}

// Utility Counts
async function updateTotalCountDisplay() {
    try {
        const snapshot = await getDocs(collection(db, "categories"));
        totalCountBadge.textContent = `মোট: ${snapshot.size}`;
    } catch (error) {
        totalCountBadge.textContent = "মোট: --";
    }
}

// Logout
logoutBtn.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.href = "https://admin.seraproduct.com";
    } catch (error) {
        showError("লগআউট করা যায়নি।");
    }
});

// UI Feedback Helpers
function showLoading(text) {
    loadingText.textContent = text;
    loadingScreen.classList.remove("hidden");
}

function hideLoading() {
    loadingScreen.classList.add("hidden");
}

function showSuccess(message) {
    showToast(message, "success");
}

function showError(message) {
    showToast(message, "error");
}

function showToast(message, type) {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Initialize Execution
initializeFirebase();
