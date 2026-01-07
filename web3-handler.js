let provider, signer, contract, usdtContract;

// --- CONFIGURATION ---
const CONTRACT_ADDRESS = "0x33Ad74E9FB3aeA563baD0Bbe36D3E911c231200A"; 
const USDT_ADDRESS = "0x3b66b1e08f55af26c8ea14a73da64b6bc8d799de"; 
const TESTNET_CHAIN_ID = 97; 

// --- ABI UPDATED ---
const CONTRACT_ABI = [
    "function register(string username, string referrerUsername) external",
    "function deposit(uint256 amount) external",
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

const calculateGlobalROI = (amount) => {
    const amt = parseFloat(amount);
    if (amt >= 5000) return 6.00;
    if (amt >= 2500) return 5.75;
    if (amt >= 1000) return 5.50;
    if (amt >= 500) return 5.25;
    return 5.00;
};

async function init() {
    if (window.ethereum) {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        window.signer = provider.getSigner();
        signer = window.signer;
        window.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        contract = window.contract;
        window.usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, signer);
        usdtContract = window.usdtContract;
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) setupApp(accounts[0]);
    }
}

// --- CORE LOGIC ---
window.handleDeposit = async function() {
    const amountInput = document.getElementById('deposit-amount');
    const depositBtn = document.getElementById('deposit-btn');
    if (!amountInput || !amountInput.value || amountInput.value <= 0) return alert("Please enter a valid USDT amount!");
    const amountInWei = ethers.utils.parseUnits(amountInput.value.toString(), 18);
    try {
        depositBtn.disabled = true;
        depositBtn.innerText = "CHECKING...";
        const userAddress = await signer.getAddress();
        const currentAllowance = await usdtContract.allowance(userAddress, CONTRACT_ADDRESS);
        if (currentAllowance.lt(amountInWei)) {
            depositBtn.innerText = "APPROVE USDT...";
            const approveTx = await usdtContract.approve(CONTRACT_ADDRESS, ethers.constants.MaxUint256);
            await approveTx.wait();
        }
        depositBtn.innerText = "DEPOSITING...";
        const tx = await contract.deposit(amountInWei, { gasLimit: 500000 });
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
        const tx = await contract.claimDailyReward(totalPending, { gasLimit: 500000 });
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
        const tx = await contract.compoundDailyReward(totalPending, { gasLimit: 500000 });
        await tx.wait();
        location.reload();
    } catch (err) { alert("Compound failed: " + (err.reason || err.message)); }
}

window.claimNetworkReward = async function(amountInWei) {
    try {
        const tx = await contract.claimNetworkReward(amountInWei, { gasLimit: 500000 });
        await tx.wait();
        location.reload();
    } catch (err) { alert("Network claim failed: " + (err.reason || err.message)); }
}

window.compoundNetworkReward = async function(amountInWei) {
    try {
        const tx = await contract.compoundNetworkReward(amountInWei, { gasLimit: 500000 });
        await tx.wait();
        location.reload();
    } catch (err) { alert("Network compound failed: " + (err.reason || err.message)); }
}

window.handleCapitalWithdraw = async function() {
    if (!confirm("Are you sure? This will stop your daily returns.")) return;
    try {
        const tx = await contract.withdrawPrincipal({ gasLimit: 500000 });
        await tx.wait();
        location.reload();
    } catch (err) { alert("Capital withdraw failed: " + (err.reason || err.message)); }
}

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

async function fetchAllData(address) {
    try {
        const [user, extra, live] = await Promise.all([
            contract.users(address),
            contract.usersExtra(address),
            contract.getLiveBalance(address)
        ]);

        if (!user.registered) return;

        const totalActive = format(user.totalActiveDeposit);
        updateText('total-deposit-display', `$ ${format(user.totalDeposited)}`);
        updateText('active-deposit', `$ ${totalActive}`);
        updateText('total-earned', `$ ${format(user.totalEarnings)}`);
        updateText('total-withdrawn', `$ ${format(user.totalWithdrawn)}`);
        updateText('team-count', extra.teamCount.toString());
        updateText('direct-count', extra.directsCount.toString());
        updateText('level-earnings', `$ ${format(extra.rewardsReferral)}`);
        updateText('direct-earnings', `$ ${format(extra.rewardsOnboarding)}`);
        
        const networkBalance = format(extra.reserveNetwork);
        updateText('ref-balance-display', `$ ${parseFloat(networkBalance).toFixed(2)}`);

        const dailyPending = parseFloat(format(live.pendingROI)) + parseFloat(format(live.pendingCap));
        const totalWithdrawable = (dailyPending + parseFloat(networkBalance)).toFixed(2);
        updateText('withdrawable-display', `$ ${totalWithdrawable}`);
        updateText('rank-display', getRankName(extra.rank));

        const baseUrl = window.location.origin + window.location.pathname.split('/').slice(0, -1).join('/');
        const refUrl = `${baseUrl}/register.html?ref=${user.username}`;
        if(document.getElementById('refURL')) document.getElementById('refURL').value = refUrl;

    } catch (err) { console.error("Data Fetch Error:", err); }
}

