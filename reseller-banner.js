import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    limit, 
    getDocs, 
    getDoc, 
    doc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    orderBy, 
    startAfter, 
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

let app, auth, db;
const ownerEmails = [
    "shohidhossain200@gmail.com",
    "nazrulislam887441234@gmail.com",
    "support.seraproduct@gmail.com"
];

let lastVisible = null;
let currentEditingId = null;
let pendingDeleteId = null;

// DOM Elements
const userBadgeEl = document.getElementById("userBadge");
const userEmailEl = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");
const bannerForm = document.getElementById("bannerForm");
const bannerImageFile = document.getElementById("bannerImageFile");
const imagePreviewContainer = document.getElementById("imagePreviewContainer");
const imagePreview = document.getElementById("imagePreview");
const clickLinkInput = document.getElementById("clickLinkInput");
const saveBannerBtn = document.getElementById("saveBannerBtn");
const saveBtnText = document.getElementById("saveBtnText");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const formTitle = document.getElementById("formTitle");
const bannerGrid = document.getElementById("bannerGrid");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const refreshBtn = document.getElementById("refreshBtn");
const loadingOverlay = document.getElementById("loadingOverlay");
const loadingText = document.getElementById("loadingText");
const deleteModal = document.getElementById("deleteModal");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

function initializeFirebase() {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
    } catch (error) {
        showError("ফায়ারবেস ইনিশিয়ালাইজ করতে সমস্যা হয়েছে।");
    }
}

function checkAuthentication() {
    showLoading("অথেন্টিকেশন যাচাই করা হচ্ছে...");
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "https://admin.seraproduct.com";
            return;
        }

        userEmailEl.textContent = user.email;

        // Owner Check
        if (ownerEmails.includes(user.email)) {
            userBadgeEl.textContent = "ওনার";
            userBadgeEl.classList.remove("loading-badge");
            hideLoading();
            initAppLogic();
            return;
        }

        // Admin Check
        try {
            const adminDocRef = doc(db, "admins", user.uid);
            const adminSnap = await getDoc(adminDocRef);

            if (adminSnap.exists()) {
                const adminData = adminSnap.data();
                if (adminData.name && adminData.email === user.email && adminData.uid === user.uid && adminData.active === true) {
                    userBadgeEl.textContent = "অ্যাডমিন";
                    userBadgeEl.classList.remove("loading-badge");
                    hideLoading();
                    initAppLogic();
                    return;
                }
            }

            // Neither Owner nor Valid Admin
            hideLoading();
            alert("আপনার এই প্যানেলটি ব্যবহার করার অনুমতি নেই।");
            window.location.href = "https://admin.seraproduct.com";
        } catch (error) {
            hideLoading();
            showError("অ্যাক্সেস যাচাইকরণে ত্রুটি ঘটেছে।");
        }
    });
}

function initAppLogic() {
    loadBanners();

    bannerImageFile.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                imagePreview.src = event.target.result;
                imagePreviewContainer.style.display = "block";
            }
            reader.readAsDataURL(file);
        }
    });

    bannerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const clickLink = clickLinkInput.value.trim();
        
        if (!isValidUrl(clickLink)) {
            showError("দয়া করে একটি সঠিক লিংক প্রদান করুন।");
            return;
        }

        if (currentEditingId) {
            await updateBanner(currentEditingId);
        } else {
            await createBanner();
        }
    });

    refreshBtn.addEventListener("click", () => {
        bannerGrid.innerHTML = "";
        lastVisible = null;
        loadBanners();
    });

    loadMoreBtn.addEventListener("click", () => {
        loadBanners(true);
    });

    logoutBtn.addEventListener("click", async () => {
        try {
            await signOut(auth);
            window.location.href = "https://admin.seraproduct.com";
        } catch (error) {
            showError("লগআউট করতে সমস্যা হয়েছে।");
        }
    });

    cancelEditBtn.addEventListener("click", resetForm);

    confirmDeleteBtn.addEventListener("click", async () => {
        if (pendingDeleteId) {
            await deleteBanner(pendingDeleteId);
            deleteModal.style.display = "none";
            pendingDeleteId = null;
        }
    });

    cancelDeleteBtn.addEventListener("click", () => {
        deleteModal.style.display = "none";
        pendingDeleteId = null;
    });
}

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

