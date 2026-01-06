let provider, signer, contract, usdtContract;

// --- CONFIGURATION ---
const CONTRACT_ADDRESS = "0x33Ad74E9FB3aeA563baD0Bbe36D3E911c231200A"; 
const USDT_ADDRESS = "0x3b66b1e08f55af26c8ea14a73da64b6bc8d799de"; 
const TESTNET_CHAIN_ID = 97; 

const CONTRACT_ABI = [
    "function register(string username, string referrerUsername) external",
    "function deposit(uint256 amount) external",
    "function claimNetworkReward(uint256 amount) external",
    "function compoundDailyReward(uint256 amount) external",
    "function claimDailyReward(uint256 amount) external",
    "function compoundNetworkReward(uint256 amount) external",
    "function withdrawPrincipal() external",
    "function getLevelTeamDetails(address _upline, uint256 _level) view returns (tuple(address uA, string username, uint256 totalDeposited, uint256 teamTotalDeposit, uint256 totalActiveDeposit, uint256 joinDate)[] memory)",
    "function getLiveBalance(address uA) view returns (uint256 pendingROI, uint256 pendingCap)",
    "function users(address) view returns (address referrer, string username, bool registered, uint256 joinDate, uint256 totalActiveDeposit, uint256 teamActiveDeposit, uint256 teamTotalDeposit, uint256 totalDeposited, uint256 totalWithdrawn, uint256 totalEarnings)",
    "function usersExtra(address) view returns (uint256 rewardsReferral, uint256 rewardsOnboarding, uint256 rewardsRank, uint256 reserveDailyCapital, uint256 reserveDailyROI, uint256 reserveNetwork, uint32 teamCount, uint32 directsCount, uint32 directsQuali, uint8 rank)",
    "function getPosition(address uA, uint256 i) view returns (tuple(uint256 amount, uint256 startTime, uint256 lastCheckpoint, uint256 endTime, uint256 earned, uint256 expectedTotalEarn, uint8 source, bool active) v)",
    "function getUserTotalPositions(address uA) view returns (uint256)",
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

// --- ROI TIER CALCULATOR ---
const calculateGlobalROI = (amount) => {
    const amt = parseFloat(amount);
    if (amt >= 5000) return 6.00;
    if (amt >= 2500) return 5.75;
    if (amt >= 1000) return 5.50;
    if (amt >= 500) return 5.25;
    return 5.00;
};

// --- INITIALIZATION ---
async function init() {
    if (window.ethereum) {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        const tempSigner = provider.getSigner();
        window.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, tempSigner);
        contract = window.contract;
        window.usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, tempSigner);
        usdtContract = window.usdtContract;

        const accounts = await provider.listAccounts();
        if (accounts.length > 0) setupApp(accounts[0]);
    }
}

// --- 1. DEPOSIT ACTION ---
window.handleDeposit = async function() {
    const amountInput = document.getElementById('deposit-amount');
    const depositBtn = document.getElementById('deposit-btn');
    if (!amountInput || !amountInput.value || amountInput.value <= 0) return alert("Please enter a valid USDT amount!");
    const rawAmount = amountInput.value;
    const amountInWei = ethers.utils.parseUnits(rawAmount.toString(), 18);
    try {
        depositBtn.disabled = true;
        depositBtn.innerText = "CHECKING CAP...";
        const userAddress = await signer.getAddress();
        const currentAllowance = await usdtContract.allowance(userAddress, CONTRACT_ADDRESS);
        if (currentAllowance.lt(amountInWei)) {
            depositBtn.innerText = "APPROVE USDT...";
            const approveTx = await usdtContract.approve(CONTRACT_ADDRESS, ethers.constants.MaxUint256);
            await approveTx.wait();
        }
        depositBtn.innerText = "CONFIRMING DEPOSIT...";
        const tx = await contract.deposit(amountInWei, { gasLimit: 500000 });
        await tx.wait();
        location.reload(); 
    } catch (err) {
        console.error(err);
        alert("Error: " + (err.reason || err.message));
        depositBtn.innerText = "DEPOSIT NOW";
        depositBtn.disabled = false;
    }
}

