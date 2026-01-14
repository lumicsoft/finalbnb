let provider, signer, contract, Contract;

// --- CONFIGURATION ---
const CONTRACT_ADDRESS = "0x34FF4680A9A659C0ef4edF7776648472101205a4"; 
const TESTNET_CHAIN_ID = 56; 

// --- RANK CONFIG FOR LEADERSHIP ---
const RANK_DETAILS = [
    { name: "NONE", roi: "0%", targetTeam: 0, targetVolume: 0 },
    { name: "V1", roi: "1.00%", targetTeam: 50, targetVolume: 2.83 },
    { name: "V2", roi: "2.00%", targetTeam: 100, targetVolume:  5.66 },
    { name: "V3", roi: "3.00%", targetTeam: 200, targetVolume: 11.33 },
    { name: "V4", roi: "4.00%", targetTeam: 400, targetVolume: 16.99 },
    { name: "V5", roi: "6.00%", targetTeam: 800, targetVolume: 28.32 },
    { name: "V6", roi: "8.00%", targetTeam: 1500, targetVolume: 56.64  },
    { name: "V7", roi: "10.00%", targetTeam: 2500, targetVolume: 113.29  }
];

// --- ABI ---
const CONTRACT_ABI = [
    "function register(string username, string referrerUsername) external",
    "function deposit() external payable", // FIX: No argument here
    "function claimNetworkReward(uint256 amount) external",
    "function compoundDailyReward(uint256 amount) external",
    "function claimDailyReward(uint256 amount) external",
    "function compoundNetworkReward(uint256 amount) external",
    "function withdrawPrincipal() external",
    "function getLevelTeamDetails(address _upline, uint256 _level) view returns (string[] names, address[] wallets, uint256[] joinDates, uint256[] activeDeps, uint256[] teamTotalDeps, uint256[] teamActiveDeps, uint256[] withdrawals)",
    "function getLiveBalance(address uA) view returns (uint256 pendingROI, uint256 pendingCap)",
    "function users(address) view returns (address referrer, string username, bool registered, uint256 joinDate, uint256 totalActiveDeposit, uint256 teamActiveDeposit, uint256 teamTotalDeposit, uint256 totalDeposited, uint256 totalWithdrawn, uint256 totalEarnings)",
    "function usersExtra(address) view returns (uint256 rewardsReferral, uint256 rewardsOnboarding, uint256 rewardsRank, uint256 reserveDailyCapital, uint256 reserveDailyROI, uint256 reserveNetwork, uint32 teamCount, uint32 directsCount, uint32 directsQuali, uint8 rank)",
    "function getPosition(address uA, uint256 i) view returns (tuple(uint256 amount, uint256 startTime, uint256 lastCheckpoint, uint256 endTime, uint256 earned, uint256 expectedTotalEarn, uint8 source, bool active) v)",
    "function getUserTotalPositions(address uA) view returns (uint256)",
    "function getUserHistory(address _user) view returns (tuple(string txType, uint256 amount, uint256 timestamp, string detail)[])"
];


const calculateGlobalROI = (amount) => {
    const amt = parseFloat(amount);
    if (amt >= 5000) return 6.00;
    if (amt >= 2500) return 5.75;
    if (amt >= 1000) return 5.50;
    if (amt >= 500) return 5.25;
    return 5.00;
};
// --- 1. NEW: AUTO-FILL LOGIC ---
function checkReferralURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const refName = urlParams.get('ref'); // URL mein ?ref=NAME hona chahiye
    const refField = document.getElementById('reg-referrer');

    if (refName && refField) {
        refField.value = refName.trim();
        console.log("Referral auto-filled from URL:", refName);
    }
}
// --- INITIALIZATION ---
async function init() {
    // Check for referral parameter on every load
    checkReferralURL();

    if (window.ethereum) {
        try {
            provider = new ethers.providers.Web3Provider(window.ethereum);
            const accounts = await provider.listAccounts();
            window.signer = provider.getSigner();
            signer = window.signer;
            window.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
            contract = window.contract;

            if (accounts.length > 0) {
                if (localStorage.getItem('manualLogout') !== 'true') {
                    await setupApp(accounts[0]);
                } else {
                    updateNavbar(accounts[0]);
                }
            }
        } catch (error) { console.error("Init Error", error); }
    } else { alert("Please install MetaMask!"); }
}

