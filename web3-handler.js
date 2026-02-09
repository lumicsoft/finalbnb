let provider, signer, contract, Contract;

// --- CONFIGURATION ---
const CONTRACT_ADDRESS = "0x7f4b3f6e015e96a5394f502c89fea2880b901aa5"; 
const TESTNET_CHAIN_ID = 97; 

// --- RANK CONFIG FOR LEADERSHIP (Updated: Removed ROI, Added Rewards) ---
const RANK_DETAILS = [
   { name: "NONE", reward: "0 BNB", powerReq: 0, otherReq: 0 },
    { name: "V1", reward: "0.01 BNB", powerReq: 0.05, otherReq: 0.05 },
    { name: "V2", reward: "0.02 BNB", powerReq: 0.1, otherReq: 0.1},
    { name: "V3", reward: "0.03 BNB", powerReq: 0.15, otherReq: 0.15 },
    { name: "V4", reward: "0.04 BNB", powerReq: 0.2, otherReq: 0.2 },
    { name: "V5", reward: "0.05 BNB", powerReq: 0.25, otherReq: 0.25 },
    { name: "V6", reward: "0.06 BNB", powerReq: 0.3, otherReq: 0.3 },
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
   "function usersExtra(address) view returns (uint256 rewardsReferral, uint256 rewardsOnboarding, uint256 rewardsRank, uint256 reserveDailyCapital, uint256 reserveDailyROI, uint256 reserveNetwork, uint32 teamCount, uint32 directsCount, uint32 directsQuali, uint8 rank, uint256 maxLegBusiness, uint256 totalTeamBusiness)",
    "function getPosition(address uA, uint256 i) view returns (tuple(uint256 amount, uint256 startTime, uint256 lastCheckpoint, uint256 endTime, uint256 earned, uint256 expectedTotalEarn, uint8 source, bool active) v)",
    "function getUserTotalPositions(address uA) view returns (uint256)",
    "function getUserHistory(address _user) view returns (tuple(string txType, uint256 amount, uint256 timestamp, string detail)[])"
];


const calculateGlobalROI = (amount) => {
    const amt = parseFloat(amount);
    if (amt >= 0.256) return 5.50; // New Logic
    if (amt >= 0.112) return 5.25; // New Logic
    return 5.00;                  // Base ROI
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
// --- INITIALIZATION ---
async function init() {
    checkReferralURL();
    
    const bscTestnetRPC = "https://data-seed-prebsc-1-s1.binance.org:8545/";
    const savedAddr = localStorage.getItem('userAddress');
    const isIndexPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';

    try {
        if (window.ethereum) {
           
            provider = new ethers.providers.Web3Provider(window.ethereum, "any");
            
            window.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
            contract = window.contract;

            // --- CONDITION START ---
            if (isIndexPage) {
                
                if (savedAddr) {
                    await setupReadOnly(bscTestnetRPC, savedAddr);
                }
            } else {
               
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    const address = accounts[0];
                    localStorage.setItem('userAddress', address);
                    signer = provider.getSigner();
                    window.signer = signer;
                    window.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
                    contract = window.contract;
                    await setupApp(address);
                } else if (savedAddr) {
                    await setupReadOnly(bscTestnetRPC, savedAddr);
                }
            }
            // --- CONDITION END ---

       
            window.ethereum.on('chainChanged', () => window.location.reload());
            window.ethereum.on('accountsChanged', (accs) => {
                if (accs.length === 0) localStorage.removeItem('userAddress');
                else localStorage.setItem('userAddress', accs[0]);
                window.location.reload();
            });

        } else {
           
            await setupReadOnly(bscTestnetRPC, savedAddr);
        }
    } catch (error) { 
        console.error("Init Error:", error);
        if (savedAddr) await setupReadOnly(bscTestnetRPC, savedAddr);
    }
}

async function setupReadOnly(rpcUrl, forcedAddress = null) {
    console.log("Mode: RPC/Memory Data Loading...");
    try {
        const tempProvider = new ethers.providers.JsonRpcProvider(rpcUrl);
        
        provider = tempProvider; 
        window.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, tempProvider);
        contract = window.contract;
        
        const addressToUse = forcedAddress || localStorage.getItem('userAddress');
        
        if (addressToUse && addressToUse !== "undefined" && addressToUse !== null) {
            await setupApp(addressToUse);
        }
    } catch (e) {
        console.error("RPC Setup Failed:", e);
    }
}


