let provider, signer, contract, usdtContract;

// --- CONFIGURATION ---
const CONTRACT_ADDRESS = "YOUR_TESTNET_CONTRACT_ADDRESS"; 
const USDT_ADDRESS = "0x337610d27c2425019392024265f210e69503487c"; 
const TESTNET_CHAIN_ID = 97; 

const CONTRACT_ABI = [
    "function register(string username, string referrerUsername) external",
    "function deposit(uint256 amount) external",
    "function claimDailyReward(uint256 amount) external",
    "function compoundDailyReward(uint256 amount) external",
    "function withdrawPrincipal() external",
    "function getLiveBalance(address uA) view returns (uint256 pendingROI, uint256 pendingCap)",
    "function users(address) view returns (address referrer, string username, bool registered, uint256 joinDate, uint256 totalActiveDeposit, uint256 teamActiveDeposit, uint256 teamTotalDeposit, uint256 totalDeposited, uint256 totalWithdrawn, uint256 totalEarnings)",
    "function usersExtra(address) view returns (uint256 rewardsReferral, uint256 rewardsOnboarding, uint256 rewardsRank, uint256 reserveDailyCapital, uint256 reserveDailyROI, uint256 reserveNetwork, uint32 teamCount, uint32 directsCount, uint32 directsQuali, uint8 rank)",
    "event Registered(address indexed user, address indexed referrer, string username)",
    "event Deposited(address indexed user, uint256 amount)",
    "event Compounded(address indexed user, uint256 amount)",
    "event RewardClaimed(address indexed user, uint256 amount, string rewardType)"
];

const USDT_ABI = [
    "function approve(address spender, uint256 amount) public returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)"
];

// --- INITIALIZATION ---
async function init() {
    if (window.ethereum) {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) setupApp(accounts[0]);
    }
}

// --- NEW LOGIN ACTION (For Login Button) ---
async function handleLogin() {
    try {
        if (!window.ethereum) return alert("Please install MetaMask!");
        
        // 1. Connect Wallet
        const accounts = await provider.send("eth_requestAccounts", []);
        const address = accounts[0];
        
        // 2. Initialize Contract if not already done
        const tempSigner = provider.getSigner();
        const tempContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, tempSigner);
        
        // 3. Check Registration Status
        const userData = await tempContract.users(address);
        
        if (userData.registered) {
            // Already registered -> Dashboard
            window.location.href = "index1.html";
        } else {
            // Not registered -> Register Page
            alert("Wallet not registered! Redirecting to registration...");
            window.location.href = "register.html";
        }
    } catch (err) {
        console.error("Login Error:", err);
    }
}

async function connectWallet() {
    try {
        const accounts = await provider.send("eth_requestAccounts", []);
        setupApp(accounts[0]);
    } catch (err) { console.error("Login failed", err); }
}

async function setupApp(address) {
    const { chainId } = await provider.getNetwork();
    if (chainId !== TESTNET_CHAIN_ID) {
        alert("Please switch to BSC Testnet!");
        return;
    }

    window.signer = provider.getSigner();
    signer = window.signer;
    
    window.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    contract = window.contract;
    
    usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, signer);
    
    // --- SECURITY CHECK FOR DASHBOARD ---
    // Agar user index1.html par hai toh check karo ki registered hai ya nahi
    if (window.location.pathname.includes('index1.html')) {
        const userData = await contract.users(address);
        if (!userData.registered) {
            window.location.href = "register.html";
            return;
        }
    }

    updateNavbar(address);
    fetchAllData(address);
    start8HourCountdown(); 
    
    if(document.getElementById('team-table-body')) fetchTeamReport(address, 1);
    if(document.getElementById('history-container')) window.showHistory('deposit');
    
    if(document.getElementById('deposits-grid')) {
        if (typeof loadActiveDeposits === "function") loadActiveDeposits();
    }
}

