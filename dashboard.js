
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
        firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();
        const db = firebase.firestore();

        // Authorized Owner Emails
        const OWNER_EMAILS = [
            "shohidhossain@gmail.com",
            "nazrulislam887441234@gmail.com",
            "support.seraproduct@gmail.com" // অথবা support.seraproduct@gmail.com
        ];

        // Exact 17 Cards Data Definition (Strict Order Maintained)
        const allCardsData = [
            {
                id: 'upload-product',
                name: 'প্রোডাক্ট আপলোড',
                route: '/upload-product',
                desc: 'নতুন প্রোডাক্ট সিস্টেমে যুক্ত করুন',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></svg>'
            },
            {
                id: 'product-manage',
                name: 'প্রোডাক্ট ম্যানেজ',
                route: '/product-manage',
                desc: 'বিদ্যমান প্রোডাক্ট তালিকা এবং স্টক পরিচালনা করুন',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>'
            },
            {
                id: 'all-admin',
                name: 'সব অ্যাডমিন',
                route: '/all-admin.html',
                desc: 'এডমিন তালিকা ও অ্যাক্সেস কন্ট্রোল পরিচালনা',
                ownerOnly: true,
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>'
            },
            {
                id: 'all-buyers',
                name: 'সব ক্রেতা ম্যানেজ',
                route: '/all-buyers',
                desc: 'রেজিস্টার্ড ক্রেতাদের তথ্য ও কার্যক্রম দেখুন',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>'
            },
            {
                id: 'all-reffercode',
                name: 'সব রেফারেল কোড',
                route: '/all-reffercode',
                desc: 'সকল রেফারেল কোড ও কমিশন ট্র্যাক করুন',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>'
            },
            {
                id: 'all-reseller',
                name: 'সব রিসেলার',
                route: '/all-reseller',
                desc: 'রিসেলার পার্টনারদের তালিকা ও তথ্য',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>'
            },
            {
                id: 'all-transection',
                name: 'সব ট্রানজেকশন',
                route: '/all-transection',
                desc: 'সকল লেনদেন ও হিসাব-নিকাশ মনিটরিং',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>'
            },
            {
                id: 'category',
                name: 'ক্যাটাগরি ম্যানেজ ও তৈরি',
                route: '/category',
                desc: 'নতুন ক্যাটাগরি তৈরি ও সাজিয়ে রাখুন',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>'
            },
            {
                id: 'home-page-banner',
                name: 'হোম পেজ ব্যানার',
                route: '/home-page-banner',
                desc: 'ওয়েবসাইটের হোমপেজ ব্যানার ম্যানেজ করুন',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>'
            },
            {
                id: 'imgbb-api',
                name: 'ইমেজ আপলোড এপিআই',
                route: '/imgbb-api',
                desc: 'ImgBB API কী ও কনফিগারেশন ম্যানেজমেন্ট',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/></svg>'
            },
            {
                id: 'notepad',
                name: 'নোটপ্যাড',
                route: '/notepad',
                desc: 'জরুরি নোট এবং গুরুত্বপূর্ণ তথ্য লিখে রাখুন',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>'
            },
            {
                id: 'reseller-banner',
                name: 'রিসেলার ব্যানার',
                route: '/reseller-banner',
                desc: 'রিসেলারদের জন্য প্রমোশনাল ব্যানার তৈরি ও আপডেট',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>'
            },
            {
                id: 'reseller-order',
                name: 'রিসেলার অর্ডার',
                route: '/reseller-order',
                desc: 'রিসেলারদের প্লেস করা অর্ডারসমূহ পরিচালনা করুন',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>'
            },
            {
                id: 'customer-order',
                name: 'কাস্টমার অর্ডার',
                route: '/customer-order',
                desc: 'সরাসরি ক্রেতাদের অর্ডার লিস্ট ও স্ট্যাটাস আপডেট',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>'
            },
            {
                id: 'video',
                name: 'রিভিউ ও টিউটোরিয়াল ভিডিও',
                route: '/video',
                desc: 'পণ্য রিভিউ এবং নির্দেশিকা ভিডিও যোগ করুন',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>'
            },
            {
                id: 'withdraw',
                name: 'টাকা উত্তোলনের অনুরোধ',
                route: '/withdraw',
                desc: 'রিসেলার ও উইথড্রল রিকোয়েস্ট প্রসেস করুন',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>'
            },
            {
                id: 'promo-code',
                name: 'প্রোমো কোড',
                route: '/promo-code',
                desc: 'ডিসকাউন্ট ও প্রোমো কোড তৈরি ও ম্যানেজ করুন',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>'
            }
        ];

        // Authentication & Authorization Check Script
        auth.onAuthStateChanged(async (user) => {
            const loadingScreen = document.getElementById('loading-screen');
            
            if (!user) {
                // Not logged in -> Redirect to login domain
                window.location.replace("https://admin.seraproduct.com");
                return;
            }

            const email = user.email;
            const uid = user.uid;
            let role = null;

            // 1. Check if user is Owner
            if (OWNER_EMAILS.includes(email)) {
                role = 'OWNER';
            } else {
                // 2. Check if user is Admin in Firestore (admins/{uid})
                try {
                    const adminDoc = await db.collection('admins').doc(uid).get();
                    if (adminDoc.exists) {
                        const adminData = adminDoc.data();
                        // Validate active status and data consistency
                        if (adminData.active === true && adminData.email === email) {
                            role = 'ADMIN';
                        }
                    }
                } catch (error) {
                    console.error("Firestore read error:", error);
                }
            }

            // If neither Owner nor Admin, unauthorized -> Redirect
            if (!role) {
                window.location.replace("https://admin.seraproduct.com");
                return;
            }

            // Render Header User Details
            document.getElementById('user-email-display').textContent = email;
            const badgeContainer = document.getElementById('role-badge-container');
            
            if (role === 'OWNER') {
                badgeContainer.innerHTML = `<span class="badge badge-owner">OWNER</span>`;
            } else {
                badgeContainer.innerHTML = `<span class="badge badge-admin">ADMIN</span>`;
            }

            // Render Dashboard Cards based on Role
            renderCards(role);

            // Hide Loading Screen smoothly
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 300);
        });

        // Function to render cards dynamically
        function renderCards(role) {
            const gridContainer = document.getElementById('dashboard-grid');
            gridContainer.innerHTML = '';

            allCardsData.forEach(card => {
                // If card is ownerOnly and current user is ADMIN, skip rendering entirely
                if (card.ownerOnly && role !== 'OWNER') {
                    return;
                }

                const cardElement = document.createElement('a');
                cardElement.href = card.route;
                cardElement.className = 'dashboard-card';
                cardElement.onclick = (e) => {
                    e.preventDefault();
                    // Internal SPA/Route Navigation handling
                    navigateToRoute(card.route);
                };

                cardElement.innerHTML = `
                    <div class="card-top">
                        <div class="card-icon-wrapper">
                            ${card.icon}
                        </div>
                        <div class="card-arrow">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                        </div>
                    </div>
                    <div class="card-content">
                        <h2 class="card-title">${card.name}</h2>
                        <p class="card-desc">${card.desc}</p>
                    </div>
                `;

                gridContainer.appendChild(cardElement);
            });
        }

        // Internal Navigation Handler
        // Internal Navigation Handler - FIXED
function navigateToRoute(route) {
    const user = auth.currentUser;
    if (route === '/all-admin.html') {
        if (!user || !OWNER_EMAILS.includes(user.email)) {
            alert("আপনার এই পেইজে প্রবেশ করার অনুমতি নেই!");
            return;
        }
    }
    window.location.href = route;
}
