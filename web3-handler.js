
let provider, signer, contract, Contract;
const CONTRACT_ADDRESS = "0xcf625eba834783689584ee1c043e6785ac864b38"; 
const MAINNET_CHAIN_ID = 56; 
const RANK_DETAILS = [
   { name: "NONE", reward: "0 BNB", powerReq: 0, otherReq: 0 },
    { name: "V1", reward: "0.55 BNB", powerReq: 1.11, otherReq: 1.11 },
    { name: "V2", reward: "1.11 BNB", powerReq: 5.55, otherReq: 5.55},
    { name: "V3", reward: "4.44 BNB", powerReq: 22.22, otherReq: 22.22 },
    { name: "V4", reward: "11.11 BNB", powerReq: 66.66, otherReq: 66.66 },
    { name: "V5", reward: "111.11 BNB", powerReq: 277.77, otherReq: 277.77 },
    { name: "V6", reward: "333.33 BNB", powerReq: 555.55, otherReq: 555.55 },
 ];

// --- ABI ---
const CONTRACT_ABI = [
    "function register(string username, string referrerUsername) external",
    "function deposit() external payable", 
    "function claimNetworkReward(uint256 amount) external",
    "function compoundDailyReward(uint256 amount) external",
    "function claimDailyReward(uint256 amount) external",
    "function compoundNetworkReward(uint256 amount) external",
    "function withdrawPrincipal() external",
    "function getLevelTeamDetails(address _upline, uint256 _level) view returns (string[] names, address[] wallets, uint256[] joinDates, uint256[] activeDeps, uint256[] teamTotalDeps, uint256[] teamActiveDeps, uint256[] withdrawals)",
    "function getLiveBalance(address uA) view returns (uint256 pendingROI, uint256 pendingCap)",
    "function users(address) view returns (address referrer, string username, bool registered, uint256 joinDate, uint256 totalActiveDeposit, uint256 teamActiveDeposit, uint256 teamTotalDeposit, uint256 totalDeposited, uint256 totalWithdrawn, uint256 totalEarnings)",
   "function usersExtra(address) view returns (uint256 rewardsReferral, uint256 rewardsOnboarding, uint256 rewardsRank, uint256 reserveDailyCapital, uint256 reserveDailyROI, uint256 reserveNetwork, uint32 teamCount, uint32 directsCount, uint32 directsQuali, uint8 rank, uint256 maxLegBusiness, uint256 totalTeamBusiness)",
    "function getPosition(address uA, uint256 i) view returns (tuple(uint256 amount, uint256 startTime, uint256 lastCheckpoint, uint256 endTime, uint256 earned, uint256 expectedTotalEarn, uint8 source, bool active) v)",
    "function getUserTotalPositions(address uA) view returns (uint256)",
    "function getUserHistory(address _user) view returns (tuple(string txType, uint256 amount, uint256 timestamp, string detail)[])"
];


const calculateGlobalROI = (amount) => {
    const amt = parseFloat(amount);
    if (amt >= 0.256) return 5.50; 
    if (amt >= 0.112) return 5.25; 
    return 5.00;                  
};
// --- 1. NEW: AUTO-FILL LOGIC ---
function checkReferralURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const refName = urlParams.get('ref'); 
    const refField = document.getElementById('reg-referrer');

    if (refName && refField) {
        refField.value = refName.trim();
        console.log("Referral auto-filled from URL:", refName);
    }
}