// --- CORE LOGIC ---
window.handleDeposit = async function() {
    const amountInput = document.getElementById('deposit-amount');
    const depositBtn = document.getElementById('deposit-btn');
    
    // 1. Validation check
    if (!amountInput || !amountInput.value || parseFloat(amountInput.value) <= 0) {
        return alert("Please enter a valid BNB amount!");
    }

    try {
        // Signer aur Contract check
        let activeSigner = window.signer || (typeof signer !== 'undefined' ? signer : null);
        let activeContract = window.contract || (typeof contract !== 'undefined' ? contract : null);

        // --- FIX 1: Connection Priority ---
        if (!activeSigner || !window.ethereum) {
            if (!window.ethereum) return alert("Please use Trust Wallet or MetaMask browser!");
            
            const tempProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
            // Trust Wallet ke liye requestAccounts zyada stable hai
            const accounts = await tempProvider.send("eth_requestAccounts", []);
            activeSigner = tempProvider.getSigner();
            activeContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, activeSigner);
                                    
            window.signer = activeSigner;
            window.contract = activeContract;
        }

        // UI Updates
        depositBtn.disabled = true;
        depositBtn.innerText = "CONFIRMING...";

        // BNB ko Wei mein convert karein
        const amountInWei = ethers.utils.parseEther(amountInput.value.toString());

        // --- FIX 2: Dynamic Gas Estimation ---
        // Direct manual gas 300,000 dene se kabhi kabhi "Out of Gas" aata hai.
        // Isliye pehle estimate karein, fir buffer add karein.
        let gasLimit;
        try {
            const estimatedGas = await activeContract.estimateGas.deposit({ value: amountInWei });
            // Add 20% buffer to estimated gas for mobile stability
            gasLimit = estimatedGas.mul(120).div(100);
        } catch (gasErr) {
            console.warn("Gas estimation failed, using fallback.");
            gasLimit = 500000; // Safe fallback
        }

        // 2. Deposit Logic
        const tx = await activeContract.deposit({ 
            value: amountInWei,
            gasLimit: gasLimit 
        });
        
        depositBtn.innerText = "PROCESSING...";
        console.log("TX Hash:", tx.hash);

        // 3. Wait for confirmation
        const receipt = await tx.wait();
        
        if(receipt.status === 1) {
            alert("Deposit Successful!");
            location.reload(); 
        } else {
            throw new Error("Transaction reverted on chain");
        }

    } catch (err) {
        console.error("Deposit Error:", err);
        
        let errorMsg = "Transaction Failed";
        // Trust Wallet/MetaMask specific error handling
        if (err.code === 4001 || err.code === 'ACTION_REJECTED') {
            errorMsg = "User rejected transaction";
        } else if (err.data && err.data.message) {
            errorMsg = err.data.message;
        } else if (err.reason) {
            errorMsg = err.reason;
        }
        
        alert("Error: " + errorMsg);
        
        depositBtn.innerText = "DEPOSIT NOW";
        depositBtn.disabled = false;
    }
}