// --- CORE LOGIC ---
window.handleDeposit = async function() {
    const amountInput = document.getElementById('deposit-amount');
    const depositBtn = document.getElementById('deposit-btn');
    if (!amountInput || !amountInput.value || amountInput.value <= 0) return alert("Please enter a valid amount!");
    
    const amountInWei = ethers.utils.parseUnits(amountInput.value.toString(), 18);
    
    try {
        depositBtn.disabled = true;
        depositBtn.innerText = "SIGNING...";
        
        // Gas Estimation Fix: Added manual gasLimit to ensure it doesn't fail on BSC
        const tx = await contract.deposit({ value: amountInWei });
        
        depositBtn.innerText = "DEPOSITING...";
        await tx.wait();
        location.reload(); 
    } catch (err) {
        alert("Error: " + (err.reason || err.message));
        depositBtn.innerText = "DEPOSIT NOW";
        depositBtn.disabled = false;
    }
}
window.handleClaim = async function() {
    try {
        const userAddress = await signer.getAddress();
        const live = await contract.getLiveBalance(userAddress);
        const totalPending = live.pendingROI.add(live.pendingCap);
        if (totalPending.lte(0)) return alert("No rewards to withdraw!");
        // Wait for tx and use safe gas limit
        const tx = await contract.claimDailyReward(totalPending);
        await tx.wait();
        location.reload();
    } catch (err) { alert("Withdraw failed: " + (err.reason || err.message)); }
}

window.handleCompoundDaily = async function() {
    try {
        const userAddress = await signer.getAddress();
        const live = await contract.getLiveBalance(userAddress);
        const totalPending = live.pendingROI.add(live.pendingCap);
        if (totalPending.lte(0)) return alert("No rewards to compound!");
        // Wait for tx and use safe gas limit
        const tx = await contract.compoundDailyReward(totalPending);
        await tx.wait();
        location.reload();
    } catch (err) { alert("Compound failed: " + (err.reason || err.message)); }
}

window.claimNetworkReward = async function(amountInWei) {
    try {
        const tx = await contract.claimNetworkReward(amountInWei);
        await tx.wait();
        location.reload();
    } catch (err) { alert("Network claim failed: " + (err.reason || err.message)); }
}
window.compoundNetworkReward = async function(amountInWei) {
    try {
        const tx = await contract.compoundNetworkReward(amountInWei);
        await tx.wait();
        location.reload();
    } catch (err) { alert("Network compound failed: " + (err.reason || err.message)); }
}

window.handleCapitalWithdraw = async function() {
    if (!confirm("Are you sure? This will stop your daily returns.")) return;
    try {
        const tx = await contract.withdrawPrincipal();
        await tx.wait();
        location.reload();
    } catch (err) { alert("Capital withdraw failed: " + (err.reason || err.message)); }
}

window.handleLogin = async function() {
    try {
        if (!window.ethereum) return alert("Please install MetaMask!");
        
        // 1. Accounts request karein
        const accounts = await provider.send("eth_requestAccounts", []);
        if (accounts.length === 0) return;
        
        const userAddress = accounts[0]; 
        
        // 2. Signer aur Contract ko re-initialize karein
        signer = provider.getSigner();
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        
        // Logout flag clear karein
        localStorage.removeItem('manualLogout');
        
        // 3. Contract se user data fetch karein
        const userData = await contract.users(userAddress);

        // 4. Registration Check
        if (userData.registered === true) {
            if(typeof showLogoutIcon === "function") showLogoutIcon(userAddress);
            window.location.href = "index1.html";
        } else {
            alert("This wallet is not registered in EarnBNB!");
            window.location.href = "register.html";
        }
    } catch (err) {
        console.error("Login Error:", err);
        alert("Login failed! Make sure you are on BSC Mainnet.");
    }
}