async function loadActiveImgbbApi() {
    try {
        const apiQuery = query(
            collection(db, "imgbb_api"),
            where("active", "==", true),
            limit(1)
        );
        const snapshot = await getDocs(apiQuery);
        if (snapshot.empty) {
            throw new Error("বর্তমানে কোনো সক্রিয় ছবি আপলোড API পাওয়া যায়নি।");
        }
        const data = snapshot.docs[0].data();
        if (!data.imgbbApi) {
            throw new Error("বর্তমানে কোনো সক্রিয় ছবি আপলোড API পাওয়া যায়নি।");
        }
        return data.imgbbApi;
    } catch (error) {
        throw error;
    }
}

async function uploadImageToImgBB(file) {
    showLoading("ছবি আপলোড হচ্ছে...");
    try {
        const apiKey = await loadActiveImgbbApi();
        const formData = new FormData();
        formData.append("image", file);

        const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
            method: "POST",
            body: formData
        });

        const result = await response.json();
        if (result && result.success) {
            return result.data.url;
        } else {
            throw new Error("ছবি আপলোড ব্যর্থ হয়েছে।");
        }
    } catch (error) {
        throw error;
    } finally {
        hideLoading();
    }
}

async function createBanner() {
    const file = bannerImageFile.files[0];
    if (!file && !currentEditingId) {
        showError("অনুগ্রহ করে একটি ছবি নির্বাচন করুন।");
        return;
    }

    try {
        showLoading("ব্যানার সংরক্ষণ হচ্ছে...");
        let bannerLink = "";
        if (file) {
            bannerLink = await uploadImageToImgBB(file);
        }

        const clickLink = clickLinkInput.value.trim();

        await addDoc(collection(db, "reseller_banner"), {
            bannerLink: bannerLink,
            clickLink: clickLink,
            createAt: serverTimestamp()
        });

        hideLoading();
        showSuccess("সফলভাবে সংরক্ষণ হয়েছে");
        resetForm();
        bannerGrid.innerHTML = "";
        lastVisible = null;
        loadBanners();
    } catch (error) {
        hideLoading();
        showError(error.message || "ফায়ারস্টোরে সংরক্ষণ ব্যর্থ হয়েছে।");
    }
}

async function loadBanners(isLoadMore = false) {
    try {
        if (!isLoadMore) showLoading("ব্যানার লোড হচ্ছে...");
        
        let q = query(
            collection(db, "reseller_banner"),
            orderBy("createAt", "desc"),
            limit(20)
        );

        if (isLoadMore && lastVisible) {
            q = query(
                collection(db, "reseller_banner"),
                orderBy("createAt", "desc"),
                startAfter(lastVisible),
                limit(20)
            );
        }

        const snapshot = await getDocs(q);
        if (!isLoadMore) hideLoading();

        if (snapshot.empty && !isLoadMore) {
            bannerGrid.innerHTML = '<p class="banner-link-text">কোনো ব্যানার পাওয়া যায়নি</p>';
            loadMoreBtn.style.display = "none";
            return;
        }

        if (!isLoadMore) bannerGrid.innerHTML = "";

        lastVisible = snapshot.docs[snapshot.docs.length - 1];

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const card = renderBannerCard(docSnap.id, data);
            bannerGrid.appendChild(card);
        });

        if (snapshot.docs.length < 20) {
            loadMoreBtn.style.display = "none";
        } else {
            loadMoreBtn.style.display = "inline-flex";
        }
    } catch (error) {
        hideLoading();
        showError("ব্যানার লোড করতে সমস্যা হয়েছে। প্রয়োজনীয় ইনডেক্স প্রয়োজন হতে পারে।");
    }
}