window.handleClaim = async function() {
    const claimBtn = event.target;
    const originalText = claimBtn.innerText;

    try {
        // 1. STABLE CONNECTION LOGIC (From your perfect code)
        let activeSigner = window.signer || signer;
        let activeContract = window.contract || contract;

        if (!activeSigner || !window.ethereum) {
            if (!window.ethereum) return alert("Please use Trust Wallet or MetaMask browser!");
            
            const tempProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
            await tempProvider.send("eth_requestAccounts", []);
            activeSigner = tempProvider.getSigner();
            activeContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, activeSigner);
            
            window.signer = activeSigner;
            window.contract = activeContract;
        }

        // 2. DATA CALCULATION (From your current project)
        const userAddress = await activeSigner.getAddress();
        
        // UI Updates
        claimBtn.disabled = true;
        claimBtn.innerText = "CALCULATING...";

        const extra = await activeContract.usersExtra(userAddress);
        const live = await activeContract.getLiveBalance(userAddress);
        
        // Combine all rewards
        const totalPending = live.pendingROI.add(live.pendingCap)
                                     .add(extra.reserveDailyROI)
                                     .add(extra.reserveDailyCapital);
                                     
        if (totalPending.lte(0)) {
            claimBtn.disabled = false;
            claimBtn.innerText = originalText;
            return alert("No rewards to withdraw!");
        }

        // 3. TRANSACTION EXECUTION
        claimBtn.innerText = "SIGNING...";

        // Note: activeContract.claimDailyReward use kar rahe hain jo parameter leta hai
        const tx = await activeContract.claimDailyReward(totalPending, {
            gasLimit: 500000 // Mobile safe gas limit
        });
        
        claimBtn.innerText = "CLAIMING...";
        console.log("Claim tx sent:", tx.hash);
        
        await tx.wait();
        
        alert("Rewards Claimed Successfully!");
        location.reload(); 

    } catch (err) {
        console.error("Claim Error:", err);
        alert("Claim failed: " + (err.reason || err.message || "User rejected or error occurred"));
        
        // Reset Button on Error
        claimBtn.innerText = originalText;
        claimBtn.disabled = false;
    }
}
window.handleCompoundDaily = async function() {
    const compoundBtn = event.target;
    const originalText = compoundBtn.innerText;

    try {
        // 1. STABLE CONNECTION LOGIC (Trust Wallet Support)
        let activeSigner = window.signer || signer;
        let activeContract = window.contract || contract;

        if (!activeSigner || !window.ethereum) {
            if (!window.ethereum) return alert("Please use Trust Wallet or MetaMask browser!");
            
            const tempProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
            await tempProvider.send("eth_requestAccounts", []);
            activeSigner = tempProvider.getSigner();
            activeContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, activeSigner);
            
            window.signer = activeSigner;
            window.contract = activeContract;
        }

        const userAddress = await activeSigner.getAddress();
        
        // UI Updates
        compoundBtn.disabled = true;
        compoundBtn.innerText = "CALCULATING...";

        // 2. DATA CALCULATION
        const extra = await activeContract.usersExtra(userAddress);
        const live = await activeContract.getLiveBalance(userAddress);
        
        // Sabhi compoundable rewards ka total
        const totalPending = live.pendingROI.add(live.pendingCap)
                                     .add(extra.reserveDailyROI)
                                     .add(extra.reserveDailyCapital);
                                     
        if (totalPending.lte(0)) {
            compoundBtn.disabled = false;
            compoundBtn.innerText = originalText;
            return alert("No rewards to compound!");
        }

        // 3. TRANSACTION EXECUTION
        compoundBtn.innerText = "SIGNING...";

        // Compounding mein gas zyada lagti hai kyunki balance deposit mein add hota hai
        const tx = await activeContract.compoundDailyReward(totalPending, {
            gasLimit: 600000 // Thoda extra safety ke liye
        });
        
        compoundBtn.innerText = "COMPOUNDING...";
        console.log("Compound tx sent:", tx.hash);
        
        await tx.wait();
        
        alert("Compounded Successfully!");
        location.reload(); 

    } catch (err) {
        console.error("Compound Error:", err);
        alert("Compound failed: " + (err.reason || err.message || "User rejected or error occurred"));
        
        // Reset Button on Error
        compoundBtn.innerText = originalText;
        compoundBtn.disabled = false;
    }
}