// --- 2. WITHDRAW DAILY ROI ---
window.handleClaim = async function() {
    try {
        const userAddress = await signer.getAddress();
        const live = await contract.getLiveBalance(userAddress);
        const totalPending = live.pendingROI.add(live.pendingCap);
        if (totalPending.lte(0)) return alert("No rewards to withdraw!");
        const tx = await contract.claimDailyReward(totalPending, { gasLimit: 500000 });
        await tx.wait();
        location.reload();
    } catch (err) { alert("Withdraw failed: " + (err.reason || err.message)); }
}

// --- 3. COMPOUND DAILY ROI ---
window.handleCompoundDaily = async function() {
    try {
        const userAddress = await signer.getAddress();
        const live = await contract.getLiveBalance(userAddress);
        const totalPending = live.pendingROI.add(live.pendingCap);
        if (totalPending.lte(0)) return alert("No rewards to compound!");
        const tx = await contract.compoundDailyReward(totalPending, { gasLimit: 500000 });
        await tx.wait();
        location.reload();
    } catch (err) { alert("Compound failed: " + (err.reason || err.message)); }
}

// --- NEW: CLAIM NETWORK REWARD ---
window.claimNetworkReward = async function(amountInWei) {
    try {
        const tx = await contract.claimNetworkReward(amountInWei, { gasLimit: 500000 });
        await tx.wait();
        location.reload();
    } catch (err) { alert("Network claim failed: " + (err.reason || err.message)); }
}

// --- NEW: COMPOUND NETWORK REWARD ---
window.compoundNetworkReward = async function(amountInWei) {
    try {
        const tx = await contract.compoundNetworkReward(amountInWei, { gasLimit: 500000 });
        await tx.wait();
        location.reload();
    } catch (err) { alert("Network compound failed: " + (err.reason || err.message)); }
}

// --- 4. CAPITAL WITHDRAWAL ---
window.handleCapitalWithdraw = async function() {
    if (!confirm("Are you sure? This will stop your daily returns.")) return;
    try {
        const tx = await contract.withdrawPrincipal({ gasLimit: 500000 });
        await tx.wait();
        location.reload();
    } catch (err) { alert("Capital withdraw failed: " + (err.reason || err.message)); }
}

// --- LOGIN & REGISTER ---
window.handleLogin = async function() {
    try {
        const accounts = await provider.send("eth_requestAccounts", []);
        const userData = await contract.users(accounts[0]);
        if (userData.registered) window.location.href = "index1.html";
        else { alert("Not registered!"); window.location.href = "register.html"; }
    } catch (err) { console.error(err); }
}

window.handleRegister = async function() {
    const userField = document.getElementById('reg-username');
    const refField = document.getElementById('reg-referrer');
    if (!userField || !refField) return;
    try {
        const tx = await contract.register(userField.value.trim(), refField.value.trim(), { gasLimit: 500000 });
        await tx.wait();
        window.location.href = "index1.html";
    } catch (err) { alert("Error: " + (err.reason || err.message)); }
}

async function setupApp(address) {
    const { chainId } = await provider.getNetwork();
    if (chainId !== TESTNET_CHAIN_ID) { alert("Please switch to BSC Testnet!"); return; }
    window.signer = provider.getSigner();
    signer = window.signer;
    window.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    contract = window.contract;
    window.usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, signer);
    usdtContract = window.usdtContract;
    
    if (window.location.pathname.includes('index1.html')) {
        const userData = await contract.users(address);
        if (!userData.registered) { window.location.href = "register.html"; return; }
    }
    updateNavbar(address);
    fetchAllData(address);
    start8HourCountdown(); 
}

