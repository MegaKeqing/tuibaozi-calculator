// 推豹子计算器核心逻辑

// 创建牌堆
function createDeck(counts) {
    let deck = [];
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < counts[i]; j++) {
            deck.push(i + 1); // 点数1-8
        }
    }
    return deck;
}

// 计算点数
function calcPoints(c1, c2) {
    if (c1 === c2) {
        return 10 + c1; // 豹子
    } else {
        return (c1 + c2) % 10; // 非豹子
    }
}

// Fisher-Yates洗牌算法
function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// 单次模拟
function simulateRound(deck) {
    const shuffled = shuffle(deck);
    
    // 发牌
    const dealer = [shuffled[0], shuffled[1]];
    const x = [shuffled[2], shuffled[3]];
    const y = [shuffled[4], shuffled[5]];
    const z = [shuffled[6], shuffled[7]];
    
    // 计算点数
    const dPts = calcPoints(dealer[0], dealer[1]);
    const xPts = calcPoints(x[0], x[1]);
    const yPts = calcPoints(y[0], y[1]);
    const zPts = calcPoints(z[0], z[1]);
    
    // 判断豹子
    const xLeopard = (x[0] === x[1]);
    const yLeopard = (y[0] === y[1]);
    const zLeopard = (z[0] === z[1]);
    
    // 判断胜负
    const xWin = xPts > dPts;
    const yWin = yPts > dPts;
    const zWin = zPts > dPts;
    
    // 统计获胜闲门数
    const winCount = (xWin ? 1 : 0) + (yWin ? 1 : 0) + (zWin ? 1 : 0);
    
    return {
        xWin, yWin, zWin,
        xLeopard, yLeopard, zLeopard,
        ermenWin: winCount >= 2,
        heiziWin: winCount === 3
    };
}