window.handleRegister = async function() {
    const userField = document.getElementById('reg-username');
    const refField = document.getElementById('reg-referrer');
    if (!userField || !refField) return;
    try {
        const tx = await contract.register(userField.value.trim(), refField.value.trim(), { gasLimit: 2000000 });
        await tx.wait();
        localStorage.removeItem('manualLogout'); 
        window.location.href = "index1.html";
    } catch (err) { alert("Error: " + (err.reason || err.message)); }
}

// --- LOGOUT LOGIC (Optimized) ---
window.handleLogout = function() {
    if (confirm("Do you want to disconnect?")) {
        localStorage.setItem('manualLogout', 'true');
        
        signer = null;
        contract = null;
        const connectBtn = document.getElementById('connect-btn');
        const logoutBtn = document.getElementById('logout-icon-btn');
        
        if (connectBtn) connectBtn.innerText = "Connect Wallet";
        if (logoutBtn) logoutBtn.classList.add('hidden');
        
        window.location.href = "index.html";
    }
}

function showLogoutIcon(address) {
    const btn = document.getElementById('connect-btn');
    const logout = document.getElementById('logout-icon-btn');
    if (btn) btn.innerText = address.substring(0, 6) + "..." + address.substring(38);
    if (logout) {
        logout.style.display = 'flex'; 
    }
}

// --- APP SETUP ---
async function setupApp(address) {
    const { chainId } = await provider.getNetwork();
    if (chainId !== TESTNET_CHAIN_ID) { alert("Please switch to BSC Mainnet!"); return; }
    
    const userData = await contract.users(address);
    const path = window.location.pathname;

    // --- SMART REDIRECTION ---
    if (!userData.registered) {
        if (!path.includes('register.html') && !path.includes('login.html')) {
            window.location.href = "register.html"; 
            return; 
        }
    } else {
        if (path.includes('register.html') || path.includes('login.html') || path.endsWith('/') || path.endsWith('index.html')) {
            window.location.href = "index1.html";
            return;
        }
    }

    updateNavbar(address);
    showLogoutIcon(address); 

    if (path.includes('index1.html')) {
        fetchAllData(address);
        start8HourCountdown(); 
    }

    if (path.includes('leadership.html')) {
        fetchLeadershipData(address);
    }
    
    if (path.includes('history.html')) {
        window.showHistory('deposit');
    }
}

// --- HISTORY LOGIC ---
window.showHistory = async function(type) {
    const container = document.getElementById('history-container');
    if(!container) return;
    
    container.innerHTML = `<div class="p-10 text-center text-yellow-500 italic">Blockchain Syncing...</div>`;
    
    const logs = await window.fetchBlockchainHistory(type);
    
    if (logs.length === 0) {
        container.innerHTML = `<div class="p-10 text-center text-gray-500">No transactions found.</div>`;
        return;
    }

    container.innerHTML = logs.map(item => `
        <div class="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 flex justify-between items-center">
            <div>
                <h4 class="font-bold ${item.color}">${item.type}</h4>
                <p class="text-xs text-gray-400">${item.date} | ${item.time}</p>
                ${item.extra ? `<p class="text-[10px] text-yellow-500 mt-1">${item.extra}</p>` : ''}
            </div>
            <div class="text-right">
                <span class="text-lg font-black text-white">${item.amount}</span>
                <p class="text-[10px] text-gray-500 italic uppercase">Completed</p>
            </div>
        </div>
    `).join('');
}

