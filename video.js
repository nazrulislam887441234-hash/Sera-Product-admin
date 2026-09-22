import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy, 
    limit, 
    startAfter, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
    "shohidhossain200@gmail.com",
    "nazrulislam887441234@gmail.com",
    "support.seraproduct@gmail.com"
];

let app, auth, db;
let lastVisibleDoc = null;
let isSubmitting = false;
let currentProcessedBlob = null;
let currentVideoIdGlobal = null;

document.addEventListener("DOMContentLoaded", () => {
    initializeFirebase();
    checkAuthentication();
});

function initializeFirebase() {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
}

function checkAuthentication() {
    showLoading("অথেন্টিকেশন যাচাই হচ্ছে");
    onAuthStateChanged(auth, async (user) => {
        hideLoading();
        if (!user) {
            window.location.href = "https://admin.seraproduct.com";
            return;
        }

        const email = user.email;
        const uid = user.uid;

        if (OWNER_EMAILS.includes(email)) {
            setupUserUI(email, "ওনার");
            loadVideos();
            return;
        }

        try {
            showLoading("অ্যাডমিন পারমিশন যাচাই হচ্ছে");
            const adminDocRef = doc(db, "admins", uid);
            const adminSnap = await getDoc(adminDocRef);
            hideLoading();

            if (adminSnap.exists()) {
                const adminData = adminSnap.data();
                if (adminData.active === true && adminData.email === email) {
                    setupUserUI(email, "অ্যাডমিন");
                    loadVideos();
                    return;
                }
            }
            throw new Error("Unauthorized Access");
        } catch (error) {
            hideLoading();
            showError("আপনি এই পেজ ব্যবহার করার অনুমতি রাখেন না।");
            setTimeout(() => {
                window.location.href = "https://admin.seraproduct.com";
            }, 2000);
        }
    });
}

function setupUserUI(email, roleText) {
    document.getElementById("userEmailDisplay").textContent = email;
    const badgeContainer = document.getElementById("userBadgeContainer");
    badgeContainer.innerHTML = `<span class="badge">${roleText}</span>`;
}

function logoutUser() {
    signOut(auth).then(() => {
        window.location.href = "https://admin.seraproduct.com";
    }).catch(() => {
        showError("লগআউট করতে সমস্যা হয়েছে।");
    });
}

window.handleUrlInput = async function(url) {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
        document.getElementById("previewContainer").classList.add("hidden");
        return;
    }
    currentVideoIdGlobal = videoId;
    showVideoPreview(videoId);
    await prepareThumbnail(videoId);
};