window.claimNetworkReward = async function(amountInWei) {
    const claimBtn = event.target;
    const originalText = claimBtn ? claimBtn.innerText : "CLAIM";

    try {
        // 1. STABLE CONNECTION LOGIC (Trust Wallet Support)
        let activeSigner = window.signer || signer;
        let activeContract = window.contract || contract;

        if (!activeSigner || !window.ethereum) {
            if (!window.ethereum) return alert("Please use Trust Wallet or MetaMask browser!");
            
            const tempProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
            await tempProvider.send("eth_requestAccounts", []);
            activeSigner = tempProvider.getSigner();
            activeContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, activeSigner);
            
            window.signer = activeSigner;
            window.contract = activeContract;
        }

        // 2. VALIDATION
        if (!amountInWei || amountInWei.lte(0)) {
            return alert("No network rewards available to claim!");
        }

        // UI Updates
        if (claimBtn && claimBtn.disabled !== undefined) {
            claimBtn.disabled = true;
            claimBtn.innerText = "SIGNING...";
        }

        // 3. TRANSACTION EXECUTION
        // Network rewards claim karte waqt aksar referral trees update hote hain, isliye 500k gas safe hai
        const tx = await activeContract.claimNetworkReward(amountInWei, {
            gasLimit: 500000 
        });
        
        if (claimBtn) claimBtn.innerText = "CLAIMING...";
        console.log("Network claim tx sent:", tx.hash);
        
        await tx.wait();
        
        alert("Network Rewards Claimed Successfully!");
        location.reload(); 

    } catch (err) {
        console.error("Network Claim Error:", err);
        alert("Network claim failed: " + (err.reason || err.message || "User rejected or error occurred"));
        
        // Reset Button on Error
        if (claimBtn) {
            claimBtn.innerText = originalText;
            claimBtn.disabled = false;
        }
    }
}
window.compoundNetworkReward = async function(amountInWei) {
    const compoundBtn = event.target;
    const originalText = compoundBtn ? compoundBtn.innerText : "COMPOUND";

    try {
        // 1. STABLE CONNECTION LOGIC (Trust Wallet Support)
        let activeSigner = window.signer || signer;
        let activeContract = window.contract || contract;

        if (!activeSigner || !window.ethereum) {
            if (!window.ethereum) return alert("Please use Trust Wallet or MetaMask browser!");
            
            const tempProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
            await tempProvider.send("eth_requestAccounts", []);
            activeSigner = tempProvider.getSigner();
            activeContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, activeSigner);
            
            window.signer = activeSigner;
            window.contract = activeContract;
        }

        // 2. VALIDATION
        if (!amountInWei || amountInWei.lte(0)) {
            return alert("No network rewards available to compound!");
        }

        // UI Updates
        if (compoundBtn && compoundBtn.disabled !== undefined) {
            compoundBtn.disabled = true;
            compoundBtn.innerText = "SIGNING...";
        }

        // 3. TRANSACTION EXECUTION
        // Compounding mein state updates zyada hote hain, isliye 600k gas safe hai
        const tx = await activeContract.compoundNetworkReward(amountInWei, {
            gasLimit: 600000 
        });
        
        if (compoundBtn) compoundBtn.innerText = "COMPOUNDING...";
        console.log("Network compound tx sent:", tx.hash);
        
        await tx.wait();
        
        alert("Network Rewards Compounded Successfully!");
        location.reload(); 

    } catch (err) {
        console.error("Network Compound Error:", err);
        alert("Network compound failed: " + (err.reason || err.message || "User rejected or error occurred"));
        
        // Reset Button on Error
        if (compoundBtn) {
            compoundBtn.innerText = originalText;
            compoundBtn.disabled = false;
        }
    }
}

window.handleCapitalWithdraw = async function() {
    // 1. Pehle Confirmation (User ki safety ke liye)
    if (!confirm("Are you sure? This will withdraw your full principal and stop your daily returns!")) return;

    const withdrawBtn = event.target;
    const originalText = withdrawBtn ? withdrawBtn.innerText : "WITHDRAW CAPITAL";

    try {
        // 2. STABLE CONNECTION LOGIC (Trust Wallet Support)
        let activeSigner = window.signer || signer;
        let activeContract = window.contract || contract;

        if (!activeSigner || !window.ethereum) {
            if (!window.ethereum) return alert("Please use Trust Wallet or MetaMask browser!");
            
            const tempProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
            await tempProvider.send("eth_requestAccounts", []);
            activeSigner = tempProvider.getSigner();
            activeContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, activeSigner);
            
            window.signer = activeSigner;
            window.contract = activeContract;
        }

        // UI Updates
        if (withdrawBtn && withdrawBtn.disabled !== undefined) {
            withdrawBtn.disabled = true;
            withdrawBtn.innerText = "SIGNING...";
        }

        // 3. TRANSACTION EXECUTION
        // Principal withdraw mein contract kaafi saare resets karta hai, isliye 500k gas safe hai
        const tx = await activeContract.withdrawPrincipal({
            gasLimit: 500000 
        });
        
        if (withdrawBtn) withdrawBtn.innerText = "WITHDRAWING...";
        console.log("Capital withdraw tx sent:", tx.hash);
        
        await tx.wait();
        
        alert("Capital Withdrawn Successfully!");
        location.reload(); 

    } catch (err) {
        console.error("Capital Withdraw Error:", err);
        alert("Capital withdraw failed: " + (err.reason || err.message || "User rejected or error occurred"));
        
        // Reset Button on Error
        if (withdrawBtn) {
            withdrawBtn.innerText = originalText;
            withdrawBtn.disabled = false;
        }
    }
}