window.fetchBlockchainHistory = async function(type) {
    try {
        const address = await signer.getAddress();
        const rawHistory = await contract.getUserHistory(address);
        
        const processedLogs = rawHistory.map(item => {
            const txType = item.txType.toUpperCase(); 
            const detail = (item.detail || "").toUpperCase();
            const dt = new Date(item.timestamp.toNumber() * 1000);
            
            let match = false;
            if (type === 'deposit' && txType === 'DEPOSIT') match = true;
            if (type === 'compounding' && (txType.includes('COMPOUND') || detail.includes('COMPOUND'))) match = true;
            if (type === 'income') {
                const incomeKeywords = ['INCOME', 'REFERRAL', 'RANK', 'ONBOARDING', 'LEVEL', 'NETWORK', 'REWARD'];
                if (incomeKeywords.some(k => txType.includes(k) || detail.includes(k))) match = true;
            }
            if (type === 'withdrawal' && (txType === 'CAPITAL' || detail.includes('CLAIM') || detail.includes('WITHDRAW'))) match = true;

            if (!match) return null;

            return {
                type: txType,
                amount: format(item.amount),
                date: dt.toLocaleDateString(),
                time: dt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                ts: item.timestamp.toNumber(),
                extra: item.detail,
                color: (type === 'income' || type === 'deposit') ? 'text-cyan-400' : 'text-red-400'
            };
        });

        return processedLogs.filter(l => l !== null).sort((a, b) => b.ts - a.ts);
    } catch (e) {
        console.error("History Error:", e);
        return [];
    }
}

// --- LEADERSHIP DATA ---
async function fetchLeadershipData(address) {
    try {
        const [user, extra] = await Promise.all([
            contract.users(address),
            contract.usersExtra(address)
        ]);

        const rIdx = extra.rank;
        updateText('rank-display', RANK_DETAILS[rIdx].name.toUpperCase());
        updateText('rank-bonus-display', `${RANK_DETAILS[rIdx].roi} Leadership ROI`);
        updateText('rank-reward-available', `${format(extra.rewardsRank)}`);
        updateText('total-rank-earned', `${format(user.totalEarnings)}`);
        updateText('team-total-deposit', `${format(user.teamTotalDeposit)}`);
        updateText('team-active-deposit', `${format(user.teamActiveDeposit)}`);

        const nextIdx = rIdx < 7 ? rIdx + 1 : 7;
        const nextRank = RANK_DETAILS[nextIdx];
        updateText('next-rank-display', nextRank.name.toUpperCase());
        updateText('progress-next-rank', nextRank.name.toUpperCase());

        const tCount = extra.teamCount;
        const tVol = parseFloat(format(user.teamActiveDeposit));
        const tPercent = Math.min((tCount / nextRank.targetTeam) * 100, 100) || 0;
        const vPercent = Math.min((tVol / nextRank.targetVolume) * 100, 100) || 0;

        updateText('current-team-count', tCount);
        updateText('target-team-count', `/ ${nextRank.targetTeam}`);
        if(document.getElementById('team-count-bar')) document.getElementById('team-count-bar').style.width = `${tPercent}%`;
        updateText('team-count-percent', `${tPercent.toFixed(0)}%`);

        updateText('current-team-volume', tVol.toFixed(3));
        updateText('target-team-volume', `/ ${nextRank.targetVolume.toLocaleString()} BNB`);
        if(document.getElementById('team-volume-bar')) document.getElementById('team-volume-bar').style.width = `${vPercent}%`;
        updateText('team-volume-percent', `${vPercent.toFixed(0)}%`);

        loadLeadershipDownlines(address, rIdx);

    } catch (err) { console.error("Leadership Fetch Error:", err); }
}

