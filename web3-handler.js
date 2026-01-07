let provider, signer, contract, usdtContract;

// --- CONFIGURATION ---
const CONTRACT_ADDRESS = "0x33Ad74E9FB3aeA563baD0Bbe36D3E911c231200A"; 
const USDT_ADDRESS = "0x3b66b1e08f55af26c8ea14a73da64b6bc8d799de"; 
const TESTNET_CHAIN_ID = 97; 

const RANK_DETAILS = [
    { name: "NONE", roi: "0%", targetTeam: 0, targetVolume: 0 },
    { name: "Inviter", roi: "0.50%", targetTeam: 50, targetVolume: 2500 },
    { name: "Promoter", roi: "1.00%", targetTeam: 100, targetVolume: 5000 },
    { name: "Leader", roi: "1.50%", targetTeam: 200, targetVolume: 10000 },
    { name: "Partner", roi: "2.00%", targetTeam: 400, targetVolume: 15000 },
    { name: "Star", roi: "3.00%", targetTeam: 800, targetVolume: 25000 },
    { name: "Royal Star", roi: "4.00%", targetTeam: 1500, targetVolume: 50000 },
    { name: "Crown Star", roi: "5.00%", targetTeam: 2500, targetVolume: 100000 }
];

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

async function setupApp(address) {
    const { chainId } = await provider.getNetwork();
    if (chainId !== TESTNET_CHAIN_ID) { alert("Please switch to BSC Testnet!"); return; }

    const userData = await contract.users(address);
    if (!userData.registered && !window.location.pathname.includes('register.html') && !window.location.pathname.includes('login.html')) {
        window.location.href = "register.html";
        return;
    }

    updateNavbar(address);
    const path = window.location.pathname;
    if (path.includes('index1.html')) { fetchAllData(address); start8HourCountdown(); }
    if (path.includes('leadership.html')) { fetchLeadershipData(address); }
}

// --- HISTORY PAGE LOGIC (DEPOSITS, INCOME, WITHDRAWALS) ---
window.fetchBlockchainHistory = async function(type) {
    try {
        const address = await signer.getAddress();
        let filter;

        if (type === 'deposit') filter = contract.filters.Deposited(address);
        else if (type === 'compounding') filter = contract.filters.Compounded(address);
        else filter = contract.filters.RewardClaimed(address);

        const logs = await contract.queryFilter(filter, -10000, "latest");

        const history = await Promise.all(logs.map(async (log) => {
            const block = await log.getBlock();
            const dateObj = new Date(block.timestamp * 1000);
            const amount = format(log.args.amount);
            const rType = (log.args.rewardType || "").toLowerCase();

            // Withdrawal Actions check (Daily, Network, Principal)
            const isWithdrawAction = rType.includes('withdraw') || rType.includes('claim') || rType.includes('principal');

            if (type === 'withdrawal' && !isWithdrawAction) return null;
            if (type === 'income' && isWithdrawAction) return null;

            let label = rType.toUpperCase() || "TRANSACTION";
            let color = "text-cyan-400";

            if (rType.includes('principal')) { label = "CAPITAL WITHDRAW"; color = "text-red-500"; }
            else if (rType.includes('daily')) { label = "DAILY WITHDRAW"; }
            else if (rType.includes('network')) { label = "NETWORK WITHDRAW"; }

            return {
                date: dateObj.toLocaleDateString(),
                time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                amount: parseFloat(amount).toFixed(2),
                type: label,
                color: color
            };
        }));

        return history.filter(item => item !== null).reverse();
    } catch (err) { console.error(err); return []; }
};

// --- CORE FUNCTIONS (ACTIONS) ---
window.handleDeposit = async function() {
    const amountInput = document.getElementById('deposit-amount');
    const depositBtn = document.getElementById('deposit-btn');
    if (!amountInput || !amountInput.value || amountInput.value <= 0) return alert("Enter amount!");
    const amountInWei = ethers.utils.parseUnits(amountInput.value.toString(), 18);
    try {
        depositBtn.innerText = "APPROVING...";
        const userAddress = await signer.getAddress();
        const currentAllowance = await usdtContract.allowance(userAddress, CONTRACT_ADDRESS);
        if (currentAllowance.lt(amountInWei)) {
            const tx = await usdtContract.approve(CONTRACT_ADDRESS, ethers.constants.MaxUint256);
            await tx.wait();
        }
        depositBtn.innerText = "DEPOSITING...";
        const tx = await contract.deposit(amountInWei, { gasLimit: 500000 });
        await tx.wait();
        location.reload();
    } catch (err) { alert(err.reason || err.message); depositBtn.innerText = "DEPOSIT NOW"; }
};

window.handleClaim = async function() {
    try {
        const live = await contract.getLiveBalance(await signer.getAddress());
        const total = live.pendingROI.add(live.pendingCap);
        if (total.lte(0)) return alert("No rewards!");
        const tx = await contract.claimDailyReward(total, { gasLimit: 500000 });
        await tx.wait(); location.reload();
    } catch (err) { alert(err.reason || err.message); }
};