// --- TIMER LOGIC (8-HOUR REVERSE COUNTDOWN) ---
function start8HourCountdown() {
    const timerElement = document.getElementById('next-timer');
    if (!timerElement) return;

    setInterval(() => {
        const now = new Date();
        const hours = now.getHours();
        let targetHour;

        if (hours < 8) targetHour = 8;
        else if (hours < 16) targetHour = 16;
        else targetHour = 24;

        const targetTime = new Date();
        targetTime.setHours(targetHour, 0, 0, 0);

        const diff = targetTime - now;

        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        timerElement.innerText = 
            `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }, 1000);
}

// --- DATA FETCHING ---
async function fetchAllData(address) {
    try {
        const [user, extra, live] = await Promise.all([
            contract.users(address),
            contract.usersExtra(address),
            contract.getLiveBalance(address)
        ]);

        if (!user.registered) return;

        updateText('total-deposit-display', `$ ${format(user.totalDeposited)}`);
        updateText('active-deposit', `$ ${format(user.totalActiveDeposit)}`);
        updateText('total-earned', `$ ${format(user.totalEarnings)}`);
        updateText('total-withdrawn', `$ ${format(user.totalWithdrawn)}`);
        updateText('team-count', extra.teamCount.toString());
        updateText('direct-count', extra.directsCount.toString());
        updateText('level-earnings', `$ ${format(extra.rewardsReferral)}`);

        const withdrawable = (parseFloat(format(live.pendingROI)) + parseFloat(format(live.pendingCap))).toFixed(2);
        updateText('withdrawable-display', `$ ${withdrawable}`);
        updateText('compounding-balance', `$ ${withdrawable}`);
        updateText('capital-investment-display', `$ ${format(user.totalActiveDeposit)}`);
        updateText('capital-withdrawn-display', `$ ${format(user.totalWithdrawn)}`);
        
        const dailyROI = (parseFloat(format(user.totalActiveDeposit)) * 0.05).toFixed(2);
        updateText('project-return', `$ ${dailyROI}`);

        updateText('rank-display', getRankName(extra.rank));

        const cpVal = Math.floor(parseFloat(format(user.totalActiveDeposit)) / 100);
        updateText('cp-display', cpVal);

        const badge = document.getElementById('status-badge');
        if(badge && parseFloat(format(user.totalActiveDeposit)) > 0) {
            badge.innerText = "● Active Status";
            badge.className = "px-4 py-1 rounded-full bg-green-500/20 text-green-400 text-[10px] font-black border border-green-500/30 uppercase";
        }

        const refUrl = `${window.location.origin}/register.html?ref=${user.username}`;
        if(document.getElementById('refURL')) document.getElementById('refURL').value = refUrl;

    } catch (err) { console.error("Data Fetch Error:", err); }
}

// --- HISTORY LOGIC ---
async function fetchBlockchainHistory(type) {
    if (!contract || !signer) return [];
    const address = await signer.getAddress();

    try {
        let filter;
        if (type === 'deposit') filter = contract.filters.Deposited(address);
        else if (type === 'compounding') filter = contract.filters.Compounded(address);
        else if (type === 'income') filter = contract.filters.RewardClaimed(address);

        const events = await contract.queryFilter(filter, -10000); 

        return events.map(e => {
            let itemType = e.args.rewardType || type.toUpperCase();
            let itemColor = (type === 'income') ? 'text-yellow-500' : 'text-gray-400';

            if(type === 'income' && e.args.rewardType) {
                const rType = e.args.rewardType.toLowerCase();
                if(rType.includes('roi')) {
                    itemType = "Daily ROI Reward";
                    itemColor = "text-yellow-500";
                } else if(rType.includes('referral') || rType.includes('level')) {
                    itemType = "Referral Bonus";
                    itemColor = "text-cyan-400";
                } else if(rType.includes('rank') || rType.includes('lead')) {
                    itemType = "Leadership Reward";
                    itemColor = "text-green-400";
                }
            }

            return {
                date: `Block ${e.blockNumber}`,
                time: "Confirmed",
                amount: format(e.args.amount),
                type: itemType,
                tp: type === 'compounding' ? "0.25%" : "DYNAMIC",
                color: itemColor
            };
        }).reverse();
    } catch (err) {
        console.error("History Error:", err);
        return [];
    }
}

// --- TEAM REPORT ---
async function fetchTeamReport(userAddress, level) {
    const tableBody = document.getElementById('team-table-body');
    if(!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-yellow-500 animate-pulse text-[10px] orbitron">SCANNING BLOCKCHAIN...</td></tr>`;

    try {
        const filter = contract.filters.Registered(null, userAddress);
        const logs = await contract.queryFilter(filter);

        if(logs.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-gray-500 text-[10px] orbitron">NO TEAM MEMBERS FOUND</td></tr>`;
            return;
        }

        tableBody.innerHTML = "";
        for (let log of logs) {
            const memberAddr = log.args.user;
            const memberData = await contract.users(memberAddr);
            
            const row = document.createElement('tr');
            row.className = "border-b border-white/5 hover:bg-white/5 transition-all text-[11px]";
            row.innerHTML = `
                <td class="p-4 text-green-400 font-mono font-bold">${memberAddr.substring(0,6)}...${memberAddr.substring(38)}</td>
                <td class="orbitron">LVL ${level}</td>
                <td class="font-bold">$ ${format(memberData.totalDeposited)}</td>
                <td class="font-bold">$ ${format(memberData.teamTotalDeposit)}</td>
                <td class="font-bold">$ ${format(memberData.totalActiveDeposit)}</td>
                <td class="text-yellow-500 font-bold">$ 0.00</td>
                <td class="text-gray-400">${new Date(memberData.joinDate * 1000).toLocaleDateString()}</td>
            `;
            tableBody.appendChild(row);
        }
    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-red-500">Node Connection Error</td></tr>`;
    }
}

// --- UTILITIES ---
const format = (val) => ethers.utils.formatUnits(val || 0, 18);
const updateText = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
const getRankName = (r) => ["Inviter", "Promoter", "Leader", "Partner", "Star", "Royal Star", "Crown Star"][r] || "NONE (-)";

function loadLevelData(val) {
    signer.getAddress().then(addr => fetchTeamReport(addr, val));
}

// --- ACTIONS ---
window.handleClaim = async function() {
    try {
        const tx = await contract.claimDailyReward(0);
        await tx.wait();
        location.reload();
    } catch (err) { console.error(err); }
}

window.handleCompoundDaily = async function() {
    try {
        const tx = await contract.compoundDailyReward(0);
        await tx.wait();
        location.reload();
    } catch (err) { console.error(err); }
}

window.handleCapitalWithdraw = async function() {
    try {
        const ok = confirm("Are you sure? Principal withdrawal will stop your rewards.");
        if(!ok) return;
        const tx = await contract.withdrawPrincipal();
        await tx.wait();
        location.reload();
    } catch (err) { console.error(err); }
}

window.showHistory = async function(type) {
    const container = document.getElementById('history-container');
    if(!container) return;
    
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.getElementById('btn-' + type);
    if(activeBtn) activeBtn.classList.add('active');
    
    container.innerHTML = `<div class="p-10 text-center animate-pulse text-yellow-500 text-[10px] orbitron tracking-widest">SCANNING BLOCKCHAIN...</div>`;
    
    const logs = await fetchBlockchainHistory(type);
    if(logs.length === 0) {
        container.innerHTML = `<div class="p-10 text-center text-gray-500 text-[10px] orbitron">NO RECORDS FOUND</div>`;
        return;
    }

    container.innerHTML = logs.map(item => `
        <div class="history-card">
            <div class="flex justify-between items-center">
                <div>
                    <p class="text-[10px] font-black ${item.color} uppercase tracking-tighter">${item.type}</p>
                    <p class="text-[10px] font-bold text-gray-500 uppercase mt-1 italic">${item.date}</p>
                </div>
                <div class="text-right">
                    <h3 class="text-lg font-black orbitron ${type === 'income' ? 'text-green-400' : 'text-white'}">
                        ${type === 'income' ? '+' : ''}$ ${item.amount}
                    </h3>
                </div>
            </div>
        </div>
    `).join('');
};

function updateNavbar(addr) {
    const btn = document.getElementById('connect-btn');
    if(btn) btn.innerText = addr.substring(0,6) + "..." + addr.substring(38);
}

// Wallet account change detector
if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) setupApp(accounts[0]);
        else location.reload();
    });
}

window.addEventListener('load', init);