// --- MAIN DATA FETCH ---
async function fetchAllData(address) {
    try {
        const [user, extra, live] = await Promise.all([
            contract.users(address),
            contract.usersExtra(address),
            contract.getLiveBalance(address)
        ]);

        if (!user.registered) return;

        const totalActive = format(user.totalActiveDeposit);
        const roiPercent = calculateGlobalROI(totalActive);

        updateText('total-deposit-display', `$ ${format(user.totalDeposited)}`);
        updateText('active-deposit', `$ ${totalActive}`);
        updateText('total-earned', `$ ${format(user.totalEarnings)}`);
        updateText('total-withdrawn', `$ ${format(user.totalWithdrawn)}`);
        updateText('team-count', extra.teamCount.toString());
        updateText('direct-count', extra.directsCount.toString());
        updateText('level-earnings', `$ ${format(extra.rewardsReferral)}`);
        updateText('direct-earnings', `$ ${format(extra.rewardsOnboarding)}`);

        // ROI Yield with Tiers
        const dailyROI = (parseFloat(totalActive) * (roiPercent / 100)).toFixed(2);
        updateText('projected-return', `$ ${dailyROI}`); 
        
        // Referral Balance Display
        const networkBalance = format(extra.reserveNetwork);
        updateText('ref-balance-display', `$ ${parseFloat(networkBalance).toFixed(2)}`);

        // Combined Withdrawable
        const dailyPending = parseFloat(format(live.pendingROI)) + parseFloat(format(live.pendingCap));
        const totalWithdrawable = (dailyPending + parseFloat(networkBalance)).toFixed(2);
        updateText('withdrawable-display', `$ ${totalWithdrawable}`);
        updateText('compounding-balance', `$ ${totalWithdrawable}`);

        updateText('capital-investment-display', `$ ${totalActive}`);
        updateText('capital-withdrawn-display', `$ ${format(user.totalWithdrawn)}`);
        updateText('rank-display', getRankName(extra.rank));

        const cpVal = Math.floor(parseFloat(totalActive) / 100);
        updateText('cp-display', cpVal);

        const badge = document.getElementById('status-badge');
        if(badge && parseFloat(totalActive) > 0) {
            badge.innerText = `● Active (${roiPercent.toFixed(2)}%)`;
            badge.className = "px-4 py-1 rounded-full bg-green-500/20 text-green-400 text-[10px] font-black border border-green-500/30 uppercase";
        }

        const baseUrl = window.location.origin + window.location.pathname.split('/').slice(0, -1).join('/');
        const refUrl = `${baseUrl}/register.html?ref=${user.username}`;
        if(document.getElementById('refURL')) document.getElementById('refURL').value = refUrl;

    } catch (err) { console.error("Data Fetch Error:", err); }
}

// --- TEAM DETAILS LOADER (FOR REFERRAL PAGE) ---
window.loadLevelData = async function(level) {
    const tableBody = document.getElementById('team-table-body');
    if(!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="7" class="p-10 text-center text-yellow-500">Loading Level ${level}...</td></tr>`;
    try {
        const address = await signer.getAddress();
        const team = await contract.getLevelTeamDetails(address, level);
        if (!team || team.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="p-10 text-center text-gray-500 italic">No users in Level ${level}</td></tr>`;
            return;
        }
        let html = '';
        team.forEach(m => {
            if (m.uA !== "0x0000000000000000000000000000000000000000") {
                html += `<tr class="border-b border-white/5">
                    <td class="p-4 font-mono text-yellow-500">${m.uA.substring(0,6)}...${m.uA.substring(38)}</td>
                    <td class="p-4 text-xs font-bold text-gray-400">Lvl ${level}</td>
                    <td class="p-4 text-xs font-black text-white">$${parseFloat(format(m.totalDeposited)).toFixed(2)}</td>
                    <td class="p-4 text-xs text-gray-400">$${parseFloat(format(m.teamTotalDeposit)).toFixed(2)}</td>
                    <td class="p-4 text-xs text-green-400 font-bold">$${parseFloat(format(m.totalActiveDeposit)).toFixed(2)}</td>
                    <td class="p-4 text-xs text-yellow-500">${parseFloat(format(m.totalActiveDeposit)) > 0 ? 'ACTIVE' : 'INACTIVE'}</td>
                    <td class="p-4 text-[10px] text-gray-500">${new Date(m.joinDate * 1000).toLocaleDateString()}</td>
                </tr>`;
            }
        });
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
        const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        timerElement.innerText = `${h}:${m}:${s}`;
    }, 1000);
}

const format = (val) => ethers.utils.formatUnits(val || 0, 18);
const updateText = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
const getRankName = (r) => ["Inviter", "Promoter", "Leader", "Partner", "Star", "Royal Star", "Crown Star"][r] || "NONE (-)";

function updateNavbar(addr) {
    const btn = document.getElementById('connect-btn');
    if(btn) btn.innerText = addr.substring(0,6) + "..." + addr.substring(38);
}

if (window.ethereum) window.ethereum.on('accountsChanged', () => location.reload());
window.addEventListener('load', init);