window.handleLogin = async function() {
    try {
        if (!window.ethereum) return alert("Please install Trust Wallet or MetaMask!");

        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length === 0) return;
        const userAddress = accounts[0]; 

        const tempProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
        const { chainId } = await tempProvider.getNetwork();

        // Check if on BSC Testnet (97)
        if (chainId !== TESTNET_CHAIN_ID) {
            alert("Please switch your wallet to BSC Testnet (Chain 97)!");
            return;
        }

        const tempSigner = tempProvider.getSigner();
        const tempContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, tempSigner);

        provider = tempProvider;
        signer = tempSigner;
        contract = tempContract;

        const userData = await contract.users(userAddress);

        if (userData.registered === true) {
            localStorage.setItem('userAddress', userAddress);
            localStorage.removeItem('manualLogout');
            
            if(typeof showLogoutIcon === "function") showLogoutIcon(userAddress);
            
            window.location.href = "index1.html";
        } else {
            alert("User Are Not registered ! Plz  Registration...");
            window.location.href = "register.html";
        }
    } catch (err) { 
        console.error("Login Error:", err);
        alert("Login failed! Make sure your wallet is connected to BSC Testnet."); 
    }
}

window.handleRegister = async function() {
    const userField = document.getElementById('reg-username');
    const refField = document.getElementById('reg-referrer');
    const regBtn = event.target; // Button ko pakadne ke liye
    
    if (!userField || !refField) return;

    const username = userField.value.trim();
    const referrer = refField.value.trim();

    if (!username || !referrer) {
        alert("Username and Referrer are required!");
        return;
    }

    try {
      
        let activeSigner = window.signer || signer;
        let activeContract = window.contract || contract;

        if (!activeSigner || !window.ethereum) {
            if (!window.ethereum) return alert("Please use Trust Wallet/MetaMask browser!");
            
            const tempProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
            await tempProvider.send("eth_requestAccounts", []);
            activeSigner = tempProvider.getSigner();
            activeContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, activeSigner);
            
            window.signer = activeSigner;
            window.contract = activeContract;
        }

        // ---  NETWORK AUTO-SWITCH (BSC Testnet: 97) ---
        const network = await activeSigner.provider.getNetwork();
        if (network.chainId !== 97) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0x61' }], // 0x61 = 97
                });
            } catch (switchError) {
                alert("Please switch your wallet to BSC Testnet manually!");
                return;
            }
        }

        regBtn.disabled = true;
        regBtn.innerText = "CHECKING...";

        
        console.log("Registering username:", username);
        
        // Manual gas limit for Trust Wallet stability
        const tx = await activeContract.register(username, referrer, {
            gasLimit: 500000 
        });

        regBtn.innerText = "CONFIRMING...";
        console.log("Tx Hash:", tx.hash);

        await tx.wait();
        
        
        localStorage.removeItem('manualLogout');
        localStorage.setItem('userAddress', await activeSigner.getAddress()); 
        
        alert("Registration Successful!");
        window.location.href = "index1.html";

    } catch (err) { 
        console.error("Register Error:", err);
        regBtn.disabled = false;
        regBtn.innerText = "REGISTER NOW";

        if (err.code === 4001 || err.message.includes("user rejected")) {
            alert("Transaction rejected by user.");
        } else {
            alert("Error: " + (err.reason || "Username might be taken or balance is low."));
        }
    }
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
    if (!address || address === "undefined") return;
    
    localStorage.setItem('userAddress', address);
    const network = await provider.getNetwork();
    if (network.chainId !== TESTNET_CHAIN_ID) { 
        alert("Please switch your wallet to BSC Testnet (Chain 97)!"); 
        return; 
    }

    const activeContract = window.contract || contract;
    const userData = await activeContract.users(address);
    const path = window.location.pathname;

    // Registration Logic
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
        setTimeout(() => fetchAllData(address), 300);
        start8HourCountdown(); 
    }
    if (path.includes('leadership.html')) {
        setTimeout(() => fetchLeadershipData(address), 300);
    }
    if (path.includes('history.html')) {
        setTimeout(() => window.showHistory('deposit'), 300);
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
        // 1. Connection Guard (Trust Wallet support)
        let activeSigner = window.signer || (typeof signer !== 'undefined' ? signer : null);
        let activeContract = window.contract || (typeof contract !== 'undefined' ? contract : null);

        // Agar signer nahi hai toh temporary provider se connect karo (Read-only ke liye)
        if (!activeSigner && window.ethereum) {
            const tempProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
            activeSigner = tempProvider.getSigner();
            activeContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, activeSigner);
        }

        if (!activeSigner) return [];

        const address = await activeSigner.getAddress();
        
        // Contract se raw history mangwayenge
        const rawHistory = await activeContract.getUserHistory(address);
        
        const processedLogs = rawHistory.map(item => {
            const txType = (item.txType || "").toUpperCase(); 
            const detail = (item.detail || "").toUpperCase();
            const dt = new Date(item.timestamp.toNumber() * 1000);
            
            let match = false;
            
            // 2. Logic Implementation (Wahi jo aapne diya tha)
            if (type === 'deposit' && txType === 'DEPOSIT') match = true;
            
            if (type === 'compounding' && (txType.includes('COMPOUND') || detail.includes('COMPOUND') || txType === 'REINVEST')) match = true;
            
            if (type === 'income') {
                const incomeKeywords = ['INCOME', 'REFERRAL', 'RANK', 'ONBOARDING', 'LEVEL', 'NETWORK', 'REWARD', 'ROI'];
                if (incomeKeywords.some(k => txType.includes(k) || detail.includes(k))) match = true;
            }
            
            if (type === 'withdrawal' && (txType === 'CAPITAL' || detail.includes('CLAIM') || detail.includes('WITHDRAW') || txType.includes('WITHDRAW'))) match = true;

            if (!match) return null;

            // 3. Formatting
            return {
                type: txType.replace('_', ' '),
                // Yahan ensure karein 'format' function BNB ke liye sahi decimals use kar raha hai
                amount: typeof format === 'function' ? format(item.amount) : ethers.utils.formatEther(item.amount),
                date: dt.toLocaleDateString(),
                time: dt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                ts: item.timestamp.toNumber(),
                detail: item.detail,
                // UI Colors
                color: (type === 'income' || type === 'deposit') ? 'text-cyan-400' : 'text-yellow-500'
            };
        });

        // Null hatana aur Latest record upar dikhana
        return processedLogs.filter(l => l !== null).sort((a, b) => b.ts - a.ts);

    } catch (e) {
        console.error("Blockchain Sync Error:", e);
        return [];
    }
}
async function fetchLeadershipData(address) {
    try {
        let activeContract = window.contract || contract;
        if (!activeContract) {
            console.log("Waiting for contract connection...");
            return;
        }

        const [userData, extraData] = await Promise.all([
            activeContract.users(address),
            activeContract.usersExtra(address)
        ]);

        console.log("Diagnostic Data:", extraData);

        // --- MAPPING FIX (Indices 11 and 12 for Business) ---
        // Humne saare fallbacks barkarar rakhe hain
        const finalRawPower = extraData.maxLegBusiness || extraData[10] || extraData[11] || 0;
        const finalRawTotal = extraData.totalTeamBusiness || extraData[11] || extraData[12] || 0;
        
        // Rank Index (Aapki ABI ke mutabiq Index 9 ya 10 par rank hai)
        const rankIndex = Number(extraData.rank || extraData[9] || extraData[10] || 0);
        const rawUnclaimedRank = extraData.rewardsRank || extraData[2] || 0;
        const rawTotalEarnings = userData.totalEarnings || userData[8] || 0;

        // --- CONVERSION ---
        const powerLegBNB = parseFloat(ethers.utils.formatEther(finalRawPower.toString()));
        const totalBusBNB = parseFloat(ethers.utils.formatEther(finalRawTotal.toString()));
        
        // Other Legs Calculation: Total - Strong Leg
        const otherLegsBNB = Math.max(0, totalBusBNB - powerLegBNB);

        // --- UI UPDATES HELPER ---
        const update = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.innerText = text;
        };

        // --- DYNAMIC TARGET LOGIC (Fixed for Progressive Bars) ---
        const currentRank = RANK_DETAILS[rankIndex] || RANK_DETAILS[0];
        
        // Agla target set karne ke liye: Agar rank 0 hai to target V1, agar 1 hai to target V2
        let nextIdx = rankIndex + 1;
        if (nextIdx > 6) nextIdx = 6; // Max rank V6 tak hi target dikhaye
        const targetRank = RANK_DETAILS[nextIdx];

        // Numbers display
        update('rank-display', currentRank.name);
        update('rank-bonus-display', `Reward: ${currentRank.reward}`);
        update('power-leg-volume', powerLegBNB.toFixed(4)); 
        update('other-legs-volume', otherLegsBNB.toFixed(4));
        
        update('rank-reward-available', parseFloat(ethers.utils.formatEther(rawUnclaimedRank.toString())).toFixed(4));
        update('total-rank-earned', parseFloat(ethers.utils.formatEther(rawTotalEarnings.toString())).toFixed(4));
        
        // Progress Info (Milestone targets)
        update('next-rank-display', targetRank.name);
        update('current-power-val', powerLegBNB.toFixed(4));
        update('target-power-val', `${targetRank.powerReq} BNB`);
        update('current-other-val', otherLegsBNB.toFixed(4));
        update('target-other-val', `${targetRank.otherReq} BNB`);

        // --- PROGRESS BAR CALCULATION (Based on Next Target) ---
        const pPercent = Math.min((powerLegBNB / targetRank.powerReq) * 100, 100) || 0;
        const oPercent = Math.min((otherLegsBNB / targetRank.otherReq) * 100, 100) || 0;

        update('power-progress-percent', `${Math.floor(pPercent)}%`);
        update('other-progress-percent', `${Math.floor(oPercent)}%`);

        const pBar = document.getElementById('power-progress-bar');
        const oBar = document.getElementById('other-progress-bar');
        
        if (pBar) {
            pBar.style.width = `${pPercent}%`;
            pBar.style.height = "100%"; 
            pBar.style.minHeight = "8px"; 
            pBar.style.transition = "width 0.5s ease-in-out"; // Smooth animation
        }
        if (oBar) {
            oBar.style.width = `${oPercent}%`;
            oBar.style.height = "100%"; 
            oBar.style.minHeight = "8px";
            oBar.style.transition = "width 0.5s ease-in-out";
        }

        if (typeof loadLeadershipDownlines === "function") {
            loadLeadershipDownlines(address);
        }

        console.log("UI Updated: Target is", targetRank.name, "Progress:", pPercent.toFixed(2) + "%");

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

        // Initial Loading State
        tableBody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-yellow-500 italic animate-pulse">Loading direct partners...</td></tr>`;

        // 1. Fetch Level 1 Partners
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
                // 2. Fetch Partner's Data (Users & UsersExtra)
                const [dUser, dExtra] = await Promise.all([
                    activeContract.users(uA),
                    activeContract.usersExtra(uA)
                ]);
                
                // 3. Precise Calculations (Matching Dashboard Logic)
                const partnerPersonal = parseFloat(ethers.utils.formatEther(dUser.totalActiveDeposit || 0));
                
                // Partner ka apna Power Leg aur Total Business
                const pPowerLegBNB = parseFloat(ethers.utils.formatEther(dExtra.maxLegBusiness || 0));
                const pTotalBusBNB = parseFloat(ethers.utils.formatEther(dExtra.totalTeamBusiness || 0));
                
                // Important: Partner ka total volume = uska personal + uska total team business
                const partnerTotalVolume = partnerPersonal + pTotalBusBNB;
                
                // Partner ki Other Legs (Total - Power)
                const pOtherLegsBNB = Math.max(0, pTotalBusBNB - pPowerLegBNB);

                // 4. Rank Details mapping
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
        // --- TRUST WALLET CONNECTION FIX ---
        let activeSigner = window.signer || signer;
        let activeContract = window.contract || contract;

        // Agar signer ya contract missing hai (jaisa mobile browser mein hota hai)
        if (!activeSigner || !activeContract) {
            if (window.ethereum) {
                const tempProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
                activeSigner = tempProvider.getSigner();
                activeContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, activeSigner);
                
                // Future use ke liye save kar lein
                window.signer = activeSigner;
                window.contract = activeContract;
            } else {
                return; // No wallet found
            }
        }

        // Agar address parameter mein nahi aaya, toh active signer se lein
        if (!address) {
            address = await activeSigner.getAddress();
        }

        // --- FETCH DATA (Stable Promise.all) ---
        const [user, extra, live] = await Promise.all([
            activeContract.users(address),
            activeContract.usersExtra(address),
            activeContract.getLiveBalance(address)
        ]);

        if (!user.registered) return;

        // Helper function for safe formatting (BNB 18 decimals)
        const formatVal = (val) => {
            if (!val) return "0.00";
            return typeof format === 'function' ? format(val) : ethers.utils.formatEther(val);
        };

        // --- UI UPDATES (Same as your logic) ---
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

        // --- LIVE BALANCE CALCULATIONS ---
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
        
        // --- STATUS & CP DISPLAY ---
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

        // Projected ROI logic
        if (typeof calculateGlobalROI === 'function') {
            const projectedReturn = (activeAmt * (calculateGlobalROI(activeAmt)/100)).toFixed(4);
            updateText('projected-return', projectedReturn);
        }
        
        // Rank logic
        if (typeof getRankName === 'function') {
            updateText('rank-display', getRankName(extra.rank));
        }

        // --- REFERRAL LINK LOGIC ---
        const currentUrl = window.location.href.split('?')[0];
        const baseUrl = currentUrl.includes('index.html') ? currentUrl.replace('index.html', 'register.html') : currentUrl + 'register.html';
        
        const refUrl = `${baseUrl}?ref=${user.username || address}`; 
        
        if(document.getElementById('refURL')) {
            document.getElementById('refURL').value = refUrl;
        }

    } catch (err) { 
        console.error("Data Fetch Error:", err); 
    }
}
window.loadLevelData = async function(level) {
    const tableBody = document.getElementById('team-table-body');
    if(!tableBody) return;
    
    // Initial Loading State
    tableBody.innerHTML = `<tr><td colspan="7" class="p-10 text-center text-yellow-500 italic animate-pulse">Scanning Level ${level} Blockchain...</td></tr>`;
    
    try {
        // 1. TRUST WALLET CONNECTION GUARD
        let activeSigner = window.signer || (typeof signer !== 'undefined' ? signer : null);
        let activeContract = window.contract || (typeof contract !== 'undefined' ? contract : null);

        if (!activeSigner || !activeContract) {
            if (window.ethereum) {
                const tempProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
                activeSigner = tempProvider.getSigner();
                activeContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, activeSigner);
                window.signer = activeSigner;
                window.contract = activeContract;
            } else {
                tableBody.innerHTML = `<tr><td colspan="7" class="p-10 text-center text-red-500">Wallet Not Connected</td></tr>`;
                return;
            }
        }

        const address = await activeSigner.getAddress();
        
        // 2. FETCH DATA (Using Tuple Fallbacks)
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

        // Helper for BNB formatting
        const formatVal = (val) => {
            const formatted = typeof format === 'function' ? format(val) : ethers.utils.formatEther(val);
            return parseFloat(formatted);
        };
        
        let html = '';
        for(let i=0; i < wallets.length; i++) {
            const uA = wallets[i];
            
            // Safety Check for empty addresses
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
        
        // 1. Current UTC time (in milliseconds)
        const nowUTC = now.getTime();
        
        // 2. 8 hours in milliseconds (Contract cycle duration)
        const eightHoursInMs = 8 * 60 * 60 * 1000;
        
        // 3. Agla target nikaalna jo 8-hour bucket mein fit ho (UTC 00, 08, 16)
        // Ye math.ceil se agla slot pakad lega (chahe kisi bhi desh mein ho)
        const nextTargetUTC = Math.ceil(nowUTC / eightHoursInMs) * eightHoursInMs;
        
        // 4. Time difference
        const diff = nextTargetUTC - nowUTC;

        if (diff <= 0) {
            // Jaise hi timer zero ho, dashboard refresh karein
            if (typeof fetchAllData === "function") {
                const accounts = localStorage.getItem('userAccount'); // ya jo bhi aapka address variable hai
                if(accounts) fetchAllData(accounts);
            }
            return;
        }

        // 5. Units mein convert karein (H:M:S)
        const h = Math.floor(diff / (1000 * 60 * 60)).toString().padStart(2, '0');
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
        const s = Math.floor((diff % (1000 * 60)) / 1000).toString().padStart(2, '0');

        // 6. Display update
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

















































