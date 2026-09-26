      import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
        import { 
            getFirestore, collection, doc, getDoc, getDocs, 
            query, orderBy, limit, startAfter, runTransaction, serverTimestamp, where 
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

        let lastVisibleDoc = null;
        let isLoading = false;
        let currentActiveWithdrawId = null;
        let selectedWithdrawData = null;

        const userRoleBadge = document.getElementById('userRoleBadge');
        const userEmailDisplay = document.getElementById('userEmailDisplay');
        const logoutBtn = document.getElementById('logoutBtn');
        const withdrawGrid = document.getElementById('withdrawGrid');
        const loadMoreContainer = document.getElementById('loadMoreContainer');
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        const totalRequestsCount = document.getElementById('totalRequestsCount');

        const confirmModal = document.getElementById('confirmModal');
        const closeConfirmModal = document.getElementById('closeConfirmModal');
        const cancelConfirmAction = document.getElementById('cancelConfirmAction');
        const submitConfirmAction = document.getElementById('submitConfirmAction');

        const cancelModal = document.getElementById('cancelModal');
        const closeCancelModal = document.getElementById('closeCancelModal');
        const dismissCancelAction = document.getElementById('dismissCancelAction');
        const submitCancelAction = document.getElementById('submitCancelAction');

        function showToast(message, type = 'success') {
            const container = document.getElementById('toastContainer');
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.textContent = message;
            container.appendChild(toast);
            setTimeout(() => { toast.remove(); }, 3000);
        }

        function formatTaka(amount) {
            if (amount === undefined || amount === null || isNaN(amount)) return "৳ ০";
            return `৳ ${Number(amount).toLocaleString('en-IN')}`;
        }

        function formatTimestamp(timestamp) {
            if (!timestamp) return "সময় পাওয়া যায়নি";
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            if (isNaN(date.getTime())) return "সময় পাওয়া যায়নি";

            const months = [
                "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
                "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"
            ];
            
            let hours = date.getHours();
            const minutes = date.getMinutes().toString().padStart(2, '0');
            
            let period = "রাত";
            if (hours >= 4 && hours < 12) period = "সকাল";
            else if (hours >= 12 && hours < 15) period = "দুপুর";
            else if (hours >= 15 && hours < 18) period = "বিকাল";
            else if (hours >= 18 && hours < 21) period = "সন্ধ্যা";

            let hours12 = hours % 12;
            if (hours12 === 0) hours12 = 12;

            return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} ${period} ${hours12}:${minutes}`;
        }

        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                window.location.href = "https://admin.seraproduct.com";
                return;
            }

            const email = user.email;
            userEmailDisplay.textContent = email;

            let isAuthorized = false;
            let roleTitle = "";

            if (OWNER_EMAILS.includes(email)) {
                isAuthorized = true;
                roleTitle = "OWNER";
            } else {
                try {
                    const adminSnap = await getDoc(doc(db, "admins", user.uid));
                    if (adminSnap.exists() && adminSnap.data().active === true) {
                        isAuthorized = true;
                        roleTitle = "ADMIN";
                    }
                } catch (err) {
                    console.error("Admin verification error:", err);
                }
            }

            if (!isAuthorized) {
                window.location.href = "https://admin.seraproduct.com";
                return;
            }

            userRoleBadge.textContent = roleTitle;
            loadWithdrawRequests(true);
        });

        logoutBtn.addEventListener('click', async () => {
            await signOut(auth);
            window.location.href = "https://admin.seraproduct.com";
        });

        async function loadWithdrawRequests(isInitial = false) {
            if (isLoading) return;
            isLoading = true;

            if (isInitial) {
                withdrawGrid.innerHTML = `
                    <div class="skeleton-card"><div class="skeleton-line short"></div><div class="skeleton-line medium"></div><div class="skeleton-line long"></div></div>
                    <div class="skeleton-card"><div class="skeleton-line short"></div><div class="skeleton-line medium"></div><div class="skeleton-line long"></div></div>
                    <div class="skeleton-card"><div class="skeleton-line short"></div><div class="skeleton-line medium"></div><div class="skeleton-line long"></div></div>
                `;
            }

            try {
                let q = query(collection(db, "withdraw"), orderBy("createdAt", "desc"), limit(20));
                
                if (!isInitial && lastVisibleDoc) {
                    q = query(collection(db, "withdraw"), orderBy("createdAt", "desc"), startAfter(lastVisibleDoc), limit(20));
                }

                const querySnapshot = await getDocs(q);

                if (isInitial) withdrawGrid.innerHTML = "";

                if (querySnapshot.empty && isInitial) {
                    withdrawGrid.innerHTML = `
                        <div class="empty-state">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
                            </svg>
                            <p>কোনো টাকা উত্তোলনের অনুরোধ পাওয়া যায়নি।</p>
                        </div>
                    `;
                    loadMoreContainer.style.display = "none";
                    totalRequestsCount.textContent = "০";
                    isLoading = false;
                    return;
                }

                querySnapshot.forEach((docSnap) => {
                    renderCard(docSnap.id, docSnap.data());
                    lastVisibleDoc = docSnap;
                });

                loadMoreContainer.style.display = querySnapshot.size < 20 ? "none" : "block";
                if (isInitial) {
                    totalRequestsCount.textContent = querySnapshot.size >= 20 ? "২০+" : querySnapshot.size;
                }

            } catch (err) {
                console.error("Error loading withdraws:", err);
                showToast("তথ্য আপডেট করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।", "error");
            } finally {
                isLoading = false;
            }
        }

        loadMoreBtn.addEventListener('click', () => loadWithdrawRequests(false));

        function renderCard(docId, data) {
            const uid = data.uid || "N/A";
            const bkashNumber = data.bkashNumber || "N/A";
            const currentBalance = Number(data.currentBalance || 0);
            const withdrawAmount = Number(data.withdrawAmount || 0);
            const status = data.status || "pending";
            const createdAt = data.createdAt;

            let statusClass = "status-pending";
            let statusText = "অপেক্ষামাণ";
            if (status === "confirmed") {
                statusClass = "status-confirmed";
                statusText = "নিশ্চিত করা হয়েছে";
            } else if (status === "cancelled") {
                statusClass = "status-cancelled";
                statusText = "বাতিল করা হয়েছে";
            }

            const isProcessed = status === "confirmed" || status === "cancelled";

            const card = document.createElement('div');
            card.className = "withdraw-card";
            card.id = `card-${docId}`;
            card.innerHTML = `
                <div class="card-top">
                    <div class="card-header-row">
                        <div class="amount-display">${formatTaka(withdrawAmount)}</div>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                    <div class="card-details">
                        <div class="detail-row"><span>রিসেলার UID</span><span>${uid}</span></div>
                        <div class="detail-row"><span>বিকাশ নাম্বার</span><span>${bkashNumber}</span></div>
                        <div class="detail-row"><span>বর্তমান ব্যালেন্স</span><span>${formatTaka(currentBalance)}</span></div>
                        <div class="detail-row"><span>অনুরোধের সময়</span><span>${formatTimestamp(createdAt)}</span></div>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn btn-confirm" onclick="openConfirmModal('${docId}')" ${isProcessed ? 'disabled' : ''}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
                        কনফার্ম
                    </button>
                    <button class="btn btn-cancel" onclick="openCancelModal('${docId}')" ${isProcessed ? 'disabled' : ''}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        ক্যানসেল
                    </button>
                </div>
            `;
            withdrawGrid.appendChild(card);
        }

        window.openConfirmModal = async function(docId) {
            currentActiveWithdrawId = docId;
            try {
                const docSnap = await getDoc(doc(db, "withdraw", docId));
                if (!docSnap.exists()) {
                    showToast("এই অনুরোধটি ইতিমধ্যে প্রক্রিয়াজাত হয়েছে।", "error");
                    return;
                }
                selectedWithdrawData = docSnap.data();
                
                if (selectedWithdrawData.status && selectedWithdrawData.status !== "pending") {
                    showToast("এই অনুরোধটি ইতিমধ্যে প্রক্রিয়াজাত হয়েছে।", "error");
                    return;
                }

                const bkash = selectedWithdrawData.bkashNumber || "";
                const amount = Number(selectedWithdrawData.withdrawAmount || 0);
                const currBal = Number(selectedWithdrawData.currentBalance || 0);
                const newBal = currBal - amount;

                document.getElementById('modalBkashNumber').textContent = bkash;
                document.getElementById('modalWithdrawAmount').textContent = formatTaka(amount);
                document.getElementById('modalCurrentBalance').textContent = formatTaka(currBal);
                document.getElementById('modalNewBalance').textContent = formatTaka(newBal);
                
                document.getElementById('inputTrxId').value = "";
                document.getElementById('inputSenderNumber').value = "";

                confirmModal.classList.add('active');
            } catch (err) {
                console.error(err);
                showToast("তথ্য লোড করতে সমস্যা হয়েছে।", "error");
            }
        };

        window.openCancelModal = async function(docId) {
            currentActiveWithdrawId = docId;
            try {
                const docSnap = await getDoc(doc(db, "withdraw", docId));
                if (!docSnap.exists()) {
                    showToast("এই অনুরোধটি ইতিমধ্যে প্রক্রিয়াজাত হয়েছে।", "error");
                    return;
                }
                const data = docSnap.data();
                if (data.status && data.status !== "pending") {
                    showToast("এই অনুরোধটি ইতিমধ্যে প্রক্রিয়াজাত হয়েছে।", "error");
                    return;
                }
                cancelModal.classList.add('active');
            } catch (err) {
                console.error(err);
                showToast("তথ্য লোড করতে সমস্যা হয়েছে।", "error");
            }
        };

        closeConfirmModal.addEventListener('click', () => confirmModal.classList.remove('active'));
        cancelConfirmAction.addEventListener('click', () => confirmModal.classList.remove('active'));
        closeCancelModal.addEventListener('click', () => cancelModal.classList.remove('active'));
        dismissCancelAction.addEventListener('click', () => cancelModal.classList.remove('active'));

        submitConfirmAction.addEventListener('click', async () => {
            const trxIdInput = document.getElementById('inputTrxId').value.trim();
            const senderNumberInput = document.getElementById('inputSenderNumber').value.trim();

            if (!trxIdInput || !senderNumberInput) {
                showToast("সবগুলো ফিল্ড পূরণ করা বাধ্যতামূলক।", "error");
                return;
            }

            if (!selectedWithdrawData) return;

            submitConfirmAction.disabled = true;
            submitConfirmAction.innerHTML = '<div class="spinner"></div> প্রক্রিয়াধীন...';

            try {
                const withdrawRef = doc(db, "withdraw", currentActiveWithdrawId);
                const uid = selectedWithdrawData.uid;
                const resellerRef = doc(db, "reseller", uid);
                const withdrawAmount = Number(selectedWithdrawData.withdrawAmount || 0);

                let generatedTransectionId = "";
                let isUnique = false;
                let attempts = 0;

                while (!isUnique && attempts < 5) {
                    attempts++;
                    const randomNum = Math.floor(10000000 + Math.random() * 90000000);
                    generatedTransectionId = `SP-TXN-${randomNum}`;

                    const checkSnap = await getDocs(query(collection(db, "transection"), where("transectionId", "==", generatedTransectionId), limit(1)));
                    if (checkSnap.empty) isUnique = true;
                }

                if (!isUnique) throw new Error("Unique transaction ID generation failed.");

                await runTransaction(db, async (transaction) => {
                    const withdrawSnap = await transaction.get(withdrawRef);
                    if (!withdrawSnap.exists()) throw new Error("Withdraw document not found.");
                    if (withdrawSnap.data().status && withdrawSnap.data().status !== "pending") throw new Error("Already processed.");

                    const resellerSnap = await transaction.get(resellerRef);
                    if (!resellerSnap.exists()) throw new Error("Reseller document not found.");

                    const currentResellerBalance = Number(resellerSnap.data().balance || 0);
                    const newBalance = currentResellerBalance - withdrawAmount;

                    const transectionRef = doc(collection(db, "transection"));
                    const noteText = `টাকা পাঠানো হয়েছে বিকাশ ট্রাঞ্জেকশন আইডি: ${trxIdInput} এবং এই ${senderNumberInput} নাম্বার থেকে টাকা পাঠানো হয়েছে!`;

                    transaction.set(transectionRef, {
                        transectionId: generatedTransectionId,
                        oldBalance: currentResellerBalance,
                        balance: newBalance,
                        note: noteText,
                        createdAt: serverTimestamp(),
                        uid: uid
                    });

                    transaction.update(resellerRef, { balance: newBalance });
                    transaction.delete(withdrawRef);
                });

                showToast("টাকা পাঠানোর তথ্য সংরক্ষণ করা হয়েছে এবং রিসেলারের ব্যালেন্স আপডেট হয়েছে।", "success");
                confirmModal.classList.remove('active');
                
                const cardEl = document.getElementById(`card-${currentActiveWithdrawId}`);
                if (cardEl) cardEl.remove();

            } catch (err) {
                console.error(err);
                if (err.message.includes("Reseller document not found")) {
                    showToast("রিসেলারের তথ্য পাওয়া যায়নি। অনুগ্রহ করে তথ্য যাচাই করুন।", "error");
                } else if (err.message.includes("Already processed") || err.message.includes("Withdraw document not found")) {
                    showToast("এই অনুরোধটি ইতিমধ্যে প্রক্রিয়াজাত হয়েছে।", "error");
                } else {
                    showToast("তথ্য আপডেট করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।", "error");
                }
            } finally {
                submitConfirmAction.disabled = false;
                submitConfirmAction.textContent = "টাকা পাঠানো হয়েছে, নিশ্চিত করুন";
            }
        });

        submitCancelAction.addEventListener('click', async () => {
            if (!currentActiveWithdrawId) return;

            submitCancelAction.disabled = true;
            submitCancelAction.textContent = "প্রক্রিয়াধীন...";

            try {
                const withdrawRef = doc(db, "withdraw", currentActiveWithdrawId);

                await runTransaction(db, async (transaction) => {
                    const withdrawSnap = await transaction.get(withdrawRef);
                    if (!withdrawSnap.exists()) throw new Error("Withdraw document not found.");
                    if (withdrawSnap.data().status && withdrawSnap.data().status !== "pending") throw new Error("Already processed.");

                    transaction.delete(withdrawRef);
                });

                showToast("টাকা উত্তোলনের অনুরোধ বাতিল করা হয়েছে।", "success");
                cancelModal.classList.remove('active');

                const cardEl = document.getElementById(`card-${currentActiveWithdrawId}`);
                if (cardEl) cardEl.remove();

            } catch (err) {
                console.error(err);
                showToast("এই অনুরোধটি ইতিমধ্যে প্রক্রিয়াজাত হয়েছে বা বাতিল করা সম্ভব হয়নি।", "error");
            } finally {
                submitCancelAction.disabled = false;
                submitCancelAction.textContent = "নিশ্চিত করুন";
            }
        });