window.extractYouTubeVideoId = function(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function showVideoPreview(videoId) {
    const previewContainer = document.getElementById("previewContainer");
    const embedWrapper = document.getElementById("videoEmbedPreview");
    previewContainer.classList.remove("hidden");
    embedWrapper.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe>`;
}

async function prepareThumbnail(videoId) {
    showLoading("থাম্বনেইল সংগ্রহ হচ্ছে");
    try {
        const thumbUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        const img = await loadThumbnailImage(thumbUrl).catch(() => {
            return loadThumbnailImage(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
        });

        showLoading("থাম্বনেইল প্রস্তুত হচ্ছে");
        currentProcessedBlob = await createVerticalThumbnail(img);
        
        const previewImg = document.getElementById("thumbnailPreviewImg");
        previewImg.src = URL.createObjectURL(currentProcessedBlob);
        hideLoading();
    } catch (error) {
        hideLoading();
        showError("থাম্বনেইল লোড বা প্রসেস করতে ব্যর্থ হয়েছে।");
    }
}

function loadThumbnailImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = url;
    });
}

function createVerticalThumbnail(img) {
    return new Promise((resolve) => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        const targetWidth = 720;
        const targetHeight = 1280;
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        const imgAspect = img.width / img.height;
        const targetAspect = targetWidth / targetHeight;

        let renderWidth, renderHeight, offsetX, offsetY;

        if (imgAspect > targetAspect) {
            renderHeight = targetHeight;
            renderWidth = img.width * (targetHeight / img.height);
            offsetX = (targetWidth - renderWidth) / 2;
            offsetY = 0;
        } else {
            renderWidth = targetWidth;
            renderHeight = img.height * (targetWidth / img.width);
            offsetX = 0;
            offsetY = (targetHeight - renderHeight) / 2;
        }

        ctx.drawImage(img, offsetX, offsetY, renderWidth, renderHeight);
        canvas.toBlob((blob) => {
            resolve(blob);
        }, "image/jpeg", 0.90);
    });
}

window.handleFormSubmit = async function(e) {
    e.preventDefault();
    if (isSubmitting) return;

    const title = document.getElementById("videoTitleInput").value.trim();
    const url = document.getElementById("youtubeUrlInput").value.trim();
    const editingId = document.getElementById("editingVideoId").value;

    if (!title) {
        showError("ভিডিওর শিরোনাম আবশ্যক।");
        return;
    }

    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
        showError("সঠিক ইউটিউব লিংক প্রদান করুন।");
        return;
    }

    isSubmitting = true;
    try {
        let thumbnailUrl = "";

        if (editingId && !currentProcessedBlob && document.getElementById("thumbnailPreviewImg").src) {
            // Keep existing thumbnail if editing and no new video URL processed
            const cardEl = document.querySelector(`[data-id="${editingId}"]`);
            thumbnailUrl = cardEl ? cardEl.getAttribute("data-thumb") : "";
        }

        if (currentProcessedBlob || !thumbnailUrl) {
            showLoading("থাম্বনেইল আপলোড হচ্ছে");
            const activeApi = await loadActiveImgbbApi();
            thumbnailUrl = await uploadThumbnailToImgBB(currentProcessedBlob, activeApi);
        }

        const embedLink = `https://www.youtube.com/embed/${videoId}`;

        if (editingId) {
            showLoading("ভিডিও আপডেট হচ্ছে");
            const docRef = doc(db, "videos", editingId);
            await updateDoc(docRef, {
                videoLink: embedLink,
                thumbnail: thumbnailUrl,
                title: title
            });
            showSuccess("ভিডিও সফলভাবে আপডেট করা হয়েছে।");
        } else {
            showLoading("ভিডিও সংরক্ষণ হচ্ছে");
            await addDoc(collection(db, "videos"), {
                videoLink: embedLink,
                thumbnail: thumbnailUrl,
                title: title,
                createdAt: serverTimestamp()
            });
            showSuccess("ভিডিও সফলভাবে সংরক্ষণ করা হয়েছে।");
        }

        resetForm();
        loadVideos();
    } catch (error) {
        hideLoading();
        showError("কার্যক্রম সম্পন্ন করতে ব্যর্থ: " + error.message);
    } finally {
        isSubmitting = false;
    }
};

async function loadActiveImgbbApi() {
    showLoading("ImgBB API খোঁজা হচ্ছে");
    const q = query(collection(db, "imgbb_api"), where("active", "==", true), limit(1));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
        throw new Error("বর্তমানে কোনো সক্রিয় ছবি আপলোড API পাওয়া যায়নি।");
    }

    const docData = snapshot.docs[0].data();
    if (!docData.imgbbApi) {
        throw new Error("ImgBB API কী অনুপস্থিত রয়েছে।");
    }
    return docData.imgbbApi;
}

async function uploadThumbnailToImgBB(blob, apiKey) {
    const formData = new FormData();
    formData.append("image", blob);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: "POST",
        body: formData
    });

    const result = await response.json();
    if (result && result.success) {
        return result.data.url;
    } else {
        throw new Error("ImgBB আপলোড ব্যর্থ হয়েছে।");
    }
}