// --- AAPKA FULL UPDATED TEAM LOADER ---
window.loadLevelData = async function(level) {
    const tableBody = document.getElementById('team-table-body');
    if(!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="7" class="p-10 text-center text-yellow-500 italic">Scanning Blockchain...</td></tr>`;
    
    try {
        const address = await signer.getAddress();
        const res = await contract.getLevelTeamDetails(address, level);
        console.log("Raw Response Debug:", res);

        // Mapping using your specific names logic
        const names = res.names || res[0] || [];
        const wallets = res.wallets || res[1] || [];
        const joinDates = res.joinDates || res[2] || [];
        const activeDeps = res.activeDeps || res[3] || [];
        const teamTotalDeps = res.teamTotalDeps || res[4] || [];

        if (!wallets || wallets.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="p-10 text-center text-gray-400">No users found in Level ${level}</td></tr>`;
            return;
        }
        
        let html = '';
        for(let i=0; i < wallets.length; i++) {
            const uA = wallets[i];
            if (!uA || uA === ethers.constants.AddressZero) continue;

            const uName = (names && names[i]) ? names[i] : "N/A";
            let activeD = "0.00";
            let teamTD = "0.00";
            let jDate = "N/A";

            try {
                if (activeDeps && activeDeps[i]) {
                    activeD = ethers.utils.formatUnits(activeDeps[i].toString(), 18);
                }
                if (teamTotalDeps && teamTotalDeps[i]) {
                    teamTD = ethers.utils.formatUnits(teamTotalDeps[i].toString(), 18);
                }
                if (joinDates && joinDates[i]) {
                    const unixTime = parseInt(joinDates[i].toString());
                    if (unixTime > 0) jDate = new Date(unixTime * 1000).toLocaleDateString();
                }
            } catch (err) { console.warn(`Row ${i} parsing issue:`, err); }

            html += `<tr class="border-b border-white/5 hover:bg-white/10 transition-all">
                <td class="p-4 font-mono text-yellow-500 text-[10px]">
                    <div class="flex flex-col">
                        <span>${uA.substring(0,8)}...${uA.substring(34)}</span>
                        <span class="text-[8px] text-gray-400 font-sans uppercase">${uName}</span>
                    </div>
                </td>
                <td class="p-4 text-xs font-bold text-gray-400">Lvl ${level}</td>
                <td class="p-4 text-xs font-black text-white">$${parseFloat(activeD).toFixed(2)}</td>
                <td class="p-4 text-xs text-gray-400">$${parseFloat(teamTD).toFixed(2)}</td>
                <td class="p-4 text-xs text-green-400 font-bold">$${parseFloat(activeD).toFixed(2)}</td>
                <td class="p-4 text-xs text-yellow-500 italic uppercase font-black">
                    ${parseFloat(activeD) > 0 ? 'ACTIVE' : 'INACTIVE'}
                </td>
                <td class="p-4 text-[10px] text-gray-500">${jDate}</td>
            </tr>`;
        }
        tableBody.innerHTML = html;
    } catch (e) { 
        console.error("Critical Fetch Error:", e);
        tableBody.innerHTML = `<tr><td colspan="7" class="p-10 text-center text-red-500">Sync Error: ${e.message}</td></tr>`; 
    }
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

const format = (val) => {
    try {
        if (!val) return "0.00";
        return ethers.utils.formatUnits(val.toString(), 18);
    } catch (e) { return "0.00"; }
};

const updateText = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
const getRankName = (r) => ["Inviter", "Promoter", "Leader", "Partner", "Star", "Royal Star", "Crown Star"][r] || "NONE (-)";

function updateNavbar(addr) {
    const btn = document.getElementById('connect-btn');
    if(btn) btn.innerText = addr.substring(0,6) + "..." + addr.substring(38);
}

if (window.ethereum) window.ethereum.on('accountsChanged', () => location.reload());
window.addEventListener('load', init);