function renderBannerCard(id, data) {
    const card = document.createElement("div");
    card.className = "banner-card";
    
    let dateStr = "তারিখ উপলব্ধ নেই";
    if (data.createAt && data.createAt.toDate) {
        dateStr = data.createAt.toDate().toLocaleString("bn-BD");
    }

    card.innerHTML = `
        <div class="banner-card-img-wrap">
            <img src="${data.bannerLink}" alt="ব্যানার">
        </div>
        <div class="banner-card-body">
            <p class="banner-link-text">লিংক: <a href="${data.clickLink}" target="_blank">${data.clickLink}</a></p>
            <span class="banner-date">তৈরির সময়: ${dateStr}</span>
            <div class="banner-card-actions">
                <button class="action-btn copy-btn" data-id="${id}" data-json='${JSON.stringify({bannerLink: data.bannerLink, clickLink: data.clickLink, createAt: dateStr})}'>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    JSON কপি করুন
                </button>
                <button class="action-btn edit-btn" data-id='${id}' data-link='${data.clickLink}' data-img='${data.bannerLink}'>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    এডিট
                </button>
                <button class="action-btn delete-btn" data-id='${id}'>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    মুছে ফেলুন
                </button>
            </div>
        </div>
    `;

    // Event Listeners for Card Actions
    card.querySelector(".copy-btn").addEventListener("click", (e) => {
        const jsonString = e.currentTarget.getAttribute("data-json");
        copyToClipboard(jsonString);
    });

    card.querySelector(".edit-btn").addEventListener("click", (e) => {
        const btn = e.currentTarget;
        prepareEdit(btn.getAttribute("data-id"), btn.getAttribute("data-link"), btn.getAttribute("data-img"));
    });

    card.querySelector(".delete-btn").addEventListener("click", (e) => {
        pendingDeleteId = e.currentTarget.getAttribute("data-id");
        deleteModal.style.display = "flex";
    });

    return card;
}

function prepareEdit(id, link, imgUrl) {
    currentEditingId = id;
    clickLinkInput.value = link;
    imagePreview.src = imgUrl;
    imagePreviewContainer.style.display = "block";
    formTitle.textContent = "ব্যানার আপডেট করুন";
    saveBtnText.textContent = "আপডেট করুন";
    cancelEditBtn.style.display = "inline-flex";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function updateBanner(id) {
    const file = bannerImageFile.files[0];
    try {
        showLoading("ব্যানার আপডেট হচ্ছে...");
        let bannerLink = imagePreview.src;

        if (file) {
            bannerLink = await uploadImageToImgBB(file);
        }

        const clickLink = clickLinkInput.value.trim();
        const docRef = doc(db, "reseller_banner", id);

        await updateDoc(docRef, {
            bannerLink: bannerLink,
            clickLink: clickLink
        });

        hideLoading();
        showSuccess("সফলভাবে আপডেট হয়েছে");
        resetForm();
        bannerGrid.innerHTML = "";
        lastVisible = null;
        loadBanners();
    } catch (error) {
        hideLoading();
        showError("ফায়ারস্টোরে আপডেট ব্যর্থ হয়েছে।");
    }
}

async function deleteBanner(id) {
    try {
        showLoading("ব্যানার মুছে ফেলা হচ্ছে...");
        await deleteDoc(doc(db, "reseller_banner", id));
        hideLoading();
        showSuccess("সফলভাবে মুছে ফেলা হয়েছে");
        bannerGrid.innerHTML = "";
        lastVisible = null;
        loadBanners();
    } catch (error) {
        hideLoading();
        showError("ব্যানার মুছে ফেলতে সমস্যা হয়েছে।");
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showSuccess("JSON সফলভাবে কপি হয়েছে।");
        }).catch(() => {
            fallbackCopyText(text);
        });
    } else {
        fallbackCopyText(text);
    }
}

function fallbackCopyText(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
        const successful = document.execCommand("copy");
        if (successful) {
            showSuccess("JSON সফলভাবে কপি হয়েছে।");
        } else {
            showError("কপি করা যায়নি, অনুগ্রহ করে আবার চেষ্টা করুন।");
        }
    } catch (err) {
        showError("কপি করা যায়নি, অনুগ্রহ করে আবার চেষ্টা করুন।");
    }
    document.body.removeChild(textarea);
}

function resetForm() {
    currentEditingId = null;
    bannerForm.reset();
    imagePreview.src = "";
    imagePreviewContainer.style.display = "none";
    formTitle.textContent = "নতুন ব্যানার যোগ করুন";
    saveBtnText.textContent = "সংরক্ষণ করুন";
    cancelEditBtn.style.display = "none";
}

function showLoading(text) {
    loadingText.textContent = text || "লোড হচ্ছে...";
    loadingOverlay.style.display = "flex";
}

function hideLoading() {
    loadingOverlay.style.display = "none";
}

function showSuccess(msg) {
    alert(msg);
}

function showError(msg) {
    alert(msg);
}

// রান করুন
initializeFirebase();
checkAuthentication();