async function loadLeadershipDownlines(address, myRankIdx) {
    const tableBody = document.getElementById('direct-downline-body');
    if(!tableBody) return;
    try {
        const res = await contract.getLevelTeamDetails(address, 1);
        const wallets = res.wallets || res[1] || [];
        const names = res.names || res[0] || [];
        const activeDeps = res.activeDeps || res[3] || [];

        if (wallets.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-gray-500 italic">No direct members</td></tr>`;
            return;
        }

        let html = '';
        for(let i=0; i < wallets.length; i++) {
            const uA = wallets[i];
            if (!uA || uA === ethers.constants.AddressZero) continue;
            const [dUser, dExtra] = await Promise.all([contract.users(uA), contract.usersExtra(uA)]);
            const diff = Math.max(parseFloat(RANK_DETAILS[myRankIdx].roi) - parseFloat(RANK_DETAILS[dExtra.rank].roi), 0).toFixed(2);

            html += `<tr class="border-b border-white/5 hover:bg-white/10 transition-all">
                <td class="p-4 flex flex-col"><span class="text-white font-bold">${names[i] || 'N/A'}</span><span class="text-[9px] text-gray-400">${uA.substring(0,8)}...</span></td>
                <td class="p-4 text-yellow-500 font-bold">${RANK_DETAILS[dExtra.rank].name}</td>
                <td class="p-4">${format(dUser.totalDeposited)}</td>
                <td class="p-4 text-green-400">${format(activeDeps[i])}</td>
                <td class="p-4">${dExtra.teamCount}</td>
                <td class="p-4 text-blue-400 font-bold">${diff}%</td>
                <td class="p-4">${format(dUser.teamActiveDeposit)}</td>
          </tr>`;
        }
        tableBody.innerHTML = html;
    } catch (e) { console.error(e); }
}

// --- GLOBAL DATA FETCH ---
async function fetchAllData(address) {
    try {
        const [user, extra, live] = await Promise.all([
            contract.users(address),
            contract.usersExtra(address),
            contract.getLiveBalance(address)
        ]);

        if (!user.registered) return;

        updateText('total-deposit-display', format(user.totalDeposited));
        updateText('active-deposit', format(user.totalActiveDeposit));
        updateText('total-earned', format(user.totalEarnings));
        updateText('total-withdrawn', format(user.totalWithdrawn));
        updateText('team-count', extra.teamCount.toString());
        updateText('direct-count', extra.directsCount.toString());
        updateText('level-earnings', format(extra.rewardsReferral));
        updateText('direct-earnings', format(extra.rewardsOnboarding));
        
        // --- Capital Box Fixes ---
        updateText('capital-investment-display', format(user.totalDeposited));
        updateText('capital-withdrawn-display', format(user.totalWithdrawn));

        // --- Live Balance Fixes ---
        const networkBalance = format(extra.reserveNetwork);
        updateText('ref-balance-display', parseFloat(networkBalance).toFixed(3));

        const dailyROI = parseFloat(format(live.pendingROI));
        const dailyCap = parseFloat(format(live.pendingCap));
        const totalDailyPending = dailyROI + dailyCap;
        
        updateText('compounding-balance', totalDailyPending.toFixed(3));
        updateText('withdrawable-display', (totalDailyPending + parseFloat(networkBalance)).toFixed(3));
        
        // --- CP Display & Projected ROI Fix ---
        const activeAmt = parseFloat(format(user.totalActiveDeposit));
        updateText('cp-display', Math.floor(activeAmt));
        
        const selfStatusEl = document.getElementById('user-status-display');
        const statusBadge = document.getElementById('status-badge');
        
        if(selfStatusEl) {
            selfStatusEl.innerText = activeAmt > 0 ? "ACTIVE" : "INACTIVE";
            selfStatusEl.className = activeAmt > 0 ? "text-yellow-500 font-bold" : "text-red-500 font-bold";
        }
        
        if(statusBadge) {
            if(activeAmt > 0) {
                statusBadge.innerText = "● Active Status";
                statusBadge.className = "px-4 py-1 rounded-full bg-green-500/20 text-green-500 text-[10px] font-black border border-green-500/30 uppercase";
            } else {
                statusBadge.innerText = "● Inactive Status";
                statusBadge.className = "px-4 py-1 rounded-full bg-red-500/20 text-red-500 text-[10px] font-black border border-red-500/30 uppercase animate-pulse";
            }
        }

        const projectedReturn = (activeAmt * 0.05).toFixed(3);
        updateText('projected-return', projectedReturn);
        
        updateText('rank-display', getRankName(extra.rank));

        const refUrl = `${window.location.origin}/register.html?ref=${user.username}`;
        if(document.getElementById('refURL')) document.getElementById('refURL').value = refUrl;

    } catch (err) { console.error("Data Fetch Error:", err); }
}