// --- INITIALIZATION ---
async function init() {
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
        const extra = await contract.usersExtra(userAddress);
        const live = await contract.getLiveBalance(userAddress);
        const totalPending = live.pendingROI.add(live.pendingCap)
                               .add(extra.reserveDailyROI)
                               .add(extra.reserveDailyCapital);
                               
        if (totalPending.lte(0)) return alert("No rewards to withdraw!");
        const tx = await contract.claimDailyReward(totalPending);
        await tx.wait();
        location.reload();
    } catch (err) { alert("Withdraw failed: " + (err.reason || err.message)); }
}
window.handleCompoundDaily = async function() {
    try {
        const userAddress = await signer.getAddress();
        const extra = await contract.usersExtra(userAddress);
        const live = await contract.getLiveBalance(userAddress);
        const totalPending = live.pendingROI.add(live.pendingCap)
                               .add(extra.reserveDailyROI)
                               .add(extra.reserveDailyCapital);

        if (totalPending.lte(0)) return alert("No rewards to compound!");
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
        const accounts = await provider.send("eth_requestAccounts", []);
        if (accounts.length === 0) return;
        
        const userAddress = accounts[0]; 
        signer = provider.getSigner();
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        localStorage.removeItem('manualLogout');
        const userData = await contract.users(userAddress);
        if (userData.registered === true) {
            if(typeof showLogoutIcon === "function") showLogoutIcon(userAddress);
            window.location.href = "index1.php";
        } else {
            alert("This wallet is not registered in EarnBNB!");
            window.location.href = "register.php";
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
       const tx = await contract.register(userField.value.trim(), refField.value.trim());
        await tx.wait();
        localStorage.removeItem('manualLogout'); 
        window.location.href = "index1.php";
    } catch (err) { alert("Error: " + (err.reason || err.message)); }
}
window.handleLogout = function() {
    if (confirm("Do you want to disconnect?")) {
        localStorage.setItem('manualLogout', 'true');
        
        signer = null;
        contract = null;
        const connectBtn = document.getElementById('connect-btn');
        const logoutBtn = document.getElementById('logout-icon-btn');
        
        if (connectBtn) connectBtn.innerText = "Connect Wallet";
        if (logoutBtn) logoutBtn.classList.add('hidden');
        
        window.location.href = "index.php";
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
    if (chainId !== MAINNET_CHAIN_ID) { alert("Please switch to BSC Mainnet!"); return; }
    
    const userData = await contract.users(address);
    const path = window.location.pathname;

    if (!userData.registered) {
        if (!path.includes('register.php') && !path.includes('login.php')) {
            window.location.href = "register.php"; 
            return; 
        }
    } else {
        if (path.includes('register.php') || path.includes('login.php') || path.endsWith('/') || path.endsWith('index.php')) {
            window.location.href = "index1.php";
            return;
        }
    }

    updateNavbar(address);
    showLogoutIcon(address); 

    if (path.includes('index1.php')) {
        fetchAllData(address);
        start8HourCountdown(); 
    }

    if (path.includes('leadership.php')) {
        fetchLeadershipData(address);
    }
    
    if (path.includes('history.php')) {
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
        const activeSigner = window.signer || signer;
        const activeContract = window.contract || contract;
        const address = await activeSigner.getAddress();
        const rawHistory = await activeContract.getUserHistory(address);
        
        const filterType = type.toLowerCase(); 

        const processedLogs = rawHistory.map(item => {
            const txType = (item.txType || "").toUpperCase(); 
            const detail = (item.detail || "").toUpperCase();
            const timestamp = item.timestamp.toNumber ? item.timestamp.toNumber() : Number(item.timestamp);
            const dt = new Date(timestamp * 1000);
            
            let match = false;
            if (filterType === 'deposit' && txType === 'DEPOSIT') match = true;
            if (filterType === 'compounding' && (txType.includes('COMPOUND') || detail.includes('COMPOUND') || txType === 'REINVEST')) match = true;
            if (filterType === 'income') {
                const incomeKeywords = ['INCOME', 'REFERRAL', 'RANK', 'ONBOARDING', 'LEVEL', 'NETWORK', 'REWARD', 'ROI'];
                if (incomeKeywords.some(k => txType.includes(k) || detail.includes(k))) match = true;
            }
            if (filterType === 'withdrawal' && (txType === 'CAPITAL' || detail.includes('CLAIM') || detail.includes('WITHDRAW') || txType.includes('WITHDRAW'))) match = true;

            if (!match) return null;

            let formattedAmount;
            try {
                formattedAmount = typeof format === 'function' ? format(item.amount) : 
                                  (window.ethers.utils ? ethers.utils.formatEther(item.amount) : ethers.formatEther(item.amount));
            } catch (err) {
                formattedAmount = "0.00";
            }

            return {
                type: txType.replace(/_/g, ' '),
                amount: formattedAmount,
                date: dt.toLocaleDateString(),
                time: dt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                ts: timestamp,
                detail: item.detail,
                color: (filterType === 'income' || filterType === 'deposit') ? 'text-cyan-400' : 'text-yellow-500'
            };
        });

        return processedLogs.filter(l => l !== null).sort((a, b) => b.ts - a.ts);

    } catch (e) {
        console.error("Blockchain Sync Error:", e);
        return [];
    }
}
async function fetchLeadershipData(address) {
    try {
        let activeContract = window.contract || contract;
        if (!activeContract) return;

        const [userData, extraData] = await Promise.all([
            activeContract.users(address),
            activeContract.usersExtra(address)
        ]);

        // --- 1. DATA EXTRACTION ---
        const finalRawPower = extraData.maxLegBusiness || extraData[10] || extraData[11] || 0;
        const finalRawTotal = extraData.totalTeamBusiness || extraData[11] || extraData[12] || 0;
        
        // Rank ko pakka number banayein
        const rankIndex = Number(extraData.rank || extraData[9] || 0);
        
        const powerLegBNB = parseFloat(ethers.utils.formatEther(finalRawPower.toString()));
        const totalBusBNB = parseFloat(ethers.utils.formatEther(finalRawTotal.toString()));
        const otherLegsBNB = Math.max(0, totalBusBNB - powerLegBNB);

        // --- 2. DYNAMIC TARGET FIX ---
        // Agar user V1 (Rank 1) hai, toh target har haal me V2 (Index 2) hona chahiye
        let nextIdx = rankIndex + 1; 
        if (nextIdx > 6) nextIdx = 6; // Max rank limit

        const currentRank = RANK_DETAILS[rankIndex] || RANK_DETAILS[0];
        const targetRank = RANK_DETAILS[nextIdx]; 

        // --- 3. UI UPDATES HELPER ---
        const update = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.innerText = text;
        };

        // Dashbaord Rank Update
        update('rank-display', currentRank.name);
        update('next-rank-display', targetRank.name); // <--- Ye ab V2 dikhayega

        // Volume Display
        update('power-leg-volume', powerLegBNB.toFixed(4));
        update('other-legs-volume', otherLegsBNB.toFixed(4));

        // --- 4. TARGET & PROGRESS CALCULATION (THE FIX) ---
        // Yahan targetRank.powerReq ab V2 wala value (0.2) pick karega
        update('target-power-val', `${targetRank.powerReq} BNB`);
        update('target-other-val', `${targetRank.otherReq} BNB`);
        update('current-power-val', powerLegBNB.toFixed(4));
        update('current-other-val', otherLegsBNB.toFixed(4));

        // Percentages calculation based on NEXT target
        const pPercent = Math.min((powerLegBNB / targetRank.powerReq) * 100, 100) || 0;
        const oPercent = Math.min((otherLegsBNB / targetRank.otherReq) * 100, 100) || 0;

        update('power-progress-percent', `${Math.floor(pPercent)}%`);
        update('other-progress-percent', `${Math.floor(oPercent)}%`);

        // --- 5. PROGRESS BAR VISUAL FIX ---
        const pBar = document.getElementById('power-progress-bar');
        const oBar = document.getElementById('other-progress-bar');
        
        if (pBar) {
            pBar.style.width = `${pPercent}%`;
            pBar.style.height = "100%";
            pBar.style.minHeight = "10px"; // Ensure visibility
            console.log("Setting Power Bar to:", pPercent + "%");
        }
        if (oBar) {
            oBar.style.width = `${oPercent}%`;
            oBar.style.height = "100%";
            oBar.style.minHeight = "10px";
            console.log("Setting Other Bar to:", oPercent + "%");
        }

        if (typeof loadLeadershipDownlines === "function") {
            loadLeadershipDownlines(address);
        }

    } catch (err) {
        console.error("Leadership Final Error:", err);
    }
}

async function loadLeadershipDownlines(address) {
    const tableBody = document.getElementById('direct-downline-body');
    if(!tableBody) return;

    try {
        let activeContract = window.contract || contract;
        if (!activeContract) return;

        tableBody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-yellow-500 italic animate-pulse">Loading direct partners...</td></tr>`;

        const res = await activeContract.getLevelTeamDetails(address, 1);
        const wallets = res.wallets || res[1] || [];
        const names = res.names || res[0] || [];
        
        if (wallets.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-500 italic">No direct members found</td></tr>`;
            return;
        }
        let html = '';
        for(let i=0; i < wallets.length; i++) {
            const uA = wallets[i];
            if (!uA || uA === "0x0000000000000000000000000000000000000000") continue;
            
            try {
                const [dUser, dExtra] = await Promise.all([
                    activeContract.users(uA),
                    activeContract.usersExtra(uA)
                ]);
                const partnerPersonal = parseFloat(ethers.utils.formatEther(dUser.totalActiveDeposit || 0));
                const pPowerLegBNB = parseFloat(ethers.utils.formatEther(dExtra.maxLegBusiness || 0));
                const pTotalBusBNB = parseFloat(ethers.utils.formatEther(dExtra.totalTeamBusiness || 0));
                const partnerTotalVolume = partnerPersonal + pTotalBusBNB;
                const pOtherLegsBNB = Math.max(0, pTotalBusBNB - pPowerLegBNB);
                const pRank = Number(dExtra.rank || 0);
                const rankInfo = RANK_DETAILS[pRank] || RANK_DETAILS[0];

                html += `
                <tr class="border-b border-white/5 hover:bg-white/10 transition-all text-xs">
                    <td class="p-4">
                        <div class="text-white font-bold">${names[i] || 'User'}</div>
                        <div class="text-[9px] text-gray-500 font-mono">${uA.substring(0,6)}...${uA.substring(uA.length-4)}</div>
                    </td>
                    <td class="p-4"><span class="bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded text-[10px] font-bold">${rankInfo.name}</span></td>
                    <td class="p-4 text-gray-200">${partnerPersonal.toFixed(3)}</td>
                    <td class="p-4 text-green-400 font-bold">${partnerTotalVolume.toFixed(3)}</td>
                    <td class="p-4 text-gray-400 font-medium">${pPowerLegBNB.toFixed(3)}</td>
                    <td class="p-4 text-blue-400 font-bold">${pOtherLegsBNB.toFixed(3)}</td>
                </tr>`;

            } catch (innerErr) {
                console.warn(`Partner ${uA} data missing`, innerErr);
                continue;
            }
        }
        
        tableBody.innerHTML = html;

    } catch (e) { 
        console.error("Downline Global Error:", e);
        tableBody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-red-500 italic">Failed to sync downline data.</td></tr>`;
    }
}

// --- GLOBAL DATA FETCH ---
async function fetchAllData(address) {
    try {
        let activeSigner = window.signer || signer;
        let activeContract = window.contract || contract;
        if (!activeSigner || !activeContract) {
            console.log("Wallet not connected or Contract not initialized");
            return; 
        }
        if (!address) {
            address = await activeSigner.getAddress();
        }

        const [user, extra, live] = await Promise.all([
            activeContract.users(address),
            activeContract.usersExtra(address),
            activeContract.getLiveBalance(address)
        ]);

        if (!user.registered) return;

        const formatVal = (val) => {
            if (!val) return "0.00";
            return typeof format === 'function' ? format(val) : ethers.utils.formatEther(val);
        };

        updateText('total-deposit-display', formatVal(user.totalDeposited));
        updateText('active-deposit', formatVal(user.totalActiveDeposit));
        updateText('total-earned', formatVal(user.totalEarnings));
        updateText('total-withdrawn', formatVal(user.totalWithdrawn));
        updateText('team-count', extra.teamCount.toString());
        updateText('direct-count', extra.directsCount.toString());
        updateText('level-earnings', formatVal(extra.rewardsReferral));
        updateText('direct-earnings', formatVal(extra.rewardsOnboarding));
        
        updateText('capital-investment-display', formatVal(user.totalDeposited));
        updateText('capital-withdrawn-display', formatVal(user.totalWithdrawn));

        const networkBalance = parseFloat(formatVal(extra.rewardsReferral)) + 
                               parseFloat(formatVal(extra.rewardsOnboarding)) + 
                               parseFloat(formatVal(extra.rewardsRank)) + 
                               parseFloat(formatVal(extra.reserveNetwork));
        
        updateText('ref-balance-display', networkBalance.toFixed(4));

        const pendingROI = parseFloat(formatVal(live.pendingROI));
        const pendingCap = parseFloat(formatVal(live.pendingCap));
        const reserveDaily = parseFloat(formatVal(extra.reserveDailyROI)) + 
                             parseFloat(formatVal(extra.reserveDailyCapital));
        
        const totalPending = pendingROI + pendingCap + reserveDaily;
        
        updateText('compounding-balance', totalPending.toFixed(4));
        updateText('withdrawable-display', (totalPending + networkBalance).toFixed(4));
        
        const activeAmt = parseFloat(formatVal(user.totalActiveDeposit));
        updateText('cp-display', activeAmt.toFixed(4));
        
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

        if (typeof calculateGlobalROI === 'function') {
            const projectedReturn = (activeAmt * (calculateGlobalROI(activeAmt)/100)).toFixed(4);
            updateText('projected-return', projectedReturn);
        }
        
        if (typeof getRankName === 'function') {
            updateText('rank-display', getRankName(extra.rank));
        }

        const currentUrl = window.location.href.split('?')[0];
        const baseUrl = currentUrl.includes('index.php') ? currentUrl.replace('index.php', 'register.php') : currentUrl + 'register.php';
        const refUrl = `${baseUrl}?ref=${user.username || address}`; 
        
        if(document.getElementById('refURL')) {
            document.getElementById('refURL').value = refUrl;
        }

    } catch (e) {
        console.error("Fetch All Data Error:", e);
    }
}

window.loadLevelData = async function(level) {
    const tableBody = document.getElementById('team-table-body');
    if(!tableBody) return;
    
    tableBody.innerHTML = `<tr><td colspan="7" class="p-10 text-center text-yellow-500 italic animate-pulse">Scanning Level ${level} Blockchain...</td></tr>`;
    try {
        let activeSigner = window.signer || (typeof signer !== 'undefined' ? signer : null);
        let activeContract = window.contract || (typeof contract !== 'undefined' ? contract : null);
        if (!activeSigner || !activeContract) {
            tableBody.innerHTML = `<tr><td colspan="7" class="p-10 text-center text-red-500">Wallet Not Connected. Please connect first.</td></tr>`;
            return;
        }

        const address = await activeSigner.getAddress();
        const res = await activeContract.getLevelTeamDetails(address, level);
        const names = res.names || res[0] || [];
        const wallets = res.wallets || res[1] || [];
        const joinDates = res.joinDates || res[2] || [];
        const activeDeps = res.activeDeps || res[3] || [];
        const teamTotalDeps = res.teamTotalDeps || res[4] || [];

        if (!wallets || wallets.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="p-10 text-center text-gray-500 italic text-sm">No members found in Level ${level}</td></tr>`;
            return;
        }
        const formatVal = (val) => {
            const formatted = typeof format === 'function' ? format(val) : ethers.utils.formatEther(val);
            return parseFloat(formatted);
        };
        let html = '';
        for(let i=0; i < wallets.length; i++) {
            const uA = wallets[i];
            if (!uA || uA === "0x0000000000000000000000000000000000000000") continue;
            const uName = names[i] || "N/A";
            const activeD = formatVal(activeDeps[i]);
            const teamTD = formatVal(teamTotalDeps[i]);
            let jDate = "N/A";
            if (joinDates[i] > 0) {
                const timestamp = joinDates[i].toNumber ? joinDates[i].toNumber() : joinDates[i];
                jDate = new Date(timestamp * 1000).toLocaleDateString();
            }
            const statusText = activeD > 0 ? 'ACTIVE' : 'INACTIVE';
            const statusColor = activeD > 0 ? 'text-green-400' : 'text-red-500';
            html += `
            <tr class="border-b border-white/5 hover:bg-white/10 transition-all">
                <td class="p-4 font-mono text-yellow-500 text-[10px]">
                    <div class="flex flex-col">
                        <span class="font-bold">${uA.substring(0,8)}...${uA.substring(uA.length-4)}</span>
                        <span class="text-[8px] text-gray-400 font-sans uppercase tracking-tighter">${uName}</span>
                    </div>
                </td>
                <td class="p-4 text-xs font-bold text-gray-400">Lvl ${level}</td>
                <td class="p-4 text-xs font-black text-white">${activeD.toFixed(4)}</td>
                <td class="p-4 text-xs text-gray-400">${teamTD.toFixed(4)}</td>
                <td class="p-4 text-xs text-cyan-400 font-bold">${activeD.toFixed(4)}</td>
                <td class="p-4 text-xs ${statusColor} italic uppercase font-black">${statusText}</td>
                <td class="p-4 text-[10px] text-gray-500 whitespace-nowrap">${jDate}</td>
            </tr>`;
        }
        tableBody.innerHTML = html || `<tr><td colspan="7" class="p-10 text-center text-gray-500">Empty Level</td></tr>`;
    } catch (e) { 
        console.error("Level Sync Error:", e);
        tableBody.innerHTML = `<tr><td colspan="7" class="p-10 text-center text-red-500">Blockchain Sync Error. Refresh Wallet.</td></tr>`; 
    }
}

function start8HourCountdown() {
    const timerElement = document.getElementById('next-timer');
    if (!timerElement) return;
    setInterval(() => {
        const now = new Date();
        const nowUTC = now.getTime();
        const eightHoursInMs = 8 * 60 * 60 * 1000;
        const nextTargetUTC = Math.ceil(nowUTC / eightHoursInMs) * eightHoursInMs;
      
        const diff = nextTargetUTC - nowUTC;
        if (diff <= 0) {
            if (typeof fetchAllData === "function") {
                const accounts = localStorage.getItem('userAccount'); 
                if(accounts) fetchAllData(accounts);
            }
            return;
        }
        const h = Math.floor(diff / (1000 * 60 * 60)).toString().padStart(2, '0');
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
        const s = Math.floor((diff % (1000 * 60)) / 1000).toString().padStart(2, '0');
        timerElement.innerText = `${h}:${m}:${s}`;
    }, 1000);
}
// --- UTILS ---
const format = (val) => {
    try { 
        if (!val) return "0.0000"; 
        let f = ethers.utils.formatUnits(val.toString(), 18);
        return parseFloat(f).toFixed(4);
    } catch (e) { return "0.0000"; }
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