// 批量模拟（支持进度回调）
async function runSimulation(counts, nSimulations, progressCallback) {
    const deck = createDeck(counts);
    const totalCards = deck.length;
    
    if (totalCards < 8) {
        throw new Error('牌堆不足8张，无法发牌');
    }
    
    // 初始化计数器
    let stats = {
        xWin: 0, xLeopard: 0, xNormal: 0,
        yWin: 0, yLeopard: 0, yNormal: 0,
        zWin: 0, zLeopard: 0, zNormal: 0,
        ermen: 0, heizi: 0
    };
    
    // 分批计算以支持进度更新
    const batchSize = Math.max(1, Math.floor(nSimulations / 100));
    const batches = Math.ceil(nSimulations / batchSize);
    
    for (let b = 0; b < batches; b++) {
        const start = b * batchSize;
        const end = Math.min(start + batchSize, nSimulations);
        
        for (let i = start; i < end; i++) {
            const result = simulateRound(deck);
            
            // X门
            if (result.xWin) {
                stats.xWin++;
                if (result.xLeopard) stats.xLeopard++;
                else stats.xNormal++;
            }
            
            // Y门
            if (result.yWin) {
                stats.yWin++;
                if (result.yLeopard) stats.yLeopard++;
                else stats.yNormal++;
            }
            
            // Z门
            if (result.zWin) {
                stats.zWin++;
                if (result.zLeopard) stats.zLeopard++;
                else stats.zNormal++;
            }
            
            // 二门和黑子
            if (result.ermenWin) stats.ermen++;
            if (result.heiziWin) stats.heizi++;
        }
        
        // 更新进度
        if (progressCallback && b % 10 === 0) {
            progressCallback((b / batches) * 100);
            // 让出时间片更新UI
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
    
    // 转换为概率
    const n = nSimulations;
    return {
        totalCards,
        xWin: stats.xWin / n,
        xLeopard: stats.xLeopard / n,
        xNormal: stats.xNormal / n,
        yWin: stats.yWin / n,
        yLeopard: stats.yLeopard / n,
        yNormal: stats.yNormal / n,
        zWin: stats.zWin / n,
        zLeopard: stats.zLeopard / n,
        zNormal: stats.zNormal / n,
        ermen: stats.ermen / n,
        heizi: stats.heizi / n,
        // 平均概率
        avgWin: (stats.xWin + stats.yWin + stats.zWin) / (3 * n),
        avgLeopard: (stats.xLeopard + stats.yLeopard + stats.zLeopard) / (3 * n),
        avgNormal: (stats.xNormal + stats.yNormal + stats.zNormal) / (3 * n)
    };
}

// 计算理论豹子概率
function calcTheoryLeopard(counts, total) {
    if (total < 2) return 0;
    let pairs = 0;
    for (let c of counts) {
        if (c >= 2) {
            pairs += c * (c - 1) / 2;
        }
    }
    const totalPairs = total * (total - 1) / 2;
    return pairs / totalPairs;
}

// 计算期望收益
function calculateEV(results) {
    // 闲门：豹子赔2倍，非豹子赔1倍，输亏1倍
    const xEV = results.avgLeopard * 2 + results.avgNormal * 1 - (1 - results.avgWin) * 1;
    
    // 二门：胜赔1倍，输亏1倍
    const ermenEV = results.ermen * 1 - (1 - results.ermen) * 1;
    
    // 黑子：胜赔3倍，输亏1倍
    const heiziEV = results.heizi * 3 - (1 - results.heizi) * 1;
    
    return { xEV, ermenEV, heiziEV };
}

// 生成策略建议
function generateAdvice(evs, results) {
    const { xEV, ermenEV, heiziEV } = evs;
    const bets = [
        { name: '闲门', ev: xEV, winRate: results.avgWin },
        { name: '二门', ev: ermenEV, winRate: results.ermen },
        { name: '黑子', ev: heiziEV, winRate: results.heizi }
    ];
    
    // 按期望收益排序
    bets.sort((a, b) => b.ev - a.ev);
    
    let advice = '';
    if (bets[0].ev > 0) {
        advice = `<strong style="color: #00ff88;">推荐下注：${bets[0].name}</strong><br>`;
        advice += `期望收益：+${bets[0].ev.toFixed(4)}元（胜率${(bets[0].winRate * 100).toFixed(2)}%）<br><br>`;
        advice += `其他选择：<br>`;
        for (let i = 1; i < 3; i++) {
            const sign = bets[i].ev >= 0 ? '+' : '';
            advice += `${bets[i].name}：${sign}${bets[i].ev.toFixed(4)}元<br>`;
        }
    } else {
        advice = `<strong style="color: #ff6b6b;">警告：所有下注期望为负！</strong><br><br>`;
        advice += `损失最小：${bets[0].name}（${bets[0].ev.toFixed(4)}元）<br>`;
        advice += `建议：不下注或等待更好牌堆`;
    }
    
    return advice;
}

// 主计算函数
async function startCalculation() {
    const btn = document.getElementById('calcBtn');
    const progressArea = document.getElementById('progressArea');
    const progressText = document.getElementById('progressText');
    const progressFill = document.getElementById('progressFill');
    const resultsCard = document.getElementById('resultsCard');
    
    // 获取输入
    const counts = [];
    for (let i = 1; i <= 8; i++) {
        const val = parseInt(document.getElementById(`n${i}`).value) || 0;
        if (val < 0 || val > 4) {
            alert(`点数${i}的张数必须在0-4之间`);
            return;
        }
        counts.push(val);
    }
    
    const nSim = parseInt(document.getElementById('simCount').value) || 1000000;
    if (nSim < 1000) {
        alert('模拟次数至少1000次');
        return;
    }
    
    // 检查总牌数
    const totalCards = counts.reduce((a, b) => a + b, 0);
    if (totalCards < 8) {
        alert('牌堆总张数至少8张');
        return;
    }
    
    // 设置计算状态
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span>计算中...';
    progressArea.style.display = 'block';
    resultsCard.style.display = 'none';
    
    const startTime = performance.now();
    
    try {
        // 运行模拟
        const results = await runSimulation(counts, nSim, (pct) => {
            progressText.textContent = `模拟进度：${pct.toFixed(0)}%`;
            progressFill.style.width = `${pct}%`;
        });
        
        const endTime = performance.now();
        const calcTime = ((endTime - startTime) / 1000).toFixed(2);
        
        // 计算期望收益
        const evs = calculateEV(results);
        
        // 更新显示
        document.getElementById('totalCards').textContent = totalCards;
        document.getElementById('theoryLeopard').textContent = 
            (calcTheoryLeopard(counts, totalCards) * 100).toFixed(1) + '%';
        document.getElementById('calcTime').textContent = calcTime + 's';
        
        // 闲门结果
        document.getElementById('xWinRate').textContent = 
            (results.avgWin * 100).toFixed(2) + '%';
        document.getElementById('leopardWinRate').textContent = 
            (results.avgLeopard * 100).toFixed(2) + '%';
        document.getElementById('normalWinRate').textContent = 
            (results.avgNormal * 100).toFixed(2) + '%';
        
        const xEVClass = evs.xEV > 0 ? 'positive' : (evs.xEV < 0 ? 'negative' : 'neutral');
        document.getElementById('xEV').className = 'result-value ' + xEVClass;
        document.getElementById('xEV').textContent = 
            (evs.xEV >= 0 ? '+' : '') + evs.xEV.toFixed(4) + '元';
        
        // 二门结果
        document.getElementById('ermenRate').textContent = 
            (results.ermen * 100).toFixed(2) + '%';
        const ermenEVClass = evs.ermenEV > 0 ? 'positive' : (evs.ermenEV < 0 ? 'negative' : 'neutral');
        document.getElementById('ermenEV').className = 'result-value ' + ermenEVClass;
        document.getElementById('ermenEV').textContent = 
            (evs.ermenEV >= 0 ? '+' : '') + evs.ermenEV.toFixed(4) + '元';
        
        // 黑子结果
        document.getElementById('heiziRate').textContent = 
            (results.heizi * 100).toFixed(2) + '%';
        const heiziEVClass = evs.heiziEV > 0 ? 'positive' : (evs.heiziEV < 0 ? 'negative' : 'neutral');
        document.getElementById('heiziEV').className = 'result-value ' + heiziEVClass;
        document.getElementById('heiziEV').textContent = 
            (evs.heiziEV >= 0 ? '+' : '') + evs.heiziEV.toFixed(4) + '元';
        
        // 三门详情
        const detailsHtml = `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 0.85em;">
                <div style="text-align: center; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px;">
                    <div style="color: #ffd700; font-weight: bold;">X门</div>
                    <div>胜率: ${(results.xWin * 100).toFixed(2)}%</div>
                    <div>豹子: ${(results.xLeopard * 100).toFixed(2)}%</div>
                    <div>期望: ${(results.xLeopard * 2 + results.xNormal * 1 - (1 - results.xWin) * 1).toFixed(4)}</div>
                </div>
                <div style="text-align: center; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px;">
                    <div style="color: #ffd700; font-weight: bold;">Y门</div>
                    <div>胜率: ${(results.yWin * 100).toFixed(2)}%</div>
                    <div>豹子: ${(results.yLeopard * 100).toFixed(2)}%</div>
                    <div>期望: ${(results.yLeopard * 2 + results.yNormal * 1 - (1 - results.yWin) * 1).toFixed(4)}</div>
                </div>
                <div style="text-align: center; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px;">
                    <div style="color: #ffd700; font-weight: bold;">Z门</div>
                    <div>胜率: ${(results.zWin * 100).toFixed(2)}%</div>
                    <div>豹子: ${(results.zLeopard * 100).toFixed(2)}%</div>
                    <div>期望: ${(results.zLeopard * 2 + results.zNormal * 1 - (1 - results.zWin) * 1).toFixed(4)}</div>
                </div>
            </div>
        `;
        document.getElementById('detailsContent').innerHTML = detailsHtml;
        
        // 策略建议
        document.getElementById('strategyAdvice').innerHTML = generateAdvice(evs, results);
        
        // 显示结果
        resultsCard.style.display = 'block';
        progressArea.style.display = 'none';
        
        // 滚动到结果
        resultsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
    } catch (err) {
        alert('计算错误：' + err.message);
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.textContent = '开始计算';
    }
}

// 切换详情显示
function toggleDetails() {
    const details = document.getElementById('details');
    const btn = document.querySelector('.detail-btn');
    if (details.classList.contains('show')) {
        details.classList.remove('show');
        btn.textContent = '查看三门详情 ▼';
    } else {
        details.classList.add('show');
        btn.textContent = '隐藏三门详情 ▲';
    }
}

// PWA安装功能
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('installBtn').style.display = 'block';
});

async function installPWA() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
        document.getElementById('installBtn').style.display = 'none';
    }
    deferredPrompt = null;
}

// 注册Service Worker（PWA离线支持）
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => {
        console.log('Service Worker注册失败:', err);
    });
}

// 键盘快捷键
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        startCalculation();
    }
});