window.loadLevelData = async function(level) {
    const tableBody = document.getElementById('team-table-body');
    if(!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="7" class="p-10 text-center text-yellow-500 italic">Scanning Blockchain...</td></tr>`;
    
    try {
        const address = await signer.getAddress();
        const res = await contract.getLevelTeamDetails(address, level);
        const names = res.names || res[0] || [];
        const wallets = res.wallets || res[1] || [];
        const joinDates = res.joinDates || res[2] || [];
        const activeDeps = res.activeDeps || res[3] || [];
        const teamTotalDeps = res.teamTotalDeps || res[4] || [];

        if (!wallets || wallets.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="p-10 text-center text-gray-500">No users found in Level ${level}</td></tr>`;
            return;
        }
        
        let html = '';
        for(let i=0; i < wallets.length; i++) {
            const uA = wallets[i];
            if (!uA || uA === ethers.constants.AddressZero) continue;
            const uName = names[i] || "N/A";
            const activeD = parseFloat(format(activeDeps[i]));
            const teamTD = format(teamTotalDeps[i]);
            let jDate = joinDates[i] > 0 ? new Date(joinDates[i] * 1000).toLocaleDateString() : "N/A";

            const statusText = activeD > 0 ? 'ACTIVE' : 'INACTIVE';
            const statusColor = activeD > 0 ? 'text-yellow-500' : 'text-red-500';

            html += `<tr class="border-b border-white/5 hover:bg-white/10 transition-all">
                <td class="p-4 font-mono text-yellow-500 text-[10px]">
                    <div class="flex flex-col">
                        <span>${uA.substring(0,8)}...${uA.substring(34)}</span>
                        <span class="text-[8px] text-gray-400 font-sans uppercase">${uName}</span>
                    </div>
                </td>
                <td class="p-4 text-xs font-bold text-gray-400">Lvl ${level}</td>
                <td class="p-4 text-xs font-black text-white">${activeD.toFixed(3)}</td>
                <td class="p-4 text-xs text-gray-400">${parseFloat(teamTD).toFixed(3)}</td>
                <td class="p-4 text-xs text-green-400 font-bold">${activeD.toFixed(3)}</td>
                <td class="p-4 text-xs ${statusColor} italic uppercase font-black">${statusText}</td>
                <td class="p-4 text-[10px] text-gray-500">${jDate}</td>
            </tr>`;
        }
        tableBody.innerHTML = html;
    } catch (e) { tableBody.innerHTML = `<tr><td colspan="7" class="p-10 text-center text-red-500">Sync Error</td></tr>`; }
}

function start8HourCountdown() {
    const timerElement = document.getElementById('next-timer');
    if (!timerElement) return;
    setInterval(() => {
        const now = new Date();
        const targetHour = now.getHours() < 8 ? 8 : now.getHours() < 16 ? 16 : 24;
        const targetTime = new Date().setHours(targetHour, 0, 0, 0);
        const diff = targetTime - now;
        if (diff <= 0) return;
        const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        timerElement.innerText = `${h}:${m}:${s}`;
    }, 1000);
}

// --- UTILS ---
const format = (val) => {
    try { 
        if (!val) return "0.000"; 
        let f = ethers.utils.formatUnits(val.toString(), 18);
        return parseFloat(f).toFixed(3);
    } catch (e) { return "0.000"; }
};

const updateText = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
const getRankName = (r) => RANK_DETAILS[r]?.name || "NONE (-)";

function updateNavbar(addr) {
    const btn = document.getElementById('connect-btn');
    if(btn) btn.innerText = addr.substring(0,6) + "..." + addr.substring(38);
}

// Listen for account changes
if (window.ethereum) {
    window.ethereum.on('accountsChanged', () => {
        localStorage.removeItem('manualLogout');
        location.reload();
    });
    window.ethereum.on('chainChanged', () => location.reload());
}

window.addEventListener('load', init);