window.loadVideos = async function() {
    showLoading("ভিডিও লোড হচ্ছে");
    const container = document.getElementById("videoGridContainer");
    container.innerHTML = "";
    lastVisibleDoc = null;

    try {
        const q = query(collection(db, "videos"), orderBy("createdAt", "desc"), limit(20));
        const snapshot = await getDocs(q);
        
        hideLoading();
        if (snapshot.empty) {
            container.innerHTML = "<p>কোনো ভিডিও পাওয়া যায়নি।</p>";
            document.getElementById("loadMoreBtn").classList.add("hidden");
            return;
        }

        lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
        renderVideoCards(snapshot.docs);

        if (snapshot.docs.length === 20) {
            document.getElementById("loadMoreBtn").classList.remove("hidden");
        } else {
            document.getElementById("loadMoreBtn").classList.add("hidden");
        }
    } catch (error) {
        hideLoading();
        showError("ভিডিও লোড করতে সমস্যা হয়েছে। সূচকের (Index) প্রয়োজন হতে পারে।");
    }
};

window.loadMoreVideos = async function() {
    if (!lastVisibleDoc) return;
    showLoading("ভিডিও লোড হচ্ছে");

    try {
        const q = query(collection(db, "videos"), orderBy("createdAt", "desc"), startAfter(lastVisibleDoc), limit(20));
        const snapshot = await getDocs(q);
        hideLoading();

        if (!snapshot.empty) {
            lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
            renderVideoCards(snapshot.docs, true);
        }

        if (snapshot.docs.length < 20) {
            document.getElementById("loadMoreBtn").classList.add("hidden");
        }
    } catch (error) {
        hideLoading();
        showError("আরও ভিডিও লোড করতে ব্যর্থ হয়েছে।");
    }
};

