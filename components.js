document.addEventListener("DOMContentLoaded", function () {
    // Check current page
    const isAuthPage = window.location.pathname.includes('register.html') || 
                       window.location.pathname.includes('login.html');

    // 1. Inject Dots Background (Ye background har page par dikhega)
    const dotsHTML = `
        <div class="dots-container">
            <div class="dots dots-white"></div>
            <div class="dots dots-cyan"></div>
        </div>
    `;
    document.body.insertAdjacentHTML('afterbegin', dotsHTML);

    // Agar Auth Page (Register/Login) hai toh Navbar aur Mobile Nav inject mat karo
    if (isAuthPage) {
        console.log("Navigation hidden on auth page.");
        return; // Function yahi stop ho jayega
    }

    // 2. Inject Navbar (Top) - Only for Dashboard pages
    const navHTML = `
        <nav class="max-w-7xl mx-auto px-6 py-8 flex justify-between items-center relative z-50">
            <div class="flex items-center gap-2 cursor-pointer" onclick="location.href='index1.html'">
                <div class="w-10 h-10 bg-gradient-to-tr from-cyan-400 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                    <i data-lucide="component" class="text-white w-6 h-6"></i>
                </div>
                <span class="text-xl font-black orbitron tracking-tighter uppercase">
                    Earn <span class="text-gradient">BNB</span>
                </span>
            </div>

            <div class="hidden md:flex gap-4">
                <button class="gold-btn !py-2 !px-5" onclick="location.href='index1.html'">Dashboard</button>
                <button class="gold-btn !py-2 !px-5" onclick="location.href='deposits.html'">Mining</button>
                <button class="gold-btn !py-2 !px-5" onclick="location.href='referral.html'">Referral</button>
                <button class="gold-btn !py-2 !px-5" onclick="location.href='leadership.html'">Leadership</button>
                <button class="gold-btn !py-2 !px-5" onclick="location.href='history.html'">History</button>
            </div>
            <button id="connect-btn" onclick="connectWallet()" class="gold-btn">Connect Wallet</button>
        </nav>
    `;
    document.body.insertAdjacentHTML('afterbegin', navHTML);

    // 3. Inject Mobile Navigation - Only for Dashboard pages
    const mobileNavHTML = `
        <div class="mobile-nav md:hidden px-2">
            <a href="index1.html" class="mobile-nav-item ${window.location.pathname.includes('index1.html') ? 'active' : ''}">
                <i data-lucide="layout-dashboard" class="w-4 h-4 mb-1"></i>
                <span class="text-[8px]">Home</span>
            </a>
            <a href="deposits.html" class="mobile-nav-item ${window.location.pathname.includes('deposits.html') ? 'active' : ''}">
                <i data-lucide="hard-drive" class="w-4 h-4 mb-1"></i>
                <span class="text-[8px]">Mining</span>
            </a>
            <a href="referral.html" class="mobile-nav-item ${window.location.pathname.includes('referral.html') ? 'active' : ''}">
                <i data-lucide="users" class="w-4 h-4 mb-1"></i>
                <span class="text-[8px]">Team</span>
            </a>
            <a href="leadership.html" class="mobile-nav-item ${window.location.pathname.includes('leadership.html') ? 'active' : ''}">
                <i data-lucide="trophy" class="w-4 h-4 mb-1"></i>
                <span class="text-[8px]">Rewards</span>
            </a>
            <a href="history.html" class="mobile-nav-item ${window.location.pathname.includes('history.html') ? 'active' : ''}">
                <i data-lucide="clock" class="w-4 h-4 mb-1"></i>
                <span class="text-[8px]">History</span>
            </a>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', mobileNavHTML);

    // Initialize Lucide Icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});