window.handleCapitalWithdraw = async function() {
    if (!confirm("Confirm Capital Withdrawal? This stops returns.")) return;
    try {
        const tx = await contract.withdrawPrincipal({ gasLimit: 500000 });
        await tx.wait(); location.reload();
    } catch (err) { alert(err.reason || err.message); }
};

// --- LEADERSHIP & TEAM ---
async function fetchLeadershipData(address) {
    try {
        const [user, extra] = await Promise.all([contract.users(address), contract.usersExtra(address)]);
        const rIdx = extra.rank;
        const nextIdx = rIdx < 7 ? rIdx + 1 : 7;
        const nextRank = RANK_DETAILS[nextIdx];
        
        updateText('rank-display', RANK_DETAILS[rIdx].name.toUpperCase());
        updateText('team-active-deposit', `$ ${format(user.teamActiveDeposit)}`);
        
        const tPercent = Math.min((extra.teamCount / nextRank.targetTeam) * 100, 100) || 0;
        const vPercent = Math.min((parseFloat(format(user.teamActiveDeposit)) / nextRank.targetVolume) * 100, 100) || 0;

        if(document.getElementById('team-count-bar')) document.getElementById('team-count-bar').style.width = `${tPercent}%`;
        if(document.getElementById('team-volume-bar')) document.getElementById('team-volume-bar').style.width = `${vPercent}%`;

        loadLeadershipDownlines(address, rIdx);
    } catch (err) { console.error(err); }
}

async function loadLeadershipDownlines(address, myRankIdx) {
    const tableBody = document.getElementById('direct-downline-body');
    if(!tableBody) return;
    try {
        const res = await contract.getLevelTeamDetails(address, 1);
        const wallets = res.wallets || res[1] || [];
        const names = res.names || res[0] || [];
        let html = '';
        for(let i=0; i < wallets.length; i++) {
            if (!wallets[i] || wallets[i] === ethers.constants.AddressZero) continue;
            const [dUser, dExtra] = await Promise.all([contract.users(wallets[i]), contract.usersExtra(wallets[i])]);
            const diff = Math.max(parseFloat(RANK_DETAILS[myRankIdx].roi) - parseFloat(RANK_DETAILS[dExtra.rank].roi), 0).toFixed(2);
            html += `<tr class="border-b border-white/5">
                <td class="p-4 text-xs font-bold text-white">${names[i] || 'N/A'}</td>
                <td class="p-4 text-xs text-yellow-500">${RANK_DETAILS[dExtra.rank].name}</td>
                <td class="p-4 text-xs">$${format(dUser.totalActiveDeposit)}</td>
                <td class="p-4 text-xs text-blue-400">${diff}%</td>
                <td class="p-4 text-xs text-gray-400">$${format(dUser.teamActiveDeposit)}</td>
            </tr>`;
        }
        tableBody.innerHTML = html;
    } catch (e) { console.error(e); }
}

async function fetchAllData(address) {
    try {
        const [user, extra, live] = await Promise.all([contract.users(address), contract.usersExtra(address), contract.getLiveBalance(address)]);
        updateText('active-deposit', `$ ${format(user.totalActiveDeposit)}`);
        updateText('total-earned', `$ ${format(user.totalEarnings)}`);
        updateText('total-withdrawn', `$ ${format(user.totalWithdrawn)}`);
        updateText('team-count', extra.teamCount.toString());
        
        const netBal = format(extra.reserveNetwork);
        const daily = parseFloat(format(live.pendingROI)) + parseFloat(format(live.pendingCap));
        updateText('withdrawable-display', `$ ${(daily + parseFloat(netBal)).toFixed(2)}`);
        
        const refUrl = `${window.location.origin}${window.location.pathname.replace('index1.html','register.html')}?ref=${user.username}`;
        if(document.getElementById('refURL')) document.getElementById('refURL').value = refUrl;
    } catch (err) { console.error(err); }
}

// --- UTILS ---
const format = (v) => { try { return ethers.utils.formatUnits(v.toString(), 18); } catch(e) { return "0.00"; } };
const updateText = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
function updateNavbar(addr) { const btn = document.getElementById('connect-btn'); if(btn) btn.innerText = addr.substring(0,6) + "..." + addr.substring(38); }
function start8HourCountdown() {
    const el = document.getElementById('next-timer'); if (!el) return;
    setInterval(() => {
        const now = new Date(); const target = new Date().setHours(now.getHours() < 8 ? 8 : now.getHours() < 16 ? 16 : 24, 0, 0, 0);
        const diff = target - now; if (diff <= 0) return;
        el.innerText = new Date(diff).toISOString().substr(11, 8);
    }, 1000);
}

if (window.ethereum) window.ethereum.on('accountsChanged', () => location.reload());
window.addEventListener('load', init);