function renderVideoCards(docs, append = false) {
    const container = document.getElementById("videoGridContainer");
    if (!append) container.innerHTML = "";

    docs.forEach(docSnap => {
        const data = docSnap.data();
        const id = docSnap.id;
        const timeStr = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString("bn-BD") : "এখনই";

        const card = document.createElement("div");
        card.className = "video-card";
        card.setAttribute("data-id", id);
        card.setAttribute("data-thumb", data.thumbnail);
        card.setAttribute("data-link", data.videoLink);
        card.setAttribute("data-title", data.title);

        card.innerHTML = `
            <div class="video-card-thumb">
                <img src="${data.thumbnail}" alt="Thumbnail">
            </div>
            <div class="video-card-body">
                <h4 class="video-card-title">${escapeHtml(data.title)}</h4>
                <div class="video-card-meta">তৈরি: ${timeStr}</div>
                <div class="video-card-actions">
                    <a href="${data.videoLink}" target="_blank" class="btn btn-primary">
                        <svg class="icon" viewBox="0 0 24 24"><path d="M10 16.5l6-4.5-6-4.5v9zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
                        <span>দেখুন</span>
                    </a>
                    <button class="btn btn-outline" onclick="copyVideoJson('${id}')">
                        <svg class="icon" viewBox="0 0 24 24"><path d="M19 21H8V7h11m0-2H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2m-3-4H4a2 2 0 0 0-2 2v14h2V3h12V1z"/></svg>
                        <span>JSON</span>
                    </button>
                    <button class="btn btn-secondary" onclick="editVideo('${id}')">
                        <svg class="icon" viewBox="0 0 24 24"><path d="M20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75M3 17.25V21h3.75L17.81 9.93l-3.75-3.75L3 17.25z"/></svg>
                        <span>এডিট</span>
                    </button>
                    <button class="btn btn-danger-outline" onclick="promptDeleteVideo('${id}')">
                        <svg class="icon" viewBox="0 0 24 24"><path d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12z"/></svg>
                        <span>মুছুন</span>
                    </button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

window.editVideo = function(id) {
    const card = document.querySelector(`[data-id="${id}"]`);
    if (!card) return;

    const title = card.getAttribute("data-title");
    const link = card.getAttribute("data-link");
    const thumb = card.getAttribute("data-thumb");

    document.getElementById("editingVideoId").value = id;
    document.getElementById("videoTitleInput").value = title;
    document.getElementById("youtubeUrlInput").value = link;
    document.getElementById("formHeading").textContent = "ভিডিও তথ্য পরিবর্তন করুন";
    document.getElementById("saveButtonText").textContent = "আপডেট করুন";
    document.getElementById("cancelEditBtn").classList.remove("hidden");

    showVideoPreview(extractYouTubeVideoId(link));
    const previewImg = document.getElementById("thumbnailPreviewImg");
    previewImg.src = thumb;
    document.getElementById("previewContainer").classList.remove("hidden");

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.resetForm = function() {
    document.getElementById("videoForm").reset();
    document.getElementById("editingVideoId").value = "";
    document.getElementById("formHeading").textContent = "নতুন রিভিউ ভিডিও যোগ করুন";
    document.getElementById("saveButtonText").textContent = "ভিডিও সংরক্ষণ করুন";
    document.getElementById("cancelEditBtn").classList.add("hidden");
    document.getElementById("previewContainer").classList.add("hidden");
    currentProcessedBlob = null;
    currentVideoIdGlobal = null;
};

let deleteTargetId = null;
window.promptDeleteVideo = function(id) {
    deleteTargetId = id;
    document.getElementById("deleteModal").classList.remove("hidden");
    document.getElementById("confirmDeleteBtn").onclick = executeDeleteVideo;
};

window.closeDeleteModal = function() {
    deleteTargetId = null;
    document.getElementById("deleteModal").classList.add("hidden");
};

async function executeDeleteVideo() {
    if (!deleteTargetId) return;
    closeDeleteModal();
    showLoading("ভিডিও মুছে ফেলা হচ্ছে");

    try {
        await deleteDoc(doc(db, "videos", deleteTargetId));
        showSuccess("ভিডিও সফলভাবে মুছে ফেলা হয়েছে।");
        loadVideos();
    } catch (error) {
        hideLoading();
        showError("ভিডিও ডিলিট করতে ব্যর্থ হয়েছে।");
    }
}

window.copyVideoJson = function(id) {
    const card = document.querySelector(`[data-id="${id}"]`);
    if (!card) return;

    const dataObj = {
        videoLink: card.getAttribute("data-link"),
        thumbnail: card.getAttribute("data-thumb"),
        title: card.getAttribute("data-title"),
        createdAt: "Firestore Timestamp"
    };

    const jsonString = JSON.stringify(dataObj, null, 2);

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(jsonString).then(() => {
            showSuccess("JSON সফলভাবে কপি হয়েছে।");
        }).catch(() => {
            fallbackCopyText(jsonString);
        });
    } else {
        fallbackCopyText(jsonString);
    }
};

function fallbackCopyText(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showSuccess("JSON সফলভাবে কপি হয়েছে।");
        } else {
            showError("কপি করা যায়নি, অনুগ্রহ করে আবার চেষ্টা করুন।");
        }
    } catch (err) {
        showError("কপি করা যায়নি, অনুগ্রহ করে আবার চেষ্টা করুন।");
    }
    document.body.removeChild(textarea);
}

function showLoading(text) {
    document.getElementById("loadingText").textContent = text;
    document.getElementById("loadingOverlay").classList.remove("hidden");
}

function hideLoading() {
    document.getElementById("loadingOverlay").classList.add("hidden");
}

function showSuccess(msg) {
    hideLoading();
    const toast = document.getElementById("toastNotification");
    toast.textContent = msg;
    toast.className = "toast success";
    setTimeout(() => { toast.classList.add("hidden"); }, 3000);
}

function showError(msg) {
    hideLoading();
    const toast = document.getElementById("toastNotification");
    toast.textContent = msg;
    toast.className = "toast error";
    setTimeout(() => { toast.classList.add("hidden"); }, 3000);
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
