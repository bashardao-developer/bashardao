// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";


contract Dbashar is Initializable, UUPSUpgradeable, ERC20Upgradeable, ERC20PermitUpgradeable, ERC20VotesUpgradeable, OwnableUpgradeable, PausableUpgradeable {
    using SafeMathUpgradeable for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;
    IERC20Upgradeable public bashar;

    //highest staked users
    struct HighestAstaStaker {
        uint256 deposited;
        address addr;
    }
    mapping(uint256 => HighestAstaStaker[]) public highestStakerInPool;

    // Info of each user.
    struct UserInfo {
        uint256 amount;     // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
        uint256 rewardBASHARDebt; // Reward debt in BASHAR.
        //
        // We do some fancy math here. Basically, any point in time, the amount of BASHAR
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accBASHARPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accBASHARPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20Upgradeable lpToken;           // Address of LP token contract.
        uint256 allocPoint;       // How many allocation points assigned to this pool. BASHARs to distribute per block.
        uint256 lastRewardBlock;  // Last block number that BASHARs distribution occurs.
        uint256 accBASHARPerShare; // Accumulated BASHARs per share, times 1e12. See below.
        uint256 lastTotalBASHARReward; // last total rewards
        uint256 lastBASHARRewardBalance; // last BASHAR rewards tokens
        uint256 totalBASHARReward; // total BASHAR rewards tokens
    }

    // The BASHAR TOKEN!
    IERC20Upgradeable public BASHAR;
    // admin address.
    address public adminAddress;
    // Bonus muliplier for early BASHAR makers.
    uint256 public constant BONUS_MULTIPLIER = 1;

    // Number of top staker stored

    uint256 public topStakerNumber;

    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Info of each user that stakes LP tokens.
    mapping (uint256 => mapping (address => UserInfo)) public userInfo;
    // Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint;
    // The block number when reward distribution start.
    uint256 public startBlock;
    // total BASHAR staked
    uint256 public totalBASHARStaked;
    // total BASHAR used for purchase land
    uint256 public totalBasharUsedForPurchase;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event AdminUpdated(address newAdmin);

    function initialize(        
        IERC20Upgradeable _bashar,
        address _adminAddress,
        uint256 _startBlock,
        uint256 _topStakerNumber
        ) public initializer {
        require(_adminAddress != address(0), "initialize: Zero address");
        OwnableUpgradeable.__Ownable_init();
        __ERC20_init_unchained("dBASHAR", "dBASHAR");
        __Pausable_init_unchained();
        ERC20PermitUpgradeable.__ERC20Permit_init("dBASHAR");
        ERC20VotesUpgradeable.__ERC20Votes_init_unchained();
        BASHAR = _bashar;
        adminAddress = _adminAddress;
        startBlock = _startBlock;
        topStakerNumber = _topStakerNumber;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // Add a new lp to the pool. Can only be called by the owner.
    // XXX DO NOT add the same LP token more than once. Rewards will be messed up if you do.
    function add(uint256 _allocPoint, IERC20Upgradeable _lpToken, bool _withUpdate) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(PoolInfo({
            lpToken: _lpToken,
            allocPoint: _allocPoint,
            lastRewardBlock: lastRewardBlock,
            accBASHARPerShare: 0,
            lastTotalBASHARReward: 0,
            lastBASHARRewardBalance: 0,
            totalBASHARReward: 0
        }));
    }

    // Update the given pool's BASHAR allocation point. Can only be called by the owner.
    function set(uint256 _pid, uint256 _allocPoint, bool _withUpdate) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);
        poolInfo[_pid].allocPoint = _allocPoint;
    }
    
    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) public pure returns (uint256) {
        if (_to >= _from) {
            return _to.sub(_from).mul(BONUS_MULTIPLIER);
        } else {
            return _from.sub(_to);
        }
    }
    
    // View function to see pending BASHARs on frontend.
    function pendingBASHAR(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accBASHARPerShare = pool.accBASHARPerShare;
        uint256 lpSupply = totalBASHARStaked;
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 rewardBalance = pool.lpToken.balanceOf(address(this)).sub(totalBASHARStaked.sub(totalBasharUsedForPurchase));
            uint256 _totalReward = rewardBalance.sub(pool.lastBASHARRewardBalance);
            accBASHARPerShare = accBASHARPerShare.add(_totalReward.mul(1e12).div(lpSupply));
        }
        return user.amount.mul(accBASHARPerShare).div(1e12).sub(user.rewardBASHARDebt);
    }

    // Update reward variables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 rewardBalance = pool.lpToken.balanceOf(address(this)).sub(totalBASHARStaked.sub(totalBasharUsedForPurchase));
        uint256 _totalReward = pool.totalBASHARReward.add(rewardBalance.sub(pool.lastBASHARRewardBalance));
        pool.lastBASHARRewardBalance = rewardBalance;
        pool.totalBASHARReward = _totalReward;
        
        uint256 lpSupply = totalBASHARStaked;
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            pool.accBASHARPerShare = 0;
            pool.lastTotalBASHARReward = 0;
            user.rewardBASHARDebt = 0;
            pool.lastBASHARRewardBalance = 0;
            pool.totalBASHARReward = 0;
            return;
        }
        
        uint256 reward = _totalReward.sub(pool.lastTotalBASHARReward);
        pool.accBASHARPerShare = pool.accBASHARPerShare.add(reward.mul(1e12).div(lpSupply));
        pool.lastTotalBASHARReward = _totalReward;
    }

    /**
    @notice Sorting the highest BASHAR staker in pool
    @param _pid : pool id
    @param left : left
    @param right : right
    @dev Description :
        It is used for sorting the highest BASHAR staker in pool. This function definition is marked
        "internal" because this function is called only from inside the contract.
    */
    function quickSort(
        uint256 _pid,
        uint256 left,
        uint256 right
    ) internal {
        HighestAstaStaker[] storage arr = highestStakerInPool[_pid];
        if (left >= right) return;
        uint256 divtwo = 2;
        uint256 p = arr[(left + right) / divtwo].deposited; // p = the pivot element
        uint256 i = left;
        uint256 j = right;
        while (i < j) {
            // HighestAstaStaker memory a;
            // HighestAstaStaker memory b;
            while (arr[i].deposited < p) ++i;
            while (arr[j].deposited > p) --j; // arr[j] > p means p still to the left, so j > 0
            if (arr[i].deposited > arr[j].deposited) {
                (arr[i].deposited, arr[j].deposited) = (
                    arr[j].deposited,
                    arr[i].deposited
                );
                (arr[i].addr, arr[j].addr) = (arr[j].addr, arr[i].addr);
            } else ++i;
        }
        // Note --j was only done when a[j] > p.  So we know: a[j] == p, a[<j] <= p, a[>j] > p
        if (j > left) quickSort(_pid, left, j - 1); // j > left, so j > 0
        quickSort(_pid, j + 1, right);
    }
    /**
    @notice store Highest 50 staked users
    @param _pid : pool id
    @param _amount : amount
    @dev Description :
    DAO governance will be performed by the top 50 wallets with the highest amount of staked BASHAR tokens.
    */
    function addHighestStakedUser(
        uint256 _pid,
        uint256 _amount,
        address user
    ) private {
        uint256 i;
        // Getting the array of Highest staker as per pool id.
        HighestAstaStaker[] storage highestStaker = highestStakerInPool[_pid];
        //for loop to check if the staking address exist in array
        for (i = 0; i < highestStaker.length; i++) {
            if (highestStaker[i].addr == user) {
                highestStaker[i].deposited = _amount;
                // Called the function for sorting the array in ascending order.
                quickSort(_pid, 0, highestStaker.length - 1);
                return;
            }
        }

        if (highestStaker.length < topStakerNumber) {
            // Here if length of highest staker is less than 100 than we just push the object into array.
            highestStaker.push(HighestAstaStaker(_amount, user));
            quickSort(_pid, 0, highestStaker.length - 1);
        } else {
            // Otherwise we check the last staker amount in the array with new one.
            if (highestStaker[0].deposited < _amount) {
                // If the last staker deposited amount is less than new then we put the greater one in the array.
                highestStaker[0].deposited = _amount;
                highestStaker[0].addr = user;
                // Called the function for sorting the array in ascending order.
                quickSort(_pid, 0, highestStaker.length - 1);
            }
        }
    }

    /**
    @notice BASHAR staking track the Highest 50 staked users
    @param _pid : pool id
    @param user : user address
    @dev Description :
    DAO governance will be performed by the top 50 wallets with the highest amount of staked BASHAR tokens. 
    */
    function checkHighestStaker(uint256 _pid, address user)
        public
        view
        returns (bool)
    {
        HighestAstaStaker[] storage highestStaker = highestStakerInPool[_pid];
        uint256 i = 0;
        // Applied the loop to check the user in the highest staker list.
        for (i; i < highestStaker.length; i++) {
            if (highestStaker[i].addr == user) {
                // If user is exists in the list then we return true otherwise false.
                return true;
            }
        }
    }

    // Deposit BASHAR tokens to MasterChef.
    function deposit(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        if (user.amount > 0) {

            uint256 basharReward = user.amount.mul(pool.accBASHARPerShare).div(1e12).sub(user.rewardBASHARDebt);
            pool.lpToken.safeTransfer(msg.sender, basharReward);
            pool.lastBASHARRewardBalance = pool.lpToken.balanceOf(address(this)).sub(totalBASHARStaked.sub(totalBasharUsedForPurchase));
        }
        pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
        totalBASHARStaked = totalBASHARStaked.add(_amount);
        user.amount = user.amount.add(_amount);
        user.rewardBASHARDebt = user.amount.mul(pool.accBASHARPerShare).div(1e12);
        addHighestStakedUser(_pid, user.amount, msg.sender);
        _mint(msg.sender,_amount);
        emit Deposit(msg.sender, _pid, _amount);
    }

    function withdraw(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");
        updatePool(_pid);

        uint256 basharReward = user.amount.mul(pool.accBASHARPerShare).div(1e12).sub(user.rewardBASHARDebt);
        pool.lpToken.safeTransfer(msg.sender, basharReward);
        pool.lastBASHARRewardBalance = pool.lpToken.balanceOf(address(this)).sub(totalBASHARStaked.sub(totalBasharUsedForPurchase));

        user.amount = user.amount.sub(_amount);
        totalBASHARStaked = totalBASHARStaked.sub(_amount);
        user.rewardBASHARDebt = user.amount.mul(pool.accBASHARPerShare).div(1e12);
        pool.lpToken.safeTransfer(address(msg.sender), _amount);
        removeHighestStakedUser(_pid, user.amount, msg.sender);
        _burn(msg.sender,_amount);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Update the staker details in case of withdrawal
    function removeHighestStakedUser(uint256 _pid, uint256 _amount, address user) private {
        // Getting Highest staker list as per the pool id
        HighestAstaStaker[] storage highestStaker = highestStakerInPool[_pid];
        // Applied this loop is just to find the staker
        for (uint256 i = 0; i < highestStaker.length; i++) {
            if (highestStaker[i].addr == user) {
                // Deleting the staker from the array.
                delete highestStaker[i];
                if(_amount > 0) {
                    // If amount is greater than 0 than we need to add this again in the highest staker list.
                    addHighestStakedUser(_pid, _amount, user);
                }
                return;
            }
        }
    }

    
    // Earn BASHAR tokens to MasterChef.
    function claimBASHAR(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        
        uint256 basharReward = user.amount.mul(pool.accBASHARPerShare).div(1e12).sub(user.rewardBASHARDebt);
        pool.lpToken.safeTransfer(msg.sender, basharReward);
        pool.lastBASHARRewardBalance = pool.lpToken.balanceOf(address(this)).sub(totalBASHARStaked.sub(totalBasharUsedForPurchase));
        
        user.rewardBASHARDebt = user.amount.mul(pool.accBASHARPerShare).div(1e12);
    }
    
    // Safe BASHAR transfer function to admin.
    function accessBASHARTokens(uint256 _pid, address _to, uint256 _amount) public {
        require(msg.sender == adminAddress, "sender must be admin address");
        require(totalBASHARStaked.sub(totalBasharUsedForPurchase) >= _amount, "Amount must be less than staked BASHAR amount");
        PoolInfo storage pool = poolInfo[_pid];
        uint256 BasharBal = pool.lpToken.balanceOf(address(this));
        if (_amount > BasharBal) {
            pool.lpToken.transfer(_to, BasharBal);
            totalBasharUsedForPurchase = totalBasharUsedForPurchase.add(BasharBal);
            emit EmergencyWithdraw(_to, _pid, BasharBal);
        } else {
            pool.lpToken.transfer(_to, _amount);
            totalBasharUsedForPurchase = totalBasharUsedForPurchase.add(_amount);
            emit EmergencyWithdraw(_to, _pid, _amount);
        }
    }
    // Update admin address by the previous admin.
    function admin(address _adminAddress) public {
        require(_adminAddress != address(0), "admin: Zero address");
        require(msg.sender == adminAddress, "admin: wut?");
        adminAddress = _adminAddress;
        emit AdminUpdated(_adminAddress);
    }

    function _mint(address to, uint256 amount)
        internal
        override(ERC20Upgradeable, ERC20VotesUpgradeable)
    {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount)
        internal
        override(ERC20Upgradeable, ERC20VotesUpgradeable)
    {
        super._burn(account, amount);
    }

    function _afterTokenTransfer(address from, address to, uint256 amount)
        internal
        override(ERC20Upgradeable, ERC20VotesUpgradeable)
    {
        ERC20VotesUpgradeable._afterTokenTransfer(from, to, amount);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        
        if(from == address(0) || to == address(0)){
            super._beforeTokenTransfer(from, to, amount);
        }else{
            revert("Non transferable token");
        }
    }

    function _delegate(address delegator, address delegatee) internal virtual override {
        require(!checkHighestStaker(0, delegator),"Top staker cannot delegate");
        super._delegate(delegator,delegatee);
    }

    function _authorizeUpgrade(address) internal view override {
        require(owner() == msg.sender, "Only owner can upgrade implementation");
    }



}